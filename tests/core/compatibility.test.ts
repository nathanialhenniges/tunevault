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
import { parseFile } from "music-metadata";
import sharp from "sharp";
import { LibraryService } from "../../src/core/library";
import { inspect } from "../../src/core/media";
import { hashFile } from "../../src/core/safety";
import { verifyTools, type ToolPaths } from "../../src/update/tools";
import type { Format, Job, Target } from "../../src/shared/types";

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

async function settled(service: LibraryService, job: Job): Promise<Job> {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const current = (await service.snapshot()).jobs.find(
      (item) => item.id === job.id,
    )!;
    if (!["queued", "running"].includes(current.status)) return current;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Compatibility test pack job timed out");
}
async function fixture(format: Format = "mp3", budget: number | null = null) {
  const root = await mkdtemp(path.join(tmpdir(), "tunevault-compatibility-"));
  const destination = path.join(root, "selected"),
    otherDestination = path.join(root, "other");
  await mkdir(destination);
  await mkdir(otherDestination);
  const service = new LibraryService({
    dataDir: path.join(root, "data"),
    toolsDir,
  });
  cleanups.push(async () => {
    service.close();
    await rm(root, { recursive: true, force: true });
  });
  const target = (await service.dispatch("targets.create", {
    name: "Test player",
    transport: "folder",
    destination,
    profile: { format },
    budget,
  })) as Target;
  const other = (await service.dispatch("targets.create", {
    name: "Other player",
    transport: "folder",
    destination: otherDestination,
  })) as Target;
  return { root, destination, otherDestination, service, target, other };
}

describe("synthetic player compatibility packs", () => {
  it.each(["mp3", "aac", "alac", "flac", "original"] as const)(
    "prepares actual %s audio, tags, RGB art and A/B/A order without library entries or receipts",
    async (format) => {
      const { service, target, other, otherDestination } =
        await fixture(format);
      const queued = (await service.dispatch("targets.testPack", {
        targetId: target.id,
      })) as Job;
      expect(queued).toMatchObject({
        kind: "export",
        status: "queued",
        payload: { targetId: target.id, compatibilityTest: true },
      });
      const completed = await settled(service, queued);
      expect(completed.status, completed.message).toBe("completed");
      expect(completed.message).toContain("hardware playback is not verified");
      const folder = String(completed.payload.resultFolder);
      const manifest = JSON.parse(
        await readFile(path.join(folder, "manifest.json"), "utf8"),
      );
      expect(manifest).toMatchObject({
        synthetic: true,
        hardwareVerified: false,
        targetId: target.id,
        profileRevision: 1,
        model: "",
        firmware: "",
      });
      expect(manifest.files).toHaveLength(2);
      const expectedCodec = format === "original" ? "flac" : format;
      for (const [index, file] of manifest.files.entries()) {
        const full = path.join(folder, file.name);
        const result = await inspect(full, tools);
        expect(result.codec).toBe(expectedCodec);
        expect(result.duration).toBeCloseTo(2, 0);
        expect(result.metadata).toMatchObject({
          title: index === 0 ? "Test A — 銀の狼" : "Test B — Música",
          artist: "TuneVault synthetic test",
          trackNumber: String(index + 1),
          trackTotal: "2",
        });
        expect(result.metadata.comment).toContain("Synthetic test tone");
        expect(await hashFile(full)).toBe(file.hash);
        const picture = (await parseFile(full)).common.picture?.[0];
        expect(picture?.format).toBe("image/jpeg");
        const art = await sharp(picture!.data).metadata();
        expect(art.channels).toBe(3);
        expect(art.space).toBe("srgb");
      }
      const playlist = (
        await readFile(path.join(folder, "playlist.m3u8"), "utf8")
      )
        .split("\n")
        .filter((line) => line && !line.startsWith("#"));
      expect(playlist).toEqual([
        manifest.files[0].name,
        manifest.files[1].name,
        manifest.files[0].name,
      ]);
      expect(
        playlist.every(
          (name) => !path.isAbsolute(name) && !name.includes(".."),
        ),
      ).toBe(true);
      const state = await service.snapshot();
      expect(state.tracks).toEqual([]);
      expect(state.playlists).toEqual([]);
      expect(state.receipts).toEqual([]);
      expect(
        state.targets.find((item) => item.id === target.id)?.profile
          .compatibility,
      ).toBe("Baseline");
      expect(
        state.targets.find((item) => item.id === other.id)?.volumeIdentity,
      ).toBe("");
      expect(await readdir(otherDestination)).toEqual([]);
      await expect(
        service.dispatch("export.confirm", {
          targetId: target.id,
          batchId: queued.id,
        }),
      ).rejects.toThrow("No prepared batch");
    },
    120000,
  );

  it("fails a too-small budget without deleting unknown files or creating transfer receipts", async () => {
    const { service, target, destination } = await fixture("mp3", 1);
    const unknown = path.join(destination, "keep-this.txt");
    await writeFile(unknown, "owner file");
    const job = await settled(
      service,
      (await service.dispatch("targets.testPack", {
        targetId: target.id,
      })) as Job,
    );
    expect(job.status).toBe("failed");
    expect(job.message).toContain("budget");
    expect(await readFile(unknown, "utf8")).toBe("owner file");
    expect((await service.snapshot()).receipts).toEqual([]);
    expect(
      (await readdir(path.join(destination, `TuneVault-${target.id}`))).filter(
        (name) => name.startsWith("compatibility-test-"),
      ),
    ).toEqual([]);
  }, 120000);

  it("rejects a replaced volume marker and retains the prior test pack", async () => {
    const { service, target, destination } = await fixture();
    const first = await settled(
      service,
      (await service.dispatch("targets.testPack", {
        targetId: target.id,
      })) as Job,
    );
    expect(first.status, first.message).toBe("completed");
    const manifest = path.join(
      String(first.payload.resultFolder),
      "manifest.json",
    );
    const before = await stat(manifest);
    await writeFile(
      path.join(destination, `TuneVault-${target.id}`, ".tunevault-volume-id"),
      "0".repeat(36),
    );
    const second = await settled(
      service,
      (await service.dispatch("targets.testPack", {
        targetId: target.id,
      })) as Job,
    );
    expect(second.status).toBe("failed");
    expect(second.message).toContain("identity changed");
    expect((await stat(manifest)).mtimeMs).toBe(before.mtimeMs);
    expect((await service.snapshot()).receipts).toEqual([]);
  }, 120000);
});
