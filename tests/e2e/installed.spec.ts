import { test, expect } from "@playwright/test";
import { launch, choose, close } from "./launch";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
test.skip(
  !process.env.TUNEVAULT_UPGRADE_PHASE,
  "Requires native installer-upgrade harness",
);
test("installed data survives the native upgrade", async () => {
  const dataDir = process.env.TUNEVAULT_TEST_DATA!;
  const { app, root } = await launch(dataDir);
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    const info = await page.evaluate(() => window.tunevault.invoke("app.info"));
    expect(info.packaged).toBe(true);
    const sentinel = join(dataDir, "upgrade-assertions.json");
    if (process.env.TUNEVAULT_UPGRADE_PHASE === "seed") {
      const vault = join(dataDir, "vault"),
        destination = join(dataDir, "device");
      await mkdir(vault, { recursive: true });
      await mkdir(destination, { recursive: true });
      await choose(app, vault, "chooseVault");
      await page.evaluate(
        (vault) =>
          window.tunevault.invoke("settings.update", {
            vault,
            appearance: "dark",
            accent: "orange",
          }),
        vault,
      );
      const tools = await page.evaluate(() =>
        window.tunevault.invoke("diagnostics"),
      );
      const file = join(dataDir, "synthetic.mp3");
      await run(tools.tools.ffmpeg, [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=523:duration=2",
        "-c:a",
        "libmp3lame",
        "-metadata",
        "title=Upgrade fixture",
        file,
      ]);
      await choose(app, file, "chooseImport");
      const job = await page.evaluate(
        (file) => window.tunevault.invoke("import.start", { paths: [file] }),
        file,
      );
      await expect
        .poll(() =>
          page.evaluate(
            (id) =>
              window.tunevault
                .invoke("snapshot")
                .then((s) => s.jobs.find((j: any) => j.id === id)?.status),
            job.id,
          ),
        )
        .toBe("completed");
      const track = (
        await page.evaluate(() => window.tunevault.invoke("snapshot"))
      ).tracks[0];
      await page.evaluate(
        (id) =>
          window.tunevault.invoke("tracks.edit", {
            ids: [id],
            changes: { artist: "Locked artist" },
            locks: ["artist"],
          }),
        track.id,
      );
      const playlist = await page.evaluate(
        (id) =>
          window.tunevault.invoke("playlists.create", {
            name: "Ordered upgrade",
            trackIds: [id, id],
          }),
        track.id,
      );
      await choose(app, destination, "chooseTargetFolder");
      const target = await page.evaluate(
        (destination) =>
          window.tunevault.invoke("targets.create", {
            name: "Upgrade player",
            transport: "imazing",
            destination,
          }),
        destination,
      );
      const exportJob = await page.evaluate(
        (input) => window.tunevault.invoke("export.prepare", input),
        { targetId: target.id, playlistId: playlist.id },
      );
      await expect
        .poll(
          () =>
            page.evaluate(
              (id) =>
                window.tunevault
                  .invoke("snapshot")
                  .then((s) => s.jobs.find((j: any) => j.id === id)?.status),
              exportJob.id,
            ),
          { timeout: 60000 },
        )
        .toBe("completed");
      await page.evaluate(
        (input) => window.tunevault.invoke("export.confirm", input),
        { targetId: target.id, batchId: exportJob.id },
      );
      await writeFile(
        sentinel,
        JSON.stringify({
          version: info.version,
          trackId: track.id,
          playlistId: playlist.id,
          targetId: target.id,
        }),
      );
    } else {
      const saved = JSON.parse(await readFile(sentinel, "utf8"));
      const state = await page.evaluate(() =>
        window.tunevault.invoke("snapshot"),
      );
      expect(info.version).not.toBe(saved.version);
      expect(state.tracks[0].id).toBe(saved.trackId);
      expect(state.tracks[0].metadata.artist).toBe("Locked artist");
      expect(state.tracks[0].locks).toContain("artist");
      expect(state.playlists[0].entries).toHaveLength(2);
      expect(
        state.receipts.some(
          (r: any) =>
            r.targetId === saved.targetId && r.evidence === "user-confirmed",
        ),
      ).toBe(true);
      expect(state.settings).toMatchObject({
        appearance: "dark",
        accent: "orange",
      });
    }
  } finally {
    await close(app);
    await rm(root, { recursive: true, force: true });
  }
});
