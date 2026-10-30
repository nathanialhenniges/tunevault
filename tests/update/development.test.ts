import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { UpdateRequestError, UpdateService } from "../../src/update/service";

const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const context = {
  version: "4.0.0",
  platform: "darwin",
  arch: "arm64",
  osVersion: "15.0.0",
};
const installer = Buffer.from("Synthetic installer fixture, never executable.");
const asset = {
  name: "TuneVault-4.0.1-mac-arm64.dmg",
  url: "https://github.com/nathanialhenniges/tunevault/releases/download/v4.0.1/TuneVault-4.0.1-mac-arm64.dmg",
  size: installer.length,
  sha512: createHash("sha512").update(installer).digest("base64"),
};
const envelope = Buffer.from(
  JSON.stringify({
    schema: 1,
    version: "4.0.1",
    channel: "stable",
    notes: "Synthetic release notes",
    minimumOS: { darwin: "15.0.0", win32: "10.0.0" },
    assets: { "darwin-arm64": asset },
  }),
);
const signature = Buffer.from(
  sign(null, envelope, keys.privateKey).toString("base64"),
);
afterEach(() => vi.unstubAllGlobals());

it.each(["darwin", "win32"])(
  "keeps %s development preview manual, local and impossible to install",
  async (platform) => {
    const transport = vi.fn(),
      fetch = vi.fn(),
      windowsUpdater = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const service = new UpdateService({
      ...context,
      platform,
      arch: platform === "darwin" ? "arm64" : "x64",
      cacheDir: "/unused",
      publicKeys: [],
      jobsActive: () => false,
      development: true,
      transport,
      windowsUpdater,
    });
    expect(service.status()).toEqual({ status: "development" });
    const result = await service.check();
    expect(result).toMatchObject({
      status: "development-preview",
      version: "99.0.0",
    });
    expect(result.notes).toContain("not a real release");
    expect(service.status()).toEqual(result);
    await expect(service.download()).rejects.toThrow("Development previews");
    await expect(service.verifiedDownload()).rejects.toThrow(
      "Development previews",
    );
    await expect(service.install()).rejects.toThrow("Development previews");
    expect(transport).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(windowsUpdater).not.toHaveBeenCalled();
  },
);

it("keeps the active media-job guard during development checks", async () => {
  const service = new UpdateService({
    ...context,
    cacheDir: "/unused",
    publicKeys: [],
    jobsActive: () => true,
    development: true,
  });
  await expect(service.check()).rejects.toThrow("media jobs");
  expect(service.status()).toEqual({ status: "development" });
});

it("reports no published release only for an envelope HTTP 404 and persists that status", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(null, { status: 404 }),
  );
  vi.stubGlobal("fetch", fetch);
  const service = new UpdateService({
    ...context,
    cacheDir: "/unused",
    publicKeys: [publicKey],
    jobsActive: () => false,
  });
  await expect(service.check()).resolves.toEqual({ status: "no-release" });
  expect(service.status()).toEqual({ status: "no-release" });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toContain("release-envelope.json");
  await expect(service.download()).rejects.toThrow("authenticated");
});

it("keeps a missing signature as an integrity failure rather than claiming no release", async () => {
  vi.stubGlobal("fetch", async (url: URL) =>
    String(url).endsWith(".json")
      ? new Response(envelope)
      : new Response(null, { status: 404 }),
  );
  const service = new UpdateService({
    ...context,
    cacheDir: "/unused",
    publicKeys: [publicKey],
    jobsActive: () => false,
  });
  await expect(service.check()).rejects.toMatchObject({ status: 404 });
  expect(service.status()).toEqual({ status: "unchecked" });
  await expect(service.download()).rejects.toThrow("authenticated");
});

it.each([401, 403, 429, 500])(
  "does not hide HTTP %s as an unpublished release",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("Provider failure", { status }),
    );
    const service = new UpdateService({
      ...context,
      cacheDir: "/unused",
      publicKeys: [publicKey],
      jobsActive: () => false,
    });
    await expect(service.check()).rejects.toMatchObject({ status });
    expect(service.status()).toEqual({ status: "unchecked" });
  },
);

it("does not classify an arbitrary error message as an HTTP 404", async () => {
  const service = new UpdateService({
    ...context,
    cacheDir: "/unused",
    publicKeys: [publicKey],
    jobsActive: () => false,
    transport: async () => {
      throw new Error("Update request failed (404)");
    },
  });
  await expect(service.check()).rejects.toThrow("404");
  expect(service.status()).toEqual({ status: "unchecked" });
});

it("invalidates a previously ready installer on envelope 404 and recovers on a verified release", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tunevault-no-release-"));
  let missing = false;
  const service = new UpdateService({
    ...context,
    cacheDir: directory,
    publicKeys: [publicKey],
    jobsActive: () => false,
    transport: async (url) => {
      if (missing) throw new UpdateRequestError(404);
      return url.endsWith(".sig") ? signature : envelope;
    },
  });
  try {
    await expect(service.check()).resolves.toMatchObject({
      status: "available",
    });
    vi.stubGlobal("fetch", async () => new Response(installer));
    const downloaded = await service.download();
    expect(service.status().status).toBe("ready-for-manual-replacement");
    missing = true;
    await expect(service.check()).resolves.toEqual({ status: "no-release" });
    await expect(service.verifiedDownload()).rejects.toThrow(
      "No verified installer",
    );
    await expect(service.download()).rejects.toThrow("authenticated");
    expect((await stat(downloaded.path)).size).toBe(installer.length);
    missing = false;
    await expect(service.check()).resolves.toMatchObject({
      status: "available",
      version: "4.0.1",
    });
    expect(service.status().path).toBeUndefined();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
