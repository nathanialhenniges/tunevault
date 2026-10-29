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
  const [playlistId, revision] = receipt.playlistRevision.split(":");
  return playlists.some(
    (playlist) =>
      playlist.id === playlistId && playlist.revision === Number(revision),
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
