import { describe, expect, it } from "vitest";
import type {
  Metadata,
  Playlist,
  Receipt,
  Target,
  Track,
} from "../../shared/types";
import { albumIdentity, targetState } from "./library-state";
const track = {
  id: "track",
  metadata: {
    album: "Greatest Hits",
    artist: "Artist A",
    albumArtist: "",
  } as Metadata,
  revision: 3,
  missing: false,
} as Track;
const target = { id: "target-a", profile: { revision: 2 } } as Target;
const receipt = {
  id: "receipt",
  trackId: "track",
  targetId: "target-a",
  trackRevision: 3,
  profileRevision: 2,
  playlistRevision: "playlist:4",
  evidence: "user-confirmed",
} as Receipt;
const playlist = { id: "playlist", revision: 4 } as Playlist;

describe("library identity and target evidence", () => {
  it("keeps identically titled albums by different credited artists separate", () => {
    expect(albumIdentity(track)).not.toBe(
      albumIdentity({
        ...track,
        metadata: { ...track.metadata, artist: "Artist B" },
      }),
    );
    expect(
      albumIdentity({
        ...track,
        metadata: { ...track.metadata, albumArtist: "Compilation" },
      }),
    ).toBe(
      albumIdentity({
        ...track,
        metadata: {
          ...track.metadata,
          artist: "Another performer",
          albumArtist: "Compilation",
        },
      }),
    );
  });
  it("invalidates a row badge when its prepared playlist order changes", () => {
    expect(targetState(track, target, [receipt], [playlist])).toBe(
      "User-confirmed transfer",
    );
    expect(
      targetState(track, target, [receipt], [{ ...playlist, revision: 5 }]),
    ).toBe("Changed since transfer");
    expect(targetState(track, target, [receipt], [])).toBe(
      "Changed since transfer",
    );
  });
  it("keeps target, metadata and profile revisions independent", () => {
    expect(
      targetState(track, { ...target, id: "target-b" }, [receipt], [playlist]),
    ).toBe("Not prepared");
    expect(
      targetState({ ...track, revision: 4 }, target, [receipt], [playlist]),
    ).toBe("Changed since transfer");
    expect(
      targetState(
        track,
        { ...target, profile: { ...target.profile, revision: 3 } },
        [receipt],
        [playlist],
      ),
    ).toBe("Changed since transfer");
  });
  it("retains the strongest current evidence across repeated preparations", () => {
    expect(
      targetState(
        track,
        target,
        [{ ...receipt, evidence: "ready-locally" }, receipt],
        [playlist],
      ),
    ).toBe("User-confirmed transfer");
    expect(
      targetState({ ...track, missing: true }, target, [receipt], [playlist]),
    ).toBe("Missing file");
  });
});
