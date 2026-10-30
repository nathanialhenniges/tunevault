import { describe, expect, it } from "vitest";
import { reconcile } from "../../src/core/references";
import type { Playlist, Reference } from "../../src/shared/types";
const ref = (sourceId: string, title: string): Reference => ({
  sourceId,
  title,
  artist: "Chosen artist",
  album: "Chosen release",
  duration: 180,
});
function playlist(followSourceOrder = true): Playlist {
  return {
    id: "playlist",
    name: "Source-following references",
    description: "",
    revision: 1,
    sourceUrl: "https://www.youtube.com/playlist?list=PLabcdefghijkl",
    snapshotAt: "2026-10-29",
    followSourceOrder,
    entries: [
      {
        id: "a",
        trackId: "owned-local-a",
        reference: ref("aaaaaaaaaaa", "Owned A"),
        manual: false,
        skipped: false,
      },
      {
        id: "b",
        trackId: "owned-local-b",
        reference: ref("bbbbbbbbbbb", "B"),
        manual: false,
        skipped: false,
      },
      {
        id: "d",
        trackId: "owned-local-d",
        reference: ref("ddddddddddd", "Removed D"),
        manual: false,
        skipped: false,
      },
      {
        id: "manual",
        trackId: "manual-local",
        reference: ref("manual", "Local addition"),
        manual: true,
        skipped: false,
      },
    ],
  };
}
describe("reviewable source refresh and approved local attachments", () => {
  it("keeps approved audio and requested metadata when the provider becomes unavailable", () => {
    const original = playlist(),
      before = structuredClone(original);
    const unavailable = {
      ...ref("aaaaaaaaaaa", "[Private video]"),
      artist: "",
      album: "",
      duration: null,
      unavailable: true,
    };
    const diff = reconcile(
      original,
      [unavailable, ref("bbbbbbbbbbb", "B"), ref("ddddddddddd", "Removed D")],
      true,
    );
    const attached = diff.entries.find((entry) => entry.id === "a")!;
    expect(attached.trackId).toBe("owned-local-a");
    expect(attached.reference).toMatchObject({
      title: "Owned A",
      artist: "Chosen artist",
      album: "Chosen release",
      duration: 180,
      unavailable: true,
    });
    expect(
      diff.changes.find((change) => change.kind === "unavailable"),
    ).toMatchObject({
      occurrenceId: "a",
      title: "Owned A",
      attachedTrackId: "owned-local-a",
      beforeOrdinal: 1,
      afterOrdinal: 1,
      after: { unavailable: true },
    });
    expect(original).toEqual(before);
  });
  it("provides actual removed, moved, changed and added rows for human review", () => {
    const diff = reconcile(
      playlist(),
      [
        ref("bbbbbbbbbbb", "Renamed B"),
        { ...ref("aaaaaaaaaaa", "[Deleted video]"), unavailable: true },
        ref("ccccccccccc", "Added C"),
      ],
      true,
    );
    expect(diff.entries.map((entry) => entry.id)).toEqual([
      "b",
      "a",
      expect.any(String),
      "manual",
    ]);
    expect(
      diff.changes.find((change) => change.kind === "removed"),
    ).toMatchObject({
      occurrenceId: "d",
      title: "Removed D",
      beforeOrdinal: 3,
      afterOrdinal: null,
      before: { title: "Removed D" },
      after: null,
      attachedTrackId: "owned-local-d",
    });
    expect(
      diff.changes.find(
        (change) => change.kind === "reordered" && change.occurrenceId === "b",
      ),
    ).toMatchObject({ beforeOrdinal: 2, afterOrdinal: 1, title: "Renamed B" });
    expect(
      diff.changes.find((change) => change.kind === "metadata-changed"),
    ).toMatchObject({
      occurrenceId: "b",
      before: { title: "B" },
      after: { title: "Renamed B" },
    });
    expect(
      diff.changes.find((change) => change.kind === "added"),
    ).toMatchObject({
      title: "Added C",
      beforeOrdinal: null,
      afterOrdinal: 3,
      before: null,
      after: { title: "Added C" },
    });
    expect(diff).toMatchObject({
      added: 1,
      removed: 1,
      reordered: 2,
      metadataChanged: 1,
      unavailable: 1,
    });
    expect(diff.entries.find((entry) => entry.id === "manual")).toMatchObject({
      trackId: "manual-local",
      manual: true,
    });
  });
  it("does not claim an applied reorder when local order is preserved", () => {
    const original = playlist(false);
    const diff = reconcile(
      original,
      [
        ref("bbbbbbbbbbb", "B"),
        ref("aaaaaaaaaaa", "Owned A"),
        ref("ddddddddddd", "Removed D"),
      ],
      true,
    );
    expect(diff.entries.map((entry) => entry.id)).toEqual(
      original.entries.map((entry) => entry.id),
    );
    expect(diff.reordered).toBe(0);
    expect(
      diff.changes.filter((change) => change.kind === "reordered"),
    ).toEqual([]);
  });
  it("preserves repeated occurrence identities without inferring recording matches from equal text", () => {
    const original = playlist();
    original.entries = [
      original.entries[0],
      { ...original.entries[0], id: "a-repeat" },
    ];
    const diff = reconcile(
      original,
      [
        ref("aaaaaaaaaaa", "Owned A"),
        ref("aaaaaaaaaaa", "Owned A"),
        ref("differentid", "Owned A"),
      ],
      true,
    );
    expect(diff.entries.map((entry) => entry.trackId)).toEqual([
      "owned-local-a",
      "owned-local-a",
      null,
    ]);
    expect(diff.entries[0].id).toBe("a");
    expect(diff.entries[1].id).toBe("a-repeat");
    expect(diff.added).toBe(1);
  });
});
