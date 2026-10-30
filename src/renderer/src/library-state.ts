import type { Playlist, Receipt, Target, Track } from "../../shared/types";

export function albumIdentity(track: Track): string {
  return JSON.stringify([
    track.metadata.album,
    track.metadata.albumArtist || track.metadata.artist,
  ]);
}

export function receiptIsCurrent(
  track: Track,
  target: Target,
  receipt: Receipt,
  playlists: Playlist[],
): boolean {
  if (
    receipt.trackId !== track.id ||
    receipt.targetId !== target.id ||
    receipt.trackRevision !== track.revision ||
    receipt.profileRevision !== target.profile.revision
  )
    return false;
  if (!receipt.playlistRevision.includes(":")) return true;
  const revisions = receipt.playlistRevision
    .split("|")
    .map((value) => value.split(":"));
  if (
    revisions.length > 1 &&
    JSON.stringify(revisions.map(([id]) => id)) !==
      JSON.stringify(target.playlistIds)
  )
    return false;
  return revisions.every(([playlistId, revision]) =>
    playlists.some(
      (playlist) =>
        playlist.id === playlistId && playlist.revision === Number(revision),
    ),
  );
}

export function targetState(
  track: Track,
  target: Target | undefined,
  receipts: Receipt[],
  playlists: Playlist[] = [],
): string {
  if (track.demo) return "Design fixture";
  if (track.missing) return "Missing file";
  if (!target) return "No target selected";
  const matching = receipts.filter(
    (receipt) => receipt.targetId === target.id && receipt.trackId === track.id,
  );
  const strength = {
    "ready-locally": 0,
    exported: 1,
    "user-confirmed": 2,
    "volume-verified": 3,
  };
  const current = matching
    .filter((receipt) => receiptIsCurrent(track, target, receipt, playlists))
    .sort((a, b) => strength[b.evidence] - strength[a.evidence])[0];
  if (!current)
    return matching.length ? "Changed since transfer" : "Not prepared";
  return {
    "ready-locally": "Ready locally",
    exported: "Exported",
    "user-confirmed": "User-confirmed transfer",
    "volume-verified": "Copied and verified",
  }[current.evidence];
}

export function compareAlbumTracks(a: Track, b: Track): number {
  const ordinal = (value: string, fallback: number) =>
    /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : fallback;
  return (
    ordinal(a.metadata.discNumber, 1) - ordinal(b.metadata.discNumber, 1) ||
    ordinal(a.metadata.trackNumber, Number.MAX_SAFE_INTEGER) -
      ordinal(b.metadata.trackNumber, Number.MAX_SAFE_INTEGER) ||
    a.metadata.title.localeCompare(b.metadata.title)
  );
}

export function needsPreparation(
  track: Track,
  target: Target | undefined,
  receipts: Receipt[],
  playlists: Playlist[],
): boolean {
  return (
    !!target &&
    !track.demo &&
    !track.missing &&
    !receipts.some((receipt) =>
      receiptIsCurrent(track, target, receipt, playlists),
    )
  );
}
