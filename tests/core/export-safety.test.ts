import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LibraryService } from "../../src/core/library";
import * as media from "../../src/core/media";
import { verifyTools, type ToolPaths } from "../../src/update/tools";
import type { Job, Target } from "../../src/shared/types";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    copyFile: vi.fn(actual.copyFile),
    rename: vi.fn(actual.rename),
  };
});
const actualFS =
  await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
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
  vi.mocked(fs.copyFile).mockImplementation(actualFS.copyFile);
  vi.mocked(fs.rename).mockImplementation(actualFS.rename);
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function settled(service: LibraryService, job: Job): Promise<Job> {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const current = (await service.snapshot()).jobs.find(
      (item) => item.id === job.id,
    )!;
    if (!["queued", "running"].includes(current.status)) return current;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Export safety fixture timed out");
}
async function fixture() {
  const root = await fs.mkdtemp(
    path.join(tmpdir(), "tunevault-export-safety-"),
  );
  const vault = path.join(root, "vault"),
    destination = path.join(root, "player");
  await fs.mkdir(vault);
  await fs.mkdir(destination);
  const service = new LibraryService({
    dataDir: path.join(root, "data"),
    toolsDir,
  });
  cleanups.push(async () => {
    service.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  await service.dispatch("settings.update", { vault });
  const source = path.join(root, "tone.mp3");
  await media.run(tools.ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-c:a",
    "libmp3lame",
    source,
  ]);
  const imported = await settled(
    service,
    (await service.dispatch("import.start", { paths: [source] })) as Job,
  );
  expect(imported.status, imported.message).toBe("completed");
  const target = (await service.dispatch("targets.create", {
    name: "Player",
    transport: "folder",
    destination,
  })) as Target;
  return {
    root,
    destination,
    service,
    target,
    targetRoot: path.join(
      await fs.realpath(destination),
      `TuneVault-${target.id}`,
    ),
  };
}

describe("target writer safety", () => {
  it("rejects updates while normal export runs, a test pack queues, or cancellation is still releasing the writer", async () => {
    const { service, target, destination } = await fixture();
    const queuedTarget = (await service.dispatch("targets.create", {
      name: "Queued",
      transport: "folder",
      destination,
    })) as Target;
    const idle = (await service.dispatch("targets.create", {
      name: "Idle",
      transport: "folder",
      destination,
    })) as Target;
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const writeMedia = media.writeMedia;
    vi.spyOn(media, "writeMedia").mockImplementationOnce(async (...args) => {
      entered();
      await held;
      args[3]?.signal?.throwIfAborted();
      return writeMedia(...args);
    });
    const normal = (await service.dispatch("export.prepare", {
      targetId: target.id,
    })) as Job;
    try {
      await started;
      const queued = (await service.dispatch("targets.testPack", {
        targetId: queuedTarget.id,
      })) as Job;
      expect(
        (await service.snapshot()).jobs.find((job) => job.id === queued.id)
          ?.status,
      ).toBe("queued");
      await expect(
        service.dispatch("targets.update", {
          id: target.id,
          name: "Overwritten",
        }),
      ).rejects.toThrow("queued or active export");
      await expect(
        service.dispatch("targets.update", {
          id: queuedTarget.id,
          profile: { format: "flac" },
        }),
      ).rejects.toThrow("queued or active export");
      expect(
        await service.dispatch("targets.update", {
          id: idle.id,
          name: "Idle rename",
        }),
      ).toMatchObject({ name: "Idle rename" });
      await service.dispatch("jobs.cancel", { id: normal.id });
      expect(
        (await service.snapshot()).jobs.find((job) => job.id === normal.id)
          ?.status,
      ).toBe("cancelled");
      await expect(
        service.dispatch("targets.update", {
          id: target.id,
          name: "Still writing",
        }),
      ).rejects.toThrow("queued or active export");
      release();
      const pack = await settled(service, queued);
      expect(pack.status, pack.message).toBe("completed");
      expect(
        await service.dispatch("targets.update", {
          id: target.id,
          name: "Allowed after cleanup",
        }),
      ).toMatchObject({ name: "Allowed after cleanup" });
      expect(
        await service.dispatch("targets.update", {
          id: queuedTarget.id,
          name: "Pack completed",
        }),
      ).toMatchObject({ name: "Pack completed" });
    } finally {
      release();
    }
  }, 120000);

  it.each(["audio", "manifest", "receipts"] as const)(
    "rejects a volume substitution before %s commit and records no transfer receipts",
    async (boundary) => {
      const { service, target, targetRoot, destination } = await fixture();
      const unknown = path.join(destination, "owner-file.txt");
      await fs.writeFile(unknown, "keep me");
      const marker = path.join(targetRoot, ".tunevault-volume-id");
      let replaced = false;
      if (boundary === "audio") {
        vi.mocked(fs.copyFile).mockImplementation(async (...args) => {
          await actualFS.copyFile(...args);
          const output = String(args[1]);
          if (
            !replaced &&
            output.startsWith(targetRoot + path.sep) &&
            output.endsWith(".partial")
          ) {
            replaced = true;
            await fs.writeFile(marker, "0".repeat(36));
          }
        });
      } else {
        vi.mocked(fs.rename).mockImplementation(async (...args) => {
          await actualFS.rename(...args);
          const output = String(args[1]);
          const committed =
            boundary === "manifest" ? "playlist.m3u8" : "manifest.json";
          if (
            !replaced &&
            output.startsWith(targetRoot + path.sep) &&
            output.endsWith(committed)
          ) {
            replaced = true;
            await fs.writeFile(marker, "0".repeat(36));
          }
        });
      }
      const job = await settled(
        service,
        (await service.dispatch("export.prepare", {
          targetId: target.id,
        })) as Job,
      );
      expect(replaced, job.message).toBe(true);
      expect(job.status).toBe("failed");
      expect(job.message).toContain("identity changed");
      expect((await service.snapshot()).receipts).toEqual([]);
      expect(await fs.readFile(unknown, "utf8")).toBe("keep me");
      if (boundary !== "receipts")
        await expect(
          fs.stat(path.join(targetRoot, job.id, "manifest.json")),
        ).rejects.toThrow();
      if (boundary === "audio")
        expect(await fs.readdir(path.join(targetRoot, job.id))).toEqual([]);
    },
    120000,
  );
});
