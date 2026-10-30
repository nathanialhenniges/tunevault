import { afterEach, beforeAll, expect, it } from "vitest";
import {
  mkdir,
  mkdtemp,
  rename,
  rm,
  readFile,
  realpath,
} from "node:fs/promises";
import { parseFile } from "music-metadata";
import { hashFile } from "../../src/core/safety";
import { tmpdir } from "node:os";
import path from "node:path";
import { LibraryService } from "../../src/core/library";
import { run } from "../../src/core/media";
import { verifyTools, type ToolPaths } from "../../src/update/tools";
import type { ExportPlan, Job, Target } from "../../src/shared/types";

const toolsDir = path.resolve(
  "resources/tools",
  `${process.platform}-${process.arch}`,
);
let tools: ToolPaths;
const cleanups: (() => Promise<void>)[] = [];
beforeAll(async () => {
  tools = await verifyTools(toolsDir);
}, 180000);
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture() {
  const root = await mkdtemp(
    path.join(tmpdir(), "tunevault-target-completion-"),
  );
  const dataDir = path.join(root, "data"),
    destination = path.join(root, "player"),
    vault = path.join(root, "vault");
  await mkdir(destination);
  await mkdir(vault);
  const service = new LibraryService({ dataDir, toolsDir });
  cleanups.push(async () => {
    service.close();
    await rm(root, { recursive: true, force: true });
  });
  await service.dispatch("settings.update", { vault });
  const target = (await service.dispatch("targets.create", {
    name: "Player",
    transport: "folder",
    destination,
    budget: 1000000000,
  })) as Target;
  const source = path.join(root, "tone.mp3");
  await run(tools.ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=duration=1",
    "-c:a",
    "libmp3lame",
    "-metadata",
    "title=Original title",
    source,
  ]);
  await completed(
    service,
    (await service.dispatch("import.start", { paths: [source] })) as Job,
  );
  return { root, dataDir, destination, service, target };
}
async function completed(service: LibraryService, job: Job) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const current = (await service.snapshot()).jobs.find(
      (item) => item.id === job.id,
    )!;
    if (!["queued", "running"].includes(current.status)) {
      expect(current.status, current.message).toBe("completed");
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("Target completion job timed out");
}
it("retains timestamped historical capacity offline and separates it from budget/current free bytes", async () => {
  const { root, dataDir, destination, service, target } = await fixture();
  const plan = (await service.dispatch("export.preview", {
    targetId: target.id,
  })) as ExportPlan;
  expect(plan.budget).toBe(1000000000);
  expect(plan.knownBytes).toBe(0);
  expect(plan.availableBytes).toBeGreaterThan(0);
  const observed = (await service.snapshot()).targets[0].lastCapacity!;
  expect(observed.totalBytes).toBeGreaterThanOrEqual(observed.freeBytes);
  expect(observed.freeBytes).toBe(plan.availableBytes);
  expect(Number.isFinite(Date.parse(observed.observedAt))).toBe(true);
  await rename(destination, path.join(root, "disconnected"));
  service.close();
  const restarted = new LibraryService({ dataDir, toolsDir });
  cleanups.push(async () => restarted.close());
  const offline = (await restarted.dispatch("export.preview", {
    targetId: target.id,
  })) as ExportPlan;
  expect(offline.availableBytes).toBe(null);
  expect((await restarted.snapshot()).targets[0]).toMatchObject({
    connected: false,
    lastCapacity: observed,
  });
}, 120000);
it("retags compatible audio without re-encoding and keeps append-only, idempotent confirmation history", async () => {
  const { service, target } = await fixture();
  const first = await completed(
    service,
    (await service.dispatch("export.prepare", { targetId: target.id })) as Job,
  );
  const prepared = (await service.snapshot()).receipts[0];
  await service.dispatch("export.confirm", {
    targetId: target.id,
    batchId: first.id,
  });
  let receipts = (await service.snapshot()).receipts;
  expect(receipts).toHaveLength(2);
  expect(receipts[0]).toEqual(prepared);
  expect(receipts[1]).toMatchObject({
    evidence: "user-confirmed",
    confirmsReceiptId: prepared.id,
  });
  const confirmed = receipts[1];
  await service.dispatch("export.confirm", {
    targetId: target.id,
    batchId: first.id,
  });
  expect((await service.snapshot()).receipts).toEqual(receipts);
  const track = (await service.snapshot()).tracks[0];
  await service.dispatch("tracks.edit", {
    ids: [track.id],
    changes: { title: "Retagged title" },
  });
  const plan = (await service.dispatch("export.preview", {
    targetId: target.id,
  })) as ExportPlan;
  expect(plan.items[0]).toMatchObject({ action: "Retag" });
  const second = await completed(
    service,
    (await service.dispatch("export.prepare", { targetId: target.id })) as Job,
  );
  receipts = (await service.snapshot()).receipts;
  expect(receipts).toContainEqual(prepared);
  expect(receipts).toContainEqual(confirmed);
  const output = receipts.find((receipt) => receipt.batchId === second.id)!;
  const packets = async (file: string) =>
    JSON.parse(
      await run(tools.ffprobe, [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_packets",
        "-show_entries",
        "packet=data_hash",
        "-show_data_hash",
        "sha256",
        "-of",
        "json",
        file,
      ]),
    ).packets.map((packet: { data_hash: string }) => packet.data_hash);
  expect(await packets(output.path)).toEqual(await packets(track.path));
  const current = (await service.dispatch("export.preview", {
    targetId: target.id,
  })) as ExportPlan;
  expect(current.items[0].action).toBe("Already current");
  expect(current.knownBytes).toBeGreaterThan(0);
}, 120000);
it("requires explicit physical test results and invalidates them when the output profile changes", async () => {
  const { service, target } = await fixture();
  await expect(
    service.dispatch("targets.update", {
      id: target.id,
      profile: {
        compatibility: "User-tested",
        model: "Owner player",
        firmware: "1.0",
      },
    }),
  ).rejects.toThrow("physical test results");
  const tested = (await service.dispatch("targets.update", {
    id: target.id,
    profile: {
      compatibility: "User-tested",
      model: "Owner player",
      firmware: "1.0",
      testResults:
        "Playback, seek, tags, art and A/B/A order checked on physical player.",
    },
  })) as Target;
  expect(tested.profile.compatibility).toBe("User-tested");
  const changed = (await service.dispatch("targets.update", {
    id: target.id,
    profile: {
      bitrate: 256,
      sampleRate: 48000,
      artworkSize: 300,
      artworkBytes: 100000,
    },
  })) as Target;
  expect(changed.profile).toMatchObject({
    compatibility: "Baseline",
    testResults: "",
    revision: tested.profile.revision + 1,
    bitrate: 256,
    sampleRate: 48000,
    artworkSize: 300,
    artworkBytes: 100000,
  });
}, 120000);

it("writes configured MP3 tags, bounded Unicode filenames, CRLF playlists and distinct occurrence-only ordering tags", async () => {
  const { service, target } = await fixture();
  const trackId = (await service.snapshot()).tracks[0].id;
  await service.dispatch("tracks.edit", {
    ids: [trackId],
    changes: {
      title: "銀".repeat(100),
      trackNumber: "7",
      trackTotal: "9",
      date: "2026-10",
    },
  });
  const canonical = (await service.snapshot()).tracks[0];
  expect((await parseFile(canonical.path)).native["ID3v2.3"]).toBeDefined();
  const playlist = (await service.dispatch("playlists.create", {
    name: "Repeated occurrence order",
    trackIds: [trackId, trackId],
  })) as { id: string };
  await service.dispatch("targets.update", {
    id: target.id,
    profile: {
      mp3TagVersion: 4,
      filenameLimit: 80,
      pathLimit: 1024,
      playlistEncoding: "utf8",
      playlistNewline: "CRLF",
      orderTags: true,
    },
  });
  const done = await completed(
    service,
    (await service.dispatch("export.prepare", {
      targetId: target.id,
      playlistId: playlist.id,
    })) as Job,
  );
  const receipts = (await service.snapshot()).receipts.filter(
    (receipt) => receipt.batchId === done.id,
  );
  expect(receipts).toHaveLength(2);
  expect(receipts[0].path).not.toBe(receipts[1].path);
  expect(receipts[0].hash).not.toBe(receipts[1].hash);
  for (const [index, receipt] of receipts.entries()) {
    expect(
      Buffer.byteLength(path.basename(receipt.path), "utf8"),
    ).toBeLessThanOrEqual(80);
    expect(Buffer.byteLength(receipt.path, "utf8")).toBeLessThanOrEqual(1024);
    const tagged = await parseFile(receipt.path);
    expect(tagged.native["ID3v2.4"]).toBeDefined();
    expect(tagged.common.track).toMatchObject({ no: index + 1, of: 2 });
    expect(tagged.common.disk).toMatchObject({ no: 1, of: 1 });
    expect(tagged.common.date).toBe("2026-10");
  }
  const list = await readFile(
    path.join(String(done.payload.path), "playlist.m3u8"),
    "utf8",
  );
  expect(list).toContain("銀");
  expect(list).toContain("\r\n");
  expect(list.replaceAll("\r\n", "")).not.toContain("\n");
  expect((await service.snapshot()).tracks[0]).toEqual(canonical);
  expect(await hashFile(canonical.path)).toBe(canonical.hash);
  const pack = await completed(
    service,
    (await service.dispatch("targets.testPack", {
      targetId: target.id,
    })) as Job,
  );
  const packRoot = String(pack.payload.resultFolder);
  const manifest = JSON.parse(
    await readFile(path.join(packRoot, "manifest.json"), "utf8"),
  );
  expect(manifest.files).toHaveLength(3);
  for (const [index, file] of manifest.files.entries())
    expect(
      (await parseFile(path.join(packRoot, file.name))).common.track,
    ).toMatchObject({ no: index + 1, of: 3 });
  const packList = await readFile(path.join(packRoot, "playlist.m3u8"), "utf8");
  expect(packList.replaceAll("\r\n", "")).not.toContain("\n");
}, 120000);

it("blocks overlong full paths in preflight and execution and rejects unsupported advanced settings", async () => {
  const { service, target, destination } = await fixture();
  const long = path.join(destination, "long".repeat(25));
  await mkdir(long);
  const bounded = (await service.dispatch("targets.update", {
    id: target.id,
    destination: long,
    profile: { pathLimit: 180 },
  })) as Target;
  const plan = (await service.dispatch("export.preview", {
    targetId: target.id,
  })) as ExportPlan;
  expect(plan.items[0]).toMatchObject({ action: "Blocked" });
  expect(plan.items[0].reason).toContain("full-path byte limit");
  await expect(
    service.dispatch("export.prepare", { targetId: target.id }),
  ).rejects.toThrow("blocked");
  for (const profile of [
    { mp3TagVersion: 2 },
    { filenameLimit: 79 },
    { pathLimit: 179 },
    { playlistEncoding: "ascii" },
    { playlistNewline: "CR" },
    { orderTags: "yes" },
  ])
    await expect(
      service.dispatch("targets.update", { id: bounded.id, profile }),
    ).rejects.toThrow("advanced");
}, 120000);

it("shortens a long filename to fit a long destination under the default 240-byte full-path cap", async () => {
  const { service, target, destination } = await fixture();
  const base = Buffer.byteLength(
    path.join(
      await realpath(destination),
      `TuneVault-${target.id}`,
      "0".repeat(36),
    ),
    "utf8",
  );
  const deeper = path.join(
    destination,
    "x".repeat(Math.max(1, 240 - base - 1 - 24)),
  );
  await mkdir(deeper);
  await service.dispatch("targets.update", {
    id: target.id,
    destination: deeper,
    profile: { filenameLimit: 180 },
  });
  const trackId = (await service.snapshot()).tracks[0].id;
  await service.dispatch("tracks.edit", {
    ids: [trackId],
    changes: {
      title: "Long filename with complete metadata preserved ".repeat(4),
    },
  });
  const plan = (await service.dispatch("export.preview", {
    targetId: target.id,
  })) as ExportPlan;
  expect(plan.items[0].action).not.toBe("Blocked");
  const done = await completed(
    service,
    (await service.dispatch("export.prepare", { targetId: target.id })) as Job,
  );
  const file = (await service.snapshot()).receipts.find(
    (receipt) => receipt.batchId === done.id,
  )!.path;
  expect(Buffer.byteLength(file, "utf8")).toBeLessThanOrEqual(240);
  expect(Buffer.byteLength(path.basename(file), "utf8")).toBeLessThan(40);
  expect((await parseFile(file)).common.title).toBe(
    "Long filename with complete metadata preserved ".repeat(4),
  );
}, 120000);
