import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LibraryService } from "../../src/core/library";
import { run } from "../../src/core/media";
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
}, 120000);
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function completed(service: LibraryService, job: Job): Promise<Job> {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const current = (await service.snapshot()).jobs.find(
      (item) => item.id === job.id,
    )!;
    if (!["queued", "running"].includes(current.status)) {
      expect(current.status, current.message).toBe("completed");
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Export fixture job timed out");
}

async function exported(transport: Target["transport"] = "folder") {
  const root = await mkdtemp(path.join(tmpdir(), "tunevault-order-"));
  const vault = path.join(root, "vault"),
    destination = path.join(root, "target");
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
  const sources: string[] = [];
  for (const [index, title] of ["A", "B"].entries()) {
    const file = path.join(root, `${title}.mp3`);
    await run(tools.ffmpeg, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${440 + index * 220}:duration=1.5`,
      "-c:a",
      "libmp3lame",
      "-metadata",
      `title=${title}`,
      file,
    ]);
    sources.push(file);
  }
  await completed(
    service,
    (await service.dispatch("import.start", { paths: sources })) as Job,
  );
  const tracks = (await service.snapshot()).tracks;
  const a = tracks.find((track) => track.metadata.title === "A")!,
    b = tracks.find((track) => track.metadata.title === "B")!;
  const playlist = (await service.dispatch("playlists.create", {
    name: "Ordered",
    trackIds: [a.id, b.id],
  })) as Playlist;
  const target = (await service.dispatch("targets.create", {
    name: "iPod",
    transport,
    destination,
  })) as Target;
  const selection = { targetId: target.id, playlistId: playlist.id };
  const first = await completed(
    service,
    (await service.dispatch("export.prepare", selection)) as Job,
  );
  const receipts = (await service.snapshot()).receipts.filter(
    (receipt) => receipt.batchId === first.id,
  );
  return {
    root,
    service,
    tracks: [a, b],
    playlist,
    target,
    selection,
    first,
    receipts,
  };
}

describe("incremental ordered exports", () => {
  it("reorders playlist references without copying audio and applies the full selected-content budget", async () => {
    const { service, playlist, target, selection, first, receipts, tracks } =
      await exported();
    const original = new Map(
      await Promise.all(
        receipts.map(
          async (receipt) => [receipt.path, await stat(receipt.path)] as const,
        ),
      ),
    );
    await service.dispatch("export.confirm", {
      targetId: target.id,
      batchId: first.id,
    });
    await service.dispatch("playlists.reorder", {
      id: playlist.id,
      occurrenceIds: playlist.entries.map((entry) => entry.id).reverse(),
    });
    const revision = (await service.snapshot()).playlists[0].revision;
    await expect(
      service.dispatch("export.confirm", {
        targetId: target.id,
        batchId: first.id,
      }),
    ).rejects.toThrow("Playlist order changed");
    const plan = (await service.dispatch(
      "export.preview",
      selection,
    )) as ExportPlan;
    expect(plan.items.map((item) => item.action)).toEqual([
      "Reorder-only",
      "Reorder-only",
    ]);
    expect(plan.estimatedBytes).toBe(0);
    expect(plan.items.every((item) => item.estimatedBytes === 0)).toBe(true);

    const second = await completed(
      service,
      (await service.dispatch("export.prepare", selection)) as Job,
    );
    const batch = String(second.payload.path);
    const lines = (await readFile(path.join(batch, "playlist.m3u8"), "utf8"))
      .split("\n")
      .filter((line) => line && !line.startsWith("#"));
    expect(lines.map((line) => path.resolve(batch, line))).toEqual(
      [...tracks]
        .reverse()
        .map(
          (track) =>
            receipts.find((receipt) => receipt.trackId === track.id)!.path,
        ),
    );
    expect(
      (await readdir(batch)).filter((name) => name.endsWith(".mp3")),
    ).toEqual([]);
    for (const [file, before] of original) {
      const after = await stat(file);
      expect(after.mtimeMs).toBe(before.mtimeMs);
      expect(after.size).toBe(before.size);
    }
    const pending = (await service.snapshot()).receipts.filter(
      (receipt) => receipt.batchId === second.id,
    );
    expect(
      pending.every(
        (receipt) =>
          receipt.playlistRevision === `${playlist.id}:${revision}` &&
          receipt.evidence === "exported",
      ),
    ).toBe(true);
    await service.dispatch("export.confirm", {
      targetId: target.id,
      batchId: second.id,
    });
    expect(
      (await service.snapshot()).receipts
        .filter((receipt) => receipt.batchId === second.id)
        .every((receipt) => receipt.evidence === "user-confirmed"),
    ).toBe(true);
    expect(
      (
        (await service.dispatch("export.preview", selection)) as ExportPlan
      ).items.map((item) => item.action),
    ).toEqual(["Already current", "Already current"]);

    const selectedBytes = [...original.values()].reduce(
      (sum, file) => sum + file.size,
      0,
    );
    await service.dispatch("targets.update", {
      id: target.id,
      budget: selectedBytes - 1,
    });
    const blocked = (await service.dispatch(
      "export.preview",
      selection,
    )) as ExportPlan;
    expect(blocked.estimatedBytes).toBe(0);
    expect(blocked.items.every((item) => item.action === "Blocked")).toBe(true);
    await expect(service.dispatch("export.prepare", selection)).rejects.toThrow(
      "blocked",
    );
    expect((await service.snapshot()).receipts).toHaveLength(4);
  }, 120000);

  it("does not call corrupted destination audio reusable or current", async () => {
    const { service, selection, receipts } = await exported();
    await writeFile(receipts[0].path, "corrupted audio");
    const plan = (await service.dispatch(
      "export.preview",
      selection,
    )) as ExportPlan;
    expect(
      plan.items.find((item) => item.trackId === receipts[0].trackId),
    ).toMatchObject({ action: "Update", estimatedBytes: expect.any(Number) });
    expect(plan.estimatedBytes).toBeGreaterThan(0);
    expect(
      plan.items.find((item) => item.trackId !== receipts[0].trackId)?.action,
    ).toBe("Already current");
  }, 120000);

  it("never reuses an earlier iMazing batch that may not have been transferred", async () => {
    const { service, playlist, selection } = await exported("imazing");
    await service.dispatch("playlists.reorder", {
      id: playlist.id,
      occurrenceIds: playlist.entries.map((entry) => entry.id).reverse(),
    });
    const plan = (await service.dispatch(
      "export.preview",
      selection,
    )) as ExportPlan;
    expect(plan.items.map((item) => item.action)).toEqual(["Update", "Update"]);
    expect(plan.estimatedBytes).toBeGreaterThan(0);
    const second = await completed(
      service,
      (await service.dispatch("export.prepare", selection)) as Job,
    );
    const batch = String(second.payload.path);
    expect(
      (await readdir(batch)).filter((name) => name.endsWith(".mp3")),
    ).toHaveLength(2);
    const lines = (await readFile(path.join(batch, "playlist.m3u8"), "utf8"))
      .split("\n")
      .filter((line) => line && !line.startsWith("#"));
    expect(lines.every((line) => !line.startsWith(".."))).toBe(true);
  }, 120000);
});
