import { afterEach, expect, it, vi } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { LibraryService } from "../../src/core/library";
import { blankMetadata } from "../../src/core/media";
import type { Job, Receipt, Target, Track } from "../../src/shared/types";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture() {
  const root = await realpath(
    await mkdtemp(path.join(tmpdir(), "tunevault-restore-validation-")),
  );
  const dataDir = path.join(root, "data"),
    vault = path.join(root, "library"),
    destination = path.join(root, "destination");
  await mkdir(vault);
  await mkdir(destination);
  const service = new LibraryService({ dataDir, toolsDir: "unused" });
  cleanup.push(async () => {
    service.close();
    await rm(root, { recursive: true, force: true });
  });
  await service.dispatch("settings.update", { vault });
  const file = path.join(vault, "owned-fixture.mp3");
  // Restore checks byte identity here; these synthetic bytes are not a codec fixture.
  const media = Buffer.from("owned backup byte fixture A");
  await writeFile(file, media);
  const track: Track = {
    id: "track-a",
    hash: createHash("sha256").update(media).digest("hex"),
    path: file,
    originalPath: file,
    metadata: { ...blankMetadata(), title: "Keep this recording" },
    locks: [],
    origins: { title: "user" },
    revision: 1,
    artwork: null,
    favorite: false,
    missing: false,
    codec: "mp3",
    container: "mp3",
    duration: 1,
    bitrate: 192000,
    sampleRate: 44100,
    bytes: media.length,
    source: null,
  };
  const seed = (table: string, record: { id: string }) => {
    const database = new DatabaseSync(path.join(dataDir, "library.sqlite"));
    database
      .prepare(`INSERT INTO ${table}(id,data) VALUES(?,?)`)
      .run(record.id, JSON.stringify(record));
    database.close();
  };
  seed("tracks", track);
  const playlist = (await service.dispatch("playlists.create", {
    name: "Keep this playlist",
    trackIds: [track.id],
  })) as { id: string };
  const target = (await service.dispatch("targets.create", {
    name: "Keep this player",
    destination,
    transport: "folder",
    playlistIds: [playlist.id],
  })) as Target;
  const timestamp = new Date().toISOString();
  const job: Job = {
    id: "batch-a",
    kind: "export",
    status: "completed",
    progress: 1,
    message: "Synthetic completed export record",
    payload: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: 1,
  };
  seed("jobs", job);
  const receipt: Receipt = {
    id: "receipt-a",
    targetId: target.id,
    batchId: job.id,
    trackId: track.id,
    trackRevision: 1,
    profileRevision: target.profile.revision,
    playlistRevision: `${playlist.id}:1`,
    hash: track.hash,
    path: path.join(destination, "historical.mp3"),
    evidence: "exported",
    createdAt: timestamp,
  };
  seed("receipts", receipt);
  async function backup(includeMedia: boolean) {
    const saved = (await service.dispatch("backup", {
      path: root,
      includeMedia,
    })) as { path: string };
    const bundleFile = path.join(saved.path, "bundle.json");
    const bundle = JSON.parse(await readFile(bundleFile, "utf8"));
    return { ...saved, bundleFile, bundle };
  }
  async function assertNoRecovery() {
    expect(
      (await readdir(dataDir)).filter((name) =>
        name.startsWith("TuneVault-backup-"),
      ),
    ).toEqual([]);
  }
  return {
    root,
    service,
    vault,
    file,
    media,
    track,
    target,
    backup,
    assertNoRecovery,
  };
}

it.each([
  [
    "target without profile",
    (snapshot: any) => {
      delete snapshot.targets[0].profile;
    },
  ],
  [
    "profile with invalid artwork bounds",
    (snapshot: any) => {
      snapshot.targets[0].profile.artworkSize = 100000;
    },
  ],
  [
    "duplicate playlist identity",
    (snapshot: any) => {
      snapshot.playlists.push(structuredClone(snapshot.playlists[0]));
    },
  ],
  [
    "duplicate occurrence across playlists",
    (snapshot: any) => {
      snapshot.playlists.push({
        ...structuredClone(snapshot.playlists[0]),
        id: "playlist-copy",
      });
    },
  ],
  [
    "duplicate receipt identity",
    (snapshot: any) => {
      snapshot.receipts.push(structuredClone(snapshot.receipts[0]));
    },
  ],
  [
    "receipt referring to unknown track",
    (snapshot: any) => {
      snapshot.receipts[0].trackId = "unknown-track";
    },
  ],
  [
    "unmatched confirmation receipt",
    (snapshot: any) => {
      snapshot.receipts[0].evidence = "user-confirmed";
      snapshot.receipts[0].confirmsReceiptId = "unknown-receipt";
    },
  ],
  [
    "malformed reference duration",
    (snapshot: any) => {
      snapshot.playlists[0].entries[0].reference.duration = "invalid duration";
    },
  ],
  [
    "malformed historical job",
    (snapshot: any) => {
      snapshot.jobs[0].status = "untrusted-state";
    },
  ],
  [
    "null field origins",
    (snapshot: any) => {
      snapshot.tracks[0].origins = null;
    },
  ],
  [
    "non-text metadata",
    (snapshot: any) => {
      snapshot.tracks[0].metadata.title = { invalid: true };
    },
  ],
  [
    "malformed source record",
    (snapshot: any) => {
      snapshot.tracks[0].source = "not a source object";
    },
  ],
  [
    "non-numeric media quality",
    (snapshot: any) => {
      snapshot.tracks[0].bitrate = "invalid";
    },
  ],
  [
    "non-text codec",
    (snapshot: any) => {
      snapshot.tracks[0].codec = [];
    },
  ],
  [
    "non-boolean favorite",
    (snapshot: any) => {
      snapshot.tracks[0].favorite = {};
    },
  ],
  [
    "malformed restored preference",
    (snapshot: any) => {
      snapshot.settings.metadataOnline = "yes";
    },
  ],
] as const)(
  "rejects a %s before recovery copies or index replacement",
  async (_name, corrupt) => {
    const { service, backup, assertNoRecovery, vault } = await fixture();
    const saved = await backup(true);
    corrupt(saved.bundle.snapshot);
    await writeFile(saved.bundleFile, JSON.stringify(saved.bundle));
    const before = await service.snapshot(),
      beforeFiles = await readdir(vault);
    await expect(
      service.dispatch("restore", { path: saved.path }),
    ).rejects.toThrow();
    expect(await service.snapshot()).toEqual(before);
    expect(await readdir(vault)).toEqual(beforeFiles);
    await assertNoRecovery();
  },
);

it("accepts a valid portable index and retains history while clearing write destinations", async () => {
  const { service, backup, track, target } = await fixture();
  const saved = await backup(true);
  await expect(
    service.dispatch("restore", { path: saved.path }),
  ).resolves.toMatchObject({ restored: 1, missing: 0 });
  const snapshot = await service.snapshot();
  expect(snapshot.tracks[0]).toMatchObject({
    id: track.id,
    hash: track.hash,
    metadata: track.metadata,
  });
  expect(snapshot.playlists[0].entries[0].trackId).toBe(track.id);
  expect(snapshot.targets[0]).toMatchObject({
    id: target.id,
    destination: "",
    connected: false,
    profile: target.profile,
  });
  expect(snapshot.receipts[0]).toMatchObject({
    id: "receipt-a",
    targetId: target.id,
    trackId: track.id,
  });
  expect(snapshot.jobs[0]).toMatchObject({
    status: "cancelled",
    payload: { restored: true },
  });
});

it("rejects backup media changed between validation and copy without replacing the existing index", async () => {
  const { service, backup, track } = await fixture();
  const saved = await backup(true),
    before = await service.snapshot();
  const copy = service["archiveCopy"].bind(service);
  vi.spyOn(service as any, "archiveCopy").mockImplementation(
    async (...args: unknown[]) => {
      const [source, id, extension, hash] = args as [
        string,
        string,
        string,
        string,
      ];
      await writeFile(source, "Synthetic replacement after validation");
      return copy(source, id, extension, hash);
    },
  );
  await expect(
    service.dispatch("restore", { path: saved.path }),
  ).rejects.toThrow("hash mismatch");
  expect(await service.snapshot()).toEqual(before);
  expect(
    createHash("sha256")
      .update(await readFile(track.path))
      .digest("hex"),
  ).toBe(track.hash);
});

it("rejects changed same-path media during metadata-only restore and leaves existing state untouched", async () => {
  const { service, backup, file, assertNoRecovery } = await fixture();
  const saved = await backup(false);
  const changed = Buffer.from("owned backup byte fixture B");
  await writeFile(file, changed);
  const before = await service.snapshot();
  await expect(
    service.dispatch("restore", { path: saved.path }),
  ).rejects.toThrow("Existing media differs");
  expect(await service.snapshot()).toEqual(before);
  expect(await readFile(file)).toEqual(changed);
  await assertNoRecovery();
});

it("still restores missing metadata-only media as missing without granting a new path", async () => {
  const { service, backup, file, track } = await fixture();
  const saved = await backup(false);
  await unlink(file);
  await expect(
    service.dispatch("restore", { path: saved.path }),
  ).resolves.toMatchObject({ restored: 1, missing: 1 });
  expect((await service.snapshot()).tracks[0]).toMatchObject({
    id: track.id,
    path: file,
    missing: true,
  });
});

it("retains M3U's normalized unknown duration through backup and restore", async () => {
  const { service, backup } = await fixture();
  await service.dispatch("references.import", {
    name: "Unknown duration",
    format: "m3u",
    text: "#EXTM3U\n#EXTINF:-1,Owned reference\nowned.mp3\n",
  });
  const saved = await backup(false);
  await service.dispatch("restore", { path: saved.path });
  expect(
    (await service.snapshot()).playlists.find(
      (playlist) => playlist.name === "Unknown duration",
    )?.entries[0].reference.duration,
  ).toBeNull();
});

it("restores safe preferences while preserving current permissions, onboarding and library location", async () => {
  const { service, backup, track } = await fixture();
  await service.dispatch("settings.update", {
    appearance: "dark",
    accent: "orange",
    view: "albums",
    filter: "favorites",
    selection: [track.id, "removed-track", track.id],
    autoUpdates: false,
    metadataOnline: false,
    metadataServices: { musicbrainz: false, coverArtArchive: true },
    tipsSeen: ["import", "playlist"],
  });
  const saved = await backup(false);
  Object.assign(saved.bundle.snapshot.settings, {
    vault: "/unapproved-location",
    disclaimerAccepted: true,
    disclaimerVersion: 999,
    onboarded: true,
    onlineAcknowledged: true,
  });
  saved.bundle.snapshot.settings.metadataServices.acoustid = true;
  await writeFile(saved.bundleFile, JSON.stringify(saved.bundle));
  await service.dispatch("settings.update", {
    appearance: "system",
    accent: "blue",
    view: "tracks",
    filter: "all",
    selection: [],
    autoUpdates: true,
    metadataOnline: true,
    metadataServices: { musicbrainz: true, coverArtArchive: false },
    tipsSeen: [],
    disclaimerAccepted: false,
    onboarded: false,
    onlineAcknowledged: false,
  });
  const permissions = (await service.snapshot()).settings;
  await service.dispatch("restore", { path: saved.path });
  const restored = (await service.snapshot()).settings;
  expect(restored).toMatchObject({
    appearance: "dark",
    accent: "orange",
    view: "albums",
    filter: "favorites",
    selection: [track.id],
    autoUpdates: false,
    metadataOnline: false,
    metadataServices: { musicbrainz: false, coverArtArchive: true },
    tipsSeen: ["import", "playlist"],
  });
  for (const key of [
    "vault",
    "disclaimerAccepted",
    "disclaimerVersion",
    "onboarded",
    "onlineAcknowledged",
  ] as const)
    expect(restored[key]).toEqual(permissions[key]);
  expect(restored.metadataServices).not.toHaveProperty("acoustid");
});

it("fills older optional metadata fields and preserves a valid bounded source record", async () => {
  const { service, backup } = await fixture();
  const saved = await backup(false),
    record = saved.bundle.snapshot.tracks[0];
  delete record.metadata.musicbrainzId;
  delete record.metadata.composer;
  delete record.origins;
  record.source = {
    provider: "youtube",
    id: "aaaaaaaaaaa",
    url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
    title: "Owned source fixture",
    uploader: "Fixture",
    description: "Inert <script>text</script>",
    acquiredAt: new Date().toISOString(),
    quality: "Lossy history",
    chapters: [{ start: 0, title: "Opening" }],
  };
  await writeFile(saved.bundleFile, JSON.stringify(saved.bundle));
  await service.dispatch("restore", { path: saved.path });
  expect((await service.snapshot()).tracks[0]).toMatchObject({
    metadata: { musicbrainzId: "", composer: "" },
    origins: {},
    source: record.source,
  });
});
