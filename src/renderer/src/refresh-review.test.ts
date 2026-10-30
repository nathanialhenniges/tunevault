import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RefreshReview, type RefreshChange } from "./refresh-review";
it("renders explicit removal, order, unavailable and individual metadata differences as inert text", () => {
  const base = {
    occurrenceId: "entry",
    title: "<script>unsafe</script>",
    artist: "Artist",
    beforeOrdinal: 1,
    afterOrdinal: 2,
    before: {
      title: "Old title",
      artist: "Old artist",
      album: "Old album",
      duration: 120,
    },
    after: {
      title: "New title",
      artist: "New artist",
      album: "New album",
      duration: 180,
    },
    attachedTrackId: "track",
  };
  const changes: RefreshChange[] = [
    { ...base, kind: "metadata-changed" },
    { ...base, kind: "reordered" },
    { ...base, kind: "removed", afterOrdinal: null, after: null },
    { ...base, kind: "unavailable" },
  ];
  const html = renderToStaticMarkup(
    createElement(RefreshReview, {
      diff: {
        added: 0,
        removed: 1,
        reordered: 1,
        metadataChanged: 1,
        unavailable: 1,
        changes,
      },
    }),
  );
  expect(html).toContain("Old title");
  expect(html).toContain("New title");
  expect(html).toContain("Old artist");
  expect(html).toContain("New artist");
  expect(html).toContain("Old album");
  expect(html).toContain("New album");
  expect(html).toContain("2:00");
  expect(html).toContain("3:00");
  expect(html).toContain("Archived audio is retained");
  expect(html).toContain("existing local recording retained");
  expect(html).toContain("1 → 2");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
});
