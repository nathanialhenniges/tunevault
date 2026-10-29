import {
  File as TagFile,
  ReadStyle,
  TagTypes,
  Id3v2Tag,
} from "node-taglib-sharp";
import { spawn } from "node:child_process";
import { stat, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { parseFile } from "music-metadata";
import sharp from "sharp";
import type { Metadata, Track, Profile } from "../shared/types";
import { hashFile } from "./safety";
export const fields = [
  "title",
  "artist",
  "album",
  "albumArtist",
  "trackNumber",
  "trackTotal",
  "discNumber",
  "discTotal",
  "date",
  "genre",
  "composer",
  "comment",
  "isrc",
  "musicbrainzId",
] as const;
export function blankMetadata(): Metadata {
  return Object.fromEntries(fields.map((x) => [x, ""])) as Metadata;
}
export interface ToolPaths {
  [name: string]: string;
}
export async function run(
  executable: string,
  args: string[],
  signal?: AbortSignal,
  onLine?: (line: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      env: { ...process.env, PATH: path.dirname(executable) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const decoder = new StringDecoder("utf8");
    let output = "",
      error = "",
      buffer = "",
      bytes = 0;
    const abort = () => {
      if (process.platform === "win32")
        spawn(
          path.join(
            process.env.SystemRoot || "C:\\Windows",
            "System32",
            "taskkill.exe",
          ),
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true },
        ).on("error", () => child.kill());
      else {
        try {
          if (child.pid) process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    };
    const timeout = setTimeout(
      () => {
        abort();
        reject(new Error("Media operation timed out"));
      },
      30 * 60 * 1000,
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) {
        abort();
        return reject(new Error("Tool response exceeded 16 MB"));
      }
      const str = decoder.write(chunk);
      output += str;
      if (onLine) {
        buffer += str;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) onLine(line);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      error = (error + chunk.toString()).slice(-4000);
    });
    child.on("error", finish);
    child.on("close", (code) => {
      const tail = decoder.end();
      output += tail;
      buffer += tail;
      if (onLine && buffer) onLine(buffer);
      finish(
        signal?.aborted
          ? new Error("Cancelled")
          : code === 0
            ? undefined
            : new Error(
                `Media tool failed (${code}): ${error.replace(/https?:\/\/\S+/g, "[URL]").slice(-1000)}`,
              ),
      );
    });
    function finish(err?: Error) {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      if (err) reject(err);
      else resolve(output);
    }
  });
}
export async function inspect(
  file: string,
  tools: ToolPaths,
  signal?: AbortSignal,
): Promise<
  Omit<
    Track,
    | "id"
    | "path"
    | "originalPath"
    | "revision"
    | "favorite"
    | "missing"
    | "source"
  >
> {
  const info = await stat(file);
  if (!info.isFile() || info.size === 0)
    throw new Error("The selected audio file is empty or unreadable");
  const probe = JSON.parse(
    await run(
      tools.ffprobe,
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", file],
      signal,
    ),
  );
  const audio = probe.streams?.find((s: any) => s.codec_type === "audio");
  if (
    !audio ||
    !Number.isFinite(Number(probe.format.duration)) ||
    Number(probe.format.duration) <= 0
  )
    throw new Error(
      "No readable audio stream; DRM-protected files are unsupported",
    );
  if (
    probe.streams.some(
      (s: any) =>
        s.codec_tag_string === "drms" || s.codec_tag_string === "enca",
    )
  )
    throw new Error("DRM-protected media cannot be imported");
  await run(
    tools.ffmpeg,
    ["-v", "error", "-i", file, "-t", "1", "-map", "0:a:0", "-f", "null", "-"],
    signal,
  );
  const tags = await parseFile(file, { duration: false, skipCovers: true });
  const c = tags.common;
  const metadata = blankMetadata();
  Object.assign(metadata, {
    title: c.title || "",
    artist: c.artists?.join("; ") || c.artist || "",
    album: c.album || "",
    albumArtist: c.albumartist || "",
    trackNumber: String(c.track?.no || ""),
    trackTotal: String(c.track?.of || ""),
    discNumber: String(c.disk?.no || ""),
    discTotal: String(c.disk?.of || ""),
    date: c.date || String(c.year || ""),
    genre: c.genre?.join("; ") || "",
    composer: c.composer?.join("; ") || "",
    comment: c.comment?.map((x) => x.text).join("\n") || "",
    isrc: c.isrc?.[0] || "",
    musicbrainzId: c.musicbrainz_recordingid || "",
  });
  return {
    hash: await hashFile(file),
    metadata,
    locks: [],
    origins: Object.fromEntries(
      fields.map((f) => [f, metadata[f] ? "existing-tags" : "unknown"]),
    ),
    artwork: null,
    codec: audio.codec_name,
    container: probe.format.format_name,
    duration: Number(probe.format.duration),
    bitrate: Number(probe.format.bit_rate || 0),
    sampleRate: Number(audio.sample_rate || 0),
    bytes: info.size,
  };
}
export async function artwork(
  source: string,
  directory: string,
  size = 600,
  maxBytes = 500000,
  padding = true,
): Promise<string> {
  const input = await stat(source);
  if (input.size > 20 * 1024 * 1024) throw new Error("Artwork exceeds 20 MB");
  const meta = await sharp(source, { limitInputPixels: 40000000 }).metadata();
  if (
    !["jpeg", "png", "webp"].includes(meta.format || "") ||
    !meta.width ||
    !meta.height
  )
    throw new Error("Use a valid JPEG, PNG or WebP image");
  await mkdir(directory, { recursive: true });
  const dest = path.join(directory, `${randomUUID()}.jpg`);
  for (const quality of [90, 75, 55, 35]) {
    await sharp(source, { limitInputPixels: 40000000 })
      .rotate()
      .resize(size, size, {
        fit: padding ? "contain" : "cover",
        background: "#ffffff",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .toColorspace("srgb")
      .jpeg({ quality })
      .toFile(dest);
    if ((await stat(dest)).size <= maxBytes) return dest;
  }
  await rm(dest, { force: true });
  throw new Error("Artwork cannot fit the selected size limit");
}
export async function embeddedArtwork(
  file: string,
  directory: string,
  tools: ToolPaths,
): Promise<string | null> {
  const raw = path.join(directory, `${randomUUID()}.jpg`);
  try {
    await mkdir(directory, { recursive: true });
    await run(tools.ffmpeg, [
      "-v",
      "error",
      "-i",
      file,
      "-map",
      "0:v:0",
      "-frames:v",
      "1",
      raw,
    ]);
    return await artwork(raw, directory);
  } catch {
    return null;
  } finally {
    await rm(raw, { force: true });
  }
}
const tagNames: Record<string, string> = {
  albumArtist: "album_artist",
  trackNumber: "track",
  discNumber: "disc",
  date: "date",
  musicbrainzId: "MUSICBRAINZ_TRACKID",
  isrc: "ISRC",
};
export async function writeMedia(
  track: Track,
  destination: string,
  tools: ToolPaths,
  options: {
    profile?: Profile;
    signal?: AbortSignal;
    range?: [number, number];
  } = {},
): Promise<void> {
  const { profile, signal, range } = options;
  const ext = path.extname(destination).toLowerCase();
  const args = ["-v", "error", "-nostdin"];
  if (range) args.push("-ss", String(range[0]));
  args.push("-i", track.path);
  if (track.artwork) args.push("-i", track.artwork);
  args.push("-map", "0:a:0");
  if (track.artwork) args.push("-map", "1:v:0");
  args.push("-map_metadata", "-1");
  const codec = profile?.format || "original";
  if (
    codec === "original" ||
    (codec === "mp3" && track.codec === "mp3") ||
    (codec === "aac" && track.codec === "aac") ||
    (codec === "alac" && track.codec === "alac") ||
    (codec === "flac" && track.codec === "flac")
  )
    args.push("-c:a", "copy");
  else {
    args.push(
      "-c:a",
      codec === "mp3" ? "libmp3lame" : codec === "aac" ? "aac" : codec,
    );
    if (codec === "mp3" || codec === "aac")
      args.push("-b:a", `${profile?.bitrate || 192}k`);
    if (profile?.sampleRate) args.push("-ar", String(profile.sampleRate));
  }
  if (range) args.push("-t", String(range[1] - range[0]));
  if (track.artwork)
    args.push(
      "-c:v",
      "mjpeg",
      "-disposition:v:0",
      "attached_pic",
      "-metadata:s:v",
      "title=Album cover",
      "-metadata:s:v",
      "comment=Cover (front)",
    );
  for (const field of fields) {
    if (
      field === "trackTotal" ||
      field === "discTotal" ||
      (field === "comment" && [".mp3", ".m4a", ".flac"].includes(ext))
    )
      continue;
    let val = track.metadata[field];
    if (field === "trackNumber" && track.metadata.trackTotal)
      val += `/${track.metadata.trackTotal}`;
    if (field === "discNumber" && track.metadata.discTotal)
      val += `/${track.metadata.discTotal}`;
    if (val) args.push("-metadata", `${tagNames[field] || field}=${val}`);
  }
  if (ext === ".mp3") args.push("-id3v2_version", "3", "-write_id3v1", "0");
  if (ext === ".m4a") args.push("-movflags", "+faststart");
  args.push("-y", destination);
  await run(tools.ffmpeg, args, signal);
  if ([".mp3", ".m4a", ".flac"].includes(ext)) {
    const file = TagFile.createFromPath(destination, undefined, ReadStyle.None);
    try {
      file.tag.comment = track.metadata.comment;
      file.tag.isrc = track.metadata.isrc;
      file.tag.musicBrainzTrackId = track.metadata.musicbrainzId;
      if (ext === ".mp3")
        (file.getTag(TagTypes.Id3v2, true) as Id3v2Tag).version = 3;
      file.save();
    } finally {
      file.dispose();
    }
  }
  const result = await inspect(destination, tools, signal);
  if (
    Math.abs(result.duration - (range ? range[1] - range[0] : track.duration)) >
    1.5
  )
    throw new Error("Written audio failed duration verification");
  for (const field of fields) {
    if (result.metadata[field] !== track.metadata[field])
      throw new Error(
        `Written ${field} did not pass independent tag verification`,
      );
  }
  if (track.artwork) {
    const tags = await parseFile(destination, { skipCovers: false });
    const pic = tags.common.picture?.[0];
    if (!pic) throw new Error("Written audio is missing embedded artwork");
    await sharp(pic.data, { limitInputPixels: 40000000 }).metadata();
  }
}
export function extension(track: Track, format: string): string {
  return format === "original"
    ? path.extname(track.path)
    : format === "aac" || format === "alac"
      ? ".m4a"
      : `.${format}`;
}
