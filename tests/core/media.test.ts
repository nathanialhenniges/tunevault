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
import sharp from "sharp";
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
beforeAll(async () => {
  tools = await verifyTools(toolsDir);
}, 60000);
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
          date: "2026",
          discNumber: "1",
          discTotal: "2",
          isrc: "USABC2600001",
          musicbrainzId: "123e4567-e89b-12d3-a456-426614174000",
        },
      };
      const dest = path.join(root, `tagged.${ext}`);
      await writeMedia(track, dest, tools);
      const result = await inspect(dest, tools);
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
    await service.dispatch("lookup.apply", {
      id: track.id,
      changes: { title: "Cannot overwrite locked" },
    });
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
        .every((r) => r.evidence === "user-confirmed"),
    ).toBe(true);
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
  expect(snapshot.tracks).toHaveLength(2);
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
  await service.dispatch("jobs.retry", { id: queued.id });
  const retried = await complete(service, queued);
  expect(retried.status, retried.message).toBe("completed");
  snapshot = await service.snapshot();
  expect(snapshot.tracks).toHaveLength(3);
  expect(snapshot.playlists[0].entries[1].error).toBeUndefined();
  expect(snapshot.playlists[0].entries.map((e) => Boolean(e.trackId))).toEqual([
    true,
    true,
    true,
    false,
    true,
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
