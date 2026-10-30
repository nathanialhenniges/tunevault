import { test, expect } from "@playwright/test";
import { rm } from "node:fs/promises";
import { launch, capture, close } from "./launch";

test.skip(
  !!process.env.TUNEVAULT_UPGRADE_PHASE,
  "Separate installed-upgrade phase",
);

test("welcome and mandatory consent precede the app; setup cannot advance without a vault", async () => {
  const { app, root } = await launch(undefined, { firstRun: true });
  try {
    const page = await app.firstWindow();
    const welcome = page.getByRole("heading", {
      name: "Welcome to TuneVault",
      exact: true,
    });
    await expect(welcome).toBeVisible();
    await expect(welcome).toBeFocused();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const consent = page.getByRole("heading", {
      name: "Use it for music you own",
      exact: true,
    });
    await expect(consent).toBeVisible();
    await expect(consent).toBeFocused();
    const agree = page.getByRole("button", {
      name: "Agree and continue",
      exact: true,
    });
    const checkbox = page.getByRole("checkbox", {
      name: /I understand and will only use TuneVault/,
    });
    await expect(checkbox).not.toBeChecked();
    await expect(agree).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(consent).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Terms of use", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Terms of use", exact: true }),
    ).toContainText("Nathanial Henniges");
    await page.keyboard.press("Escape");
    await expect(agree).toBeDisabled();
    await capture(app, "artifacts/screenshots/onboarding-consent.png");
    await checkbox.check();
    await agree.click();
    const setup = page.getByRole("dialog", {
      name: "Set up your library",
      exact: true,
    });
    await expect(setup).toBeVisible();
    await expect(
      setup.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
    expect(
      (await page.evaluate(() => window.tunevault.invoke("snapshot"))).settings,
    ).toMatchObject({
      disclaimerAccepted: true,
      onboarded: false,
      onlineAcknowledged: false,
      vault: "",
    });
    await page.keyboard.press("Escape");
    await expect(setup).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    expect(
      (await page.evaluate(() => window.tunevault.invoke("snapshot"))).settings
        .onboarded,
    ).toBe(false);
    await page
      .getByRole("button", { name: "Add music…", exact: true })
      .last()
      .click();
    await expect(setup).toBeVisible();
    await expect(
      setup.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
  } finally {
    await close(app);
    await rm(root, { recursive: true, force: true });
  }
});
