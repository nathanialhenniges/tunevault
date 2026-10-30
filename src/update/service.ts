import { mkdir, rename, rm, open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  verifyArtifact,
  verifyEnvelope,
  verifyFeed,
  type UpdateContext,
  type VerifiedRelease,
} from "./verify";

const releaseRoot =
  "https://github.com/nathanialhenniges/tunevault/releases/latest/download/";
const redirectHosts = new Set([
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
]);

export class UpdateRequestError extends Error {
  constructor(readonly status: number) {
    super(`Update request failed (${status})`);
    this.name = "UpdateRequestError";
  }
}

const developmentPreview = {
  status: "development-preview",
  version: "99.0.0",
  notes:
    "Local development preview, not a real release. This illustrates update release notes without contacting GitHub. No update files can be downloaded or installed from this preview.",
};

async function updateResponse(
  url: string,
  max: number,
  signal?: AbortSignal,
): Promise<Response> {
  let current = new URL(url);
  for (let redirects = 0; redirects < 5; redirects++) {
    if (
      current.protocol !== "https:" ||
      !redirectHosts.has(current.hostname) ||
      current.username ||
      current.password ||
      current.port
    )
      throw new Error("Update URL host rejected");
    const headersTimeout = new AbortController();
    const timer = setTimeout(() => headersTimeout.abort(), 120_000);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: signal
          ? AbortSignal.any([signal, headersTimeout.signal])
          : headersTimeout.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Missing redirect location");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new UpdateRequestError(response.status);
    }
    if (Number(response.headers.get("content-length")) > max)
      throw new Error("Update response too large");
    return response;
  }
  throw new Error("Too many update redirects");
}

async function* responseChunks(response: Response) {
  const reader = response.body!.getReader();
  try {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          reader.read(),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
              reject(new Error("Update download stalled"));
              void reader.cancel();
            }, 120_000);
          }),
        ]);
        if (result.done) break;
        yield result.value;
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function boundedFetch(
  url: string,
  max: number,
  signal?: AbortSignal,
): Promise<Buffer> {
  const response = await updateResponse(url, max, signal);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const value of responseChunks(response)) {
    total += value.length;
    if (total > max) throw new Error("Update response exceeds limit");
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export class UpdateService {
  private release: VerifiedRelease | null = null;
  private downloaded: string | null = null;
  private cancellation: AbortController | null = null;
  private updater: import("electron-updater").NsisUpdater | null = null;
  private checked = false;
  private noRelease = false;
  constructor(
    private options: UpdateContext & {
      cacheDir: string;
      publicKeys: string[];
      jobsActive: () => boolean;
      development?: boolean;
      transport?: typeof boundedFetch;
      windowsUpdater?: () => Promise<import("electron-updater").NsisUpdater>;
    },
  ) {}

  status() {
    if (this.options.development)
      return this.checked
        ? { ...developmentPreview }
        : { status: "development" };
    return {
      status: this.cancellation
        ? "downloading"
        : this.downloaded
          ? this.options.platform === "darwin"
            ? "ready-for-manual-replacement"
            : "ready-to-install"
          : this.release
            ? "available"
            : this.noRelease
              ? "no-release"
              : !this.options.publicKeys.length
                ? "not-configured"
                : this.checked
                  ? "current"
                  : "unchecked",
      ...(this.release
        ? {
            version: this.release.envelope.version,
            notes: this.release.envelope.notes,
          }
        : {}),
      ...(this.downloaded ? { path: this.downloaded } : {}),
    };
  }

  async check(): Promise<{ status: string; version?: string; notes?: string }> {
    if (this.cancellation)
      throw new Error("An update download is already active");
    if (this.options.jobsActive())
      throw new Error(
        "Finish or cancel media jobs before checking for updates",
      );
    if (this.options.development) {
      this.checked = true;
      return this.status();
    }
    if (!this.options.publicKeys.length) return { status: "not-configured" };
    const transport = this.options.transport ?? boundedFetch;
    let bytes: Buffer;
    try {
      bytes = await transport(`${releaseRoot}release-envelope.json`, 128_000);
    } catch (error) {
      if (!(error instanceof UpdateRequestError) || error.status !== 404)
        throw error;
      this.release = null;
      this.downloaded = null;
      this.updater = null;
      this.checked = true;
      this.noRelease = true;
      return this.status();
    }
    const signatureText = await transport(
      `${releaseRoot}release-envelope.sig`,
      256,
    );
    const signature = signatureText.toString("ascii").trim();
    if (!/^[A-Za-z0-9+/]{86}==$/.test(signature))
      throw new Error("Invalid release signature encoding");
    const previous = this.release;
    this.release = verifyEnvelope(
      bytes,
      Buffer.from(signature, "base64"),
      this.options.publicKeys,
      this.options,
    );
    this.checked = true;
    this.noRelease = false;
    if (JSON.stringify(previous) !== JSON.stringify(this.release))
      this.downloaded = null;
    return this.status();
  }

  async download(): Promise<{ status: string; path: string; version: string }> {
    if (this.options.development)
      throw new Error(
        "Development previews cannot download or install updates",
      );
    if (this.cancellation)
      throw new Error("An update download is already active");
    if (!this.release)
      throw new Error("Check for an authenticated release first");
    if (this.options.jobsActive())
      throw new Error("An update cannot download during media jobs");
    const release = structuredClone(this.release);
    this.cancellation = new AbortController();
    try {
      await mkdir(this.options.cacheDir, { recursive: true });
      if (this.options.platform === "win32") {
        const module = await import("electron-updater");
        const updater = (this.updater = this.options.windowsUpdater
          ? await this.options.windowsUpdater()
          : new module.NsisUpdater({
              provider: "github",
              owner: "nathanialhenniges",
              repo: "tunevault",
            }));
        updater.autoDownload = false;
        updater.autoInstallOnAppQuit = false;
        updater.allowDowngrade = false;
        updater.allowPrerelease = false;
        updater.disableDifferentialDownload = true;
        const checked = await updater.checkForUpdates();
        if (!checked) throw new Error("Update feed unavailable");
        verifyFeed(checked.updateInfo, release);
        if (this.cancellation.signal.aborted)
          throw new Error("Update download canceled");
        this.cancellation.signal.addEventListener(
          "abort",
          () => checked.cancellationToken?.cancel(),
          { once: true },
        );
        const paths = await updater.downloadUpdate(checked.cancellationToken);
        if (paths.length !== 1)
          throw new Error("Unexpected downloaded installer set");
        await verifyArtifact(paths[0]!, release.asset);
        if (JSON.stringify(this.release) !== JSON.stringify(release))
          throw new Error("Release changed during download");
        this.downloaded = paths[0]!;
      } else {
        const final = join(this.options.cacheDir, release.asset.name);
        const temporary = `${final}.${randomUUID()}.partial`;
        const file = await open(temporary, "wx", 0o600);
        try {
          const response = await updateResponse(
            release.asset.url,
            release.asset.size,
            this.cancellation.signal,
          );
          let written = 0;
          for await (const chunk of responseChunks(response)) {
            written += chunk.length;
            if (written > release.asset.size)
              throw new Error("Installer exceeds authenticated size");
            await file.writeFile(chunk);
          }
          await file.sync();
          await file.close();
          await verifyArtifact(temporary, release.asset);
          if (JSON.stringify(this.release) !== JSON.stringify(release))
            throw new Error("Release changed during download");
          await rename(temporary, final);
          this.downloaded = final;
        } catch (error) {
          await file.close().catch(() => {});
          await rm(temporary, { force: true });
          throw error;
        }
      }
      return {
        status:
          this.options.platform === "darwin"
            ? "ready-for-manual-replacement"
            : "ready-to-install",
        path: this.downloaded!,
        version: release.envelope.version,
      };
    } finally {
      this.cancellation = null;
    }
  }

  cancel(): void {
    this.cancellation?.abort();
  }
  async verifiedDownload(): Promise<string> {
    if (this.options.development)
      throw new Error(
        "Development previews cannot download or install updates",
      );
    if (!this.downloaded || !this.release)
      throw new Error("No verified installer");
    await verifyArtifact(this.downloaded, this.release.asset);
    return this.downloaded;
  }
  async install(): Promise<void> {
    if (this.options.development)
      throw new Error(
        "Development previews cannot download or install updates",
      );
    if (this.options.platform !== "win32")
      throw new Error("macOS updates require manual Quit, Replace, Reopen");
    if (this.options.jobsActive())
      throw new Error("Finish or cancel media jobs before installing");
    const updater = this.updater,
      release = this.release,
      downloaded = this.downloaded;
    await this.verifiedDownload();
    if (
      !updater ||
      updater !== this.updater ||
      release !== this.release ||
      downloaded !== this.downloaded ||
      this.cancellation
    )
      throw new Error("Windows update session changed; check again");
    updater.quitAndInstall(true, true);
  }
}
