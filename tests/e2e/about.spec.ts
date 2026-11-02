import { test, expect } from "@playwright/test";
import { launch, capture, close } from "./launch";
import { rm } from "node:fs/promises";

test.skip(
  !!process.env.TUNEVAULT_UPGRADE_PHASE,
  "Separate installed-upgrade phase",
);
test("About shows bundled versions and opens offline third-party notices", async () => {
  const { app, root } = await launch();
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    const info = await page.evaluate(() => window.tunevault.invoke("app.info"));
    expect(info.software.runtimes.Electron).toMatch(/^\d+\./);
    expect(info.software.tools.ffmpeg).toMatch(/^\d+\./);
    expect(info.software.tools["yt-dlp EJS"]).toBeTruthy();
    expect(info.software.libraries.react).toMatch(/^\d+\./);
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send(
        "tunevault:menu",
        "about",
      );
    });
    await expect(
      page.getByRole("heading", { name: "About TuneVault" }),
    ).toBeVisible();
    for (const group of Object.values(info.software)) {
      for (const [name, version] of Object.entries(
        group as Record<string, string>,
      )) {
        const term = page.getByText(name, { exact: true });
        await expect(term).toHaveCount(1);
        await expect(term.locator("+ dd")).toHaveText(version);
      }
    }
    await capture(app, "artifacts/screenshots/about-versions.png");
    await page
      .getByRole("button", { name: "Third-party notices", exact: true })
      .click();
    const notices = page.getByRole("dialog", { name: "Third-party notices" });
    await expect(notices).toBeVisible();
    await expect(notices).toContainText("Third-party components");
    await expect(notices).toContainText("This does not relicense");
    await expect(notices).toContainText("FFmpeg / ffprobe");
    await capture(app, "artifacts/screenshots/third-party-notices.png");
  } finally {
    await close(app);
    await rm(root, { recursive: true, force: true });
  }
});
