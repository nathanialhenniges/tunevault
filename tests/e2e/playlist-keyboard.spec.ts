import { test, expect } from "@playwright/test";
import { rm } from "node:fs/promises";
import { launch, close } from "./launch";
import type { Snapshot } from "../../src/shared/types";

test.skip(
  !!process.env.TUNEVAULT_UPGRADE_PHASE,
  "Separate installed-upgrade phase",
);
test("keyboard reorder preserves occurrence identity and focus across repeated moves", async () => {
  const { app, root } = await launch();
  try {
    const page = await app.firstWindow();
    const playlist = await page.evaluate(() =>
      window.tunevault.invoke("references.import", {
        name: "Keyboard order",
        format: "csv",
        text: "title,artist\nRepeated,Test\nSecond,Test\nRepeated,Test\nLast,Test",
      }),
    );
    await page.getByRole("button", { name: "Playlists", exact: true }).click();
    const rows = page.locator(".playlist-table tbody tr");
    await expect(rows).toHaveCount(4);
    const moving = rows
      .first()
      .getByRole("button", { name: "Move song 1 down", exact: true });
    await moving.focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(
      rows
        .nth(1)
        .getByRole("button", { name: "Move song 2 down", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(
      rows
        .nth(2)
        .getByRole("button", { name: "Move song 3 down", exact: true }),
    ).toBeFocused();
    const reordered: Snapshot = await page.evaluate(() =>
      window.tunevault.invoke("snapshot"),
    );
    expect(
      reordered.playlists
        .find((item) => item.id === playlist.id)!
        .entries.map((entry) => entry.id),
    ).toEqual([
      playlist.entries[1].id,
      playlist.entries[2].id,
      playlist.entries[0].id,
      playlist.entries[3].id,
    ]);
    await page.keyboard.press("Alt+ArrowUp");
    await expect(
      rows
        .nth(1)
        .getByRole("button", { name: "Move song 2 down", exact: true }),
    ).toBeFocused();
  } finally {
    await close(app);
    await rm(root, { recursive: true, force: true });
  }
});
