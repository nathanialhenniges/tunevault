import { XMLParser } from "fast-xml-parser";
import type { Chapter, Occurrence, Playlist, Reference } from "../shared/types";
import { randomUUID } from "node:crypto";
import { text } from "./safety";
export function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!cell || quoted) quoted = !quoted;
      else cell += c;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed quoted field");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseReferences(value: string, format: string): Reference[] {
  text(value, 8 * 1024 * 1024);
  let refs: Reference[] = [];
  if (format === "csv" || format === "tsv") {
    const rows = parseDelimited(value, format === "csv" ? "," : "\t");
    const headers = (rows.shift() || []).map((s) => s.trim().toLowerCase());
    const column = (row: string[], names: string[]) =>
      row[headers.findIndex((h) => names.includes(h))] || "";
    if (!headers.includes("title") && !headers.includes("name"))
      throw new Error(
        "Reference file needs title (or Name) and artist headers",
      );
    refs = rows.map((row) => ({
      title: column(row, ["title", "name"]),
      artist: column(row, ["artist"]),
      album: column(row, ["album"]),
      duration: duration(column(row, ["duration", "total time"])),
      url: column(row, ["url", "location"]) || undefined,
    }));
  } else if (format === "m3u") {
    let title = "",
      length: number | null = null;
    for (const line of value.split(/\r?\n/)) {
      if (line.startsWith("#EXTINF:")) {
        const match = /^#EXTINF:([\d.-]+),(.*)$/.exec(line);
        if (match) {
          length = Number(match[1]);
          title = match[2];
        }
      } else if (line.trim() && !line.startsWith("#")) {
        refs.push({
          title: title || line.split(/[\\/]/).pop() || line,
          artist: "",
          album: "",
          duration: length && length > 0 ? length : null,
          url: /^https:\/\//.test(line) ? line : undefined,
        });
        title = "";
        length = null;
      }
    }
  } else if (format === "spotify-json") {
    const data = JSON.parse(value);
    const playlist = data.playlists?.length === 1 ? data.playlists[0] : data;
    if (data.playlists?.length > 1)
      throw new Error("Select/export only one Spotify playlist at a time");
    if (!Array.isArray(playlist.items))
      throw new Error("Expected a selected Spotify playlist with items");
    refs = playlist.items.map((item: any) => {
      const track = item.track || item.episode;
      return {
        title: track?.trackName || track?.episodeName || "Unavailable",
        artist: track?.artistName || "",
        album: track?.albumName || "",
        duration: null,
        url: track?.trackUri,
        unavailable: !track,
      };
    });
  } else if (format === "apple-xml") {
    value = value.replace(
      /<!DOCTYPE\s+plist\s+PUBLIC\s+"-\/\/Apple\/\/DTD PLIST 1\.0\/\/EN"\s+"https?:\/\/www\.apple\.com\/DTDs\/PropertyList-1\.0\.dtd"\s*>/i,
      "",
    );
    if (/<!DOCTYPE|<!ENTITY/i.test(value))
      throw new Error(
        "Custom XML document types and entities are not supported",
      );
    const parsed = new XMLParser({
      preserveOrder: true,
      ignoreAttributes: false,
      processEntities: false,
    }).parse(value);
    const decode = (nodes: any[]): any => {
      const dict = nodes.find((n) => n.dict);
      if (dict) {
        const result: Record<string, any> = {};
        let key = "";
        for (const node of dict.dict) {
          if (node.key) key = String(node.key[0]?.["#text"] ?? "");
          else if (key) {
            result[key] = decode([node]);
            key = "";
          }
        }
        return result;
      }
      const array = nodes.find((n) => n.array);
      if (array) return array.array.map((n: any) => decode([n]));
      for (const node of nodes) {
        for (const tag of ["string", "integer", "real", "date"])
          if (node[tag])
            return node[tag]
              .map((n: any) => n["#text"] ?? "")
              .join("")
              .replace(
                /&(amp|lt|gt|quot|apos);/g,
                (_match: string, name: string) =>
                  ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[
                    name
                  ] || _match,
              );
        if (node.true) return true;
        if (node.false) return false;
      }
      return "";
    };
    const plist = parsed.find((n: any) => n.plist)?.plist;
    const data = decode(plist || []);
    const list = data.Playlists?.[0]?.["Playlist Items"];
    if (!Array.isArray(list) || !data.Tracks)
      throw new Error("Expected an Apple Music exported playlist");
    refs = list.map((item: any) => {
      const track = data.Tracks[item["Track ID"]];
      return {
        title: track?.Name || "Unavailable",
        artist: track?.Artist || "",
        album: track?.Album || "",
        duration: track?.["Total Time"]
          ? Number(track["Total Time"]) / 1000
          : null,
        unavailable: !track,
      };
    });
  } else throw new Error("Unsupported reference format");
  if (refs.length > 10000)
    throw new Error("Reference list exceeds 10,000 entries");
  return refs.map((ref) => ({
    ...ref,
    title: text(ref.title, 2000),
    artist: text(ref.artist, 2000),
    album: text(ref.album, 2000),
  }));
}
function duration(value: string): number | null {
  if (!value) return null;
  const parts = value.split(":").map(Number);
  const result =
    parts.length === 1 ? Number(value) : parts.reduce((n, p) => n * 60 + p, 0);
  return Number.isFinite(result) && result >= 0 ? result : null;
}
export function parseChapters(
  description: string,
  durationSeconds: number,
): Chapter[] {
  const chapters: Chapter[] = [];
  for (const line of description.split(/\r?\n/)) {
    if (/^\s*-\d+:/.test(line))
      throw new Error("Chapter timestamps cannot be negative");
    const match = /^\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{2})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const hours = match[1] ? Number(match[1]) : 0,
      minutes = Number(match[2]),
      seconds = Number(match[3]);
    if (seconds >= 60 || (match[1] && minutes >= 60))
      throw new Error("Invalid chapter timestamp");
    chapters.push({
      start: hours * 3600 + minutes * 60 + seconds,
      title: match[4],
    });
  }
  validateChapters(chapters, durationSeconds);
  return chapters;
}
export function validateChapters(
  chapters: Chapter[],
  durationSeconds: number,
): void {
  if (!Array.isArray(chapters) || chapters.length > 1000)
    throw new Error("Invalid chapter list");
  let previous = -1;
  for (const chapter of chapters) {
    if (
      !Number.isFinite(chapter.start) ||
      chapter.start < 0 ||
      chapter.start <= previous ||
      chapter.start >= durationSeconds
    )
      throw new Error(
        "Chapter starts must increase and remain inside the mix duration",
      );
    text(chapter.title, 2000);
    previous = chapter.start;
  }
}
export function reconcile(
  playlist: Playlist,
  references: Reference[],
  complete: boolean,
): {
  entries: Occurrence[];
  added: number;
  removed: number;
  reordered: number;
  unavailable: number;
  metadataChanged: number;
} {
  if (!complete)
    throw new Error(
      "Incomplete refresh: previous complete snapshot has been preserved",
    );
  const pools = new Map<string, Occurrence[]>();
  const key = (ref: Reference) =>
    ref.sourceId || ref.url || `${ref.title}\0${ref.artist}\0${ref.album}`;
  for (const entry of playlist.entries.filter((e) => !e.manual)) {
    const k = key(entry.reference);
    pools.set(k, [...(pools.get(k) || []), entry]);
  }
  let added = 0,
    reordered = 0,
    metadataChanged = 0;
  const entries = references.map((ref, index) => {
    const old = pools.get(key(ref))?.shift();
    if (!old) {
      added++;
      return {
        id: randomUUID(),
        trackId: null,
        reference: ref,
        manual: false,
        skipped: false,
      };
    }
    if (playlist.entries[index]?.id !== old.id) reordered++;
    if (JSON.stringify(old.reference) !== JSON.stringify(ref))
      metadataChanged++;
    return { ...old, reference: ref };
  });
  const removed = [...pools.values()].reduce((n, a) => n + a.length, 0);
  const manual = playlist.entries.filter((e) => e.manual);
  return {
    entries: playlist.followSourceOrder
      ? [...entries, ...manual]
      : [
          ...playlist.entries
            .filter(
              (e) => manual.includes(e) || entries.some((n) => n.id === e.id),
            )
            .map((e) => entries.find((n) => n.id === e.id) || e),
          ...entries.filter(
            (e) => !playlist.entries.some((o) => o.id === e.id),
          ),
        ],
    added,
    removed,
    reordered,
    unavailable: references.filter((r) => r.unavailable).length,
    metadataChanged,
  };
}
