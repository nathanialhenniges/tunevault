import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { run as runTool } from "../core/media";

const verifiedVersions = new Map<string, string>();
export type ToolPaths = Record<
  "ffmpeg" | "ffprobe" | "yt-dlp" | "deno",
  string
>;

export function supportsArchitecture(
  bytes: Buffer,
  platform: string,
  arch: string,
): boolean {
  if (bytes.length < 64) return false;
  if (platform === "win32") {
    if (bytes.toString("ascii", 0, 2) !== "MZ") return false;
    const offset = bytes.readUInt32LE(0x3c);
    return (
      offset + 6 <= bytes.length &&
      bytes.toString("ascii", offset, offset + 4) === "PE\0\0" &&
      bytes.readUInt16LE(offset + 4) === 0x8664 &&
      arch === "x64"
    );
  }
  if (platform !== "darwin") return false;
  const cpu = arch === "arm64" ? 0x0100000c : arch === "x64" ? 0x01000007 : -1;
  const magic = bytes.readUInt32BE(0);
  if (magic === 0xcffaedfe) return bytes.readUInt32LE(4) === cpu;
  if (magic === 0xfeedfacf) return bytes.readUInt32BE(4) === cpu;
  if (magic === 0xcafebabe || magic === 0xcafebabf) {
    const count = bytes.readUInt32BE(4);
    const stride = magic === 0xcafebabf ? 32 : 20;
    if (count > 16 || 8 + count * stride > bytes.length) return false;
    for (let i = 0; i < count; i++)
      if (bytes.readUInt32BE(8 + i * stride) === cpu) return true;
  }
  return false;
}

export async function verifyTools(
  directory: string,
  platform = process.platform,
  arch = process.arch,
  signal?: AbortSignal,
): Promise<ToolPaths> {
  const root = await realpath(directory);
  const text = await readFile(join(root, "manifest.json"), "utf8");
  if (text.length > 64_000) throw new Error("Tool manifest too large");
  const manifest = JSON.parse(text);
  if (
    manifest.schema !== 1 ||
    manifest.platform !== platform ||
    manifest.arch !== arch ||
    !Array.isArray(manifest.entries)
  )
    throw new Error("Wrong tool bundle architecture or schema");
  const paths: Partial<ToolPaths> = {};
  for (const name of ["ffmpeg", "ffprobe", "yt-dlp", "deno"] as const) {
    const entry = manifest.entries.find(
      (item: { name: string }) => item.name === name,
    );
    const expected = `${name}${platform === "win32" ? ".exe" : ""}`;
    if (
      !entry ||
      entry.file !== expected ||
      typeof entry.version !== "string" ||
      !entry.version ||
      entry.version.length > 100 ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
      throw new Error(`Missing or invalid ${name} manifest`);
    const path = await realpath(join(root, expected));
    if (dirname(path) !== root) throw new Error("Tool symlink escape");
    if ((await stat(path)).size !== entry.size || entry.size > 300_000_000)
      throw new Error(`${name} size mismatch`);
    const bytes = await readFile(path);
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
      throw new Error(`${name} digest mismatch`);
    if (!supportsArchitecture(bytes, platform, arch))
      throw new Error(`${name} executable architecture mismatch`);
    const proof = `${platform}:${arch}:${name}:${entry.sha256}:${entry.version}`;
    let output = verifiedVersions.get(proof);
    if (output === undefined) {
      const args =
        name === "yt-dlp"
          ? [
              "--ignore-config",
              "--no-plugin-dirs",
              "--no-remote-components",
              "--version",
            ]
          : [name.startsWith("ff") ? "-version" : "--version"];
      output = await runTool(path, args, signal, undefined, {
        timeoutMs: name === "yt-dlp" ? 90000 : 30000,
        maxBytes: 256000,
      });
      if (!output.includes(entry.version))
        throw new Error(`${name} version mismatch`);
      if (name.startsWith("ff") && output.includes("--enable-nonfree"))
        throw new Error("Non-redistributable FFmpeg build rejected");
      if (verifiedVersions.size >= 32) verifiedVersions.clear();
      verifiedVersions.set(proof, output);
    }
    paths[name] = path;
  }
  for (const [kind, required] of [
    ["encoders", ["libmp3lame", "aac", "alac", "flac", "png", "mjpeg"]],
    [
      "decoders",
      ["mp3", "aac", "alac", "flac", "opus", "vorbis", "png", "mjpeg"],
    ],
  ] as const) {
    const stdout = await runTool(
      paths.ffmpeg!,
      ["-hide_banner", `-${kind}`],
      signal,
      undefined,
      { timeoutMs: 30000, maxBytes: 256000 },
    );
    const supported = new Set(
      stdout.split("\n").map((line) => line.trim().split(/\s+/)[1]),
    );
    for (const codec of required)
      if (!supported.has(codec))
        throw new Error(`Required FFmpeg ${kind} missing: ${codec}`);
  }
  return paths as ToolPaths;
}

export function ytDlpArgs(tools: ToolPaths): string[] {
  return [
    "--ignore-config",
    "--no-plugin-dirs",
    "--no-remote-components",
    "--no-js-runtimes",
    "--js-runtimes",
    `deno:${tools.deno}`,
    "--ffmpeg-location",
    dirname(tools.ffmpeg),
  ];
}
