import { afterEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
  symlink,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { LibraryService } from "../../src/core/library";
import { run } from "../../src/core/media";
import { verifyTools } from "../../src/update/tools";
import type { Job } from "../../src/shared/types";
const toolsDir = path.resolve(
  "resources/tools",
  `${process.platform}-${process.arch}`,
);
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function root() {
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "tunevault-recovery-")),
  );
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
function service(directory: string) {
  const instance = new LibraryService({
    dataDir: path.join(directory, "data"),
    toolsDir,
  });
  cleanups.push(async () => instance.close());
  return instance;
}
async function seedV1(directory: string, invalidForeignKey = false) {
  const dataDir = path.join(directory, "data");
  await mkdir(dataDir);
  const db = new DatabaseSync(path.join(dataDir, "library.sqlite"));
  for (const table of [
    "tracks",
    "playlists",
    "targets",
    "jobs",
    "receipts",
    "revisions",
    "previews",
    "cache",
  ])
    db.exec(
      `CREATE TABLE ${table}(id TEXT PRIMARY KEY NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)))`,
    );
  db.exec(
    "CREATE TABLE settings(id INTEGER PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE playlist_occurrences(id TEXT PRIMARY KEY,playlist_id TEXT,track_id TEXT,ordinal INTEGER); CREATE TABLE receipt_links(receipt_id TEXT PRIMARY KEY,track_id TEXT,target_id TEXT); PRAGMA user_version=1",
  );
  const track = {
    id: "track-a",
    path: "/missing/track.mp3",
    metadata: { title: "Preserved" },
    hash: "a".repeat(64),
  };
  const playlist = {
    id: "playlist-a",
    entries: [
      {
        id: "occurrence-a",
        trackId: invalidForeignKey ? "unknown-track" : "track-a",
      },
      { id: "occurrence-b", trackId: "track-a" },
      { id: "unavailable", trackId: null },
    ],
  };
  db.prepare("INSERT INTO tracks VALUES(?,?)").run(
    track.id,
    JSON.stringify(track),
  );
  db.prepare("INSERT INTO playlists VALUES(?,?)").run(
    playlist.id,
    JSON.stringify(playlist),
  );
  db.prepare("INSERT INTO targets VALUES(?,?)").run(
    "target-a",
    JSON.stringify({ id: "target-a" }),
  );
  db.prepare("INSERT INTO receipts VALUES(?,?)").run(
    "receipt-a",
    JSON.stringify({
      id: "receipt-a",
      targetId: "target-a",
      trackId: "track-a",
    }),
  );
  db.close();
  return { dataDir, track, playlist };
}
describe("numbered SQLite migration and pre-migration recovery", () => {
  it("creates schema2 without redundant backup for a fresh database", async () => {
    const directory = await root();
    const instance = service(directory);
    instance.close();
    const db = new DatabaseSync(path.join(directory, "data/library.sqlite"), {
      readOnly: true,
    });
    expect(db.prepare("PRAGMA user_version").get()).toMatchObject({
      user_version: 2,
    });
    db.close();
    expect(
      (await readdir(path.join(directory, "data"))).filter((name) =>
        name.startsWith("before-schema-"),
      ),
    ).toEqual([]);
  });
  it("backs up actual schema1 and preserves duplicate occurrence identities during upgrade", async () => {
    const directory = await root();
    const { dataDir, playlist } = await seedV1(directory);
    const instance = service(directory);
    instance.close();
    const files = (await readdir(dataDir)).filter((name) =>
      name.startsWith("before-schema-"),
    );
    expect(files).toHaveLength(1);
    const before = new DatabaseSync(path.join(dataDir, files[0]), {
      readOnly: true,
    });
    expect(before.prepare("PRAGMA user_version").get()).toMatchObject({
      user_version: 1,
    });
    expect(before.prepare("PRAGMA quick_check").get()).toMatchObject({
      quick_check: "ok",
    });
    expect(
      JSON.parse(
        (before.prepare("SELECT data FROM playlists").get() as any).data,
      ),
    ).toEqual(playlist);
    before.close();
    const migrated = new DatabaseSync(path.join(dataDir, "library.sqlite"), {
      readOnly: true,
    });
    expect(migrated.prepare("PRAGMA user_version").get()).toMatchObject({
      user_version: 2,
    });
    expect(
      migrated
        .prepare(
          "SELECT id,track_id,ordinal FROM playlist_occurrences ORDER BY ordinal",
        )
        .all(),
    ).toEqual([
      { id: "occurrence-a", track_id: "track-a", ordinal: 0 },
      { id: "occurrence-b", track_id: "track-a", ordinal: 1 },
      { id: "unavailable", track_id: null, ordinal: 2 },
    ]);
    expect(migrated.prepare("SELECT * FROM receipt_links").get()).toMatchObject(
      { receipt_id: "receipt-a", track_id: "track-a", target_id: "target-a" },
    );
    expect(migrated.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    migrated.close();
    service(directory).close();
    expect(
      (await readdir(dataDir)).filter((name) =>
        name.startsWith("before-schema-"),
      ),
    ).toEqual(files);
  });
  it("rolls back an invalid migration and retains a readable pre-migration backup", async () => {
    const directory = await root();
    const { dataDir, playlist } = await seedV1(directory, true);
    expect(() => new LibraryService({ dataDir, toolsDir })).toThrow(
      "FOREIGN KEY",
    );
    const original = new DatabaseSync(path.join(dataDir, "library.sqlite"), {
      readOnly: true,
    });
    expect(original.prepare("PRAGMA user_version").get()).toMatchObject({
      user_version: 1,
    });
    expect(
      JSON.parse(
        (original.prepare("SELECT data FROM playlists").get() as any).data,
      ),
    ).toEqual(playlist);
    expect(
      original
        .prepare("SELECT COUNT(*) AS count FROM playlist_occurrences")
        .get(),
    ).toMatchObject({ count: 0 });
    original.close();
    const files = (await readdir(dataDir)).filter((name) =>
      name.startsWith("before-schema-"),
    );
    expect(files).toHaveLength(1);
    const backup = new DatabaseSync(path.join(dataDir, files[0]), {
      readOnly: true,
    });
    expect(backup.prepare("PRAGMA quick_check").get()).toMatchObject({
      quick_check: "ok",
    });
    backup.close();
  });
  it("rejects a corrupted database without replacing its bytes or inventing a backup", async () => {
    const directory = await root();
    const dataDir = path.join(directory, "data");
    await mkdir(dataDir);
    const bytes = Buffer.from("corrupted existing TuneVault library");
    const file = path.join(dataDir, "library.sqlite");
    await writeFile(file, bytes);
    expect(() => new LibraryService({ dataDir, toolsDir })).toThrow();
    expect(await readFile(file)).toEqual(bytes);
    expect(
      (await readdir(dataDir)).filter((name) =>
        name.startsWith("before-schema-"),
      ),
    ).toEqual([]);
  });
});
async function importedFixture() {
  const directory = await root(),
    vault = path.join(directory, "vault");
  await mkdir(vault);
  const instance = service(directory);
  await instance.dispatch("settings.update", { vault });
  const tools = await verifyTools(toolsDir);
  const source = path.join(directory, "owned-synthetic.mp3");
  await run(tools.ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=330:duration=1",
    "-c:a",
    "libmp3lame",
    "-metadata",
    "title=Original owned tone",
    source,
  ]);
  const queued = (await instance.dispatch("import.start", {
    paths: [source],
  })) as Job;
  for (let attempts = 0; attempts < 400; attempts++) {
    const job = (await instance.snapshot()).jobs.find(
      (job) => job.id === queued.id,
    )!;
    if (!["queued", "running"].includes(job.status)) {
      expect(job.status, job.message).toBe("completed");
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  expect((await instance.snapshot()).tracks).toHaveLength(1);
  const track = (await instance.snapshot()).tracks[0];
  const image = path.join(directory, "cover.png");
  await sharp({
    create: { width: 60, height: 60, channels: 3, background: "#00aced" },
  })
    .png()
    .toFile(image);
  await instance.dispatch("tracks.artwork", { ids: [track.id], path: image });
  await instance.dispatch("tracks.edit", {
    ids: [track.id],
    changes: { title: "Before relocation" },
    addLocks: ["title"],
  });
  return {
    directory,
    vault,
    source,
    instance,
    track: (await instance.snapshot()).tracks[0],
  };
}
describe("explicitly re-pointing a moved managed vault", () => {
  it("verifies current media/revisions/art after an actual rename, then edits and undoes in the chosen vault", async () => {
    const { directory, vault, instance, track, source } =
      await importedFixture();
    const files = await readdir(vault, { recursive: true });
    const moved = path.join(directory, "Moved vault");
    await rename(vault, moved);
    expect((await instance.snapshot()).tracks[0].missing).toBe(true);
    await instance.dispatch("settings.update", { vault: moved });
    const located = (await instance.snapshot()).tracks[0];
    expect(located.path).toBe(
      path.join(moved, path.relative(vault, track.path)),
    );
    expect(located.artwork).toBe(
      path.join(moved, path.relative(vault, track.artwork!)),
    );
    expect(located.artworkOriginal).toBe(
      path.join(moved, path.relative(vault, track.artworkOriginal!)),
    );
    expect(located.missing).toBe(false);
    expect(await readdir(moved, { recursive: true })).toEqual(files);
    await instance.dispatch("tracks.edit", {
      ids: [track.id],
      changes: { title: "After relocation" },
    });
    await instance.dispatch("tracks.undo", { ids: [track.id] });
    expect((await instance.snapshot()).tracks[0]).toMatchObject({
      metadata: { title: "Before relocation" },
      locks: ["title"],
      missing: false,
    });
    await instance.dispatch("tracks.undo", { ids: [track.id] });
    expect((await instance.snapshot()).tracks[0].metadata.title).toBe(
      "Original owned tone",
    );
    expect(
      (await instance.snapshot()).tracks[0].path.startsWith(moved + path.sep),
    ).toBe(true);
    expect(await readFile(source)).toBeTruthy();
  }, 180000);
  it("aborts on a changed media revision and preserves previous settings/index", async () => {
    const { directory, vault, instance, track } = await importedFixture();
    const before = await instance.snapshot(),
      moved = path.join(directory, "Moved vault");
    await rename(vault, moved);
    await writeFile(
      path.join(moved, path.relative(vault, track.path)),
      "corrupted replacement",
    );
    await expect(
      instance.dispatch("settings.update", { vault: moved, accent: "orange" }),
    ).rejects.toThrow("hash mismatch");
    const after = await instance.snapshot();
    expect(after.settings).toEqual(before.settings);
    expect(after.tracks[0].path).toBe(track.path);
    expect(after.tracks[0].metadata).toEqual(track.metadata);
  }, 180000);
  it("rejects symlink escapes instead of adopting external artwork after a move", async () => {
    const { directory, vault, instance, track } = await importedFixture();
    const moved = path.join(directory, "Moved vault");
    await rename(vault, moved);
    const art = path.join(moved, path.relative(vault, track.artwork!)),
      external = path.join(directory, "external.jpg");
    await writeFile(external, await readFile(art));
    await rm(art);
    await symlink(external, art);
    await expect(
      instance.dispatch("settings.update", { vault: moved }),
    ).rejects.toThrow("Symlink");
    expect((await instance.snapshot()).settings.vault).toBe(vault);
    expect((await instance.snapshot()).tracks[0].path).toBe(track.path);
  }, 180000);
});
