import { test, expect } from "@playwright/test";
import { launch, choose, capture, close } from "./launch";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
const run = promisify(execFile);
test.skip(
  !!process.env.TUNEVAULT_UPGRADE_PHASE,
  "Separate installed-upgrade test phase",
);
test("packaged sandbox, real media, persistence, theme, legal and export flow", async () => {
  const { app, root, dataDir } = await launch();
  let closed = false;
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    const security = await page.evaluate(
      () => (window.tunevault as any).runtimeSecurity,
    );
    expect(security.sandboxed).toBe(true);
    expect(security.contextIsolated).toBe(true);
    expect(await page.evaluate(() => typeof (window as any).require)).toBe(
      "undefined",
    );
    const info = await page.evaluate(() => window.tunevault.invoke("app.info"));
    expect(info.packaged).toBe(true);
    const native = await app.evaluate(({ nativeTheme }) => ({
      os: process.getSystemVersion(),
      reducedTransparency: nativeTheme.prefersReducedTransparency,
      highContrast: nativeTheme.shouldUseHighContrastColors,
    }));
    if (
      process.platform === "darwin" &&
      Number(native.os.split(".")[0]) >= 26 &&
      !native.reducedTransparency &&
      !native.highContrast
    )
      expect(info.nativeGlass).toBe(true);
    if (info.nativeGlass) {
      await app.evaluate(({ nativeTheme }) => {
        (globalThis as any).__transparencyDescriptor =
          Object.getOwnPropertyDescriptor(
            nativeTheme,
            "prefersReducedTransparency",
          );
        Object.defineProperty(nativeTheme, "prefersReducedTransparency", {
          configurable: true,
          get: () => true,
        });
        nativeTheme.emit("updated");
      });
      try {
        await expect(page.locator("html")).toHaveAttribute(
          "data-native-glass",
          "false",
        );
        expect(
          (await page.evaluate(() => window.tunevault.invoke("app.info")))
            .nativeGlass,
        ).toBe(false);
      } finally {
        await app.evaluate(({ nativeTheme }) => {
          const original = (globalThis as any).__transparencyDescriptor;
          if (original)
            Object.defineProperty(
              nativeTheme,
              "prefersReducedTransparency",
              original,
            );
          else delete (nativeTheme as any).prefersReducedTransparency;
          delete (globalThis as any).__transparencyDescriptor;
          nativeTheme.emit("updated");
        });
      }
      await expect(page.locator("html")).toHaveAttribute(
        "data-native-glass",
        "true",
      );
    }

    expect(info.runtime.sqlite).toBe(true);
    const diagnostics = await page.evaluate(() =>
      window.tunevault.invoke("diagnostics"),
    );
    expect(diagnostics.tools.ffmpeg).toMatch(/[\\/]resources[\\/]/i);
    const vault = join(root, "vault"),
      destination = join(root, "export");
    await mkdir(vault);
    await mkdir(destination);
    await choose(app, vault, "chooseVault");
    await page.evaluate(
      (vault) => window.tunevault.invoke("settings.update", { vault }),
      vault,
    );
    const source = join(root, "owned-synthetic.mp3");
    await run(
      diagnostics.tools.ffmpeg,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2",
        "-c:a",
        "libmp3lame",
        "-metadata",
        "title=Synthetic 音楽",
        "-metadata",
        "artist=TuneVault tests",
        source,
      ],
      { env: { ...process.env, PATH: "" } },
    );
    await choose(app, source, "chooseImport");
    await page.getByRole("button", { name: "Add music…", exact: true }).click();
    await page.getByRole("button", { name: "Choose audio files…" }).click();
    await expect(
      page.getByText("Synthetic 音楽", { exact: false }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Import selected files" }).click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const s = await window.tunevault.invoke("snapshot");
          return s.tracks.length;
        }),
      )
      .toBe(1);
    const state = await page.evaluate(() =>
      window.tunevault.invoke("snapshot"),
    );
    expect(await readFile(source)).toEqual(
      await readFile(state.tracks[0].path),
    );
    await page.evaluate(
      (id) =>
        window.tunevault.invoke("tracks.edit", {
          ids: [id],
          changes: { album: "Preserved album" },
          locks: ["title"],
        }),
      state.tracks[0].id,
    );
    const target = await choose(app, destination, "chooseTargetFolder").then(
      () =>
        page.evaluate(
          (destination) =>
            window.tunevault.invoke("targets.create", {
              name: "E2E folder",
              transport: "folder",
              destination,
            }),
          destination,
        ),
    );
    const queued = await page.evaluate(
      (targetId) => window.tunevault.invoke("export.prepare", { targetId }),
      target.id,
    );
    await expect
      .poll(
        async () =>
          page.evaluate(
            (id) =>
              window.tunevault
                .invoke("snapshot")
                .then((s) => s.jobs.find((j: any) => j.id === id)?.status),
            queued.id,
          ),
        { timeout: 60000 },
      )
      .toBe("completed");
    const exported = await page.evaluate(() =>
      window.tunevault.invoke("snapshot"),
    );
    expect(exported.receipts).toHaveLength(1);
    expect(exported.receipts[0].evidence).toBe("exported");
    await app.evaluate(({ shell }) => {
      shell.showItemInFolder = (path) => {
        (globalThis as any).__revealedBatch = path;
      };
    });
    await page.evaluate(
      ({ targetId, batchId }) =>
        window.tunevault.invoke("reveal", { targetId, batchId }),
      {
        targetId: exported.receipts[0].targetId,
        batchId: exported.receipts[0].batchId,
      },
    );
    expect(await app.evaluate(() => (globalThis as any).__revealedBatch)).toBe(
      exported.jobs.find((job: any) => job.id === queued.id).payload.path,
    );
    const report = await page.evaluate(() =>
      window.tunevault.invoke("diagnostics.preview"),
    );
    expect(JSON.parse(report.text).counts.tracks).toBe(1);
    expect(report.text).not.toContain(root);
    expect(report.text).not.toContain("Synthetic 音楽");
    const reportPath = join(root, "reviewed-report.json");
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, reportPath);
    expect(
      await page.evaluate(
        (token) => window.tunevault.invoke("diagnostics.export", { token }),
        report.token,
      ),
    ).toEqual({ saved: true });
    expect(await readFile(reportPath, "utf8")).toBe(report.text);

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByRole("button", { name: "Library", exact: false })
      .first()
      .click();
    await page.locator("button.track-name").first().click();
    await page
      .locator("summary")
      .filter({ hasText: /^Artwork$/ })
      .click();
    await page
      .getByRole("button", {
        name: "Generate offline placeholder…",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Review placeholder artwork" }),
    ).toContainText("Locally generated");
    await page
      .getByRole("button", { name: "Apply selected artwork", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Review placeholder artwork" }),
    ).toHaveCount(0);
    expect(
      (await page.evaluate(() => window.tunevault.invoke("snapshot"))).tracks[0]
        .artworkOrigin,
    ).toBe("locally-generated-placeholder");
    await page
      .getByRole("button", { name: "Undo previous revision", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.tunevault.invoke("snapshot")))
            .tracks[0].artwork,
      )
      .toBeNull();
    await page
      .getByLabel("Title", { exact: true })
      .fill("Unsaved theme-test draft");
    for (const appearance of ["light", "dark"] as const)
      for (const accent of ["blue", "orange"] as const) {
        await page.evaluate(
          (settings) => window.tunevault.invoke("settings.update", settings),
          { appearance, accent },
        );
        await expect(page.locator("html")).toHaveAttribute(
          "data-appearance",
          appearance,
        );
        await expect(page.locator("html")).toHaveAttribute(
          "data-accent",
          accent,
        );
        const contrasts = await page.evaluate(() => {
          const sidebar = document.querySelector(".sidebar")!;
          const muted = sidebar.querySelector(".muted")!;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext("2d")!;
          const pixel = (paint: string, base: string) => {
            ctx.fillStyle = base;
            ctx.fillRect(0, 0, 1, 1);
            ctx.fillStyle = paint;
            ctx.fillRect(0, 0, 1, 1);
            return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
          };
          const lum = (values: number[]) =>
            values
              .map((x) => x / 255)
              .map((x) =>
                x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
              )
              .reduce((n, x, i) => n + x * [0.2126, 0.7152, 0.0722][i], 0);
          return ["#000", "#fff"].map((base) => {
            const bg = lum(
              pixel(getComputedStyle(sidebar).backgroundColor, base),
            );
            const fg = lum(pixel(getComputedStyle(muted).color, base));
            return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
          });
        });
        expect(Math.min(...contrasts)).toBeGreaterThanOrEqual(4.5);
        await capture(
          app,
          `artifacts/screenshots/packaged-${appearance}-${accent}.png`,
        );
      }
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Unsaved theme-test draft",
    );
    await page.evaluate(() =>
      window.tunevault.invoke("settings.update", { appearance: "system" }),
    );
    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = "dark";
    });
    await expect(page.locator("html")).toHaveAttribute(
      "data-appearance",
      "dark",
    );
    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = "light";
    });
    await expect(page.locator("html")).toHaveAttribute(
      "data-appearance",
      "light",
    );
    expect(
      (await page.evaluate(() => window.tunevault.invoke("snapshot"))).settings
        .appearance,
    ).toBe("system");
    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = "system";
    });
    await page.getByRole("button", { name: "Close track details" }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("tab", { name: "Privacy", exact: true }).click();
    await page
      .getByRole("button", { name: "Privacy policy", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Nathanial Henniges");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1024, 768),
    );
    await page.waitForFunction(() => innerWidth < 1200);
    await capture(app, "artifacts/screenshots/packaged-narrow.png");
    await page.evaluate(() =>
      window.tunevault.invoke("settings.update", {
        appearance: "dark",
        accent: "orange",
      }),
    );
    await close(app);
    closed = true;
    const next = await launch(dataDir);
    try {
      const reopened = await next.app.firstWindow();
      const state = await reopened.evaluate(() =>
        window.tunevault.invoke("snapshot"),
      );
      expect(state.tracks[0].metadata.album).toBe("Preserved album");
      expect(state.tracks[0].locks).toContain("title");
      expect(state.receipts).toHaveLength(1);
      expect(state.settings).toMatchObject({
        appearance: "dark",
        accent: "orange",
      });
      await expect(reopened.locator("html")).toHaveAttribute(
        "data-appearance",
        "dark",
      );
    } finally {
      await close(next.app);
      await rm(next.root, { recursive: true, force: true });
    }
  } finally {
    if (!closed) await close(app);
    await rm(root, { recursive: true, force: true });
  }
});
