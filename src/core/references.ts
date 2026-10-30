import { XMLParser } from "fast-xml-parser";
import type { Chapter, Occurrence, Playlist, Reference } from "../shared/types";
import { randomUUID } from "node:crypto";
import { object, text } from "./safety";
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
export function spotifyPlaylists(
  value: string,
): { index: number; name: string; count: number }[] {
  text(value, 8 * 1024 * 1024);
  const data = object(JSON.parse(value));
  const playlists = Array.isArray(data.playlists) ? data.playlists : [data];
  if (playlists.length > 10000)
    throw new Error("Too many playlists in data export");
  return playlists.map((playlist: any, index: number) => {
    if (!Array.isArray(playlist?.items))
      throw new Error("Expected Spotify playlist items");
    return {
      index,
      name: text(playlist.name || `Playlist ${index + 1}`, 200),
      count: playlist.items.length,
    };
  });
}
export function parseReferences(
  value: string,
  format: string,
  selectedPlaylist?: number,
): Reference[] {
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
      duration: duration(column(row, ["duration", "time", "total time"])),
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
    const data = object(JSON.parse(value));
    if (
      selectedPlaylist !== undefined &&
      (!Number.isInteger(selectedPlaylist) ||
        selectedPlaylist < 0 ||
        !Array.isArray(data.playlists) ||
        selectedPlaylist >= data.playlists.length)
    )
      throw new Error("Invalid Spotify playlist selection");
    if (data.playlists?.length > 1 && selectedPlaylist === undefined)
      throw new Error("Choose one Spotify playlist from this data export");
    const playlist = Array.isArray(data.playlists)
      ? data.playlists[selectedPlaylist ?? 0]
      : data;
    if (
      !playlist ||
      typeof playlist !== "object" ||
      !Array.isArray(playlist.items)
    )
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
      /<!DOCTYPE\s+plist\s+PUBLIC\s+"-\/\/Apple(?: Computer)?\/\/DTD PLIST 1\.0\/\/EN"\s+"https?:\/\/www\.apple\.com\/DTDs\/PropertyList-1\.0\.dtd"\s*>/i,
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
      parseTagValue: false,
      trimValues: false,
    }).parse(value);
    const decode = (nodes: any[]): any => {
      const dict = nodes.find((n) => n.dict);
      if (dict) {
        const result: Record<string, any> = Object.create(null);
        let key = "";
        for (const node of dict.dict) {
          if (Object.keys(node).every((key) => key === "#text")) continue;
          if (node.key) key = String(node.key[0]?.["#text"] ?? "");
          else if (key) {
            result[key] = decode([node]);
            key = "";
          }
        }
        return result;
      }
      const array = nodes.find((n) => n.array);
      if (array)
        return array.array
          .filter((node: any) =>
            Object.keys(node).some((key) => key !== "#text"),
          )
          .map((n: any) => decode([n]));
      for (const node of nodes) {
        for (const tag of ["string", "integer", "real", "date"])
          if (node[tag])
            return node[tag]
              .map((n: any) => n["#text"] ?? "")
              .join("")
              .replace(
                /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
                (match: string, entity: string) => {
                  if (entity[0] !== "#")
                    return (
                      { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[
                        entity.toLowerCase()
                      ] || match
                    );
                  const number =
                    entity[1].toLowerCase() === "x"
                      ? parseInt(entity.slice(2), 16)
                      : Number(entity.slice(1));
                  if (
                    !Number.isInteger(number) ||
                    number <= 0 ||
                    number > 0x10ffff ||
                    (number >= 0xd800 && number <= 0xdfff)
                  )
                    throw new Error("Invalid XML character reference");
                  return String.fromCodePoint(number);
                },
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
export interface RefreshChange {
  kind: "added" | "removed" | "reordered" | "unavailable" | "metadata-changed";
  occurrenceId: string;
  title: string;
  artist: string;
  beforeOrdinal: number | null;
  afterOrdinal: number | null;
  before: Reference | null;
  after: Reference | null;
  attachedTrackId: string | null;
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
  changes: RefreshChange[];
} {
  if (!complete)
    throw new Error(
      "Incomplete refresh: previous complete snapshot has been preserved",
    );
  const pools = new Map<string, Occurrence[]>(),
    oldById = new Map(
      playlist.entries.map((entry, index) => [
        entry.id,
        { entry, ordinal: index + 1 },
      ]),
    );
  const key = (reference: Reference) =>
    reference.sourceId ||
    reference.url ||
    `${reference.title}\0${reference.artist}\0${reference.album}`;
  for (const entry of playlist.entries.filter((entry) => !entry.manual)) {
    const identity = key(entry.reference);
    pools.set(identity, [...(pools.get(identity) || []), entry]);
  }
  const entries: Occurrence[] = references.map((reference) => {
    const old = pools.get(key(reference))?.shift();
    if (!old)
      return {
        id: randomUUID(),
        trackId: null,
        reference,
        manual: false,
        skipped: false,
      };
    return {
      ...old,
      reference:
        reference.unavailable && old.trackId
          ? {
              ...reference,
              title: old.reference.title,
              artist: old.reference.artist,
              album: old.reference.album,
              duration: old.reference.duration,
            }
          : reference,
    };
  });
  const removedEntries = [...pools.values()].flat(),
    manual = playlist.entries.filter((entry) => entry.manual),
    refreshedById = new Map(entries.map((entry) => [entry.id, entry]));
  const finalEntries = playlist.followSourceOrder
    ? [...entries, ...manual]
    : [
        ...playlist.entries
          .filter((entry) => entry.manual || refreshedById.has(entry.id))
          .map((entry) => refreshedById.get(entry.id) || entry),
        ...entries.filter((entry) => !oldById.has(entry.id)),
      ];
  const afterOrdinals = new Map(
    finalEntries.map((entry, index) => [entry.id, index + 1]),
  );
  const changes: RefreshChange[] = [];
  const add = (
    kind: RefreshChange["kind"],
    entry: Occurrence,
    before: Occurrence | null,
  ) =>
    changes.push({
      kind,
      occurrenceId: entry.id,
      title: entry.reference.title,
      artist: entry.reference.artist,
      beforeOrdinal: oldById.get(entry.id)?.ordinal ?? null,
      afterOrdinal: afterOrdinals.get(entry.id) ?? null,
      before: before?.reference ?? null,
      after: afterOrdinals.has(entry.id) ? entry.reference : null,
      attachedTrackId: entry.trackId,
    });
  let added = 0,
    reordered = 0,
    metadataChanged = 0;
  for (const entry of entries) {
    const before = oldById.get(entry.id)?.entry;
    if (!before) {
      added++;
      add("added", entry, null);
    } else {
      if (oldById.get(entry.id)!.ordinal !== afterOrdinals.get(entry.id)) {
        reordered++;
        add("reordered", entry, before);
      }
      if (
        ["title", "artist", "album", "duration"].some(
          (field) =>
            before.reference[field as keyof Reference] !==
            entry.reference[field as keyof Reference],
        )
      ) {
        metadataChanged++;
        add("metadata-changed", entry, before);
      }
    }
    if (entry.reference.unavailable) add("unavailable", entry, before || null);
  }
  for (const entry of removedEntries) add("removed", entry, entry);
  changes.sort(
    (a, b) =>
      (a.afterOrdinal ?? a.beforeOrdinal ?? 0) -
      (b.afterOrdinal ?? b.beforeOrdinal ?? 0),
  );
  return {
    entries: finalEntries,
    added,
    removed: removedEntries.length,
    reordered,
    unavailable: references.filter((reference) => reference.unavailable).length,
    metadataChanged,
    changes,
  };
}
