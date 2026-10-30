interface SpotifyPlaylist {
  name?: string;
  items: unknown[];
}
function playlists(text: string): SpotifyPlaylist[] {
  const parsed: unknown = JSON.parse(text);
  const account =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  const values: unknown[] = Array.isArray(account?.playlists)
    ? account.playlists
    : [parsed];
  if (!values.length)
    throw new Error("Use a Spotify playlist export containing playlist items.");
  return values.map((value) => {
    const playlist =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : null;
    if (!Array.isArray(playlist?.items))
      throw new Error(
        "Use a Spotify playlist export containing playlist items.",
      );
    return {
      name: typeof playlist.name === "string" ? playlist.name : undefined,
      items: playlist.items,
    };
  });
}
export function spotifyPlaylistChoices(
  text: string,
): { name: string; count: number }[] {
  return playlists(text).map((playlist, index) => ({
    name: playlist.name || `Playlist ${index + 1}`,
    count: playlist.items.length,
  }));
}
export function selectedSpotifyPlaylist(text: string, index: number): string {
  const selected = playlists(text)[index];
  if (!Number.isInteger(index) || !selected)
    throw new Error("Choose one playlist from the export.");
  return JSON.stringify({
    name: selected.name || "Imported Spotify playlist",
    items: selected.items,
  });
}
