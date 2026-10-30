import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import {
  compareVersions,
  verifyArtifact,
  verifyEnvelope,
  verifyFeed,
  type ReleaseEnvelope,
} from "../../src/update/verify";
import {
  supportsArchitecture,
  verifyTools,
  ytDlpArgs,
} from "../../src/update/tools";
import { UpdateService, boundedFetch } from "../../src/update/service";

const pair = generateKeyPairSync("ed25519");
const publicKey = pair.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const installer = Buffer.from("synthetic installer, never executable");
const asset = {
  name: "TuneVault-4.0.1-mac-arm64.dmg",
  url: "https://github.com/nathanialhenniges/tunevault/releases/download/v4.0.1/TuneVault-4.0.1-mac-arm64.dmg",
  size: installer.length,
  sha512: createHash("sha512").update(installer).digest("base64"),
};
const context = {
  version: "4.0.0",
  platform: "darwin",
  arch: "arm64",
  osVersion: "14.0.0",
};
const envelope = (): ReleaseEnvelope => ({
  schema: 1,
  version: "4.0.1",
  channel: "stable",
  notes: "Test release",
  minimumOS: { darwin: "14.0.0", win32: "10.0.0" },
  assets: { "darwin-arm64": { ...asset } },
});
function signed(value: unknown) {
  const bytes = Buffer.from(JSON.stringify(value));
  return { bytes, signature: sign(null, bytes, pair.privateKey) };
}
function verify(value = envelope(), ctx = context) {
  const { bytes, signature } = signed(value);
  return verifyEnvelope(bytes, signature, [publicKey], ctx);
}

describe("production update authentication", () => {
  it("verifies exact bytes before parsing and rejects tampering or unknown keys", () => {
    const { bytes, signature } = signed(envelope());
    expect(
      verifyEnvelope(bytes, signature, [publicKey], context)?.asset,
    ).toEqual(asset);
    expect(() =>
      verifyEnvelope(
        Buffer.concat([bytes, Buffer.from(" ")]),
        signature,
        [publicKey],
        context,
      ),
    ).toThrow("signature");
    expect(() => verifyEnvelope(bytes, signature, [], context)).toThrow(
      "signature",
    );
    expect(() =>
      verifyEnvelope(bytes, Buffer.alloc(63), [publicKey], context),
    ).toThrow("bounds");
    expect(() =>
      verifyEnvelope(Buffer.alloc(128_001), signature, [publicKey], context),
    ).toThrow("bounds");
  });
  it("handles current release and rejects downgrade/prerelease", () => {
    expect(verify(envelope(), { ...context, version: "4.0.1" })).toBeNull();
    expect(() => verify(envelope(), { ...context, version: "4.0.2" })).toThrow(
      "downgrade",
    );
    expect(() => verify({ ...envelope(), version: "4.0.1-beta.1" })).toThrow(
      "stable",
    );
    expect(compareVersions("4.10.0", "4.9.0")).toBe(1);
  });
  it("rejects missing assets, wrong architecture and old OS", () => {
    expect(() => verify({ ...envelope(), assets: {} })).toThrow("asset");
    expect(() => verify(envelope(), { ...context, arch: "x64" })).toThrow(
      "asset",
    );
    expect(() => verify(envelope(), { ...context, platform: "linux" })).toThrow(
      "platform",
    );
    expect(() =>
      verify(envelope(), { ...context, osVersion: "13.6.0" }),
    ).toThrow("operating system");
  });
  it.each([
    "http://github.com/a",
    "https://localhost/a",
    "https://github.com.evil.test/a",
    "https://github.com/nathanialhenniges/other/releases/download/v4.0.1/file.dmg",
    `${asset.url}?token=leak`,
    `${asset.url}#x`,
  ])("rejects nonallowlisted asset URL %s", (url) => {
    const value = envelope();
    value.assets["darwin-arm64"]!.url = url;
    expect(() => verify(value)).toThrow("asset");
  });
  it("rejects unauthenticated feed identity, hash and size changes", () => {
    const release = verify()!;
    const feed = {
      version: "4.0.1",
      files: [{ url: asset.name, sha512: asset.sha512, size: asset.size }],
    };
    expect(() => verifyFeed(feed, release)).not.toThrow();
    expect(() => verifyFeed({ ...feed, version: "4.0.2" }, release)).toThrow(
      "differs",
    );
    expect(() =>
      verifyFeed(
        { ...feed, files: [{ ...feed.files[0]!, url: "other.exe" }] },
        release,
      ),
    ).toThrow("differs");
    expect(() =>
      verifyFeed(
        { ...feed, files: [{ ...feed.files[0]!, sha512: "changed" }] },
        release,
      ),
    ).toThrow("differs");
    expect(() =>
      verifyFeed({ ...feed, files: [{ ...feed.files[0]!, size: 1 }] }, release),
    ).toThrow("differs");
  });
  it("rehashes cached artifacts and rejects truncation, tampering and symlinks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tunevault-update-"));
    try {
      const path = join(dir, "installer.dmg");
      await writeFile(path, installer);
      await expect(verifyArtifact(path, asset)).resolves.toBeUndefined();
      await writeFile(path, Buffer.alloc(installer.length));
      await expect(verifyArtifact(path, asset)).rejects.toThrow("digest");
      await writeFile(path, installer.subarray(1));
      await expect(verifyArtifact(path, asset)).rejects.toThrow("size");
      if (process.platform !== "win32") {
        const link = join(dir, "link.dmg");
        await symlink(path, link);
        await expect(verifyArtifact(link, asset)).rejects.toThrow("type");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("fails closed when key missing, jobs active, no checked release or mac install requested", async () => {
    const service = new UpdateService({
      ...context,
      cacheDir: "/unused",
      publicKeys: [],
      jobsActive: () => false,
    });
    await expect(service.check()).resolves.toEqual({
      status: "not-configured",
    });
    await expect(service.download()).rejects.toThrow("authenticated");
    await expect(service.install()).rejects.toThrow("manual");
    const busy = new UpdateService({
      ...context,
      cacheDir: "/unused",
      publicKeys: [publicKey],
      jobsActive: () => true,
    });
    await expect(busy.check()).rejects.toThrow("media jobs");
  });
  it("checks signed metadata through the production service and preserves explicit offline errors", async () => {
    const { bytes, signature } = signed(envelope());
    const service = new UpdateService({
      ...context,
      cacheDir: "/unused",
      publicKeys: [publicKey],
      jobsActive: () => false,
      transport: async (url) =>
        url.endsWith(".sig")
          ? Buffer.from(signature.toString("base64"))
          : bytes,
    });
    await expect(service.check()).resolves.toEqual({
      status: "available",
      version: "4.0.1",
      notes: "Test release",
    });
    const offline = new UpdateService({
      ...context,
      cacheDir: "/unused",
      publicKeys: [publicKey],
      jobsActive: () => false,
      transport: async () => {
        throw new Error("Offline");
      },
    });
    await expect(offline.check()).rejects.toThrow("Offline");
    const tampered = new UpdateService({
      ...context,
      cacheDir: "/unused",
      publicKeys: [publicKey],
      jobsActive: () => false,
      transport: async (url) =>
        url.endsWith(".sig")
          ? Buffer.from(signature.toString("base64"))
          : Buffer.concat([bytes, Buffer.from(" ")]),
    });
    await expect(tampered.check()).rejects.toThrow("signature");
  });
  it("streams and authenticates a DMG and detects a changed cache before reveal", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tunevault-dmg-"));
    const { bytes, signature } = signed(envelope());
    const service = new UpdateService({
      ...context,
      cacheDir: dir,
      publicKeys: [publicKey],
      jobsActive: () => false,
      transport: async (url) =>
        url.endsWith(".sig")
          ? Buffer.from(signature.toString("base64"))
          : bytes,
    });
    try {
      await service.check();
      vi.stubGlobal("fetch", async () => new Response(installer));
      const result = await service.download();
      expect(result.status).toBe("ready-for-manual-replacement");
      expect(service.status().path).toBe(result.path);
      expect((await service.check()).status).toBe(
        "ready-for-manual-replacement",
      );
      expect(service.status().path).toBe(result.path);
      await expect(service.verifiedDownload()).resolves.toBe(result.path);
      await writeFile(result.path, Buffer.alloc(installer.length));
      await expect(service.verifiedDownload()).rejects.toThrow("digest");
      vi.stubGlobal("fetch", async () => new Response(installer.subarray(1)));
      await expect(service.download()).rejects.toThrow("size");
      vi.stubGlobal(
        "fetch",
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "http://127.0.0.1/private" },
          }),
      );
      await expect(service.download()).rejects.toThrow("host");
    } finally {
      vi.unstubAllGlobals();
      await rm(dir, { recursive: true, force: true });
    }
  });
});

it("allows a progressing long update body and rejects an idle stream", async () => {
  vi.useFakeTimers();
  try {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              for (let index = 1; index <= 3; index++)
                setTimeout(() => {
                  controller.enqueue(Uint8Array.of(index));
                  if (index === 3) controller.close();
                }, index * 60000);
            },
          }),
        ),
    );
    const progressing = expect(boundedFetch(asset.url, 3)).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
    await vi.advanceTimersByTimeAsync(181000);
    await progressing;
    vi.stubGlobal(
      "fetch",
      async () => new Response(new ReadableStream({ start() {} })),
    );
    const stalled = expect(boundedFetch(asset.url, 3)).rejects.toThrow(
      "stalled",
    );
    await vi.advanceTimersByTimeAsync(121000);
    await stalled;
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

describe("sidecar architecture and invocation", () => {
  it("fails closed on a missing tool or wrong platform bundle", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tunevault-tools-"));
    try {
      await writeFile(
        join(dir, "manifest.json"),
        JSON.stringify({
          schema: 1,
          platform: "other",
          arch: process.arch,
          entries: [],
        }),
      );
      await expect(verifyTools(dir)).rejects.toThrow("architecture");
      await writeFile(
        join(dir, "manifest.json"),
        JSON.stringify({
          schema: 1,
          platform: process.platform,
          arch: process.arch,
          entries: [],
        }),
      );
      await expect(verifyTools(dir)).rejects.toThrow(
        "Missing or invalid ffmpeg",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("rejects non executables and wrong architecture", () => {
    const mac = Buffer.alloc(64);
    mac.writeUInt32BE(0xcffaedfe);
    mac.writeUInt32LE(0x0100000c, 4);
    expect(supportsArchitecture(mac, "darwin", "arm64")).toBe(true);
    expect(supportsArchitecture(mac, "darwin", "x64")).toBe(false);
    expect(
      supportsArchitecture(Buffer.from("not a binary"), "darwin", "arm64"),
    ).toBe(false);
    const windows = Buffer.alloc(128);
    windows.write("MZ");
    windows.writeUInt32LE(64, 0x3c);
    windows.write("PE\0\0", 64);
    windows.writeUInt16LE(0x8664, 68);
    expect(supportsArchitecture(windows, "win32", "x64")).toBe(true);
    expect(supportsArchitecture(windows, "win32", "arm64")).toBe(false);
  });
  it("pins runtime and disables user config/plugins/remote scripts", () => {
    const args = ytDlpArgs({
      ffmpeg: "/bundle/ffmpeg",
      ffprobe: "/bundle/ffprobe",
      deno: "/bundle/deno",
      "yt-dlp": "/bundle/yt-dlp",
    });
    expect(args).toEqual([
      "--ignore-config",
      "--no-plugin-dirs",
      "--no-remote-components",
      "--no-js-runtimes",
      "--js-runtimes",
      "deno:/bundle/deno",
      "--ffmpeg-location",
      "/bundle",
    ]);
  });
});
