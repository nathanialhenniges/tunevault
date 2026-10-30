import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  utilityProcess,
  nativeTheme,
  nativeImage,
  protocol,
  net,
  safeStorage,
  clipboard,
} from "electron";
import { join, resolve, dirname, basename, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { release } from "node:os";
import { spawn } from "node:child_process";
import { UpdateService } from "../update/service";
import { updateOptions } from "../update/config";
import { Credentials } from "./credentials";
import { FileGrants } from "./permissions";
import { CURRENT_DISCLAIMER_VERSION } from "../shared/types";

const toolPids = new Set<number>();
function stopTool(pid: number) {
  if (process.platform === "win32")
    spawn(
      join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe"),
      ["/PID", String(pid), "/T", "/F"],
      { windowsHide: true },
    ).on("error", () => {});
  else
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      /* Already exited. */
    }
}

if (process.env.TUNEVAULT_TEST_DATA) {
  if (!app.isPackaged || process.env.TUNEVAULT_E2E === "1")
    app.setPath("userData", resolve(process.env.TUNEVAULT_TEST_DATA));
}
app.setName("TuneVault");
app.setAppUserModelId("com.nathanialhenniges.tunevault");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "tunevault-art",
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  },
]);
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
let window: BrowserWindow | null = null;
const grants = new FileGrants();
const pending = new Map<
  string,
  {
    resolve: (v: any) => void;
    reject: (e: Error) => void;
    timeout: NodeJS.Timeout;
  }
>();
let worker: Electron.UtilityProcess;
let expectedUrl: string;
let credentials: Credentials | null = null;
const commands = new Set([
  "snapshot",
  "settings.update",
  "import.preview",
  "import.start",
  "tracks.edit",
  "tracks.undo",
  "tracks.favorite",
  "tracks.artwork",
  "tracks.placeholder",
  "tracks.relink",
  "playlists.create",
  "playlists.update",
  "playlists.add",
  "playlists.reorder",
  "playlists.remove",
  "references.import",
  "references.attach",
  "references.skip",
  "source.preview",
  "source.search",
  "source.acquire",
  "playlists.refreshPreview",
  "playlists.refreshApply",
  "targets.create",
  "targets.testPack",
  "targets.update",
  "export.preview",
  "export.prepare",
  "export.confirm",
  "jobs.cancel",
  "jobs.retry",
  "mixes.parse",
  "mixes.split",
  "description.export",
  "lookup.search",
  "lookup.cancel",
  "lookup.apply",
  "lookup.artworkPreview",
  "lookup.artworkApply",
  "artwork.preview",
  "artwork.placeholderPreview",
  "backup",
  "restore",
  "diagnostics",
]);
function command(action: string, input?: unknown): Promise<any> {
  return new Promise((yes, no) => {
    const id = randomUUID();
    const timeout = setTimeout(
      () => {
        pending.delete(id);
        no(
          new Error("The operation timed out; check Activity before retrying"),
        );
      },
      30 * 60 * 1000,
    );
    pending.set(id, { resolve: yes, reject: no, timeout });
    worker.postMessage({ id, action, input });
  });
}
function validateSender(event: Electron.IpcMainInvokeEvent) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    event.senderFrame.url !== expectedUrl
  )
    throw new Error("Untrusted request");
}
async function picker(kind: string): Promise<any> {
  const folder = [
    "chooseVault",
    "chooseTargetFolder",
    "chooseImportFolder",
    "chooseBackup",
    "chooseRestore",
  ].includes(kind);
  const result = await dialog.showOpenDialog(window!, {
    title: folder ? "Choose folder" : "Choose files",
    properties: folder
      ? ["openDirectory"]
      : kind === "chooseImport"
        ? ["openFile", "multiSelections"]
        : ["openFile"],
    ...(kind === "chooseArtwork"
      ? {
          filters: [
            { name: "Artwork", extensions: ["png", "jpg", "jpeg", "webp"] },
          ],
        }
      : kind === "chooseReference"
        ? {
            filters: [
              {
                name: "Playlist references",
                extensions: ["csv", "tsv", "m3u", "m3u8", "json", "xml"],
              },
            ],
          }
        : {}),
  });
  const paths = await Promise.all(
    result.filePaths.map((path) => grants.grant(path)),
  );
  return kind === "chooseImport" ? paths : (paths[0] ?? null);
}
// Suggests a folder under the user's Music folder. Main chooses the path, so it
// is granted like a native dialog choice; it is only created when requested.
async function defaultFolder(input: any) {
  const kind = input?.kind;
  if (kind !== "vault" && kind !== "export")
    throw new Error("Unknown default folder");
  let name = [...(typeof input?.name === "string" ? input.name : "")]
    .map((c) => (c.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(c) ? " " : c))
    .join("")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 80);
  if (!name || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name)) name = "Player";
  const folder = join(
    app.getPath("music"),
    "TuneVault",
    ...(kind === "vault" ? ["Library"] : ["Exports", name]),
  );
  let selected = folder;
  if (input?.create) {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(folder, { recursive: true });
    selected = await grants.grant(folder);
  }
  return input?.info ? folderInfo(selected) : selected;
}
async function folderInfo(path: string) {
  const { stat, statfs } = await import("node:fs/promises");
  const exists = await stat(path)
    .then((info) => info.isDirectory())
    .catch(() => false);
  let ancestor = path;
  for (;;) {
    try {
      if ((await stat(ancestor)).isDirectory()) {
        const space = await statfs(ancestor);
        return {
          path,
          exists,
          availableBytes: Number(space.bavail) * Number(space.bsize),
        };
      }
    } catch {
      /* The suggested folder may not exist yet; measure its existing volume. */
    }
    const parent = dirname(ancestor);
    if (parent === ancestor) return { path, exists, availableBytes: null };
    ancestor = parent;
  }
}
// Windows caption buttons match the page background of the active theme.
function captionOverlay() {
  const dark = nativeTheme.shouldUseDarkColors;
  return {
    color: dark ? "#18191b" : "#ffffff",
    symbolColor: dark ? "#ededf0" : "#24262a",
    height: 40,
  };
}
async function checkPaths(action: string, input: any) {
  if (["import.preview", "import.start"].includes(action)) {
    if (!Array.isArray(input?.paths) || input.paths.length > 10000)
      throw new Error("Invalid import selection");
    await Promise.all(input.paths.map((path: unknown) => grants.require(path)));
  }
  if (action === "settings.update" && input?.vault !== undefined)
    await grants.require(input.vault);
  if (
    ["targets.create", "targets.update"].includes(action) &&
    input?.destination !== undefined
  )
    await grants.require(input.destination);
  if (
    [
      "tracks.artwork",
      "artwork.preview",
      "tracks.relink",
      "restore",
      "backup",
    ].includes(action)
  )
    await grants.require(input?.path);
}
app
  .whenReady()
  .then(async () => {
    worker = utilityProcess.fork(join(__dirname, "worker.js"), [], {
      serviceName: "TuneVault library",
    });
    worker.on("message", (message: any) => {
      if (Number.isSafeInteger(message.toolPid) && message.toolPid > 0) {
        if (message.started) toolPids.add(message.toolPid);
        else toolPids.delete(message.toolPid);
        return;
      }
      if (message.changed) {
        window?.webContents.send("tunevault:changed");
        return;
      }
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timeout);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error));
      else request.resolve(message.result);
    });
    worker.on("exit", () => {
      for (const pid of toolPids) stopTool(pid);
      toolPids.clear();
      for (const request of pending.values()) {
        clearTimeout(request.timeout);
        request.reject(
          new Error(
            "Library process stopped. Reopen TuneVault to recover interrupted jobs.",
          ),
        );
      }
      pending.clear();
    });
    const runtime = await command("__init", {
      dataDir: join(app.getPath("userData"), "library"),
      toolsDir: app.isPackaged
        ? join(process.resourcesPath, "tools")
        : resolve("resources/tools", `${process.platform}-${process.arch}`),
    });
    credentials = new Credentials(
      app.getPath("userData"),
      app.getPath("temp"),
      safeStorage,
    );
    await command("__cookies", { path: await credentials.initialize() });
    const initial = await command("snapshot");
    let appearance: "system" | "light" | "dark" = initial.settings.appearance;
    let accent: "blue" | "orange" = initial.settings.accent;
    nativeTheme.themeSource = appearance;
    let glass: typeof import("electron-liquid-glass").default | null = null;
    if (
      process.platform === "darwin" &&
      Number(process.getSystemVersion().split(".")[0]) >= 26
    ) {
      try {
        glass = (await import("electron-liquid-glass")).default;
      } catch {
        /* Optional native material falls back to opaque chrome. */
      }
    }
    let nativeGlass = false;
    const glassActive = () =>
      nativeGlass &&
      !nativeTheme.prefersReducedTransparency &&
      !nativeTheme.shouldUseHighContrastColors;
    ipcMain.on("tunevault:appearance", (event) => {
      event.returnValue = {
        appearance,
        accent,
        nativeGlass: glassActive(),
        systemDark: nativeTheme.shouldUseDarkColors,
      };
    });
    const icon = nativeImage.createFromPath(
      app.isPackaged
        ? join(process.resourcesPath, "icon.png")
        : resolve("resources/icon.png"),
    );
    app.setAboutPanelOptions({
      applicationName: "TuneVault",
      applicationVersion: app.getVersion(),
      // An empty build version stops macOS from repeating the version in brackets.
      version: "",
      copyright: "Copyright © 2026 Nathanial Henniges",
      credits:
        "Local music library and portable-player exports.\nMIT License. Bundled tools keep their own licenses: see Help › Third-Party Notices.",
      website: "https://github.com/nathanialhenniges/tunevault",
      iconPath: app.isPackaged
        ? join(process.resourcesPath, "icon.png")
        : resolve("resources/icon.png"),
    });
    if (!app.isPackaged) app.dock?.setIcon(icon);
    let supportPreview: {
      token: string;
      text: string;
      createdAt: number;
    } | null = null;
    let jobsActive = false;
    let updateDownloading = false;
    const updates = new UpdateService({
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      osVersion:
        process.platform === "darwin" ? process.getSystemVersion() : release(),
      cacheDir: join(app.getPath("userData"), "updates"),
      ...updateOptions(),
      jobsActive: () => jobsActive,
    });
    protocol.handle("tunevault-art", async (request) => {
      try {
        const url = new URL(request.url);
        if (
          url.hostname !== "track" ||
          !/^\/[a-zA-Z0-9-]{1,100}$/.test(url.pathname)
        )
          return new Response("Invalid artwork", { status: 400 });
        const result = await command("artwork.get", {
          id: url.pathname.slice(1),
        });
        if (!result?.path) return new Response("No artwork", { status: 404 });
        return net.fetch(pathToFileURL(result.path).href);
      } catch {
        return new Response("Artwork unavailable", { status: 404 });
      }
    });
    window = new BrowserWindow({
      show: false,
      width: 1440,
      height: 900,
      minWidth: 720,
      minHeight: 520,
      title: "TuneVault",
      icon,
      // Content runs under the title bar: inset traffic lights on macOS,
      // native caption buttons overlaid on Windows.
      ...(process.platform === "darwin"
        ? {
            titleBarStyle: "hiddenInset" as const,
            trafficLightPosition: { x: 18, y: 18 },
          }
        : {
            titleBarStyle: "hidden" as const,
            titleBarOverlay: captionOverlay(),
          }),
      transparent: !!glass,
      backgroundColor: glass
        ? "#00000000"
        : nativeTheme.shouldUseDarkColors
          ? "#161719"
          : "#ffffff",
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });
    if (glass) {
      try {
        nativeGlass =
          glass.addView(window.getNativeWindowHandle(), {
            cornerRadius: 12,
            opaque: false,
          }) >= 0;
      } catch {
        nativeGlass = false;
      }
      window.setWindowButtonVisibility(true);
    }
    const updateMaterial = () => {
      const active = glassActive();
      window?.setBackgroundColor(
        active
          ? "#00000000"
          : nativeTheme.shouldUseDarkColors
            ? "#18191b"
            : "#ffffff",
      );
      if (process.platform !== "darwin")
        window?.setTitleBarOverlay(captionOverlay());
      window?.webContents.send("tunevault:materials", active);
      window?.webContents.send(
        "tunevault:system-theme",
        nativeTheme.shouldUseDarkColors,
      );
    };
    nativeTheme.on("updated", updateMaterial);
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      if (url !== expectedUrl) event.preventDefault();
    });
    window.webContents.session.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    ipcMain.handle("tunevault:drop", async (event, paths: unknown) => {
      validateSender(event);
      if (
        !Array.isArray(paths) ||
        paths.length > 10000 ||
        paths.some((path) => typeof path !== "string")
      )
        throw new Error("Invalid drop");
      return Promise.all(paths.map((path) => grants.grant(path)));
    });
    ipcMain.handle(
      "tunevault:command",
      async (event, action: unknown, raw?: unknown) => {
        validateSender(event);
        if (
          typeof action !== "string" ||
          JSON.stringify(raw ?? {}).length > 4_000_000
        )
          throw new Error("Invalid request");
        if (
          [
            "chooseImport",
            "chooseImportFolder",
            "chooseVault",
            "chooseTargetFolder",
            "chooseArtwork",
            "chooseBackup",
            "chooseRestore",
            "chooseReference",
          ].includes(action)
        )
          return picker(action);
        if (action === "defaultFolder") return defaultFolder(raw);
        if (action === "vault.status") {
          const state = await command("snapshot");
          const path = state.settings.vault;
          if (!path)
            return { path: "", available: false, availableBytes: null };
          const info = await folderInfo(path);
          return {
            path: info.path,
            available: info.exists,
            availableBytes: info.exists ? info.availableBytes : null,
          };
        }
        if (action === "references.readFile") {
          const { readFile, stat, realpath } = await import("node:fs/promises");
          await grants.require((raw as any)?.path);
          const path = await realpath((raw as any).path);
          const extension = extname(path).toLowerCase();
          const format = (
            {
              ".csv": "csv",
              ".tsv": "tsv",
              ".m3u": "m3u",
              ".m3u8": "m3u",
              ".json": "spotify-json",
              ".xml": "apple-xml",
            } as Record<string, string>
          )[extension];
          if (!format)
            throw new Error(
              "Choose a CSV, TSV, M3U, Spotify JSON or Apple XML playlist export",
            );
          const info = await stat(path);
          if (!info.isFile() || info.size > 8 * 1024 * 1024)
            throw new Error(
              "Playlist reference file must be a regular file no larger than 8 MiB",
            );
          const bytes = await readFile(path);
          if (bytes.length > 8 * 1024 * 1024)
            throw new Error("Playlist reference file exceeds 8 MiB");
          let text: string;
          try {
            text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          } catch {
            throw new Error("Playlist reference file must use UTF-8 text");
          }
          return { path, name: basename(path, extname(path)), format, text };
        }
        const input = raw as any;
        if (action === "diagnostics.preview") {
          const state = await command("snapshot");
          let toolVersions: Record<string, string>;
          try {
            const { readFile } = await import("node:fs/promises");
            const manifest = JSON.parse(
              await readFile(
                join(
                  app.isPackaged
                    ? join(process.resourcesPath, "tools")
                    : resolve(
                        "resources/tools",
                        `${process.platform}-${process.arch}`,
                      ),
                  "manifest.json",
                ),
                "utf8",
              ),
            );
            toolVersions = Object.fromEntries(
              manifest.entries
                .slice(0, 8)
                .map((tool: any) => [
                  String(tool.name).slice(0, 40),
                  String(tool.version).slice(0, 100),
                ]),
            );
          } catch {
            toolVersions = { bundle: "Manifest unavailable" };
          }
          const report = {
            app: "TuneVault",
            version: app.getVersion(),
            platform: process.platform,
            arch: process.arch,
            electron: process.versions.electron,
            node: runtime.node,
            packaged: app.isPackaged,
            tools: toolVersions,
            counts: {
              tracks: state.tracks.length,
              playlists: state.playlists.length,
              targets: state.targets.length,
              receipts: state.receipts.length,
            },
            jobs: Object.fromEntries(
              [
                "queued",
                "running",
                "completed",
                "failed",
                "cancelled",
                "interrupted",
              ].map((status) => [
                status,
                state.jobs.filter((job: any) => job.status === status).length,
              ]),
            ),
            privacy:
              "Contains counts and runtime/tool versions only. No library names, media, file paths, source URLs or credentials.",
          };
          supportPreview = {
            token: randomUUID(),
            text: JSON.stringify(report, null, 2) + "\n",
            createdAt: Date.now(),
          };
          return { token: supportPreview.token, text: supportPreview.text };
        }
        if (action === "diagnostics.export") {
          if (
            !supportPreview ||
            input?.token !== supportPreview.token ||
            Date.now() - supportPreview.createdAt > 300000
          )
            throw new Error("Preview the report again before saving");
          const reviewed = supportPreview.text;
          const selected = await dialog.showSaveDialog(window!, {
            title: "Save reviewed support report",
            defaultPath: "TuneVault-support.json",
            filters: [{ name: "JSON report", extensions: ["json"] }],
          });
          if (selected.canceled || !selected.filePath) return null;
          const { writeFile, rename, rm } = await import("node:fs/promises");
          const temporary = selected.filePath + "." + randomUUID() + ".partial";
          try {
            await writeFile(temporary, reviewed, { flag: "wx", mode: 0o600 });
            await rename(temporary, selected.filePath);
          } finally {
            await rm(temporary, { force: true });
          }
          return { saved: true };
        }
        if (action === "credentials.status") return credentials!.status();
        if (action === "credentials.disconnect") {
          const state = await command("snapshot");
          if (
            state.jobs.some((j: any) =>
              ["running", "queued"].includes(j.status),
            )
          )
            throw new Error(
              "Finish or cancel active jobs before disconnecting credentials",
            );
          await command("__cookies", { path: null });
          await credentials!.disconnect();
          return credentials!.status();
        }
        if (action === "credentials.connect") {
          const state = await command("snapshot");
          if (
            state.jobs.some((j: any) =>
              ["running", "queued"].includes(j.status),
            )
          )
            throw new Error(
              "Finish or cancel active jobs before changing credentials",
            );
          const consent = await dialog.showMessageBox(window!, {
            type: "warning",
            buttons: ["Cancel", "Choose exported cookies"],
            defaultId: 0,
            cancelId: 0,
            title: "Use YouTube account cookies?",
            message: "Cookies are account credentials.",
            detail:
              "Only choose intentionally exported YouTube/Google cookies from your own account. TuneVault stores an OS-encrypted copy, gives yt-dlp a temporary cookie file for YouTube requests, and removes it when you disconnect or quit. It never reads browser cookies automatically. Never share this file or include it in public issues.",
          });
          if (consent.response !== 1) return credentials!.status();
          const selected = await dialog.showOpenDialog(window!, {
            title: "Choose exported YouTube cookies",
            properties: ["openFile"],
            filters: [{ name: "Netscape cookies", extensions: ["txt"] }],
          });
          if (selected.canceled || !selected.filePaths[0])
            return credentials!.status();
          const { readFile, stat } = await import("node:fs/promises");
          const file = selected.filePaths[0];
          if ((await stat(file)).size > 1024 * 1024)
            throw new Error("Cookie file exceeds 1 MB");
          await command("__cookies", {
            path: await credentials!.connect(await readFile(file, "utf8")),
          });
          return credentials!.status();
        }
        if (action.startsWith("updates.")) {
          if (action === "updates.status") return updates.status();
          const state = await command("snapshot");
          jobsActive = state.jobs.some((job: any) =>
            ["queued", "running"].includes(job.status),
          );
          if (action === "updates.check") return updates.check();
          if (action === "updates.download") {
            if (updateDownloading)
              throw new Error("An update download is already active");
            updateDownloading = true;
            try {
              return await updates.download();
            } finally {
              updateDownloading = false;
            }
          }
          if (action === "updates.cancel") return updates.cancel();
          if (action === "updates.reveal")
            return shell.showItemInFolder(await updates.verifiedDownload());
          if (action === "updates.install") return updates.install();
          throw new Error("Unknown update command");
        }
        if (action === "description.copy") {
          const state = await command("snapshot");
          const track = state.tracks.find((t: any) => t.id === input?.id);
          if (!track) throw new Error("Unknown track");
          clipboard.writeText(
            (track.source?.description || track.metadata.comment || "").slice(
              0,
              200000,
            ),
          );
          return true;
        }
        if (action === "app.about") return app.showAboutPanel();
        if (action === "app.info")
          return {
            version: app.getVersion(),
            platform: process.platform,
            arch: process.arch,
            runtime,
            nativeGlass: glassActive(),
            packaged: app.isPackaged,
          };
        if (action === "openExternal") {
          const url = new URL(input?.url);
          if (
            url.protocol !== "https:" ||
            ![
              "github.com",
              "www.youtube.com",
              "youtube.com",
              "musicbrainz.org",
              "coverartarchive.org",
              "imazing.com",
            ].includes(url.hostname) ||
            url.username ||
            url.password
          )
            throw new Error("Unsupported external link");
          return shell.openExternal(url.href);
        }
        if (action === "reveal") {
          const snapshot = await command("snapshot");
          const path = input?.trackId
            ? snapshot.tracks.find((x: any) => x.id === input.trackId)?.path
            : input?.targetId
              ? input.batchId
                ? snapshot.jobs.find(
                    (job: any) =>
                      job.kind === "export" &&
                      job.payload.targetId === input.targetId &&
                      job.payload.batchId === input.batchId,
                  )?.payload.path
                : snapshot.targets.find((x: any) => x.id === input.targetId)
                    ?.destination
              : input?.path;
          const paths = [
            ...snapshot.tracks.map((x: any) => x.path),
            ...snapshot.receipts.map((x: any) => x.path),
            ...snapshot.targets.map((x: any) => x.destination),
            ...snapshot.jobs
              .filter((job: any) => job.kind === "export")
              .map((job: any) => job.payload.path),
            snapshot.settings.vault,
          ];
          if (!path || !paths.includes(path))
            throw new Error("Choose a library or export location");
          return shell.showItemInFolder(path);
        }
        if (action === "legal.read") {
          const name = input?.name;
          if (
            ![
              "terms-of-use",
              "privacy-policy",
              "third-party-notices",
              "install-update",
              "license",
            ].includes(name)
          )
            throw new Error("Unknown document");
          const { readFile } = await import("node:fs/promises");
          const file =
            name === "license" ? "LICENSE" : join("docs", `${name}.md`);
          return readFile(
            app.isPackaged ? join(process.resourcesPath, file) : resolve(file),
            "utf8",
          );
        }
        if (
          updateDownloading &&
          [
            "import.start",
            "source.acquire",
            "export.prepare",
            "mixes.split",
            "targets.testPack",
            "tracks.placeholder",
            "jobs.retry",
          ].includes(action)
        )
          throw new Error(
            "Finish or cancel the update download before starting media jobs",
          );
        if (!commands.has(action)) throw new Error("Unknown command");
        await checkPaths(action, input);
        const result = await command(action, input);
        if (action === "snapshot")
          jobsActive = result.jobs.some((job: any) =>
            ["running", "queued"].includes(job.status),
          );
        if (action === "settings.update") {
          appearance = result.appearance;
          accent = result.accent;
          nativeTheme.themeSource = appearance;
          updateMaterial();
        }
        return result;
      },
    );
    const mac = process.platform === "darwin";
    const send = (action: string) => () =>
      window?.webContents.send("tunevault:menu", action);
    const settingsItem = {
      label: mac ? "Settings…" : "Settings",
      accelerator: "CmdOrCtrl+,",
      click: send("settings"),
    };
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        ...(mac
          ? [
              {
                label: "TuneVault",
                submenu: [
                  { role: "about" as const },
                  { type: "separator" as const },
                  settingsItem,
                  {
                    label: "Check for Updates…",
                    click: send("settings:updates"),
                  },
                  { type: "separator" as const },
                  { role: "services" as const },
                  { type: "separator" as const },
                  { role: "hide" as const },
                  { role: "hideOthers" as const },
                  { role: "unhide" as const },
                  { type: "separator" as const },
                  { role: "quit" as const },
                ],
              },
            ]
          : []),
        {
          label: "File",
          submenu: [
            {
              label: "Add Music…",
              accelerator: "CmdOrCtrl+O",
              click: send("import"),
            },
            { type: "separator" },
            { label: "Back Up Library…", click: send("settings:library") },
            {
              label: "Restore from Backup…",
              click: send("settings:library"),
            },
            { type: "separator" },
            ...(mac
              ? [{ role: "close" as const }]
              : [
                  settingsItem,
                  { type: "separator" as const },
                  { role: "quit" as const, label: "Exit" },
                ]),
          ],
        },
        { role: "editMenu" },
        {
          label: "View",
          submenu: [
            // Reload and developer tools are for development builds only.
            ...(app.isPackaged
              ? []
              : [
                  { role: "reload" as const },
                  { role: "toggleDevTools" as const },
                  { type: "separator" as const },
                ]),
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
          ],
        },
        { role: "windowMenu" },
        {
          role: "help",
          submenu: [
            { label: "Welcome Guide…", click: send("welcome") },
            { label: "Install & Update Help", click: send("legal:install") },
            { type: "separator" },
            { label: "Privacy Policy", click: send("legal:privacy") },
            { label: "Terms of Use", click: send("legal:terms") },
            { label: "Third-Party Notices", click: send("legal:third-party") },
            { label: "License", click: send("legal:license") },
            { type: "separator" },
            {
              label: "Create Support Report…",
              click: send("settings:advanced"),
            },
            {
              label: "Report an Issue…",
              click: () =>
                shell.openExternal(
                  "https://github.com/nathanialhenniges/tunevault/issues",
                ),
            },
            ...(mac
              ? []
              : [
                  { type: "separator" as const },
                  {
                    label: "Check for Updates…",
                    click: send("settings:updates"),
                  },
                  { label: "About TuneVault", click: send("about") },
                ]),
          ],
        },
      ]),
    );
    expectedUrl =
      process.env.ELECTRON_RENDERER_URL ||
      pathToFileURL(join(__dirname, "../renderer/index.html")).href;
    window.webContents.on("page-title-updated", (event) => {
      event.preventDefault();
      window?.setTitle("TuneVault");
    });
    window.once("ready-to-show", () => {
      if (
        process.env.TUNEVAULT_E2E !== "1" ||
        process.env.TUNEVAULT_E2E_VISIBLE === "1"
      )
        window?.show();
    });
    await window.loadURL(expectedUrl);
    const autoCheck = setTimeout(async () => {
      try {
        const state = await command("snapshot");
        jobsActive = state.jobs.some((j: any) =>
          ["running", "queued"].includes(j.status),
        );
        if (
          state.settings.disclaimerAccepted &&
          state.settings.disclaimerVersion >= CURRENT_DISCLAIMER_VERSION &&
          state.settings.autoUpdates &&
          !jobsActive
        ) {
          await updates.check();
          window?.webContents.send("tunevault:changed");
        }
      } catch {
        /* Offline/update errors do not interrupt library use. */
      }
    }, 15000);
    autoCheck.unref();
  })
  .catch(async (error) => {
    dialog.showErrorBox(
      "TuneVault could not start",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  });
app.on("second-instance", () => {
  window?.show();
  window?.focus();
});
app.on("window-all-closed", () => app.quit());
let quitting = false;
app.on("before-quit", (event) => {
  if (quitting) return;
  quitting = true;
  event.preventDefault();
  void (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (worker)
        await Promise.race([
          command("__shutdown"),
          new Promise((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error("Shutdown timeout")),
              5000,
            );
          }),
        ]);
    } catch {
      /* Forced cleanup also covers an unresponsive utility process. */
    } finally {
      clearTimeout(timer);
      for (const pid of toolPids) stopTool(pid);
      toolPids.clear();
      try {
        credentials?.clearSessionSync();
      } catch {
        console.warn("Temporary credential cleanup will retry on next launch");
      }
      worker?.kill();
      app.quit();
    }
  })();
});
