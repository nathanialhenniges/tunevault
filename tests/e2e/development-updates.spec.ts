import { _electron, test, expect } from "@playwright/test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { launch, choose, openSettings, capture, close } from "./launch";

test.skip(
  !!process.env.TUNEVAULT_UPGRADE_PHASE,
  "Separate installed-upgrade phase",
);
test("development update preview is manual, local, and cannot install", async () => {
  const root = await mkdtemp(join(tmpdir(), "tunevault-dev-updates-"));
  const app = await _electron.launch({
    executablePath: resolve(
      process.platform === "darwin"
        ? "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
        : "node_modules/electron/dist/electron.exe",
    ),
    args: [resolve(".")],
    env: {
      ...process.env,
      TUNEVAULT_E2E: "1",
      TUNEVAULT_TEST_DATA: join(root, "data"),
    },
    timeout: 30000,
  });
  try {
    await app.evaluate(() => {
      (globalThis as any).__updateRequests = 0;
      globalThis.fetch = async () => {
        (globalThis as any).__updateRequests++;
        throw new Error("Development update test forbids HTTP requests");
      };
    });
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.tunevault);
    const vault = join(root, "library");
    await mkdir(vault);
    const selected = await choose(app, vault, "chooseVault");
    await page.evaluate(
      (vault) =>
        window.tunevault.invoke("settings.update", {
          vault,
          disclaimerAccepted: true,
          onboarded: true,
          autoUpdates: true,
          appearance: "dark",
        }),
      selected,
    );
    const settings = await openSettings(app, page);
    await settings.getByRole("tab", { name: "Updates", exact: true }).click();
    const automatic = settings.getByRole("checkbox", {
      name: "Automatically check for app releases",
    });
    await expect(automatic).toBeDisabled();
    await expect(automatic).not.toBeChecked();
    await expect(
      settings.getByText(
        "Development build. Check for updates to preview the update screen locally.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.waitForTimeout(16000);
    expect(
      await page.evaluate(() => window.tunevault.invoke("updates.status")),
    ).toEqual({ status: "development" });
    await settings
      .getByRole("button", { name: "Check for updates", exact: true })
      .click();
    await expect(
      settings.getByText(
        "Development preview. This is not a real release; no update will be installed.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      settings.getByText("Version 99.0.0", { exact: true }),
    ).toBeVisible();
    await expect(
      settings.getByRole("button", { name: /Download|Install update|Reveal/ }),
    ).toHaveCount(0);
    expect(await app.evaluate(() => (globalThis as any).__updateRequests)).toBe(
      0,
    );
    expect(
      (await page.evaluate(() => window.tunevault.invoke("snapshot"))).settings
        .autoUpdates,
    ).toBe(true);
    await expect(
      page.evaluate(() => window.tunevault.invoke("updates.download")),
    ).rejects.toThrow(/development/i);
    await capture(app, "artifacts/screenshots/development-updates-main.png");
    const png = Buffer.from(
      await app.evaluate(async ({ BrowserWindow }) => {
        const window =
          BrowserWindow.getAllWindows().find((window) =>
            window.webContents.getURL().endsWith("#settings"),
          ) || BrowserWindow.getAllWindows()[0];
        return Array.from(
          (
            await window.webContents.capturePage(undefined, {
              stayHidden: true,
              stayAwake: true,
            })
          ).toPNG(),
        );
      }),
    );
    await writeFile("artifacts/screenshots/development-updates.png", png);
    await test
      .info()
      .attach("development-updates", { body: png, contentType: "image/png" });
  } finally {
    await close(app);
    await rm(root, { recursive: true, force: true });
  }
});

test("installed builds show an unpublished feed without a remote-method error", async () => {
  const { app, root } = await launch();
  try {
    await app.evaluate(() => {
      globalThis.fetch = async () => new Response(null, { status: 404 });
    });
    const page = await app.firstWindow();
    const settings = await openSettings(app, page);
    await settings.getByRole("tab", { name: "Updates", exact: true }).click();
    await expect(
      settings.getByRole("checkbox", {
        name: "Automatically check for app releases",
      }),
    ).toBeEnabled();
    await settings
      .getByRole("button", { name: "Check for updates", exact: true })
      .click();
    await expect(
      settings.getByText(
        "No published update is available yet. You can check again later.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(settings.getByRole("alert")).toHaveCount(0);
    expect(
      await settings.evaluate(() => window.tunevault.invoke("updates.status")),
    ).toEqual({ status: "no-release" });
    await expect(
      settings.getByRole("button", { name: /Download update|Install update/ }),
    ).toHaveCount(0);
  } finally {
    await close(app);
    await rm(root, { recursive: true, force: true });
  }
});
