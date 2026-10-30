import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  mkdir,
  mkdtemp,
  rm,
  readFile,
  writeFile,
  stat,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { parseFile } from "music-metadata";
import { verifyTools, type ToolPaths } from "../../src/update/tools";
import { run, inspect, writeMedia, artwork } from "../../src/core/media";
import { LibraryService } from "../../src/core/library";
import * as media from "../../src/core/media";
import type { Job, Track, Playlist, Target } from "../../src/shared/types";
const toolsDir = path.resolve(
  "resources/tools",
  `${process.platform}-${process.arch}`,
);
let tools: ToolPaths;
const cleanups: (() => Promise<void>)[] = [];
it("shutdown stops an active media subprocess and its child", async () => {
  let ready!: (pids: number[]) => void;
  const started = new Promise<number[]>((resolve) => {
    ready = resolve;
  });
  const running = run(
    process.execPath,
    [
      "-e",
      `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(JSON.stringify([process.pid,child.pid]));setInterval(()=>{},1000)`,
    ],
    undefined,
    (line) => ready(JSON.parse(line)),
  ).catch((error) => error);
  const pids = await started;
  await media.stopMediaTools();
  expect(await running).toBeInstanceOf(Error);
  await expect
    .poll(
      () =>
        pids.every((pid) => {
          try {
            process.kill(pid, 0);
            return false;
          } catch {
            return true;
          }
        }),
      { timeout: 5000 },
    )
    .toBe(true);
}, 15000);
beforeAll(async () => {
  tools = await verifyTools(toolsDir);
}, 180000);
afterEach(async () => {
  vi.restoreAllMocks();
  for (const clean of cleanups.splice(0).reverse()) await clean();
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "tunevault-media-"));
  const vault = path.join(root, "vault"),
    destination = path.join(root, "destination");
  await mkdir(vault);
  await mkdir(destination);
  const service = new LibraryService({
    dataDir: path.join(root, "data"),
    toolsDir,
  });
  cleanups.push(async () => {
    service.close();
    await rm(root, { recursive: true, force: true });
  });
  await service.dispatch("settings.update", { vault });
  return { root, vault, destination, service };
}
async function audio(
  root: string,
  name = "synthetic.mp3",
  codec = "libmp3lame",
) {
  const file = path.join(root, name);
  await run(tools.ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1.5",
    "-c:a",
    codec,
    "-metadata",
    "title=Test 銀の狼",
    "-metadata",
    "artist=Synthetic Fixture",
    "-metadata",
    "album=Owned test tones",
    "-metadata",
    "track=2/8",
    file,
  ]);
  return file;
}
async function complete(service: LibraryService, job: Job): Promise<Job> {
  for (let i = 0; i < 300; i++) {
    const current = (await service.snapshot()).jobs.find(
      (j) => j.id === job.id,
    )!;
    if (!["running", "queued"].includes(current.status)) return current;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Job did not complete");
}
describe("actual bundled media processing", () => {
  it("expires approved mapping suggestions without detaching saved occurrences and ignores missing media", async () => {
    const { root, service } = await fixture();
    const source = await audio(root);
    expect(
      (
        await complete(
          service,
          (await service.dispatch("import.start", { paths: [source] })) as Job,
        )
      ).status,
    ).toBe("completed");
    const track = (await service.snapshot()).tracks[0];
    const input = {
      format: "csv",
      text: "Title,Artist\nReference,Reference artist",
    };
    const first = (await service.dispatch(
      "references.import",
      input,
    )) as Playlist;
    await service.dispatch("references.attach", {
      playlistId: first.id,
      occurrenceId: first.entries[0].id,
      trackId: track.id,
    });
    expect(
      ((await service.dispatch("references.import", input)) as Playlist)
        .entries[0].trackId,
    ).toBe(track.id);
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(
      ((await service.dispatch("references.import", input)) as Playlist)
        .entries[0].trackId,
    ).toBeNull();
    expect(
      (await service.snapshot()).playlists.find(
        (playlist) => playlist.id === first.id,
      )?.entries[0].trackId,
    ).toBe(track.id);
    clock.mockRestore();
    await rm(track.path);
    expect(
      ((await service.dispatch("references.import", input)) as Playlist)
        .entries[0].trackId,
    ).toBeNull();
  }, 120000);
  it("preserves unmodelled tags and original-resolution embedded artwork across a tag edit", async () => {
    const { root, service } = await fixture();
    const tone = await audio(root);
    const image = path.join(root, "original.png");
    await sharp({
      create: { width: 1200, height: 1200, channels: 3, background: "#aabbcc" },
    })
      .png()
      .toFile(image);
    const source = path.join(root, "complete.mp3");
    await run(tools.ffmpeg, [
      "-v",
      "error",
      "-i",
      tone,
      "-i",
      image,
      "-map",
      "0:a",
      "-map",
      "1:v",
      "-c",
      "copy",
      "-disposition:v",
      "attached_pic",
      "-metadata",
      "lyrics=Owned synthetic lyrics",
      "-metadata",
      "replaygain_track_gain=-4.00 dB",
      "-id3v2_version",
      "3",
      source,
    ]);
    const before = (await parseFile(source)).common;
    expect(
      (
        await complete(
          service,
          (await service.dispatch("import.start", { paths: [source] })) as Job,
        )
      ).status,
    ).toBe("completed");
    let track = (await service.snapshot()).tracks[0];
    expect(await readFile(track.artworkOriginal!)).toEqual(
      await readFile(image),
    );
    expect((await sharp(track.artwork!).metadata()).width).toBe(600);
    await service.dispatch("tracks.edit", {
      ids: [track.id],
      changes: { title: "Edited only title", date: "2026-10" },
    });
    track = (await service.snapshot()).tracks[0];
    const after = (await parseFile(track.path)).common;
    expect(after.lyrics).toEqual(before.lyrics);
    expect(before.replaygain_track_gain).toBeDefined();
    expect(after.replaygain_track_gain).toEqual(before.replaygain_track_gain);
    expect((await inspect(track.path, tools)).metadata.date).toBe("2026-10");
  }, 120000);
  it.each(["aac", "aiff", "wav", "ogg", "opus", "webm"])(
    "edits %s audio with artwork and preserves its codec",
    async (extension) => {
      const { root, service } = await fixture();
      let source: string;
      if (["ogg", "opus", "webm"].includes(extension)) {
        source = path.join(root, `tone.${extension}`);
        await copyFile(
          path.resolve(`tests/fixtures/audio/tone.${extension}`),
          source,
        );
      } else
        source = await audio(
          root,
          `tone.${extension}`,
          extension === "aac"
            ? "aac"
            : extension === "aiff"
              ? "pcm_s16be"
              : "pcm_s16le",
        );
      const job = await complete(
        service,
        (await service.dispatch("import.start", { paths: [source] })) as Job,
      );
      expect(job.status, job.message).toBe("completed");
      let track = (await service.snapshot()).tracks[0];
      const codec = track.codec;
      const image = path.join(root, "cover.png");
      await sharp({
        create: { width: 64, height: 64, channels: 3, background: "#123abc" },
      })
        .png()
        .toFile(image);
      await service.dispatch("tracks.artwork", {
        ids: [track.id],
        path: image,
        padding: true,
      });
      await service.dispatch("tracks.edit", {
        ids: [track.id],
        changes: {
          title: "Edited synthetic",
          artist: "AC/DC",
          date: "20261029",
          trackNumber: "007",
        },
      });
      track = (await service.snapshot()).tracks[0];
      const result = await inspect(track.path, tools);
      expect(result.codec).toBe(codec);
      expect(result.metadata).toMatchObject({
        title: "Edited synthetic",
        artist: "AC/DC",
        date: "2026-10-29",
        trackNumber: "7",
      });
      expect(
        await media.embeddedArtwork(
          track.path,
          path.join(root, "decoded"),
          tools,
        ),
      ).toBeTruthy();
    },
    120000,
  );
  it("resumes durable queued imports after startup while interrupted work stays retryable", async () => {
    const { root, service } = await fixture();
    const file = await audio(root);
    service.close();
    const database = new DatabaseSync(
      path.join(root, "data", "library.sqlite"),
    );
    const queued: Job = {
      id: "queued-restart",
      kind: "import",
      status: "queued",
      progress: 0,
      message: "Waiting",
      payload: { paths: [file] },
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    for (const job of [
      queued,
      { ...queued, id: "interrupted-restart", status: "running" },
    ])
      database
        .prepare("INSERT INTO jobs(id,data) VALUES(?,?)")
        .run(job.id, JSON.stringify(job));
    database.close();
    const restarted = new LibraryService({
      dataDir: path.join(root, "data"),
      toolsDir,
    });
    cleanups.push(async () => restarted.close());
    expect(
      (await restarted.snapshot()).jobs.find(
        (job) => job.id === "interrupted-restart",
      )?.status,
    ).toBe("interrupted");
    restarted.resumeQueued();
    expect((await complete(restarted, queued)).status).toBe("completed");
    expect((await restarted.snapshot()).tracks).toHaveLength(1);
  }, 120000);
  it.each([
    ["mp3", "libmp3lame", "mp3"],
    ["m4a", "aac", "aac"],
    ["m4a", "alac", "alac"],
    ["flac", "flac", "flac"],
  ])(
    "independently probes and tags %s/%s with decodable cover",
    async (ext, encoder, codec) => {
      const { root } = await fixture();
      const source = await audio(root, `input.${ext}`, encoder);
      const info = await inspect(source, tools);
      expect(info.codec).toBe(codec);
      expect(info.metadata.title).toBe("Test 銀の狼");
      expect(info.metadata.trackNumber).toBe("2");
      const png = path.join(root, "cover.png");
      await sharp({
        create: { width: 100, height: 80, channels: 3, background: "#0088cc" },
      })
        .png()
        .toFile(png);
      const image = await artwork(png, path.join(root, "art"));
      const track: Track = {
        ...info,
        id: "test",
        path: source,
        originalPath: source,
        artwork: image,
        revision: 1,
        favorite: false,
        missing: false,
        source: null,
        metadata: {
          ...info.metadata,
          title: "Edited 孤狼",
          artist: "New artist",
          albumArtist: "Album Artist",
          genre: "Electronic",
          composer: "Test Composer",
          comment: "Owned synthetic audio",
          date: "2026-10-29",
          discNumber: "1",
          discTotal: "2",
          isrc: "USABC2600001",
          musicbrainzId: "123e4567-e89b-12d3-a456-426614174000",
        },
      };
      const dest = path.join(root, `tagged.${ext}`);
      await writeMedia(track, dest, tools);
      const result = await inspect(dest, tools);
      if (ext === "mp3") {
        const bytes = await readFile(dest);
        expect(bytes.subarray(0, 3).toString()).toBe("ID3");
        expect(bytes[3]).toBe(3);
        expect(bytes.subarray(-128, -125).toString()).not.toBe("TAG");
      }
      expect(result.codec).toBe(codec);
      expect(result.metadata.title).toBe("Edited 孤狼");
      expect(result.metadata.trackNumber).toBe("2");
      expect(result.duration).toBeCloseTo(info.duration, 0);
      expect((await stat(source)).size).toBeGreaterThan(0);
    },
    60000,
  );
  it("imports managed copies, deduplicates hash, saves locks, undoes metadata and preserves originals", async () => {
    const { root, service } = await fixture();
    const file = await audio(root);
    const original = await readFile(file);
    let job = (await service.dispatch("import.start", {
      paths: [file],
    })) as Job;
    expect(await complete(service, job)).toMatchObject({ status: "completed" });
    const track = (await service.snapshot()).tracks[0];
    expect(track.path).not.toBe(file);
    await service.dispatch("tracks.edit", {
      ids: [track.id],
      changes: { title: "Changed" },
      locks: ["title"],
    });
    const edited = (await service.snapshot()).tracks[0];
    expect(edited.metadata.title).toBe("Changed");
    expect(edited.locks).toEqual(["title"]);
    expect(edited.revision).toBe(2);
    await service.dispatch("settings.update", { onlineAcknowledged: true });
    vi.stubGlobal("fetch", async () =>
      Response.json({
        recordings: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "Cannot overwrite locked",
          },
        ],
      }),
    );
    const [suggestion] = (await service.dispatch("lookup.search", {
      id: track.id,
    })) as { token: string }[];
    await service.dispatch("lookup.apply", {
      id: track.id,
      changes: { title: "Cannot overwrite locked" },
      token: suggestion.token,
    });
    expect((await service.snapshot()).tracks[0].metadata.title).toBe("Changed");
    const preview = (await service.dispatch("import.preview", {
      paths: [file],
    })) as any[];
    expect(preview[0].duplicate).toBe(true);
    job = (await service.dispatch("import.start", { paths: [file] })) as Job;
    expect((await complete(service, job)).status).toBe("completed");
    expect((await service.snapshot()).tracks).toHaveLength(1);
    expect((await service.snapshot()).tracks[0].metadata.title).toBe("Changed");
    await service.dispatch("tracks.undo", { ids: [track.id] });
    await service.dispatch("tracks.undo", { ids: [track.id] });
    expect((await service.snapshot()).tracks[0].metadata.title).toBe(
      track.metadata.title,
    );
    expect(await readFile(file)).toEqual(original);
    job = (await service.dispatch("import.start", { paths: [file] })) as Job;
    expect(await complete(service, job)).toMatchObject({ status: "completed" });
    expect((await service.snapshot()).tracks).toHaveLength(1);
  }, 60000);
  it("writes ordered relative playlists including duplicate occurrences and separate target receipts", async () => {
    const { root, service, destination } = await fixture();
    for (const name of ["A.mp3", "B.mp3", "C.mp3"]) {
      const file = await audio(root, name); // distinct title bytes ensure evidence does not deduplicate the fixtures
      await run(tools.ffmpeg, [
        "-v",
        "error",
        "-i",
        file,
        "-c",
        "copy",
        "-metadata",
        `title=${name[0]}`,
        path.join(root, "copy-" + name),
      ]);
      const job = (await service.dispatch("import.start", {
        paths: [path.join(root, "copy-" + name)],
      })) as Job;
      expect((await complete(service, job)).status).toBe("completed");
    }
    const tracks = (await service.snapshot()).tracks;
    const playlist = (await service.dispatch("references.import", {
      name: "Occurrence order",
      format: "m3u",
      text: "#EXTINF:1,A\nA.mp3\n#EXTINF:1,B\nB.mp3\n#EXTINF:1,A\nA.mp3\n#EXTINF:1,Unavailable\nmissing.mp3\n#EXTINF:1,C\nC.mp3",
    })) as Playlist;
    for (const [index, trackIndex] of [
      [0, 0],
      [1, 1],
      [2, 0],
      [4, 2],
    ])
      await service.dispatch("references.attach", {
        playlistId: playlist.id,
        occurrenceId: playlist.entries[index].id,
        trackId: tracks[trackIndex].id,
      });
    const a = (await service.dispatch("targets.create", {
      name: "iPod",
      transport: "imazing",
      destination,
      profile: { format: "mp3" },
    })) as Target;
    const b = (await service.dispatch("targets.create", {
      name: "USB",
      transport: "usb",
      destination,
    })) as Target;
    const plan = (await service.dispatch("export.preview", {
      targetId: a.id,
      playlistId: playlist.id,
    })) as any;
    expect(plan.omissions).toEqual([
      { ordinal: 4, title: "Unavailable", reason: "No approved recording" },
    ]);
    const job = (await service.dispatch("export.prepare", {
      targetId: a.id,
      playlistId: playlist.id,
    })) as Job;
    const done = await complete(service, job);
    expect(done.status, done.message).toBe("completed");
    const list = await readFile(
      path.join(String(done.payload.path), "playlist.m3u8"),
      "utf8",
    );
    expect(
      list
        .split("\n")
        .filter((l) => l.endsWith(".mp3"))
        .map((l) => l.slice(0, 4)),
    ).toEqual(["0001", "0002", "0003", "0005"]);
    expect(list).not.toContain(root);
    await service.dispatch("export.confirm", {
      targetId: a.id,
      batchId: done.payload.batchId,
    });
    expect(
      (await service.snapshot()).receipts
        .filter((r) => r.targetId === a.id)
        .filter((r) => r.evidence === "user-confirmed"),
    ).toHaveLength(4);
    expect(
      (await service.snapshot()).receipts.filter((r) => r.targetId === b.id),
    ).toHaveLength(0);
    await service.dispatch("tracks.edit", {
      ids: [tracks[0].id],
      changes: { comment: "New revision" },
    });
    await expect(
      service.dispatch("export.confirm", {
        targetId: a.id,
        batchId: done.payload.batchId,
      }),
    ).rejects.toThrow("stale");
    expect(
      (
        (await service.dispatch("export.preview", {
          targetId: b.id,
          playlistId: playlist.id,
        })) as any
      ).items[0].action,
    ).toBe("Add");
  }, 60000);
  it("rejects invalid images and budgets without writing target receipts", async () => {
    const { root, destination, service } = await fixture();
    const fake = path.join(root, "fake.png");
    await writeFile(fake, "not an image");
    await expect(artwork(fake, root)).rejects.toThrow();
    const source = await audio(root);
    const job = (await service.dispatch("import.start", {
      paths: [source],
    })) as Job;
    expect((await complete(service, job)).status).toBe("completed");
    const target = (await service.dispatch("targets.create", {
      name: "Tiny",
      destination,
      transport: "folder",
      budget: 1,
    })) as Target;
    await expect(
      service.dispatch("export.prepare", { targetId: target.id }),
    ).rejects.toThrow("blocked");
    expect((await service.snapshot()).receipts).toHaveLength(0);
  }, 60000);
});

describe("recovery and incremental evidence", () => {
  it("restores the automatic recovery bundle with prior undo history and leaves every original file intact", async () => {
    const { root, service } = await fixture();
    const original = await audio(root);
    const originalBytes = await readFile(original);
    expect(
      (
        await complete(
          service,
          (await service.dispatch("import.start", {
            paths: [original],
          })) as Job,
        )
      ).status,
    ).toBe("completed");
    const first = (await service.snapshot()).tracks[0];
    const incoming = (await service.dispatch("backup", {
      path: root,
      includeMedia: false,
    })) as { path: string };
    await service.dispatch("tracks.edit", {
      ids: [first.id],
      changes: { title: "Before restore" },
      locks: ["title"],
    });
    const second = (await service.snapshot()).tracks[0];
    await service.dispatch("tracks.edit", {
      ids: [first.id],
      changes: { artist: "Recover this artist" },
      locks: ["title", "artist"],
    });
    const third = (await service.snapshot()).tracks[0];
    const files = new Map(
      await Promise.all(
        [first, second, third].map(
          async (track) => [track.path, await readFile(track.path)] as const,
        ),
      ),
    );
    const restored = (await service.dispatch("restore", {
      path: incoming.path,
    })) as { recoveryBackup: string };
    expect((await stat(restored.recoveryBackup)).isDirectory()).toBe(true);
    const recovery = JSON.parse(
      await readFile(path.join(restored.recoveryBackup, "bundle.json"), "utf8"),
    );
    expect(recovery.kind).toBe("metadata-only");
    expect(recovery.snapshot).not.toHaveProperty("library");
    expect(recovery.snapshot.tracks[0].metadata).toMatchObject({
      title: "Before restore",
      artist: "Recover this artist",
    });
    expect(recovery.revisions).toHaveLength(2);
    await service.dispatch("restore", { path: restored.recoveryBackup });
    expect((await service.snapshot()).tracks[0]).toMatchObject({
      metadata: { title: "Before restore", artist: "Recover this artist" },
      locks: ["title", "artist"],
    });
    await service.dispatch("tracks.undo", { ids: [first.id] });
    expect((await service.snapshot()).tracks[0].metadata).toMatchObject({
      title: "Before restore",
      artist: first.metadata.artist,
    });
    await service.dispatch("tracks.undo", { ids: [first.id] });
    expect((await service.snapshot()).tracks[0].metadata).toEqual(
      first.metadata,
    );
    expect(await readFile(original)).toEqual(originalBytes);
    for (const [file, bytes] of files)
      expect(await readFile(file)).toEqual(bytes);
  }, 60000);
  it("rejects a backup while an earlier metadata edit is still writing", async () => {
    const { root, service } = await fixture();
    const original = await audio(root);
    expect(
      (
        await complete(
          service,
          (await service.dispatch("import.start", {
            paths: [original],
          })) as Job,
        )
      ).status,
    ).toBe("completed");
    const track = (await service.snapshot()).tracks[0];
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const originalWriter = media.writeMedia;
    vi.spyOn(media, "writeMedia").mockImplementationOnce(async (...args) => {
      entered();
      await gate;
      return originalWriter(...args);
    });
    const edited = service.dispatch("tracks.edit", {
      ids: [track.id],
      changes: { title: "Protected write" },
    });
    try {
      await started;
      await expect(
        service.dispatch("backup", { path: root, includeMedia: false }),
      ).rejects.toThrow("write is in progress");
    } finally {
      release();
      await edited;
    }
    expect((await service.snapshot()).tracks[0].metadata.title).toBe(
      "Protected write",
    );
  }, 60000);
  it("restores full media plus revision undo while requiring target re-selection", async () => {
    const { root, service, destination } = await fixture();
    const file = await audio(root);
    const imported = (await service.dispatch("import.start", {
      paths: [file],
    })) as Job;
    expect((await complete(service, imported)).status).toBe("completed");
    const track = (await service.snapshot()).tracks[0];
    await service.dispatch("tracks.edit", {
      ids: [track.id],
      changes: { title: "Backed up revision" },
      locks: ["title"],
    });
    await service.dispatch("targets.create", {
      name: "Player",
      transport: "folder",
      destination,
    });
    const backup = (await service.dispatch("backup", {
      path: root,
      includeMedia: true,
    })) as any;
    await service.dispatch("tracks.edit", {
      ids: [track.id],
      changes: { title: "Unwanted revision" },
    });
    const restored = (await service.dispatch("restore", {
      path: backup.path,
    })) as any;
    expect(restored.restored).toBe(1);
    expect((await service.snapshot()).tracks[0].metadata.title).toBe(
      "Backed up revision",
    );
    expect((await service.snapshot()).targets[0].destination).toBe("");
    await service.dispatch("tracks.undo", { ids: [track.id] });
    expect((await service.snapshot()).tracks[0].metadata.title).toBe(
      "Test 銀の狼",
    );
  }, 60000);
  it("reuses hash-verified destination files and rejects a substituted target marker", async () => {
    const { root, service, destination } = await fixture();
    const file = await audio(root);
    expect(
      (
        await complete(
          service,
          (await service.dispatch("import.start", { paths: [file] })) as Job,
        )
      ).status,
    ).toBe("completed");
    const target = (await service.dispatch("targets.create", {
      name: "Folder",
      transport: "folder",
      destination,
    })) as Target;
    const first = await complete(
      service,
      (await service.dispatch("export.prepare", {
        targetId: target.id,
      })) as Job,
    );
    expect(first.status, first.message).toBe("completed");
    const firstReceipt = (await service.snapshot()).receipts[0];
    const before = await stat(firstReceipt.path);
    const second = await complete(
      service,
      (await service.dispatch("export.prepare", {
        targetId: target.id,
      })) as Job,
    );
    expect(second.status, second.message).toBe("completed");
    const secondReceipts = (await service.snapshot()).receipts.filter(
      (r) => r.batchId === second.payload.batchId,
    );
    expect(secondReceipts[0].path).toBe(firstReceipt.path);
    expect((await stat(firstReceipt.path)).mtimeMs).toBe(before.mtimeMs);
    expect(
      await readFile(
        path.join(String(second.payload.path), "playlist.m3u8"),
        "utf8",
      ),
    ).toContain("../");
    await writeFile(
      path.join(destination, `TuneVault-${target.id}`, ".tunevault-volume-id"),
      "different volume",
    );
    const bad = await complete(
      service,
      (await service.dispatch("export.prepare", {
        targetId: target.id,
      })) as Job,
    );
    expect(bad.status).toBe("failed");
    expect(bad.message).toContain("identity changed");
  }, 60000);
  it("frames NDJSON across Unicode byte boundaries and cancels a child process", async () => {
    const lines: string[] = [];
    const script =
      'const b=Buffer.from(JSON.stringify({title:"孤狼"})+"\\n");process.stdout.write(b.subarray(0,12));setTimeout(()=>process.stdout.write(b.subarray(12)),20)';
    await run(process.execPath, ["-e", script], undefined, (line) =>
      lines.push(line),
    );
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ title: "孤狼" }]);
    const controller = new AbortController();
    const pending = run(
      process.execPath,
      ["-e", "setInterval(()=>{},1000)"],
      controller.signal,
    );
    setTimeout(() => controller.abort(), 50);
    await expect(pending).rejects.toThrow("Cancelled");
  });
});

it("retains per-occurrence failures and retries only failed audio sources", async () => {
  const { root, service } = await fixture();
  const synthetic = await audio(root);
  await service.dispatch("settings.update", { onlineAcknowledged: true });
  const originalRun = media.run,
    downloads: Record<string, number> = {};
  let failB = true;
  vi.spyOn(media, "run").mockImplementation(
    async (executable, args, signal, onLine) => {
      if (executable !== tools["yt-dlp"])
        return originalRun(executable, args, signal, onLine);
      if (args.includes("--flat-playlist"))
        return JSON.stringify({
          title: "Owned fixture source list",
          playlist_count: 5,
          entries: [
            { id: "aaaaaaaaaaa", title: "A" },
            { id: "bbbbbbbbbbb", title: "B" },
            { id: "aaaaaaaaaaa", title: "A" },
            { id: null, title: "[Private video]" },
            { id: "ccccccccccc", title: "C" },
          ],
        });
      const sourceId = new URL(args.at(-1)!).searchParams.get("v")!;
      if (args.includes("--dump-single-json")) {
        if (sourceId === "bbbbbbbbbbb" && failB) {
          failB = false;
          throw new Error("Fixture provider unavailable");
        }
        return JSON.stringify({
          id: sourceId,
          title: sourceId,
          artist: "Synthetic Fixture",
          description: "<script>inert source description</script>",
          release_date: "20261029",
        });
      }
      expect(args[args.indexOf("--format") + 1]).toBe("bestaudio");
      downloads[sourceId] = (downloads[sourceId] || 0) + 1;
      const destination = args[args.indexOf("--output") + 1].replace(
        "%(ext)s",
        "mp3",
      );
      await copyFile(synthetic, destination);
      onLine?.('TVPROGRESS:{"downloaded":1200,"total":2000}');
      return destination + "\n";
    },
  );
  const queued = (await service.dispatch("source.acquire", {
    url: "https://www.youtube.com/playlist?list=PLabcdefghijkl",
  })) as Job;
  const first = await complete(service, queued);
  expect(first.status, first.message).toBe("failed");
  let snapshot = await service.snapshot();
  expect(
    snapshot.tracks,
    JSON.stringify({
      message: first.message,
      failures: first.payload.failures,
      playlist: snapshot.playlists[0],
    }),
  ).toHaveLength(2);
  expect(snapshot.playlists[0].entries.map((e) => Boolean(e.trackId))).toEqual([
    true,
    false,
    true,
    false,
    true,
  ]);
  expect(snapshot.playlists[0].entries[0].trackId).toBe(
    snapshot.playlists[0].entries[2].trackId,
  );
  expect(snapshot.playlists[0].entries[1].error).toContain(
    "Fixture provider unavailable",
  );
  expect(
    snapshot.tracks.every(
      (track) =>
        track.metadata.title === "Test 銀の狼" &&
        track.metadata.album === "Owned test tones" &&
        track.origins.title === "existing-tags",
    ),
  ).toBe(true);
  const originalEntries = snapshot.playlists[0].entries;
  expect(first.payload.destinationOccurrences).toEqual(
    originalEntries.map((entry) => entry.id),
  );
  await service.dispatch("playlists.remove", {
    id: snapshot.playlists[0].id,
    occurrenceIds: [originalEntries[0].id],
  });
  const reordered = [
    originalEntries[4].id,
    originalEntries[1].id,
    originalEntries[2].id,
    originalEntries[3].id,
  ];
  await service.dispatch("playlists.reorder", {
    id: snapshot.playlists[0].id,
    occurrenceIds: reordered,
  });
  await service.dispatch("jobs.retry", { id: queued.id });
  const retried = await complete(service, queued);
  expect(retried.status, retried.message).toBe("completed");
  snapshot = await service.snapshot();
  expect(snapshot.tracks).toHaveLength(3);
  expect(snapshot.tracks.map((track) => track.metadata.date)).toEqual([
    "2026-10-29",
    "2026-10-29",
    "2026-10-29",
  ]);
  expect(snapshot.playlists[0].entries[1].error).toBeUndefined();
  expect(snapshot.playlists[0].entries.map((entry) => entry.id)).toEqual(
    reordered,
  );
  expect(
    snapshot.playlists[0].entries.map((entry) =>
      entry.trackId
        ? snapshot.tracks.find((track) => track.id === entry.trackId)?.source
            ?.id
        : null,
    ),
  ).toEqual(["ccccccccccc", "bbbbbbbbbbb", "aaaaaaaaaaa", null]);
  expect(snapshot.playlists[0].entries.map((e) => Boolean(e.trackId))).toEqual([
    true,
    true,
    true,
    false,
  ]);
  expect(downloads).toEqual({ aaaaaaaaaaa: 1, bbbbbbbbbbb: 1, ccccccccccc: 1 });
}, 60000);

it("batch lock additions preserve each track's existing locks", async () => {
  const { root, service } = await fixture();
  const a = await audio(root, "a.mp3"),
    b = await audio(root, "b.flac", "flac");
  expect(
    (
      await complete(
        service,
        (await service.dispatch("import.start", { paths: [a, b] })) as Job,
      )
    ).status,
  ).toBe("completed");
  const tracks = (await service.snapshot()).tracks;
  await service.dispatch("tracks.edit", {
    ids: [tracks[0].id],
    changes: {},
    locks: ["title"],
  });
  const beforeUndo = (await service.snapshot()).tracks[0];
  await expect(
    service.dispatch("tracks.undo", { ids: tracks.map((t) => t.id) }),
  ).rejects.toThrow("No saved metadata revision");
  expect((await service.snapshot()).tracks[0]).toEqual(beforeUndo);
  await service.dispatch("tracks.edit", {
    ids: [tracks[1].id],
    changes: {},
    locks: ["artist"],
  });
  await service.dispatch("tracks.edit", {
    ids: tracks.map((t) => t.id),
    changes: { genre: "Test" },
    addLocks: ["genre"],
  });
  const edited = (await service.snapshot()).tracks;
  expect(edited[0].locks).toEqual(["title", "genre"]);
  expect(edited[1].locks).toEqual(["artist", "genre"]);
});

it("creates reviewed mix segments with linked ranges while preserving the master", async () => {
  const { root, service } = await fixture();
  const source = await audio(root);
  const importJob = (await service.dispatch("import.start", {
    paths: [source],
  })) as Job;
  const imported = await complete(service, importJob);
  expect(imported.status, imported.message).toBe("completed");
  const master = (await service.snapshot()).tracks[0];
  const original = await readFile(master.path);
  const job = (await service.dispatch("mixes.split", {
    id: master.id,
    chapters: [
      { start: 0, title: "First section" },
      { start: 0.75, title: "Second section" },
    ],
  })) as Job;
  const result = await complete(service, job);
  expect(result.status, result.message).toBe("completed");
  const tracks = (await service.snapshot()).tracks;
  expect(tracks).toHaveLength(3);
  expect(await readFile(master.path)).toEqual(original);
  const children = tracks.filter((track) => track.parentId === master.id);
  expect(children.map((track) => track.metadata.title)).toEqual([
    "First section",
    "Second section",
  ]);
  expect(children.map((track) => track.range)).toEqual([
    [0, 0.75],
    [0.75, master.duration],
  ]);
  expect(
    children.every(
      (track) => track.duration > 0 && track.duration < master.duration,
    ),
  ).toBe(true);
});

it("cached tool diagnostics still reject an altered manifest version", async () => {
  const { root } = await fixture();
  const directory = path.join(root, "tools");
  await mkdir(directory);
  const manifest = JSON.parse(
    await readFile(path.join(toolsDir, "manifest.json"), "utf8"),
  );
  for (const entry of manifest.entries)
    await copyFile(
      path.join(toolsDir, entry.file),
      path.join(directory, entry.file),
    );
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest),
  );
  await verifyTools(directory);
  manifest.entries.find((entry: any) => entry.name === "ffmpeg").version =
    "not-the-verified-version";
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest),
  );
  await expect(verifyTools(directory)).rejects.toThrow("version mismatch");
  manifest.entries.find((entry: any) => entry.name === "ffmpeg").version = "";
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest),
  );
  await expect(verifyTools(directory)).rejects.toThrow("Missing or invalid");
});
