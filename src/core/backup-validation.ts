import { ids, object, text } from "./safety";
import { blankMetadata, fields } from "./media";
import { validateChapters } from "./references";
import type { Settings } from "../shared/types";

function identity(value: unknown): string {
  const id = text(value, 100);
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw new Error("Invalid backup identity");
  return id;
}
function integer(
  value: unknown,
  minimum = 1,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < minimum ||
    Number(value) > maximum
  )
    throw new Error("Invalid backup numeric value");
}
function boolean(value: unknown) {
  if (typeof value !== "boolean") throw new Error("Invalid backup boolean");
}
function timestamp(value: unknown) {
  if (!Number.isFinite(Date.parse(text(value, 100))))
    throw new Error("Invalid backup timestamp");
}

function trackShape(track: Record<string, any>, trackIds: Set<string>) {
  track.metadata = { ...blankMetadata(), ...object(track.metadata) };
  track.origins = track.origins === undefined ? {} : object(track.origins);
  for (const [field, origin] of Object.entries(track.origins)) {
    if (!fields.includes(field as (typeof fields)[number]))
      throw new Error("Invalid backup field origin");
    text(origin, 4000);
  }
  text(track.path, 4000);
  text(track.originalPath, 4000);
  boolean(track.favorite);
  boolean(track.missing);
  for (const field of ["codec", "container"]) text(track[field], 200);
  for (const field of ["bitrate", "sampleRate"])
    if (
      !Number.isFinite(track[field]) ||
      track[field] < 0 ||
      track[field] > Number.MAX_SAFE_INTEGER
    )
      throw new Error("Invalid backup media quality");
  if (track.artwork === undefined) track.artwork = null;
  for (const field of ["artwork", "artworkOriginal", "artworkOrigin"])
    if (track[field] !== undefined && track[field] !== null)
      text(track[field], 4000);
  if (
    track.parentId !== undefined &&
    (!trackIds.has(identity(track.parentId)) || track.parentId === track.id)
  )
    throw new Error("Invalid backup segment parent");
  if (
    track.range !== undefined &&
    (!Array.isArray(track.range) ||
      track.range.length !== 2 ||
      track.range.some(
        (value: unknown) => !Number.isFinite(value) || Number(value) < 0,
      ) ||
      track.range[0] >= track.range[1])
  )
    throw new Error("Invalid backup segment range");
  if (track.demo !== undefined) boolean(track.demo);
  if (track.source === undefined) track.source = null;
  if (track.source !== null) {
    const source = object(track.source);
    if (!["local", "youtube"].includes(source.provider))
      throw new Error("Invalid backup source provider");
    text(source.id, 100);
    for (const field of ["url", "title", "uploader"]) text(source[field], 2000);
    text(source.description, 200000);
    text(source.quality, 4000);
    timestamp(source.acquiredAt);
    if (source.chapters === undefined) source.chapters = [];
    validateChapters(source.chapters, track.duration);
  }
}

export function validateBackupIndex(
  snapshot: Record<string, any>,
  revisions: any[],
): Set<string> {
  const identities = new Map<string, Set<string>>();
  for (const table of ["tracks", "playlists", "targets", "jobs", "receipts"]) {
    const seen = new Set<string>();
    for (const value of snapshot[table]) {
      const record = object(value),
        id = identity(record.id);
      if (seen.has(id))
        throw new Error(`Duplicate ${table} identity in backup`);
      seen.add(id);
    }
    identities.set(table, seen);
  }
  const trackIds = identities.get("tracks")!,
    playlistIds = identities.get("playlists")!,
    targetIds = identities.get("targets")!;
  const revisionIds = new Set<string>();
  for (const value of revisions) {
    const revision = object(value),
      id = identity(revision.id);
    if (revisionIds.has(id)) throw new Error("Duplicate revision identity");
    revisionIds.add(id);
    if (
      !trackIds.has(identity(revision.trackId)) ||
      object(revision.track).id !== revision.trackId
    )
      throw new Error("Revision points to an unknown or different track");
  }
  for (const track of [
    ...snapshot.tracks,
    ...revisions.map((revision) => revision.track),
  ])
    trackShape(track, trackIds);
  const occurrences = new Set<string>();
  for (const playlist of snapshot.playlists) {
    text(playlist.name, 200);
    text(playlist.description, 20000);
    integer(playlist.revision);
    boolean(playlist.followSourceOrder);
    if (playlist.sourceUrl !== null) text(playlist.sourceUrl, 2000);
    if (playlist.snapshotAt !== null) timestamp(playlist.snapshotAt);
    if (!Array.isArray(playlist.entries) || playlist.entries.length > 10000)
      throw new Error("Invalid backup playlist entries");
    for (const value of playlist.entries) {
      const entry = object(value),
        id = identity(entry.id);
      if (occurrences.has(id))
        throw new Error("Duplicate playlist occurrence identity in backup");
      occurrences.add(id);
      if (entry.trackId !== null && !trackIds.has(identity(entry.trackId)))
        throw new Error("Playlist refers to an unknown track");
      boolean(entry.manual);
      boolean(entry.skipped);
      if (entry.error !== undefined) text(entry.error, 2000);
      const reference = object(entry.reference);
      for (const field of ["title", "artist", "album"])
        text(reference[field], 2000);
      if (
        reference.duration !== null &&
        (!Number.isFinite(reference.duration) || reference.duration < 0)
      )
        throw new Error("Invalid backup reference duration");
      if (reference.url !== undefined) text(reference.url, 4000);
      if (reference.sourceId !== undefined) text(reference.sourceId, 100);
      if (reference.unavailable !== undefined) boolean(reference.unavailable);
    }
  }
  for (const target of snapshot.targets) {
    if (!text(target.name, 200).trim())
      throw new Error("Invalid backup target name");
    if (!["imazing", "usb", "folder", "mtp"].includes(target.transport))
      throw new Error("Invalid backup transfer route");
    text(target.destination, 4000);
    text(target.volumeIdentity, 100);
    boolean(target.connected);
    if (target.budget !== null) integer(target.budget);
    if (ids(target.playlistIds).some((id) => !playlistIds.has(id)))
      throw new Error("Target refers to an unknown playlist");
    const profile = object(target.profile);
    if (
      !["original", "mp3", "aac", "alac", "flac"].includes(profile.format) ||
      ![128, 160, 192, 256, 320].includes(profile.bitrate) ||
      ![44100, 48000].includes(profile.sampleRate)
    )
      throw new Error("Invalid backup media profile");
    integer(profile.artworkSize, 100, 1200);
    integer(profile.artworkBytes, 10000, 2000000);
    integer(profile.revision);
    if (
      target.transport === "imazing" &&
      ["flac", "original"].includes(profile.format)
    )
      throw new Error("Invalid backup iPod media profile");
    if (!["Baseline", "User-tested"].includes(profile.compatibility))
      throw new Error("Invalid backup compatibility status");
    text(profile.model, 200);
    text(profile.firmware, 200);
    text(profile.testResults ?? "", 4000);
    if (
      profile.compatibility === "User-tested" &&
      (!profile.model || !profile.firmware || !profile.testResults?.trim())
    )
      throw new Error("Backup user-tested profile needs physical test results");
    boolean(profile.legacyPlaylist);
    if (
      profile.mp3TagVersion !== undefined &&
      ![3, 4].includes(profile.mp3TagVersion)
    )
      throw new Error("Invalid backup MP3 tag version");
    if (profile.filenameLimit !== undefined)
      integer(profile.filenameLimit, 80, 180);
    if (profile.pathLimit !== undefined) integer(profile.pathLimit, 180, 1024);
    if (
      profile.playlistEncoding !== undefined &&
      profile.playlistEncoding !== "utf8"
    )
      throw new Error("Invalid backup playlist encoding");
    if (
      profile.playlistNewline !== undefined &&
      !["LF", "CRLF"].includes(profile.playlistNewline)
    )
      throw new Error("Invalid backup playlist newline");
    if (profile.orderTags !== undefined) boolean(profile.orderTags);
    if (target.lastCapacity !== undefined) {
      const capacity = object(target.lastCapacity);
      integer(capacity.totalBytes, 0);
      integer(capacity.freeBytes, 0, capacity.totalBytes);
      timestamp(capacity.observedAt);
    }
  }
  const receiptById = new Map<string, Record<string, any>>(
    snapshot.receipts.map((receipt: any) => [receipt.id, receipt]),
  );
  for (const receipt of snapshot.receipts) {
    if (
      !trackIds.has(identity(receipt.trackId)) ||
      !targetIds.has(identity(receipt.targetId))
    )
      throw new Error("Receipt refers to an unknown track or target");
    identity(receipt.batchId);
    integer(receipt.trackRevision);
    integer(receipt.profileRevision);
    text(receipt.playlistRevision, 2000000);
    if (
      !/^[a-f0-9]{64}$/.test(receipt.playlistRevision) &&
      !receipt.playlistRevision
        .split("|")
        .every((part: string) => /^[a-zA-Z0-9_-]{1,100}:[1-9]\d*$/.test(part))
    )
      throw new Error("Invalid backup receipt playlist revision");
    if (!/^[a-f0-9]{64}$/.test(text(receipt.hash, 64)))
      throw new Error("Invalid backup receipt hash");
    text(receipt.path, 4000);
    if (
      ![
        "ready-locally",
        "exported",
        "user-confirmed",
        "volume-verified",
      ].includes(receipt.evidence)
    )
      throw new Error("Invalid backup receipt evidence");
    timestamp(receipt.createdAt);
    if (receipt.confirmsReceiptId !== undefined) {
      const original = receiptById.get(identity(receipt.confirmsReceiptId));
      if (
        !original ||
        original.id === receipt.id ||
        receipt.evidence !== "user-confirmed" ||
        original.evidence === "user-confirmed" ||
        [
          "trackId",
          "targetId",
          "batchId",
          "hash",
          "trackRevision",
          "profileRevision",
          "playlistRevision",
        ].some((field) => original[field] !== receipt[field])
      )
        throw new Error("Invalid backup receipt confirmation link");
    }
  }
  for (const job of snapshot.jobs) {
    if (
      !["import", "download", "export", "split"].includes(job.kind) ||
      ![
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
        "interrupted",
      ].includes(job.status)
    )
      throw new Error("Invalid backup job state");
    if (!Number.isFinite(job.progress) || job.progress < 0 || job.progress > 1)
      throw new Error("Invalid backup job progress");
    text(job.message, 2000);
    integer(job.attempts, 0);
    timestamp(job.createdAt);
    timestamp(job.updatedAt);
    object(job.payload);
  }
  return trackIds;
}

export function restoredPreferences(
  value: unknown,
  current: Settings,
  trackIds: Set<string>,
): Settings {
  const saved = value === undefined ? {} : object(value),
    restored = { ...current };
  if (saved.appearance !== undefined) {
    if (!["system", "light", "dark"].includes(saved.appearance))
      throw new Error("Invalid backup appearance");
    restored.appearance = saved.appearance;
  }
  if (saved.accent !== undefined) {
    if (!["blue", "orange"].includes(saved.accent))
      throw new Error("Invalid backup accent");
    restored.accent = saved.accent;
  }
  if (saved.view !== undefined) {
    if (!["tracks", "albums"].includes(saved.view))
      throw new Error("Invalid backup library view");
    restored.view = saved.view;
  }
  if (saved.filter !== undefined) restored.filter = text(saved.filter, 100);
  if (saved.selection !== undefined)
    restored.selection = [
      ...new Set(ids(saved.selection).filter((id) => trackIds.has(id))),
    ];
  for (const key of ["autoUpdates", "metadataOnline"] as const) {
    if (saved[key] !== undefined) {
      boolean(saved[key]);
      restored[key] = saved[key];
    }
  }
  if (saved.metadataServices !== undefined) {
    const services = { ...object(saved.metadataServices) };
    delete services.acoustid;
    for (const [service, enabled] of Object.entries(services)) {
      if (!["musicbrainz", "coverArtArchive"].includes(service))
        throw new Error("Invalid backup metadata service");
      boolean(enabled);
    }
    restored.metadataServices = {
      musicbrainz: current.metadataServices?.musicbrainz ?? true,
      coverArtArchive: current.metadataServices?.coverArtArchive ?? true,
      ...services,
    };
  }
  if (saved.tipsSeen !== undefined) {
    const tips = ids(saved.tipsSeen);
    if (tips.some((tip) => !["import", "playlist", "target"].includes(tip)))
      throw new Error("Invalid backup onboarding tip");
    restored.tipsSeen = [...new Set(tips)];
  }
  restored.selection = [
    ...new Set(ids(restored.selection).filter((id) => trackIds.has(id))),
  ];
  return restored;
}
