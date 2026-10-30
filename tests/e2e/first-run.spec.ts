import { test, expect } from "@playwright/test";
import { launch, close } from "./launch";
import { rm } from "node:fs/promises";

test("first run requires the disclaimer, then offers a skippable welcome guide once", async () => {
  const { app, dataDir, root } = await launch(undefined, { firstRun: true });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Before you start" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    const agree = page.getByRole("button", { name: "Agree and continue" });
    await expect(agree).toBeDisabled();
    await page.getByRole("checkbox", { name: /right to keep/ }).check();
    await agree.click();

    const guide = page.getByRole("dialog", { name: "Welcome to TuneVault" });
    await expect(guide).toBeVisible();
    await guide.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByRole("dialog", { name: "Choose your vault" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Skip guide" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.tunevault
            .invoke("snapshot")
            .then((s) => [s.settings.disclaimerAccepted, s.settings.onboarded]),
        ),
      )
      .toEqual([true, true]);
    await close(app);

    const again = await launch(dataDir, { firstRun: true });
    try {
      const next = await again.app.firstWindow();
      await expect(next.getByRole("navigation")).toBeVisible();
      await expect(next.getByRole("dialog")).toHaveCount(0);
      await next.getByRole("button", { name: "Settings", exact: true }).click();
      await next.getByRole("button", { name: "Show welcome guide" }).click();
      await expect(
        next.getByRole("dialog", { name: "Welcome to TuneVault" }),
      ).toBeVisible();
    } finally {
      await close(again.app);
      await rm(again.root, { recursive: true, force: true });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
