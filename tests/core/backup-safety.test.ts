import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LibraryService } from "../../src/core/library";
import type { Track } from "../../src/shared/types";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
    writeFile: vi.fn(actual.writeFile),
  };
});
const actualFS =
  await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.mocked(fs.readFile).mockImplementation(actualFS.readFile);
  vi.mocked(fs.writeFile).mockImplementation(actualFS.writeFile);
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture() {
  const root = await fs.mkdtemp(
    path.join(tmpdir(), "tunevault-backup-safety-"),
  );
  const service = new LibraryService({
    dataDir: path.join(root, "data"),
    toolsDir: "unused",
  });
  cleanups.push(async () => {
    service.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  return { root, service };
}
describe("portable backup boundaries", () => {
  it("omits duplicate library rows and refuses more rows than restore accepts", async () => {
    const { root, service } = await fixture();
    const backup = (await service.dispatch("backup", {
      path: root,
      includeMedia: false,
    })) as { path: string };
    const bundle = JSON.parse(
      await fs.readFile(path.join(backup.path, "bundle.json"), "utf8"),
    );
    expect(bundle.snapshot).not.toHaveProperty("library");
    const state = await service.snapshot();
    vi.spyOn(service, "snapshot").mockResolvedValue({
      ...state,
      playlists: Array.from({ length: 100001 }, (_, index) => ({
        id: String(index),
        name: "P",
        description: "",
        revision: 1,
        entries: [],
        sourceUrl: null,
        snapshotAt: null,
        followSourceOrder: false,
      })),
    });
    await expect(
      service.dispatch("backup", { path: root, includeMedia: false }),
    ).rejects.toThrow("100000 records");
    expect(
      (await fs.readdir(root)).filter((name) =>
        name.startsWith("TuneVault-backup-"),
      ),
    ).toHaveLength(1);
  });
  it("refuses a metadata envelope beyond restore's byte limit", async () => {
    const { root, service } = await fixture();
    const state = await service.snapshot();
    const description = "x".repeat(200000);
    const tracks = Array.from(
      { length: 525 },
      (_, index) => ({ id: String(index), source: { description } }) as Track,
    );
    vi.spyOn(service, "snapshot").mockResolvedValue({
      ...state,
      tracks,
      library: tracks,
    });
    await expect(
      service.dispatch("backup", { path: root, includeMedia: false }),
    ).rejects.toThrow("100 MB");
    expect(
      (await fs.readdir(root)).filter((name) =>
        name.startsWith("TuneVault-backup-"),
      ),
    ).toEqual([]);
  });
  it("refuses more playlist occurrences than the restore validator accepts", async () => {
    const { root, service } = await fixture();
    const state = await service.snapshot();
    const entries = Array.from({ length: 10001 }, (_, index) => ({
      id: String(index),
      trackId: null,
      reference: { title: "Reference", artist: "", album: "", duration: null },
      manual: true,
      skipped: false,
    }));
    vi.spyOn(service, "snapshot").mockResolvedValue({
      ...state,
      playlists: [
        {
          id: "large",
          name: "Large",
          description: "",
          revision: 1,
          entries,
          sourceUrl: null,
          snapshotAt: null,
          followSourceOrder: false,
        },
      ],
    });
    await expect(
      service.dispatch("backup", { path: root, includeMedia: false }),
    ).rejects.toThrow("10000 occurrences");
    expect(
      (await fs.readdir(root)).filter((name) =>
        name.startsWith("TuneVault-backup-"),
      ),
    ).toEqual([]);
  });
  it.each(["backup", "restore"] as const)(
    "blocks new mutations throughout an asynchronous %s but permits read-only previews",
    async (action) => {
      const { root, service } = await fixture();
      const source = (await service.dispatch("backup", {
        path: root,
        includeMedia: false,
      })) as { path: string };
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      if (action === "backup")
        vi.mocked(fs.writeFile).mockImplementationOnce(async (...args) => {
          entered();
          await gate;
          return actualFS.writeFile(...args);
        });
      else
        vi.mocked(fs.readFile).mockImplementationOnce(async (...args) => {
          entered();
          await gate;
          return actualFS.readFile(...args);
        });
      const pending = service.dispatch(action, {
        path: action === "backup" ? root : source.path,
        includeMedia: false,
      });
      try {
        await started;
        await expect(
          service.dispatch("import.start", { paths: [] }),
        ).rejects.toThrow("write is in progress");
        await expect(
          service.dispatch("tracks.edit", { ids: [], changes: {} }),
        ).rejects.toThrow("write is in progress");
        await expect(
          service.dispatch("settings.update", { accent: "orange" }),
        ).rejects.toThrow("write is in progress");
        expect(
          ((await service.dispatch("snapshot")) as { tracks: Track[] }).tracks,
        ).toEqual([]);
        expect(
          await service.dispatch("source.preview", {
            url: "https://open.spotify.com/playlist/test",
          }),
        ).toMatchObject({ capability: "credentials-required" });
      } finally {
        release();
        await pending;
      }
      expect(
        await service.dispatch("settings.update", { accent: "orange" }),
      ).toMatchObject({ accent: "orange" });
    },
  );
});
