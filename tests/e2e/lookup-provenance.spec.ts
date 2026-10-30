import { test, expect } from "@playwright/test";
import { launch, choose, close } from "./launch";
import { DatabaseSync } from "node:sqlite";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
test.skip(
  !!process.env.TUNEVAULT_UPGRADE_PHASE,
  "Separate installed-upgrade phase",
);
// A cached MusicBrainz result keeps this test independent of the live API.
test("reviewed lookup fields keep service provenance; manual edits and locks win", async () => {
  const recording = "5b11f4ce-a62d-471e-81fc-a69a8278c7da";
  const first = await launch();
  const roots = [first.root];
  let app = first.app;
  let running = true;
  try {
    let page = await app.firstWindow();
    const tools = await page.evaluate(() =>
      window.tunevault.invoke("diagnostics"),
    );
    const file = join(first.root, "provenance.mp3");
    await execute(
      tools.tools.ffmpeg,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=523:duration=1",
        "-c:a",
        "libmp3lame",
        "-metadata",
        "title=Provenance Song",
        "-metadata",
        "artist=Provenance Artist",
        "-metadata",
        "album=Draft album",
        "-metadata",
        "date=1999",
        file,
      ],
      { env: { ...process.env, PATH: "" } },
    );
    await choose(app, file, "chooseImport");
    const imported = await page.evaluate(
      (paths) => window.tunevault.invoke("import.start", { paths }),
      [file],
    );
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) =>
              window.tunevault
                .invoke("snapshot")
                .then((s) => s.jobs.find((job: any) => job.id === id)?.status),
            imported.id,
          ),
        { timeout: 60000 },
      )
      .toBe("completed");
    await page.evaluate(() =>
      window.tunevault.invoke("settings.update", { onlineAcknowledged: true }),
    );
    await close(app);
    running = false;

    const db = new DatabaseSync(
      join(first.dataDir, "library", "library.sqlite"),
    );
    db.prepare("INSERT OR REPLACE INTO cache(id,data) VALUES(?,?)").run(
      "lookup:Provenance Song Provenance Artist",
      JSON.stringify({
        id: "lookup:Provenance Song Provenance Artist",
        at: Date.now(),
        results: [
          {
            id: recording,
            title: "Reviewed Song",
            artist: "Reviewed Artist",
            album: "Reviewed Album",
            releases: [],
            date: "2001",
            reason: "Cached fixture",
          },
        ],
      }),
    );
    db.close();

    const second = await launch(first.dataDir);
    roots.push(second.root);
    app = second.app;
    running = true;
    page = await app.firstWindow();
    await page.locator(".track-name").first().dblclick();
    const inspector = page.locator(".inspector");
    await expect(
      inspector.getByRole("heading", { name: "Track details", exact: true }),
    ).toBeVisible();

    await inspector
      .getByText("More tags & field locks", { exact: true })
      .click();
    await inspector.getByLabel("Lock release date").check();
    await inspector.getByText("Metadata suggestions", { exact: true }).click();
    await inspector
      .getByRole("button", { name: "Find suggestions", exact: true })
      .click();
    await expect(
      inspector.getByText("Reviewed Song", { exact: true }),
    ).toBeVisible();
    for (const field of ["title", "artist", "album"])
      await inspector
        .getByRole("button", { name: `Use ${field}`, exact: true })
        .click();
    // The locked field cannot take a suggestion.
    await expect(
      inspector.getByRole("button", { name: "Use date", exact: true }),
    ).toBeDisabled();
    // A manual edit after choosing a suggestion makes that field the user's.
    await inspector.getByLabel("Album", { exact: true }).fill("My album");

    await inspector
      .getByRole("button", { name: "Review changes…", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Apply to archived copy", exact: true })
      .click();

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.tunevault.invoke("snapshot").then((s) => s.tracks[0]),
          ),
        { timeout: 30000 },
      )
      .toMatchObject({
        metadata: {
          title: "Reviewed Song",
          artist: "Reviewed Artist",
          album: "My album",
          date: "1999",
        },
        origins: {
          title: `musicbrainz:${recording}`,
          artist: `musicbrainz:${recording}`,
          album: "user",
        },
      });
    const saved = await page.evaluate(() =>
      window.tunevault.invoke("snapshot").then((s) => s.tracks[0]),
    );
    expect(saved.locks).toContain("date");
    expect(saved.origins.date ?? "").not.toMatch(/^musicbrainz:/);
    await expect(
      inspector.locator("label.check-line").filter({ hasText: /^Lock title/ }),
    ).toContainText("From MusicBrainz");
    await expect(
      inspector
        .locator("label.check-line")
        .filter({ hasText: /^Lock album(?! artist)/ }),
    ).toContainText("Edited by you");
  } finally {
    if (running) await close(app);
    await Promise.all(
      roots.map((root) => rm(root, { recursive: true, force: true })),
    );
  }
});
