import { test, expect } from "@playwright/test";
import { launch, choose, close } from "./launch";
import { mkdir, realpath, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
test.skip(
  !!process.env.TUNEVAULT_UPGRADE_PHASE,
  "Separate installed-upgrade phase",
);
test("target scope, reconnect, numeric albums, batch undo, restore review and narrow focus", async () => {
  const initial = await launch();
  let app = initial.app;
  const roots = [initial.root];
  let running = true;
  try {
    let page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    const tools = await page.evaluate(() =>
      window.tunevault.invoke("diagnostics"),
    );
    const vault = join(initial.root, "vault"),
      destination = join(initial.root, "player"),
      replacement = join(initial.root, "replacement"),
      backups = join(initial.root, "backups");
    await Promise.all(
      [vault, destination, replacement, backups].map((path) => mkdir(path)),
    );
    await choose(app, vault, "chooseVault");
    await page.evaluate(
      (vault) => window.tunevault.invoke("settings.update", { vault }),
      vault,
    );
    const files = [];
    for (const [index, number, title] of [
      [0, 10, "A tenth"],
      [1, 2, "M second"],
      [2, 1, "Z first"],
    ] as const) {
      const file = join(initial.root, `synthetic-${index}.mp3`);
      await execute(
        tools.tools.ffmpeg,
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          `sine=frequency=${440 + index * 110}:duration=1`,
          "-c:a",
          "libmp3lame",
          "-metadata",
          `title=${title}`,
          "-metadata",
          "artist=Renderer tests",
          "-metadata",
          "album=Ordered album",
          "-metadata",
          `track=${number}/10`,
          "-metadata",
          "disc=1/1",
          file,
        ],
        { env: { ...process.env, PATH: "" } },
      );
      await choose(app, file, "chooseImport");
      files.push(file);
    }
    const imported = await page.evaluate(
      (paths) => window.tunevault.invoke("import.start", { paths }),
      files,
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
    const state = await page.evaluate(() =>
      window.tunevault.invoke("snapshot"),
    );
    const first = state.tracks.find(
      (track: any) => track.metadata.title === "Z first",
    );
    const playlist = await page.evaluate(
      (id) =>
        window.tunevault.invoke("playlists.create", {
          name: "Target-only playlist",
          trackIds: [id],
        }),
      first.id,
    );
    await choose(app, destination, "chooseTargetFolder");
    const target = await page.evaluate(
      (destination) =>
        window.tunevault.invoke("targets.create", {
          name: "Renderer target",
          transport: "folder",
          destination,
        }),
      destination,
    );
    await close(app);
    running = false;
    const reopened = await launch(initial.dataDir);
    app = reopened.app;
    roots.push(reopened.root);
    running = true;
    page = await app.firstWindow();
    await page
      .getByRole("button", { name: "Devices & exports", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Compatibility", exact: true })
      .click();
    await page.getByLabel("Model", { exact: true }).fill("Test model");
    await page.getByLabel("Firmware / iOS version").fill("1.0");
    await page
      .getByRole("button", { name: "Save compatibility profile", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          (id) =>
            window.tunevault
              .invoke("snapshot")
              .then(
                (s) => s.targets.find((t: any) => t.id === id)?.profile.model,
              ),
          target.id,
        ),
      )
      .toBe("Test model");
    await expect(page.locator(".error-banner")).toHaveCount(0);
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await choose(app, replacement, "chooseTargetFolder");
    await page
      .getByRole("button", { name: "Change destination…", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Change target destination" }),
    ).toContainText(replacement);
    expect(
      (await page.evaluate(() => window.tunevault.invoke("snapshot")))
        .targets[0].destination,
    ).toBe(destination);
    await page
      .getByRole("button", { name: "Use selected destination", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.tunevault
            .invoke("snapshot")
            .then((s) => s.targets[0].destination),
        ),
      )
      .toBe(await realpath(replacement));
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.getByRole("checkbox", { name: /Target-only playlist/ }).check();
    await page
      .getByRole("button", { name: "Save selected playlists", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.tunevault
            .invoke("snapshot")
            .then((s) => s.targets[0].playlistIds),
        ),
      )
      .toEqual([playlist.id]);
    await page
      .getByRole("button", { name: "Review saved target export…", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Run preflight", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").locator(".review-table tbody tr"),
    ).toHaveCount(1);
    await expect(page.getByRole("dialog")).toContainText("Z first");
    await page.keyboard.press("Escape");
    const exported = await page.evaluate(
      (targetId) => window.tunevault.invoke("export.prepare", { targetId }),
      target.id,
    );
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) =>
              window.tunevault
                .invoke("snapshot")
                .then((s) => s.jobs.find((job: any) => job.id === id)?.status),
            exported.id,
          ),
        { timeout: 60000 },
      )
      .toBe("completed");
    await expect(
      page.getByText("No tracks match this target-content filter."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "Albums", exact: true }).click();
    await page
      .locator(".album-card")
      .filter({ hasText: "Ordered album" })
      .click();
    await expect(
      page.locator(".track-table tbody .track-name strong"),
    ).toHaveText(["Z first", "M second", "A tenth"]);
    await page
      .getByRole("checkbox", {
        name: "Select tracks on this page",
        exact: true,
      })
      .check();
    await page.getByRole("button", { name: "Edit tags…", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("checkbox", { name: "Album", exact: true })
      .check();
    await page
      .getByRole("textbox", { name: "Batch Album", exact: true })
      .fill("Temporary batch album");
    await page
      .getByRole("button", { name: "Preview changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Apply changes", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.tunevault
            .invoke("snapshot")
            .then((s) =>
              s.tracks.every(
                (track: any) =>
                  track.metadata.album === "Temporary batch album",
              ),
            ),
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Edit tags…", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Undo previous revisions for selected tracks…",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Undo selected revisions", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.tunevault
            .invoke("snapshot")
            .then((s) =>
              s.tracks.every(
                (track: any) => track.metadata.album === "Ordered album",
              ),
            ),
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Tracks", exact: true }).click();
    // The undo creates newer metadata revisions; prepare the saved target scope again.
    const currentExport = await page.evaluate(
      (targetId) => window.tunevault.invoke("export.prepare", { targetId }),
      target.id,
    );
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) =>
              window.tunevault
                .invoke("snapshot")
                .then((s) => s.jobs.find((job: any) => job.id === id)?.status),
            currentExport.id,
          ),
        { timeout: 60000 },
      )
      .toBe("completed");
    await page
      .getByLabel("Filter library", { exact: true })
      .selectOption("ready");
    await expect(page.locator(".track-table tbody tr")).toHaveCount(2);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1024, 768),
    );
    const opener = page.locator(".track-name").first();
    await opener.click();
    const sheet = page.getByRole("dialog", {
      name: "Track details",
      exact: true,
    });
    await expect(sheet).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close track details", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(() =>
        document.querySelector(".inspector")?.contains(document.activeElement),
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".main-content")
        .evaluate((element) => (element as HTMLElement).inert),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(
      await page
        .locator(".main-content")
        .evaluate((element) => (element as HTMLElement).inert),
    ).toBe(false);
    await choose(app, backups, "chooseBackup");
    const backup = await page.evaluate(
      (path) =>
        window.tunevault.invoke("backup", { path, includeMedia: false }),
      backups,
    );
    await page.evaluate(
      (id) =>
        window.tunevault.invoke("tracks.edit", {
          ids: [id],
          changes: { title: "Changed after backup" },
        }),
      first.id,
    );
    await page
      .getByRole("button", { name: "Settings & About", exact: true })
      .click();
    await choose(app, backup.path, "chooseRestore");
    await page
      .getByRole("button", { name: "Restore validated backup…", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Review library restore" }),
    ).toBeVisible();
    expect(
      (
        await page.evaluate(() => window.tunevault.invoke("snapshot"))
      ).tracks.find((track: any) => track.id === first.id).metadata.title,
    ).toBe("Changed after backup");
    await page.keyboard.press("Escape");
    expect(
      (
        await page.evaluate(() => window.tunevault.invoke("snapshot"))
      ).tracks.find((track: any) => track.id === first.id).metadata.title,
    ).toBe("Changed after backup");
    await page
      .getByRole("button", { name: "Restore validated backup…", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Restore selected backup", exact: true })
      .click();
    await expect(
      page.getByText("Restored 3 tracks", { exact: true }),
    ).toBeVisible();
    const recovery = await page
      .getByLabel("Recovery backup", { exact: true })
      .inputValue();
    expect((await stat(join(recovery, "bundle.json"))).size).toBeGreaterThan(0);
    expect(
      (
        await page.evaluate(() => window.tunevault.invoke("snapshot"))
      ).tracks.find((track: any) => track.id === first.id).metadata.title,
    ).toBe("Z first");
  } finally {
    if (running) await close(app);
    for (const root of roots.reverse())
      await rm(root, { recursive: true, force: true });
  }
});
