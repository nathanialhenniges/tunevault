import type { Reference } from "../../shared/types";
import { duration } from "./ui";
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
const labels = {
  added: "Added",
  removed: "Removed",
  reordered: "Reordered",
  unavailable: "Unavailable",
  "metadata-changed": "Reference changed",
};
export function RefreshReview({
  diff,
}: {
  diff: {
    added: number;
    removed: number;
    reordered: number;
    unavailable: number;
    metadataChanged: number;
    changes: RefreshChange[];
  };
}) {
  return (
    <>
      <p>
        {diff.added} added · {diff.removed} removed · {diff.reordered} reordered
        · {diff.metadataChanged} reference changes · {diff.unavailable}{" "}
        unavailable
      </p>
      {!diff.changes.length ? (
        <p className="muted">No source changes found.</p>
      ) : (
        <table className="review-table">
          <thead>
            <tr>
              <th>Change</th>
              <th>Recording / position</th>
              <th>Review details</th>
            </tr>
          </thead>
          <tbody>
            {diff.changes.map((change, index) => (
              <tr key={`${change.occurrenceId}-${change.kind}-${index}`}>
                <td>{labels[change.kind]}</td>
                <td>
                  <strong>{change.title || "Unavailable occurrence"}</strong>
                  {change.artist && (
                    <p className="small muted">{change.artist}</p>
                  )}
                  <span className="small muted">
                    {change.beforeOrdinal === null
                      ? "New"
                      : change.beforeOrdinal}{" "}
                    →{" "}
                    {change.afterOrdinal === null
                      ? "Removed"
                      : change.afterOrdinal}
                  </span>
                </td>
                <td>
                  {change.kind === "metadata-changed" ? (
                    <ul className="file-list">
                      {(["title", "artist", "album", "duration"] as const)
                        .filter(
                          (field) =>
                            change.before?.[field] !== change.after?.[field],
                        )
                        .map((field) => (
                          <li key={field}>
                            {field === "duration"
                              ? "Duration"
                              : field[0].toUpperCase() + field.slice(1)}
                            :{" "}
                            {field === "duration"
                              ? change.before?.duration === null
                                ? "Unknown"
                                : duration(change.before?.duration || 0)
                              : change.before?.[field] || "Unknown"}{" "}
                            →{" "}
                            {field === "duration"
                              ? change.after?.duration === null
                                ? "Unknown"
                                : duration(change.after?.duration || 0)
                              : change.after?.[field] || "Unknown"}
                          </li>
                        ))}
                    </ul>
                  ) : change.kind === "removed" ? (
                    "Removed from this source-following playlist. Archived audio is retained."
                  ) : change.kind === "unavailable" ? (
                    change.attachedTrackId ? (
                      "Source unavailable; existing local recording retained."
                    ) : (
                      "Source unavailable; occurrence stays visible for review."
                    )
                  ) : change.attachedTrackId ? (
                    "Existing local recording remains attached."
                  ) : (
                    "Review and attach an authorized recording."
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="small muted">
        Repeated occurrences retain their identities. Source references do not
        overwrite locked archive metadata. Removed source entries never delete
        archived audio.
      </p>
    </>
  );
}
