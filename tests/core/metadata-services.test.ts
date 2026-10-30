import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { LibraryService } from "../../src/core/library";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "tunevault-services-"));
  const options = { dataDir: root, toolsDir: path.join(root, "unused") };
  let service = new LibraryService(options);
  cleanups.push(async () => {
    service.close();
    await rm(root, { recursive: true, force: true });
  });
  function seed(table: string, value: Record<string, unknown>) {
    const db = new DatabaseSync(path.join(root, "library.sqlite"));
    db.prepare(`INSERT OR REPLACE INTO ${table}(id,data) VALUES(?,?)`).run(
      value.id as string | number,
      JSON.stringify(value),
    );
    db.close();
  }
  const restart = () => {
    service.close();
    service = new LibraryService(options);
    return service;
  };
  return { service, seed, restart };
}

it("merges legacy service defaults and validates partial setting updates", async () => {
  const { service, seed, restart } = await fixture();
  expect((await service.snapshot()).settings).toMatchObject({
    metadataOnline: true,
    metadataServices: {
      musicbrainz: true,
      coverArtArchive: true,
    },
  });
  seed("settings", {
    id: 1,
    appearance: "dark",
    metadataServices: { musicbrainz: false, acoustid: true },
  });
  const reopened = restart();
  expect(
    (await reopened.snapshot()).settings.metadataServices,
  ).not.toHaveProperty("acoustid");
  expect((await reopened.snapshot()).settings).toMatchObject({
    appearance: "dark",
    metadataOnline: true,
    metadataServices: {
      musicbrainz: false,
      coverArtArchive: true,
    },
  });
  await reopened.dispatch("settings.update", {
    metadataOnline: false,
    metadataServices: { acoustid: true },
  });
  const persisted = restart();
  expect((await persisted.snapshot()).settings).toMatchObject({
    metadataOnline: false,
    metadataServices: {
      musicbrainz: false,
      coverArtArchive: true,
    },
  });
  expect(
    (await persisted.snapshot()).settings.metadataServices,
  ).not.toHaveProperty("acoustid");
  for (const data of [
    { metadataOnline: "false" },
    { metadataServices: null },
    { metadataServices: { unknown: true } },
    { metadataServices: { musicbrainz: 1 } },
  ])
    await expect(persisted.dispatch("settings.update", data)).rejects.toThrow();
});

it("blocks disabled lookups before cache/network access and rejects removed identification", async () => {
  const { service, seed } = await fixture();
  const track = { id: "track", metadata: { title: "Owned", artist: "Artist" } };
  seed("tracks", track);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await service.dispatch("settings.update", {
    onlineAcknowledged: true,
    metadataOnline: false,
  });
  await expect(
    service.dispatch("lookup.search", { id: track.id }),
  ).rejects.toThrow("lookups are off");
  await expect(
    service.dispatch("lookup.artworkPreview", {
      releaseId: "11111111-1111-1111-1111-111111111111",
    }),
  ).rejects.toThrow("lookups are off");
  await service.dispatch("settings.update", {
    metadataOnline: true,
    metadataServices: { musicbrainz: false, coverArtArchive: false },
  });
  await expect(
    service.dispatch("lookup.search", { id: track.id }),
  ).rejects.toThrow("musicbrainz is disabled");
  await expect(service.dispatch("lookup.artworkPreview", {})).rejects.toThrow(
    "coverArtArchive is disabled",
  );
  await expect(
    service.dispatch("lookup.identify", { id: track.id }),
  ).rejects.toThrow("Unknown");
  expect(fetch).not.toHaveBeenCalled();
});

it("aborts in-flight lookups when online metadata is disabled", async () => {
  const { service, seed } = await fixture();
  seed("tracks", {
    id: "track",
    metadata: { title: "Pending", artist: "Artist" },
  });
  await service.dispatch("settings.update", { onlineAcknowledged: true });
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.stubGlobal(
    "fetch",
    (_url: unknown, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = options.signal!;
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
        started();
      }),
  );
  const pending = expect(
    service.dispatch("lookup.search", { id: "track" }),
  ).rejects.toThrow("disabled");
  await ready;
  await service.dispatch("settings.update", { metadataOnline: false });
  await pending;
});
