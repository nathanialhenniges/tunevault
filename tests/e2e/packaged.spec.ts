import { test, expect } from "@playwright/test";
import { launch, choose } from "./launch";
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
    await page
      .getByRole("button", { name: "Settings & About", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Library", exact: false })
      .first()
      .click();
    await page.locator("button.track-name").first().click();
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
        await page.screenshot({
          path: `artifacts/screenshots/packaged-${appearance}-${accent}.png`,
        });
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
    await page
      .getByRole("button", { name: "Settings & About", exact: true })
      .click();
    await page.getByRole("button", { name: "Privacy", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Nathanial Henniges");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1024, 768),
    );
    await page.screenshot({
      path: "artifacts/screenshots/packaged-narrow.png",
    });
    await page.evaluate(() =>
      window.tunevault.invoke("settings.update", {
        appearance: "dark",
        accent: "orange",
      }),
    );
    await app.close();
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
      await next.app.close();
      await rm(next.root, { recursive: true, force: true });
    }
  } finally {
    if (!closed) await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
