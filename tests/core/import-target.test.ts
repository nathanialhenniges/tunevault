import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  copyFile,
  rename,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LibraryService } from "../../src/core/library";
import * as media from "../../src/core/media";
import { verifyTools, type ToolPaths } from "../../src/update/tools";
import type { ExportPlan, Job, Playlist, Target } from "../../src/shared/types";
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
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "tunevault-import-target-"));
  const vault = path.join(root, "vault"),
    destination = path.join(root, "player");
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
async function tone(file: string, title: string) {
  await media.run(tools.ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-c:a",
    "libmp3lame",
    "-metadata",
    `title=${title}`,
    "-y",
    file,
  ]);
}
async function settled(service: LibraryService, job: Job): Promise<Job> {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const current = (await service.snapshot()).jobs.find(
      (item) => item.id === job.id,
    )!;
    if (!["queued", "running"].includes(current.status)) return current;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Import/target fixture timed out");
}
describe("partial imports and saved player scope", () => {
  it("retains good folder imports, ignores hidden and linked files, and retries only failed audio", async () => {
    const { root, service } = await fixture();
    const folder = path.join(root, "selection");
    await mkdir(folder);
    const good = path.join(folder, "good.mp3"),
      bad = path.join(folder, "bad.mp3"),
      outside = path.join(root, "outside.mp3");
    await tone(good, "Good");
    await tone(outside, "Outside");
    await writeFile(bad, "Not audio");
    await writeFile(path.join(folder, "notes.txt"), "Owner notes");
    await copyFile(outside, path.join(folder, ".hidden.mp3"));
    const hidden = path.join(folder, ".cache");
    await mkdir(hidden);
    await copyFile(outside, path.join(hidden, "hidden.mp3"));
    await symlink(outside, path.join(folder, "linked.mp3"), "file");
    const original = await readFile(good);
    const preview = (await service.dispatch("import.preview", {
      paths: [folder],
    })) as { path: string; error?: string }[];
    expect(preview.map((item) => path.basename(item.path)).sort()).toEqual([
      "bad.mp3",
      "good.mp3",
    ]);
    const first = await settled(
      service,
      (await service.dispatch("import.start", { paths: [folder] })) as Job,
    );
    expect(first.status).toBe("failed");
    expect(first.payload.failures).toMatchObject([
      { path: expect.stringContaining("bad.mp3") },
    ]);
    const retained = (await service.snapshot()).tracks;
    expect(retained.map((track) => track.metadata.title)).toEqual(["Good"]);
    await service.dispatch("tracks.edit", {
      ids: [retained[0].id],
      changes: { title: "Keep good edit" },
    });
    await tone(bad, "Repaired");
    const inspected = vi.spyOn(media, "inspect");
    await service.dispatch("jobs.retry", { id: first.id });
    const retried = await settled(service, first);
    expect(retried.status, retried.message).toBe("completed");
    expect(retried.payload.failures).toEqual([]);
    expect(inspected.mock.calls.map((args) => path.basename(args[0]))).toEqual([
      "bad.mp3",
    ]);
    expect(
      (await service.snapshot()).tracks
        .map((track) => track.metadata.title)
        .sort(),
    ).toEqual(["Keep good edit", "Repaired"]);
    expect(await readFile(good)).toEqual(original);
  }, 120000);

  it("uses saved ordered playlists per target, preserving duplicate occurrences and target isolation", async () => {
    const { root, destination, service } = await fixture();
    const files = ["A", "B", "C"].map((title) =>
      path.join(root, `${title}.mp3`),
    );
    for (const [index, file] of files.entries())
      await tone(file, ["A", "B", "C"][index]);
    expect(
      (
        await settled(
          service,
          (await service.dispatch("import.start", { paths: files })) as Job,
        )
      ).status,
    ).toBe("completed");
    const tracks = (await service.snapshot()).tracks;
    const id = (title: string) =>
      tracks.find((track) => track.metadata.title === title)!.id;
    const first = (await service.dispatch("playlists.create", {
      name: "First",
      trackIds: [id("A"), id("B"), id("A")],
    })) as Playlist;
    const second = (await service.dispatch("playlists.create", {
      name: "Second",
      trackIds: [id("C"), id("B")],
    })) as Playlist;
    const selected = (await service.dispatch("targets.create", {
      name: "Selected player",
      transport: "imazing",
      destination,
      playlistIds: [second.id, first.id],
    })) as Target;
    const other = (await service.dispatch("targets.create", {
      name: "Other player",
      transport: "folder",
      destination,
      playlistIds: [first.id],
    })) as Target;
    const plan = (await service.dispatch("export.preview", {
      targetId: selected.id,
    })) as ExportPlan;
    expect(plan.occurrences).toBe(5);
    expect(plan.uniqueMedia).toBe(3);
    expect(plan.items.map((item) => item.trackId)).toEqual([
      id("C"),
      id("B"),
      id("A"),
      id("B"),
      id("A"),
    ]);
    const job = await settled(
      service,
      (await service.dispatch("export.prepare", {
        targetId: selected.id,
      })) as Job,
    );
    expect(job.status, job.message).toBe("completed");
    await service.dispatch("export.confirm", {
      targetId: selected.id,
      batchId: job.id,
    });
    const state = await service.snapshot();
    expect(
      state.receipts.filter((receipt) => receipt.targetId === selected.id),
    ).toHaveLength(10);
    expect(
      state.receipts.filter(
        (receipt) =>
          receipt.targetId === selected.id &&
          receipt.evidence === "ready-locally",
      ),
    ).toHaveLength(5);
    expect(
      state.receipts.filter(
        (receipt) =>
          receipt.targetId === selected.id &&
          receipt.evidence === "user-confirmed",
      ),
    ).toHaveLength(5);
    expect(
      state.receipts.filter((receipt) => receipt.targetId === other.id),
    ).toEqual([]);
    expect(
      (
        (await service.dispatch("export.preview", {
          targetId: other.id,
        })) as ExportPlan
      ).occurrences,
    ).toBe(3);
  }, 120000);

  it("allows offline profile edits while keeping destination identity stable", async () => {
    const { root, destination, service } = await fixture();
    const target = (await service.dispatch("targets.create", {
      name: "Player",
      transport: "folder",
      destination,
    })) as Target;
    expect(
      (
        await settled(
          service,
          (await service.dispatch("targets.testPack", {
            targetId: target.id,
          })) as Job,
        )
      ).status,
    ).toBe("completed");
    const saved = (await service.snapshot()).targets[0];
    expect(saved.volumeIdentity).not.toBe("");
    const same = (await service.dispatch("targets.update", {
      id: target.id,
      name: "Renamed",
      destination,
    })) as Target;
    expect(same.volumeIdentity).toBe(saved.volumeIdentity);
    expect(same.profile.revision).toBe(saved.profile.revision);
    const offline = path.join(root, "disconnected-player");
    await rename(destination, offline);
    const updated = (await service.dispatch("targets.update", {
      id: target.id,
      name: "Offline player",
      profile: { format: "aac" },
    })) as Target;
    expect(updated.connected).toBe(false);
    expect(updated.destination).toBe(destination);
    expect(updated.volumeIdentity).toBe(saved.volumeIdentity);
    expect(updated.profile.revision).toBe(saved.profile.revision + 1);
    await rename(offline, destination);
    const reconnected = (await service.dispatch("targets.update", {
      id: target.id,
      destination,
    })) as Target;
    expect(reconnected.connected).toBe(true);
    expect(reconnected.volumeIdentity).toBe(saved.volumeIdentity);
    expect(reconnected.profile.revision).toBe(updated.profile.revision);
  }, 120000);
});
