import { test, expect, type ElectronApplication } from "@playwright/test";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  copyFile,
  writeFile,
  stat,
} from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { LibraryService } from "../../src/core/library";
import type { Job } from "../../src/shared/types";
import { launch, choose, capture, close } from "./launch";

test.skip(
  !!process.env.TUNEVAULT_UPGRADE_PHASE,
  "Separate installed-upgrade phase",
);

async function openWelcomeMenu(app: ElectronApplication) {
  await app.evaluate(({ Menu, BrowserWindow }) => {
    const help = Menu.getApplicationMenu()?.items.find(
      (item) => item.label.replaceAll("&", "") === "Help",
    );
    const welcome = help?.submenu?.items.find(
      (item) => item.label === "Welcome Guide…",
    );
    if (!welcome)
      throw new Error("Native Help > Welcome Guide… menu item is missing");
    welcome.click(
      welcome,
      BrowserWindow.getAllWindows()[0],
      {} as Electron.KeyboardEvent,
    );
  });
}

test("task setup chooses the real suggested vault, preserves consent and reopens from Help", async () => {
  const initial = await launch(undefined, { firstRun: true });
  const roots = [initial.root];
  let app = initial.app;
  let running = true;
  try {
    let page = await app.firstWindow();
    const music = join(initial.root, "music");
    await mkdir(music);
    await app.evaluate(
      ({ app }, path) => app.setPath("music", path),
      await realpath(music),
    );
    await expect(
      page.getByRole("heading", { name: "Welcome to TuneVault", exact: true }),
    ).toBeVisible();
    const suggestion = await page.evaluate(() =>
      window.tunevault.invoke("defaultFolder", { kind: "vault", info: true }),
    );
    expect(suggestion).toMatchObject({
      path: join(await realpath(music), "TuneVault", "Library"),
      exists: false,
    });
    expect(
      suggestion.availableBytes === null ||
        Number.isSafeInteger(suggestion.availableBytes),
    ).toBe(true);
    await expect(stat(suggestion.path)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(800, 700),
    );
    let blueLogo = "";
    for (const appearance of ["light", "dark"] as const) {
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
        const logo = page.locator("main img").first();
        await expect
          .poll(() =>
            logo.evaluate(
              (image: HTMLImageElement) =>
                image.complete && image.naturalWidth > 0,
            ),
          )
          .toBe(true);
        const image = await logo.getAttribute("src");
        if (accent === "blue") blueLogo = image!;
        else expect(image).not.toBe(blueLogo);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
    expect(
      await page.evaluate(() =>
        document
          .getAnimations()
          .some((animation) => animation.playState === "running"),
      ),
    ).toBe(false);
    await capture(
      app,
      "artifacts/screenshots/onboarding-welcome-dark-orange.png",
    );
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("checkbox", {
        name: /I understand and will only use TuneVault/,
      })
      .check();
    await page
      .getByRole("button", { name: "Agree and continue", exact: true })
      .click();
    const setup = page.getByRole("dialog", {
      name: "Set up your library",
      exact: true,
    });
    await expect(setup).toBeVisible();
    const next = setup.getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeDisabled();
    await setup
      .getByRole("button", { name: "Use this folder", exact: true })
      .click();
    const vault = await realpath(join(music, "TuneVault", "Library"));
    await expect(
      setup.getByRole("textbox", { name: "Library folder", exact: true }),
    ).toHaveValue(vault);
    await expect(next).toBeEnabled();
    await capture(app, "artifacts/screenshots/onboarding-choose-vault.png");
    await next.click();
    const add = setup.getByRole("heading", {
      name: "Add your music",
      exact: true,
    });
    await expect(add).toBeVisible();
    await expect(add).toBeFocused();
    await expect(setup.getByRole("status")).toContainText(/2.*2/);
    for (const name of [
      "Choose files…",
      "Choose folder…",
      "Import playlist file…",
    ]) {
      await expect(
        setup.getByRole("button", { name, exact: true }),
      ).toBeEnabled();
    }
    await capture(app, "artifacts/screenshots/onboarding-add-music.png");
    const references = "Title,Artist\nOwned reference,Fixture artist\n";
    const referenceFile = join(initial.root, "owned-playlist.csv");
    await writeFile(referenceFile, references);
    await expect(
      page.evaluate(
        (path) => window.tunevault.invoke("references.readFile", { path }),
        referenceFile,
      ),
    ).rejects.toThrow("not selected in a native dialog");
    await choose(app, referenceFile, "chooseReference");
    const read = await page.evaluate(
      (path) => window.tunevault.invoke("references.readFile", { path }),
      referenceFile,
    );
    expect(read).toMatchObject({
      name: "owned-playlist",
      format: "csv",
      text: references,
    });
    await setup
      .getByRole("button", { name: "Import playlist file…", exact: true })
      .click();
    const review = page.getByRole("dialog", { name: "Add music", exact: true });
    await expect(
      review.getByRole("textbox", { name: "Playlist data", exact: true }),
    ).toHaveValue(references);
    expect(
      (await page.evaluate(() => window.tunevault.invoke("snapshot")))
        .playlists,
    ).toHaveLength(0);
    await page.keyboard.press("Escape");
    await expect(review).toHaveCount(0);
    await expect(setup).toBeVisible();
    await setup.getByRole("button", { name: "Later", exact: true }).click();
    await expect(setup).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    expect(
      (await page.evaluate(() => window.tunevault.invoke("snapshot"))).settings,
    ).toMatchObject({
      disclaimerAccepted: true,
      onboarded: true,
      onlineAcknowledged: false,
      vault,
    });
    await close(app);
    running = false;
    const reopened = await launch(initial.dataDir, { firstRun: true });
    roots.push(reopened.root);
    app = reopened.app;
    running = true;
    page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const opener = page
      .getByRole("button", { name: "Add music…", exact: true })
      .first();
    await opener.focus();
    await openWelcomeMenu(app);
    await expect(
      page.getByRole("dialog", { name: "Set up your library", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByRole("button", { name: "Show welcome guide", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Set up your library", exact: true }),
    ).toBeVisible();
  } finally {
    if (running) await close(app);
    for (const root of roots.reverse())
      await rm(root, { recursive: true, force: true });
  }
});

test("a previously queued local import waits for mandatory consent before resuming", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "tunevault-consent-queue-"));
  const dataDir = join(fixture, "data"),
    vault = join(fixture, "vault");
  await mkdir(vault);
  const source = join(fixture, "owned-tone.opus");
  await copyFile(resolve("tests/fixtures/audio/tone.opus"), source);
  const service = new LibraryService({
    dataDir: join(dataDir, "library"),
    toolsDir: resolve("resources/tools", `${process.platform}-${process.arch}`),
  });
  await service.dispatch("settings.update", { vault });
  service.close();
  const job: Job = {
    id: "previously-approved-local-import",
    kind: "import",
    status: "queued",
    progress: 0,
    message: "Waiting",
    payload: { paths: [source] },
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const db = new DatabaseSync(join(dataDir, "library", "library.sqlite"));
  db.prepare("INSERT INTO jobs(id,data) VALUES(?,?)").run(
    job.id,
    JSON.stringify(job),
  );
  db.close();
  const { app, root } = await launch(dataDir, { firstRun: true });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Welcome to TuneVault", exact: true }),
    ).toBeVisible();
    let state = await page.evaluate(() => window.tunevault.invoke("snapshot"));
    expect(state.jobs.find((item: Job) => item.id === job.id)?.status).toBe(
      "queued",
    );
    expect(state.tracks).toHaveLength(0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Agree and continue", exact: true }),
    ).toBeDisabled();
    state = await page.evaluate(() => window.tunevault.invoke("snapshot"));
    expect(state.jobs.find((item: Job) => item.id === job.id)?.status).toBe(
      "queued",
    );
    await page
      .getByRole("checkbox", {
        name: /I understand and will only use TuneVault/,
      })
      .check();
    await page
      .getByRole("button", { name: "Agree and continue", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await page.evaluate(() => window.tunevault.invoke("snapshot"))
          ).jobs.find((item: Job) => item.id === job.id)?.status,
        { timeout: 90000 },
      )
      .toBe("completed");
    state = await page.evaluate(() => window.tunevault.invoke("snapshot"));
    expect(state.tracks).toHaveLength(1);
    expect(state.tracks[0].codec).toBe("opus");
    expect(state.settings.onlineAcknowledged).toBe(false);
  } finally {
    await close(app);
    await rm(root, { recursive: true, force: true });
    await rm(fixture, { recursive: true, force: true });
  }
});
