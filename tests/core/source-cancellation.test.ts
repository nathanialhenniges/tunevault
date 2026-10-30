import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LibraryService } from "../../src/core/library";
import * as media from "../../src/core/media";
import type { Job } from "../../src/shared/types";

vi.mock("../../src/update/tools", () => ({
  verifyTools: vi.fn(async () => ({
    ffmpeg: "/mock/ffmpeg",
    ffprobe: "/mock/ffprobe",
    "yt-dlp": "/mock/yt-dlp",
    deno: "/mock/deno",
  })),
}));

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "tunevault-source-cancel-"));
  const vault = path.join(root, "library");
  await mkdir(vault);
  const service = new LibraryService({
    dataDir: path.join(root, "data"),
    toolsDir: path.join(root, "mock-tools"),
  });
  cleanup.push(async () => {
    service.close();
    await media.stopMediaTools();
    await rm(root, { recursive: true, force: true });
  });
  await service.dispatch("settings.update", {
    vault,
    onlineAcknowledged: true,
  });
  return service;
}
const emptyPreview = JSON.stringify({
  title: "Empty owned playlist fixture",
  playlist_count: 0,
  entries: [],
});
async function complete(service: LibraryService, job: Job) {
  await vi.waitFor(
    async () => {
      expect(
        (await service.snapshot()).jobs.find((item) => item.id === job.id)
          ?.status,
      ).toBe("completed");
    },
    { timeout: 10000, interval: 20 },
  );
}

it("cancels the initial preview subprocess, advances the queue, and retries only on request", async () => {
  const service = await fixture();
  const actualRun = media.run;
  let ready!: () => void;
  const started = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let previews = 0;
  const spy = vi
    .spyOn(media, "run")
    .mockImplementation(async (_executable, _args, signal) => {
      if (++previews > 1) return emptyPreview;
      return actualRun(
        process.execPath,
        ["-e", "process.stdout.write('READY\\n'); setTimeout(() => {}, 30000)"],
        signal,
        (line) => {
          if (line === "READY") ready();
        },
      );
    });
  const cancelled = (await service.dispatch("source.acquire", {
    url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
  })) as Job;
  await started;
  const next = (await service.dispatch("source.acquire", {
    url: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
  })) as Job;
  await service.dispatch("jobs.cancel", { id: cancelled.id });
  await complete(service, next);
  let snapshot = await service.snapshot();
  expect(snapshot.jobs.find((job) => job.id === cancelled.id)).toMatchObject({
    status: "cancelled",
    attempts: 1,
  });
  expect(snapshot.playlists).toEqual([]);
  expect(snapshot.tracks).toEqual([]);
  expect(spy.mock.calls[0][2]?.aborted).toBe(true);
  expect(previews).toBe(2);
  await service.dispatch("jobs.retry", { id: cancelled.id });
  await complete(service, cancelled);
  snapshot = await service.snapshot();
  expect(snapshot.jobs.find((job) => job.id === cancelled.id)).toMatchObject({
    status: "completed",
    attempts: 2,
  });
  expect(previews).toBe(3);
});

it("does not create a stale playlist if a preview resolves after cancellation", async () => {
  const service = await fixture();
  let resolvePreview!: (value: string) => void;
  let ready!: () => void;
  const started = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let previews = 0;
  vi.spyOn(media, "run").mockImplementation(async () => {
    if (++previews > 1) return emptyPreview;
    ready();
    return new Promise<string>((resolve) => {
      resolvePreview = resolve;
    });
  });
  const cancelled = (await service.dispatch("source.acquire", {
    url: "https://www.youtube.com/watch?v=ccccccccccc",
  })) as Job;
  await started;
  await service.dispatch("jobs.cancel", { id: cancelled.id });
  const next = (await service.dispatch("source.acquire", {
    url: "https://www.youtube.com/watch?v=ddddddddddd",
  })) as Job;
  resolvePreview(
    JSON.stringify({
      title: "Must not be saved",
      playlist_count: 2,
      entries: [
        { id: "eeeeeeeeeee", title: "First" },
        { id: "fffffffffff", title: "Second" },
      ],
    }),
  );
  await complete(service, next);
  const snapshot = await service.snapshot();
  expect(snapshot.jobs.find((job) => job.id === cancelled.id)?.status).toBe(
    "cancelled",
  );
  expect(
    snapshot.jobs.find((job) => job.id === cancelled.id)?.payload,
  ).not.toHaveProperty("sourceSnapshot");
  expect(snapshot.playlists).toEqual([]);
  expect(snapshot.tracks).toEqual([]);
});

it("aborts a standalone source preview when its library closes", async () => {
  const service = await fixture();
  let ready!: () => void;
  const started = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let previewSignal: AbortSignal | undefined;
  vi.spyOn(media, "run").mockImplementation(
    async (_executable, _args, signal) => {
      previewSignal = signal;
      ready();
      return new Promise<string>((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(new Error("Preview cancelled")),
          { once: true },
        );
      });
    },
  );
  const preview = service.dispatch("source.preview", {
    url: "https://www.youtube.com/watch?v=ggggggggggg",
  });
  await started;
  expect(previewSignal).toBeInstanceOf(AbortSignal);
  service.close();
  expect(previewSignal?.aborted).toBe(true);
  await expect(preview).resolves.toMatchObject({
    capability: "temporarily-failed",
    complete: false,
  });
});
