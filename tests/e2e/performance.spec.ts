import { test, expect } from "@playwright/test";
import { launch } from "./launch";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Track, Metadata } from "../../src/shared/types";
test.skip(
  !!process.env.TUNEVAULT_UPGRADE_PHASE,
  "Separate installed-upgrade phase",
);
test("10k indexed tracks, narrow keyboard and zoom rendering", async () => {
  const first = await launch();
  await first.app.firstWindow();
  await first.app.close();
  const db = new DatabaseSync(join(first.dataDir, "library", "library.sqlite"));
  const insert = db.prepare("INSERT INTO tracks(id,data) VALUES(?,?)");
  const metadata: Metadata = {
    title: "",
    artist: "",
    album: "",
    albumArtist: "",
    trackNumber: "",
    trackTotal: "",
    discNumber: "",
    discTotal: "",
    date: "",
    genre: "",
    composer: "",
    comment: "",
    isrc: "",
    musicbrainzId: "",
  };
  db.exec("BEGIN");
  for (let i = 0; i < 10000; i++) {
    const track: Track = {
      id: randomUUID(),
      hash: "a".repeat(64),
      path: join(first.root, "not-present.mp3"),
      originalPath: "",
      metadata: {
        ...metadata,
        title: `Fixture ${String(i).padStart(5, "0")}`,
        artist: `Test Artist ${i % 200}`,
        album: `Album ${i % 1000}`,
      },
      locks: [],
      origins: {},
      revision: 1,
      artwork: null,
      favorite: i % 9 === 0,
      missing: true,
      codec: "mp3",
      container: "mp3",
      duration: 180 + (i % 300),
      bitrate: 192000,
      sampleRate: 44100,
      bytes: 1000,
      source: null,
    };
    insert.run(track.id, JSON.stringify(track));
  }
  db.exec("COMMIT");
  db.close();
  const started = performance.now();
  const second = await launch(first.dataDir);
  try {
    const page = await second.app.firstWindow();
    await expect(
      page.getByText("10,000 tracks", { exact: true }).first(),
    ).toBeVisible();
    const startupMs = performance.now() - started;
    const search = page.getByRole("searchbox", { name: "Search library" });
    const searchStart = performance.now();
    await search.fill("Fixture 09999");
    await expect(
      page.locator("button.track-name").filter({ hasText: "Fixture 09999" }),
    ).toBeVisible();
    const searchMs = performance.now() - searchStart;
    await search.fill("");
    await expect(page.locator(".track-table tbody tr")).toHaveCount(100);
    const scrollStart = performance.now();
    await page
      .locator(".table-scroll")
      .evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Page 2 of 100")).toBeVisible();
    const pageScrollMs = performance.now() - scrollStart;
    await second.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1024, 768),
    );
    await search.fill("Fixture 09999");
    await page
      .locator("button.track-name")
      .filter({ hasText: "Fixture 09999" })
      .click();
    await expect(
      page.getByRole("button", { name: "Close track details" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".inspector")).toHaveCount(0);
    await page.getByRole("button", { name: "Add music…", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await page.evaluate(() =>
        document.querySelector("dialog")?.contains(document.activeElement),
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await second.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2),
    );
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    const png = await second.app.evaluate(async ({ BrowserWindow }) =>
      Array.from(
        (
          await BrowserWindow.getAllWindows()[0].webContents.capturePage()
        ).toPNG(),
      ),
    );
    await mkdir("artifacts/screenshots", { recursive: true });
    await writeFile(
      "artifacts/screenshots/packaged-200-percent.png",
      Buffer.from(png),
    );
    await mkdir("test-results", { recursive: true });
    await writeFile(
      "test-results/performance.json",
      JSON.stringify(
        {
          tracks: 10000,
          startupMs,
          searchMs,
          pageScrollMs,
          renderedRows: 100,
          zoom: 2,
          platform: process.platform,
          arch: process.arch,
        },
        null,
        2,
      ),
    );
  } finally {
    await second.app.close();
    await rm(first.root, { recursive: true, force: true });
    await rm(second.root, { recursive: true, force: true });
  }
});
