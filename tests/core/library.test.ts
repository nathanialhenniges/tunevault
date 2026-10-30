import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LibraryService } from "../../src/core/library";
import { confined, safeName, youtubeUrl } from "../../src/core/safety";
import {
  parseChapters,
  parseDelimited,
  parseReferences,
  spotifyPlaylists,
  reconcile,
} from "../../src/core/references";
import type { Playlist } from "../../src/shared/types";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "tunevault-core-"));
  const dataDir = path.join(root, "data"),
    vault = path.join(root, "vault");
  await mkdir(vault);
  const service = new LibraryService({
    dataDir,
    toolsDir: path.join(root, "missing-tools"),
  });
  cleanups.push(async () => {
    service.close();
    await rm(root, { recursive: true, force: true });
  });
  await service.dispatch("settings.update", { vault });
  return { root, vault, service };
}
describe("durable library", () => {
  it("starts empty and persists independent appearance/accent", async () => {
    const { root, service } = await fixture();
    await service.dispatch("settings.update", {
      appearance: "dark",
      accent: "orange",
    });
    expect((await service.snapshot()).tracks).toEqual([]);
    const second = new LibraryService({
      dataDir: path.join(root, "data"),
      toolsDir: "missing",
    });
    expect((await second.snapshot()).settings).toMatchObject({
      appearance: "dark",
      accent: "orange",
    });
    second.close();
    await expect(
      service.dispatch("settings.update", { appearance: "neon" }),
    ).rejects.toThrow("appearance");
  });
  it("preserves repeated reference occurrences and unavailable entries without auto importing paths", async () => {
    const { service } = await fixture();
    const playlist = (await service.dispatch("references.import", {
      name: "Ordered",
      format: "m3u",
      text: "#EXTM3U\n#EXTINF:3,A\n../A.mp3\n#EXTINF:4,B\nB.mp3\n#EXTINF:3,A\n../A.mp3\n#EXTINF:0,unavailable\nmissing.mp3\n#EXTINF:5,C\nC.mp3",
    })) as Playlist;
    expect(playlist.entries.map((e) => e.reference.title)).toEqual([
      "A",
      "B",
      "A",
      "unavailable",
      "C",
    ]);
    expect(new Set(playlist.entries.map((e) => e.id)).size).toBe(5);
    expect(playlist.entries.every((e) => e.trackId === null)).toBe(true);
    await expect(
      service.dispatch("playlists.reorder", {
        id: playlist.id,
        occurrenceIds: [playlist.entries[0].id],
      }),
    ).rejects.toThrow("each occurrence");
    const order = playlist.entries.map((e) => e.id).reverse();
    await service.dispatch("playlists.reorder", {
      id: playlist.id,
      occurrenceIds: order,
    });
    expect(
      (await service.snapshot()).playlists[0].entries.map((e) => e.id),
    ).toEqual(order);
  });
  it("backs up metadata and rejects a corrupted restore without losing current state", async () => {
    const { root, service } = await fixture();
    await service.dispatch("playlists.create", { name: "Keep me" });
    const result = (await service.dispatch("backup", {
      path: root,
      includeMedia: false,
    })) as any;
    const bundle = JSON.parse(
      await readFile(path.join(result.path, "bundle.json"), "utf8"),
    );
    bundle.schema = 100;
    await writeFile(
      path.join(result.path, "bundle.json"),
      JSON.stringify(bundle),
    );
    await expect(
      service.dispatch("restore", { path: result.path }),
    ).rejects.toThrow("schema");
    expect((await service.snapshot()).playlists[0].name).toBe("Keep me");
  });
  it("reports Spotify and Apple credentials capability without fetching or pretending completeness", async () => {
    const { service } = await fixture();
    for (const url of [
      "https://open.spotify.com/playlist/abc",
      "https://music.apple.com/us/playlist/abc",
    ])
      expect(await service.dispatch("source.preview", { url })).toMatchObject({
        capability: "credentials-required",
        complete: false,
        references: [],
      });
  });
  it("separates named targets and advertises MTP folder fallback honestly", async () => {
    const { service, vault } = await fixture();
    const a = (await service.dispatch("targets.create", {
      name: "iPod",
      transport: "imazing",
      destination: vault,
      profile: { format: "aac" },
    })) as any;
    const b = (await service.dispatch("targets.create", {
      name: "Android",
      transport: "mtp",
      destination: vault,
    })) as any;
    const renamed = (await service.dispatch("targets.update", {
      id: a.id,
      name: "Renamed iPod",
      profile: a.profile,
    })) as any;
    expect(renamed.profile.revision).toBe(a.profile.revision);
    expect(a.id).not.toBe(b.id);
    expect(
      await service.dispatch("export.preview", { targetId: b.id }),
    ).toMatchObject({
      warning: expect.stringContaining("Direct MTP transfer unavailable"),
    });
    await expect(
      service.dispatch("targets.update", {
        id: a.id,
        profile: { format: "flac" },
      }),
    ).rejects.toThrow("compatible");
  });
});
describe("safe paths and ordered parsing", () => {
  it("rejects traversal and symlink escape and sanitizes portable filenames", async () => {
    const { root, vault } = await fixture();
    await expect(confined(vault, "../outside")).rejects.toThrow();
    await symlink(root, path.join(vault, "escape"));
    await expect(confined(vault, "escape/evil.mp3")).rejects.toThrow("Symlink");
    expect(safeName("CON.mp3")).toBe("_CON.mp3");
    expect(safeName("a/b\\c: d. ")).toBe("a_b_c_ d");
  });
  it("accepts only canonical safe YouTube URLs", () => {
    expect(youtubeUrl("https://youtu.be/abcdefghijk?t=1")).toBe(
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
    for (const input of [
      "http://youtube.com/watch?v=abcdefghijk",
      "https://youtube.com.evil.test/watch?v=abcdefghijk",
      "https://127.0.0.1/a",
      "https://youtube.com:4430/watch?v=abcdefghijk",
    ])
      expect(() => youtubeUrl(input)).toThrow();
  });
  it("parses quoted and Unicode CSV, preserves version distinctions", () => {
    expect(parseDelimited('title,artist\n"Live, version","孤狼"', ",")).toEqual(
      [
        ["title", "artist"],
        ["Live, version", "孤狼"],
      ],
    );
    const refs = parseReferences(
      "title,artist,album,duration\nSong,A,Remix,03:04\nSong,A,Live,03:05",
      "csv",
    );
    expect(refs.map((r) => r.duration)).toEqual([184, 185]);
    expect(refs[0].album).not.toBe(refs[1].album);
    expect(() => parseDelimited('"oops', ",")).toThrow("Unclosed");
  });
  it("validates hour timestamps, duplicates, ordering and duration bounds", () => {
    expect(parseChapters("00:00 Intro\n01:02:03 Long set", 4000)).toEqual([
      { start: 0, title: "Intro" },
      { start: 3723, title: "Long set" },
    ]);
    for (const source of [
      "00:03 A\n00:02 B",
      "00:00 A\n00:00 B",
      "00:99 Bad",
      "02:00 Out",
    ])
      expect(() => parseChapters(source, 60)).toThrow();
  });
  it("refreshes occurrence-aware snapshots and keeps manual additions, refusing partial replacement", () => {
    const refs = ["A", "B", "A", "unavailable", "C"].map((title) => ({
      title,
      artist: "",
      album: "",
      duration: null,
      sourceId: title,
      unavailable: title === "unavailable",
    }));
    const playlist: Playlist = {
      id: "p",
      name: "P",
      description: "",
      revision: 1,
      sourceUrl: "https://youtube.com",
      snapshotAt: null,
      followSourceOrder: true,
      entries: refs
        .map((reference, i) => ({
          id: String(i),
          reference,
          trackId: null,
          manual: false,
          skipped: false,
        }))
        .concat([
          {
            id: "manual",
            reference: {
              title: "Local",
              artist: "",
              album: "",
              duration: null,
              sourceId: "Local",
              unavailable: false,
            },
            trackId: null,
            manual: true,
            skipped: false,
          },
        ]),
    };
    const result = reconcile(
      playlist,
      [refs[1], refs[0], refs[2], refs[4]],
      true,
    );
    expect(result.entries.map((e) => e.id)).toEqual([
      "1",
      "0",
      "2",
      "4",
      "manual",
    ]);
    expect(result.removed).toBe(1);
    expect(() => reconcile(playlist, [], false)).toThrow(
      "previous complete snapshot",
    );
    expect(playlist.entries).toHaveLength(6);
  });
});

it("reads normal Apple Music XML without resolving external DTDs and rejects entity injection", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Tracks</key><dict><key>1</key><dict><key>Name</key><string>A &amp; B</string><key>Artist</key><string>孤狼</string><key>Total Time</key><integer>123000</integer></dict></dict><key>Playlists</key><array><dict><key>Playlist Items</key><array><dict><key>Track ID</key><integer>1</integer></dict><dict><key>Track ID</key><integer>1</integer></dict></array></dict></array></dict></plist>`;
  expect(parseReferences(xml, "apple-xml")).toMatchObject([
    { title: "A & B", artist: "孤狼", duration: 123 },
    { title: "A & B", artist: "孤狼", duration: 123 },
  ]);
  expect(() =>
    parseReferences(
      '<!DOCTYPE plist [<!ENTITY x SYSTEM "file:///etc/passwd">]><plist/>',
      "apple-xml",
    ),
  ).toThrow("entities");
});

it("metadata-only restore cannot grant access to media or artwork outside the selected vault", async () => {
  const { service, root } = await fixture();
  const secret = path.join(root, "private.txt");
  await writeFile(secret, "DO NOT COPY");
  const backup = (await service.dispatch("backup", {
    path: root,
    includeMedia: false,
  })) as any;
  const bundleFile = path.join(backup.path, "bundle.json");
  const bundle = JSON.parse(await readFile(bundleFile, "utf8"));
  bundle.snapshot.tracks = [
    {
      id: "malicious",
      hash: "a".repeat(64),
      path: secret,
      originalPath: "",
      metadata: { title: "Untrusted" },
      locks: [],
      origins: {},
      revision: 1,
      artwork: secret,
      favorite: false,
      missing: false,
      codec: "mp3",
      container: "mp3",
      duration: 1,
      bitrate: 1,
      sampleRate: 44100,
      bytes: 11,
      source: null,
    },
  ];
  await writeFile(bundleFile, JSON.stringify(bundle));
  await service.dispatch("restore", { path: backup.path });
  const track = (await service.snapshot()).tracks[0];
  expect(track.missing).toBe(true);
  expect(track.path).not.toBe(secret);
  expect(track.artwork).toBeNull();
  expect(await service.dispatch("artwork.get", { id: track.id })).toEqual({
    path: null,
  });
  await expect(
    service.dispatch("backup", { path: root, includeMedia: true }),
  ).rejects.toThrow("relink missing");
  expect(await readFile(secret, "utf8")).toBe("DO NOT COPY");
});

it.each(["Apple", "Apple Computer"])(
  "preserves plist strings and decodes numeric XML entities for %s exports",
  (publisher) => {
    const xml = `<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//${publisher}//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist><dict><key>Tracks</key><dict><key>001</key><dict><key>Name</key><string>007</string><key>Artist</key><string>&#x5B64;&#29436; &amp; Co</string><key>Album</key><string>002</string><key>Total Time</key><integer>184000</integer></dict></dict><key>Playlists</key><array><dict><key>Playlist Items</key><array><dict><key>Track ID</key><integer>001</integer></dict></array></dict></array></dict></plist>`;
    expect(
      parseReferences(xml.replaceAll("><", ">\n  <"), "apple-xml"),
    ).toEqual([
      {
        title: "007",
        artist: "孤狼 & Co",
        album: "002",
        duration: 184,
        unavailable: false,
      },
    ]);
    for (const doctype of [
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://evil.test/dtd">',
      '<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd" [<!ENTITY x "bad">]>',
    ])
      expect(() => parseReferences(doctype + "<plist/>", "apple-xml")).toThrow(
        "entities",
      );
  },
);
it("maps Apple Music Time TSV duration while preserving text numerals", () => {
  expect(
    parseReferences("Name\tArtist\tAlbum\tTime\n007\t孤狼\t002\t03:04", "tsv"),
  ).toEqual([
    {
      title: "007",
      artist: "孤狼",
      album: "002",
      duration: 184,
      url: undefined,
    },
  ]);
});
it("selects only one playlist from a multiple-playlist Spotify export", () => {
  const data = JSON.stringify({
    privateAccountField: "must not be imported",
    playlists: [
      {
        name: "First",
        items: [
          {
            track: { trackName: "A", artistName: "One", albumName: "Album A" },
          },
        ],
      },
      {
        name: "Second",
        items: [
          {
            track: { trackName: "B", artistName: "Two", albumName: "Album B" },
          },
          {
            track: { trackName: "B", artistName: "Two", albumName: "Album B" },
          },
        ],
      },
    ],
  });
  expect(spotifyPlaylists(data)).toEqual([
    { index: 0, name: "First", count: 1 },
    { index: 1, name: "Second", count: 2 },
  ]);
  expect(() => parseReferences(data, "spotify-json")).toThrow("Choose one");
  const references = parseReferences(data, "spotify-json", 1);
  expect(references.map((reference) => reference.title)).toEqual(["B", "B"]);
  expect(JSON.stringify(references)).not.toContain("must not be imported");
  expect(() => parseReferences(data, "spotify-json", 2)).toThrow(
    "Invalid Spotify playlist selection",
  );
});
