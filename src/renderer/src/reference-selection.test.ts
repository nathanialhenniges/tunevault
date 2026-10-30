import { expect, it } from "vitest";
import {
  selectedSpotifyPlaylist,
  spotifyPlaylistChoices,
} from "./reference-selection";
it("previews choices but sends only the selected playlist, without other account data", () => {
  const text = JSON.stringify({
    email: "private@example.invalid",
    playlists: [
      { name: "First", items: [{ track: { trackName: "A" } }] },
      {
        name: "Second",
        items: [{ track: { trackName: "B" } }, { track: { trackName: "B" } }],
      },
    ],
    privateHistory: ["secret"],
  });
  expect(spotifyPlaylistChoices(text)).toEqual([
    { name: "First", count: 1 },
    { name: "Second", count: 2 },
  ]);
  const selected = selectedSpotifyPlaylist(text, 1);
  expect(JSON.parse(selected)).toEqual({
    name: "Second",
    items: [{ track: { trackName: "B" } }, { track: { trackName: "B" } }],
  });
  expect(selected).not.toContain("private");
  expect(selected).not.toContain("First");
  expect(() => selectedSpotifyPlaylist(text, -1)).toThrow(
    "Choose one playlist",
  );
});
it("supports a selected playlist and rejects account data without a playlist", () => {
  expect(spotifyPlaylistChoices('{"name":"Chosen","items":[]}')).toEqual([
    { name: "Chosen", count: 0 },
  ]);
  expect(() => spotifyPlaylistChoices('{"profile":{}}')).toThrow(
    "playlist items",
  );
});
