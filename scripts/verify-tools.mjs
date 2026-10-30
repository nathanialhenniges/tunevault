import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { execFileSync } from "node:child_process";

const root = await realpath(
  process.argv[2] ||
    resolve("resources/tools", `${process.platform}-${process.arch}`),
);
const manifest = JSON.parse(
  await readFile(join(root, "manifest.json"), "utf8"),
);
if (
  manifest.schema !== 1 ||
  manifest.platform !== process.platform ||
  manifest.arch !== process.arch
)
  throw new Error("Wrong tool platform/architecture");
for (const name of ["ffmpeg", "ffprobe", "yt-dlp", "deno"]) {
  const item = manifest.entries.find((entry) => entry.name === name);
  if (
    !item ||
    item.file !== `${name}${process.platform === "win32" ? ".exe" : ""}`
  )
    throw new Error(`Missing ${name}`);
  const file = await realpath(join(root, item.file));
  if (dirname(file) !== root) throw new Error("Tool path escapes bundle");
  const bytes = await readFile(file);
  if (
    bytes.length !== item.size ||
    createHash("sha256").update(bytes).digest("hex") !== item.sha256
  )
    throw new Error(`Tool hash/size mismatch: ${name}`);
  const output = execFileSync(
    file,
    name === "yt-dlp"
      ? [
          "--ignore-config",
          "--no-plugin-dirs",
          "--no-remote-components",
          "--version",
        ]
      : [name.startsWith("ff") ? "-version" : "--version"],
    {
      encoding: "utf8",
      timeout: 90_000,
      maxBuffer: 256_000,
      env: { ...process.env, PATH: "" },
      windowsHide: true,
    },
  );
  if (!output.includes(item.version) || output.includes("--enable-nonfree"))
    throw new Error(`Unacceptable version/build: ${name}`);
  console.log(`${name}: ${output.split("\n")[0]} sha256:${item.sha256}`);
}
// EJS is pinned inside the hash-verified official standalone yt-dlp binary.
const ytdlp = join(root, `yt-dlp${process.platform === "win32" ? ".exe" : ""}`);
execFileSync(
  ytdlp,
  [
    "--ignore-config",
    "--no-plugin-dirs",
    "--no-remote-components",
    "--no-js-runtimes",
    "--js-runtimes",
    `deno:${join(root, `deno${process.platform === "win32" ? ".exe" : ""}`)}`,
    "--version",
  ],
  { timeout: 90_000, env: { ...process.env, PATH: "" } },
);
console.log(`EJS: ${manifest.ejs}`);
for (const [kind, required] of [
  ["encoders", ["libmp3lame", "aac", "alac", "flac", "png", "mjpeg"]],
  [
    "decoders",
    ["mp3", "aac", "alac", "flac", "opus", "vorbis", "png", "mjpeg"],
  ],
  ["muxers", ["mp3", "ipod", "flac", "wav", "aiff", "adts", "ogg"]],
]) {
  const output = execFileSync(
    join(root, `ffmpeg${process.platform === "win32" ? ".exe" : ""}`),
    ["-hide_banner", `-${kind}`],
    { encoding: "utf8", timeout: 90_000, env: { ...process.env, PATH: "" } },
  );
  const supported = new Set(
    output.split("\n").map((line) => line.trim().split(/\s+/)[1]),
  );
  for (const codec of required)
    if (!supported.has(codec))
      throw new Error(`Required FFmpeg ${kind} missing: ${codec}`);
}
console.log(
  "Required MP3/AAC/ALAC/FLAC/artwork codecs, output containers and Opus/Vorbis input capabilities present.",
);
