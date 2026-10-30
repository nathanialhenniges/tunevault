import { createHash, verify } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
  sha512: string;
}
export interface ReleaseEnvelope {
  schema: 1;
  version: string;
  channel: "stable";
  notes: string;
  minimumOS: Record<"darwin" | "win32", string>;
  assets: Record<string, ReleaseAsset>;
}
export interface UpdateContext {
  version: string;
  platform: string;
  arch: string;
  osVersion: string;
}
export interface VerifiedRelease {
  envelope: ReleaseEnvelope;
  asset: ReleaseAsset;
}

export function versionParts(value: string): number[] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value))
    throw new Error("A stable semantic version is required");
  const parts = value.split(".").map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part)))
    throw new Error("Invalid version bounds");
  return parts;
}
export function compareVersions(a: string, b: string): number {
  const av = versionParts(a),
    bv = versionParts(b);
  for (let i = 0; i < 3; i++)
    if (av[i] !== bv[i]) return av[i]! > bv[i]! ? 1 : -1;
  return 0;
}
export function validAssetURL(
  url: string,
  name: string,
  version: string,
): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "github.com" &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash &&
      parsed.pathname ===
        `/nathanialhenniges/tunevault/releases/download/v${version}/${encodeURIComponent(name)}`
    );
  } catch {
    return false;
  }
}

export function verifyEnvelope(
  bytes: Buffer,
  signature: Buffer,
  publicKeys: string[],
  context: UpdateContext,
): VerifiedRelease | null {
  if (!bytes.length || bytes.length > 128_000 || signature.length !== 64)
    throw new Error("Invalid release envelope bounds");
  if (
    !publicKeys.length ||
    !publicKeys.some((key) => {
      try {
        return verify(null, bytes, key, signature);
      } catch {
        return false;
      }
    })
  )
    throw new Error("Release signature could not be verified");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const envelope = JSON.parse(text) as ReleaseEnvelope;
  if (
    !envelope ||
    envelope.schema !== 1 ||
    envelope.channel !== "stable" ||
    typeof envelope.notes !== "string" ||
    envelope.notes.length > 40_000 ||
    !envelope.minimumOS ||
    !envelope.assets ||
    Array.isArray(envelope.assets)
  )
    throw new Error("Unsupported release envelope schema");
  const comparison = compareVersions(envelope.version, context.version);
  if (comparison < 0) throw new Error("Release downgrade rejected");
  if (
    !["darwin", "win32"].includes(context.platform) ||
    !["arm64", "x64"].includes(context.arch) ||
    (context.platform === "win32" && context.arch !== "x64") ||
    (context.platform === "darwin" && context.arch !== "arm64")
  )
    throw new Error("Unsupported update platform");
  const minimum = envelope.minimumOS[context.platform as "darwin" | "win32"];
  if (
    typeof minimum !== "string" ||
    compareVersions(context.osVersion, minimum) < 0
  )
    throw new Error("This release requires a newer operating system");
  const asset = envelope.assets[`${context.platform}-${context.arch}`];
  const extension = context.platform === "darwin" ? ".dmg" : ".exe";
  if (
    !asset ||
    typeof asset.name !== "string" ||
    !/^[A-Za-z0-9._-]{1,180}$/.test(asset.name) ||
    !asset.name.endsWith(extension) ||
    !validAssetURL(asset.url, asset.name, envelope.version) ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < 1 ||
    asset.size > 4_000_000_000 ||
    typeof asset.sha512 !== "string" ||
    !/^[A-Za-z0-9+/]{86}==$/.test(asset.sha512) ||
    Buffer.from(asset.sha512, "base64").length !== 64
  )
    throw new Error("Missing or invalid platform release asset");
  return comparison === 0 ? null : { envelope, asset };
}

export async function verifyArtifact(
  path: string,
  asset: ReleaseAsset,
): Promise<void> {
  const file = await lstat(path);
  if (!file.isFile() || file.isSymbolicLink() || file.size !== asset.size)
    throw new Error("Downloaded installer size/type mismatch");
  const digest = createHash("sha512");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  if (digest.digest("base64") !== asset.sha512)
    throw new Error("Downloaded installer digest mismatch");
}

export function verifyFeed(
  info: {
    version: string;
    files?: { url: string; sha512: string; size?: number }[];
  },
  release: VerifiedRelease,
): void {
  const { envelope, asset } = release;
  if (info.version !== envelope.version || info.files?.length !== 1)
    throw new Error("Updater feed differs from authenticated release");
  const file = info.files[0]!;
  if (
    ![asset.name, asset.url].includes(file.url) ||
    file.sha512 !== asset.sha512 ||
    file.size !== asset.size
  )
    throw new Error("Updater installer differs from authenticated asset");
}
