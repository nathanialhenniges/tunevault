import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { parseFile } from "music-metadata";
import { LibraryService } from "../../src/core/library";
import { run } from "../../src/core/media";
import { hashFile } from "../../src/core/safety";
import { verifyTools, type ToolPaths } from "../../src/update/tools";
import type { Job } from "../../src/shared/types";

const toolsDir = path.resolve(
  "resources/tools",
  `${process.platform}-${process.arch}`,
);
let tools: ToolPaths;
const cleanup: (() => Promise<void>)[] = [];
beforeAll(async () => {
  tools = await verifyTools(toolsDir);
}, 180000);
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const operation of cleanup.splice(0).reverse()) await operation();
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "tunevault-metadata-art-"));
  const vault = path.join(root, "vault");
  await mkdir(vault);
  const service = new LibraryService({
    dataDir: path.join(root, "data"),
    toolsDir,
  });
  cleanup.push(async () => {
    service.close();
    await rm(root, { recursive: true, force: true });
  });
  await service.dispatch("settings.update", { vault });
  return { root, vault, service };
}
async function settled(service: LibraryService, job: Job) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const current = (await service.snapshot()).jobs.find(
      (item) => item.id === job.id,
    )!;
    if (!["queued", "running"].includes(current.status)) return current;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Synthetic metadata import timed out");
}

it("generates, reviews and applies a labelled placeholder offline with recoverable prior art", async () => {
  const { root, service } = await fixture();
  const source = path.join(root, "synthetic.mp3");
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
    "title=Synthetic placeholder fixture",
    source,
  ]);
  const sourceHash = await hashFile(source);
  const job = await settled(
    service,
    (await service.dispatch("import.start", { paths: [source] })) as Job,
  );
  expect(job.status, job.message).toBe("completed");
  let track = (await service.snapshot()).tracks[0];
  const image = path.join(root, "owner-art.png");
  await sharp({
    create: { width: 1000, height: 800, channels: 3, background: "#aabbcc" },
  })
    .png()
    .toFile(image);
  await service.dispatch("tracks.artwork", { ids: [track.id], path: image });
  const previous = (await service.snapshot()).tracks[0];
  const original = await readFile(previous.artworkOriginal!);
  const fetch = vi.fn(async () => {
    throw new Error("Network must stay unused");
  });
  vi.stubGlobal("fetch", fetch);
  const preview = (await service.dispatch("artwork.placeholderPreview")) as {
    token: string;
    preview: string;
    origin: string;
  };
  expect(preview.origin).toContain("Locally generated");
  const decoded = Buffer.from(preview.preview.split(",")[1], "base64");
  expect(await sharp(decoded).metadata()).toMatchObject({
    format: "jpeg",
    width: 600,
    height: 600,
    channels: 3,
    space: "srgb",
  });
  expect((await service.snapshot()).tracks[0].revision).toBe(previous.revision);
  await expect(
    service.dispatch("tracks.placeholder", {
      ids: [track.id],
      token: "unknown",
    }),
  ).rejects.toThrow();
  await service.dispatch("tracks.placeholder", {
    ids: [track.id],
    token: preview.token,
  });
  track = (await service.snapshot()).tracks[0];
  expect(track.artworkOrigin).toBe("locally-generated-placeholder");
  expect(track.metadata).toEqual(previous.metadata);
  expect((await parseFile(track.path)).common.picture?.[0]).toBeDefined();
  expect(await readFile(previous.artworkOriginal!)).toEqual(original);
  expect(await hashFile(source)).toBe(sourceHash);
  expect(fetch).not.toHaveBeenCalled();
  await service.dispatch("tracks.undo", { ids: [track.id] });
  expect((await service.snapshot()).tracks[0]).toMatchObject({
    artwork: previous.artwork,
    artworkOriginal: previous.artworkOriginal,
    artworkOrigin: previous.artworkOrigin,
  });
}, 120000);

it("reuses validated CAA thumbnail data across restart and keeps lookup failure separate from media", async () => {
  const { root, service } = await fixture();
  await service.dispatch("settings.update", { onlineAcknowledged: true });
  const image = await sharp({
    create: { width: 500, height: 400, channels: 3, background: "#445566" },
  })
    .jpeg()
    .toBuffer();
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(image, { headers: { "content-type": "image/jpeg" } }),
  );
  vi.stubGlobal("fetch", fetch);
  const releaseId = "11111111-1111-1111-1111-111111111111";
  const first = (await service.dispatch("lookup.artworkPreview", {
    releaseId,
  })) as { preview: string };
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toContain("front-1200");
  service.close();
  vi.resetModules();
  const fresh = await import("../../src/core/library");
  const restarted = new fresh.LibraryService({
    dataDir: path.join(root, "data"),
    toolsDir,
  });
  cleanup.push(async () => restarted.close());
  const offline = vi.fn(async () => {
    throw new Error("Offline fixture");
  });
  vi.stubGlobal("fetch", offline);
  const second = (await restarted.dispatch("lookup.artworkPreview", {
    releaseId,
  })) as { preview: string };
  expect(second.preview).toBe(first.preview);
  expect(offline).not.toHaveBeenCalled();
  await expect(
    restarted.dispatch("lookup.artworkPreview", {
      releaseId: "22222222-2222-2222-2222-222222222222",
    }),
  ).rejects.toThrow("Offline fixture");
  expect((await restarted.snapshot()).tracks).toEqual([]);
}, 120000);

it("applies reviewed service fields with validated per-field provenance and preserves user edits", async () => {
  const { root, service } = await fixture();
  const source = path.join(root, "provenance.mp3");
  await run(tools.ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=duration=1",
    "-c:a",
    "libmp3lame",
    source,
  ]);
  const job = await settled(
    service,
    (await service.dispatch("import.start", { paths: [source] })) as Job,
  );
  expect(job.status).toBe("completed");
  const track = (await service.snapshot()).tracks[0];
  await service.dispatch("settings.update", { onlineAcknowledged: true });
  const mbid = "33333333-3333-3333-3333-333333333333";
  vi.stubGlobal("fetch", async () =>
    Response.json({
      recordings: [
        {
          id: mbid,
          title: "Approved title",
          "artist-credit": [{ name: "Approved artist" }],
        },
      ],
    }),
  );
  const [suggestion] = (await service.dispatch("lookup.search", {
    id: track.id,
  })) as {
    token: string;
    title: string;
    artist: string;
    origin: string;
    license: string;
  }[];
  expect(suggestion).toMatchObject({
    origin: `musicbrainz:${mbid}`,
    license: "CC0 core metadata",
  });
  await expect(
    service.dispatch("tracks.edit", {
      ids: [track.id],
      changes: { title: "Forged value" },
      lookupSources: { title: suggestion.token },
    }),
  ).rejects.toThrow("does not match");
  await expect(
    service.dispatch("lookup.apply", {
      id: track.id,
      changes: { title: "Approved title" },
    }),
  ).rejects.toThrow();
  await service.dispatch("tracks.edit", {
    ids: [track.id],
    changes: { title: suggestion.title, artist: "User artist" },
    lookupSources: { title: suggestion.token },
  });
  let updated = (await service.snapshot()).tracks[0];
  expect(updated.origins).toMatchObject({
    title: `musicbrainz:${mbid}`,
    artist: "user",
  });
  expect((await parseFile(updated.path)).common.title).toBe("Approved title");
  await service.dispatch("tracks.undo", { ids: [track.id] });
  updated = (await service.snapshot()).tracks[0];
  expect(updated.origins.title).toBe(track.origins.title);
  await service.dispatch("tracks.edit", {
    ids: [track.id],
    changes: { title: "Locked title" },
    locks: ["title"],
  });
  await service.dispatch("lookup.apply", {
    id: track.id,
    token: suggestion.token,
    changes: { title: suggestion.title, artist: suggestion.artist },
  });
  updated = (await service.snapshot()).tracks[0];
  expect(updated.metadata.title).toBe("Locked title");
  expect(updated.origins).toMatchObject({
    title: "user",
    artist: `musicbrainz:${mbid}`,
  });
  await service.dispatch("tracks.edit", {
    ids: [track.id],
    changes: { title: suggestion.title },
    locks: [],
    lookupSources: { title: suggestion.token },
  });
  updated = (await service.snapshot()).tracks[0];
  expect(updated.metadata.title).toBe(suggestion.title);
  expect(updated.origins.title).toBe(`musicbrainz:${mbid}`);
  expect(updated.locks).toEqual([]);
  await service.dispatch("tracks.edit", {
    ids: [track.id],
    changes: { title: "Another user title" },
  });
  await service.dispatch("tracks.edit", {
    ids: [track.id],
    changes: { title: suggestion.title },
    locks: ["title"],
    lookupSources: { title: suggestion.token },
  });
  updated = (await service.snapshot()).tracks[0];
  expect(updated.metadata.title).toBe(suggestion.title);
  expect(updated.origins.title).toBe(`musicbrainz:${mbid}`);
  expect(updated.locks).toEqual(["title"]);
}, 120000);

it("falls back only for missing 1200px art and keeps the applied image within 1200px", async () => {
  const { service } = await fixture();
  await service.dispatch("settings.update", { onlineAcknowledged: true });
  const image = await sharp({
    create: { width: 1800, height: 1400, channels: 3, background: "#778899" },
  })
    .jpeg()
    .toBuffer();
  const fetch = vi.fn<typeof globalThis.fetch>(async (url) =>
    String(url).endsWith("front-1200")
      ? new Response(null, { status: 404 })
      : new Response(image, { headers: { "content-type": "image/jpeg" } }),
  );
  vi.stubGlobal("fetch", fetch);
  const releaseId = "44444444-4444-4444-4444-444444444444";
  const result = (await service.dispatch("lookup.artworkPreview", {
    releaseId,
  })) as { origin: string; preview: string };
  expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
    `https://coverartarchive.org/release/${releaseId}/front-1200`,
    `https://coverartarchive.org/release/${releaseId}/front-500`,
  ]);
  expect(result.origin).toBe(`coverartarchive:${releaseId}`);
  const size = await sharp(
    Buffer.from(result.preview.split(",")[1], "base64"),
  ).metadata();
  expect(size.width).toBeLessThanOrEqual(1200);
  expect(size.height).toBeLessThanOrEqual(1200);
  await service.dispatch("settings.update", {
    metadataServices: { coverArtArchive: false },
  });
  await expect(
    service.dispatch("lookup.artworkPreview", { releaseId }),
  ).rejects.toThrow("disabled");
  expect(fetch).toHaveBeenCalledTimes(2);
}, 120000);
