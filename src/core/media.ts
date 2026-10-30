import {
  File as TagFile,
  ReadStyle,
  TagTypes,
  Id3v2Tag,
  Picture,
  Id3v2FrameIdentifiers,
  Id3v2UserTextInformationFrame,
} from "node-taglib-sharp";
import { spawn } from "node:child_process";
import { stat, mkdir, rm, copyFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { parseFile } from "music-metadata";
import sharp from "sharp";
import type { Metadata, Track, Profile } from "../shared/types";
import { hashFile, redact } from "./safety";
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
export function normalizeMetadata(metadata: Metadata): Metadata {
  const value = { ...metadata };
  if (/^\d{8}$/.test(value.date))
    value.date = value.date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
  for (const field of [
    "trackNumber",
    "trackTotal",
    "discNumber",
    "discTotal",
  ] as const)
    if (/^\d+$/.test(value[field]))
      value[field] = Number(value[field]) ? String(Number(value[field])) : "";
  return value;
}
export interface ToolPaths {
  [name: string]: string;
}
const activeTools = new Set<{ abort: () => void; closed: Promise<void> }>();
export async function stopMediaTools() {
  const tools = [...activeTools];
  for (const tool of tools) tool.abort();
  await Promise.all(tools.map((tool) => tool.closed));
}
export async function run(
  executable: string,
  args: string[],
  signal?: AbortSignal,
  onLine?: (line: string) => void,
  limits: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        PATH: path.dirname(executable),
        PYTHONIOENCODING: "utf-8",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const decoder = new StringDecoder("utf8");
    const sensitive = args.includes("--cookies");
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
    let closed!: () => void;
    const active = {
      abort,
      closed: new Promise<void>((resolve) => {
        closed = resolve;
      }),
    };
    activeTools.add(active);
    if (child.pid)
      process.parentPort?.postMessage({ toolPid: child.pid, started: true });
    child.once("close", () => {
      activeTools.delete(active);
      if (child.pid)
        process.parentPort?.postMessage({ toolPid: child.pid, started: false });
      closed();
    });
    const timeout = setTimeout(
      () => {
        abort();
        reject(new Error("Media operation timed out"));
      },
      limits.timeoutMs ?? 30 * 60 * 1000,
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > (limits.maxBytes ?? 16 * 1024 * 1024)) {
        abort();
        return reject(
          new Error("Tool response exceeded the allowed output size"),
        );
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
      if (sensitive) {
        const status = /HTTP(?: Error| status| code)?\s*([45]\d{2})/i.exec(
          chunk.toString(),
        )?.[1];
        error = status
          ? `HTTP ${status}; credentialed source details withheld`
          : "Credentialed source details withheld";
      } else error = (error + chunk.toString()).slice(-4000);
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
                `Media tool failed (${code}): ${redact(error).slice(-1000)}`,
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
    probe.streams?.some(
      (stream: any) =>
        stream.codec_type === "video" && !stream.disposition?.attached_pic,
    )
  )
    throw new Error(
      "Only audio files are supported; video media cannot be imported",
    );
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
  // ID3v2.3 uses slash separators; retain the literal credit for names such as AC/DC.
  const id3Text = (id: string) =>
    tags.native["ID3v2.3"]
      ?.filter((tag) => tag.id === id)
      .map((tag) => String(tag.value))
      .join("/");
  const metadata = blankMetadata();
  Object.assign(metadata, {
    title: c.title || "",
    artist: id3Text("TPE1") || c.artist || c.artists?.join("; ") || "",
    album: c.album || "",
    albumArtist: id3Text("TPE2") || c.albumartist || "",
    trackNumber: String(c.track?.no || ""),
    trackTotal: String(c.track?.of || ""),
    discNumber: String(c.disk?.no || ""),
    discTotal: String(c.disk?.of || ""),
    date: id3Text("TXXX:TUNEVAULT_DATE") || c.date || String(c.year || ""),
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
  original?: string,
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
      "-c:v",
      "copy",
      "-f",
      "image2",
      raw,
    ]);
    if ((await stat(raw)).size > 20 * 1024 * 1024)
      throw new Error("Embedded artwork exceeds 20 MB");
    if (original) await copyFile(raw, original);
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
  const metadata = normalizeMetadata(track.metadata);
  const muxedPicture =
    !!track.artwork && [".mp3", ".m4a", ".flac"].includes(ext);
  const args = ["-v", "error", "-nostdin"];
  if (range) args.push("-ss", String(range[0]));
  args.push("-i", track.path);
  if (muxedPicture) args.push("-i", track.artwork!);
  args.push("-map", "0:a:0");
  if (muxedPicture) args.push("-map", "1:v:0");
  args.push("-map_metadata", "0");
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
  if (muxedPicture)
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
    let val = metadata[field];
    if (field === "trackNumber" && metadata.trackTotal)
      val += `/${metadata.trackTotal}`;
    if (field === "discNumber" && metadata.discTotal)
      val += `/${metadata.discTotal}`;
    args.push("-metadata", `${tagNames[field] || field}=${val}`);
    args.push("-metadata:s:a:0", `${tagNames[field] || field}=${val}`);
  }
  if (ext === ".mp3") args.push("-id3v2_version", "3", "-write_id3v1", "0");
  if (ext === ".m4a") args.push("-movflags", "+faststart");
  args.push("-y", destination);
  await run(tools.ffmpeg, args, signal);
  {
    const file = TagFile.createFromPath(destination, undefined, ReadStyle.None);
    try {
      file.tag.title = metadata.title;
      file.tag.performers = metadata.artist ? [metadata.artist] : [];
      file.tag.album = metadata.album;
      file.tag.albumArtists = metadata.albumArtist
        ? [metadata.albumArtist]
        : [];
      file.tag.composers = metadata.composer ? [metadata.composer] : [];
      file.tag.genres = metadata.genre ? [metadata.genre] : [];
      file.tag.track = Number(metadata.trackNumber) || 0;
      file.tag.trackCount = Number(metadata.trackTotal) || 0;
      file.tag.disc = Number(metadata.discNumber) || 0;
      file.tag.discCount = Number(metadata.discTotal) || 0;
      file.tag.comment = track.metadata.comment;
      file.tag.isrc = track.metadata.isrc;
      file.tag.musicBrainzTrackId = track.metadata.musicbrainzId;
      if (track.artwork && !muxedPicture)
        file.tag.pictures = [Picture.fromPath(track.artwork)];
      if ([".mp3", ".wav", ".aiff", ".aif", ".aac"].includes(ext)) {
        const tag = file.getTag(TagTypes.Id3v2, true) as Id3v2Tag;
        tag.version = 3;
        tag.setTextFrame(Id3v2FrameIdentifiers.TYER, metadata.date.slice(0, 4));
        tag.setTextFrame(
          Id3v2FrameIdentifiers.TDAT,
          /^\d{4}-\d{2}-\d{2}$/.test(metadata.date)
            ? metadata.date.slice(8, 10) + metadata.date.slice(5, 7)
            : "",
        );
        for (const frame of tag.frames)
          if (
            frame instanceof Id3v2UserTextInformationFrame &&
            frame.description === "TUNEVAULT_DATE"
          )
            tag.removeFrame(frame);
        // ID3v2.3 cannot express month-only precision in its standard date frames.
        if (/^\d{4}-\d{2}$/.test(metadata.date)) {
          const date =
            Id3v2UserTextInformationFrame.fromDescription("TUNEVAULT_DATE");
          date.text = [metadata.date];
          tag.addFrame(date);
        }
        file.removeTags(TagTypes.Id3v1);
      }
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
    if (normalizeMetadata(result.metadata)[field] !== metadata[field])
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
    ? track.codec === "opus"
      ? ".opus"
      : track.codec === "vorbis"
        ? ".ogg"
        : track.codec === "aac"
          ? ".m4a"
          : path.extname(track.path)
    : format === "aac" || format === "alac"
      ? ".m4a"
      : `.${format}`;
}
