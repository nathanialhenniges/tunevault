import { useEffect, useState } from "react";
import type { Occurrence, Playlist, Snapshot } from "../../shared/types";
import type { Run } from "./Inspector";
import { Artwork } from "./Library";
import { duration, Empty, Icon, message, Modal } from "./ui";

export default function Playlists({
  snapshot,
  run,
  prepare,
  inspect,
}: {
  snapshot: Snapshot;
  run: Run;
  prepare: (id: string) => void;
  inspect: (id: string) => void;
}) {
  const [playlistId, setPlaylistId] = useState(""),
    [create, setCreate] = useState(false),
    [name, setName] = useState(""),
    [edit, setEdit] = useState(false),
    [description, setDescription] = useState(""),
    [match, setMatch] = useState<Occurrence | null>(null),
    [diff, setDiff] = useState<any>(null),
    [drag, setDrag] = useState<string | null>(null),
    [page, setPage] = useState(0);
  const playlist =
    snapshot.playlists.find((p) => p.id === playlistId) ||
    snapshot.playlists[0];
  useEffect(() => {
    setPage(0);
    if (playlist) {
      setName(playlist.name);
      setDescription(playlist.description);
    }
  }, [playlist?.id]);
  async function move(entry: Occurrence, direction: number) {
    if (!playlist) return;
    const ids = playlist.entries.map((e) => e.id),
      from = ids.indexOf(entry.id),
      to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await run("playlists.reorder", { id: playlist.id, occurrenceIds: ids });
  }
  async function dropOn(id: string) {
    if (!playlist || !drag || drag === id) return;
    const ids = playlist.entries.map((e) => e.id);
    ids.splice(ids.indexOf(drag), 1);
    ids.splice(ids.indexOf(id), 0, drag);
    await run("playlists.reorder", { id: playlist.id, occurrenceIds: ids });
    setDrag(null);
  }
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil((playlist?.entries.length || 0) / 100) - 1),
  );
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Playlists</h1>
          <p>
            Ordered collections, including repeated and unavailable entries.
          </p>
        </div>
        <button
          onClick={() => {
            setName("");
            setCreate(true);
          }}
        >
          <Icon name="plus" size={16} />
          New playlist…
        </button>
      </div>
      {!playlist ? (
        <Empty
          icon="playlist"
          title="Keep your collections in order"
          action={
            <button onClick={() => setCreate(true)}>Create playlist</button>
          }
        >
          Create a playlist from your library, or import selected playlist
          references through Add music.
        </Empty>
      ) : (
        <>
          <div className="playlist-toolbar">
            <label className="field compact">
              Playlist
              <select
                value={playlist.id}
                onChange={(e) => setPlaylistId(e.target.value)}
              >
                {snapshot.playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button
                onClick={() => {
                  setName(playlist.name);
                  setDescription(playlist.description);
                  setEdit(true);
                }}
              >
                Edit details…
              </button>
              {playlist.sourceUrl && (
                <button
                  onClick={async () =>
                    setDiff(
                      await run("playlists.refreshPreview", {
                        id: playlist.id,
                      }),
                    )
                  }
                >
                  Check source changes…
                </button>
              )}
              <button className="primary" onClick={() => prepare(playlist.id)}>
                Prepare playlist…
              </button>
            </div>
          </div>
          <div className="playlist-summary">
            <h2>{playlist.name}</h2>
            <p>
              {playlist.entries.length} ordered occurrences ·{" "}
              {
                new Set(playlist.entries.map((e) => e.trackId).filter(Boolean))
                  .size
              }{" "}
              unique local tracks ·{" "}
              {playlist.entries.filter((e) => !e.trackId).length} unresolved
            </p>
            {playlist.description && (
              <p className="muted">{playlist.description}</p>
            )}
            {playlist.sourceUrl && (
              <p className="small muted">
                {playlist.snapshotAt
                  ? `Last complete snapshot: ${new Date(playlist.snapshotAt).toLocaleString()}`
                  : "No complete source snapshot yet"}
              </p>
            )}
          </div>
          <div className="table-scroll">
            <table className="playlist-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title / artist</th>
                  <th>Time</th>
                  <th>State</th>
                  <th>Order / remove</th>
                </tr>
              </thead>
              <tbody>
                {playlist.entries
                  .slice(currentPage * 100, currentPage * 100 + 100)
                  .map((entry, index) => {
                    const track = snapshot.tracks.find(
                        (t) => t.id === entry.trackId,
                      ),
                      position = currentPage * 100 + index;
                    return (
                      <tr
                        key={entry.id}
                        draggable
                        onDragStart={() => setDrag(entry.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dropOn(entry.id)}
                        onKeyDown={(e) => {
                          if (
                            e.altKey &&
                            (e.key === "ArrowUp" || e.key === "ArrowDown")
                          ) {
                            e.preventDefault();
                            void move(entry, e.key === "ArrowUp" ? -1 : 1);
                          }
                        }}
                      >
                        <td className="tabular muted">{position + 1}</td>
                        <td>
                          {track ? (
                            <button
                              className="track-name"
                              onClick={() => inspect(track.id)}
                            >
                              <Artwork track={track} />
                              <span>
                                <strong>{track.metadata.title}</strong>
                                <small>
                                  {track.metadata.artist ||
                                    "Artist needs review"}
                                </small>
                              </span>
                            </button>
                          ) : (
                            <span className="track-name">
                              <span className="artwork">
                                <Icon name="music" size={17} />
                              </span>
                              <span>
                                <strong>
                                  {entry.reference.title ||
                                    "Unavailable occurrence"}
                                </strong>
                                <small>
                                  {entry.reference.artist || "Reference only"}
                                </small>
                              </span>
                            </span>
                          )}
                          {entry.error && (
                            <span className="occurrence-error">
                              Acquisition failed: {entry.error}
                            </span>
                          )}
                        </td>
                        <td className="tabular">
                          {duration(
                            track?.duration || entry.reference.duration || 0,
                          )}
                        </td>
                        <td>
                          {entry.skipped ? (
                            <button
                              className="quiet"
                              onClick={() =>
                                run("references.skip", {
                                  playlistId: playlist.id,
                                  occurrenceId: entry.id,
                                  skipped: false,
                                })
                              }
                            >
                              Skipped · restore
                            </button>
                          ) : track ? (
                            "In library"
                          ) : (
                            <button
                              className="quiet warning"
                              onClick={() => setMatch(entry)}
                            >
                              {entry.reference.unavailable
                                ? "Unavailable · review"
                                : "Find or attach…"}
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="button-row">
                            <button
                              className="icon-button"
                              disabled={!position}
                              aria-label={`Move occurrence ${position + 1} up`}
                              onClick={() => move(entry, -1)}
                            >
                              ↑
                            </button>
                            <button
                              className="icon-button"
                              disabled={
                                position === playlist.entries.length - 1
                              }
                              aria-label={`Move occurrence ${position + 1} down`}
                              onClick={() => move(entry, 1)}
                            >
                              ↓
                            </button>
                            <button
                              className="icon-button quiet"
                              aria-label={`Remove occurrence ${position + 1} from playlist`}
                              onClick={() =>
                                run("playlists.remove", {
                                  id: playlist.id,
                                  occurrenceIds: [entry.id],
                                })
                              }
                            >
                              <Icon name="close" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span className="muted small">
              Drag to reorder, or use arrow buttons. Removing an occurrence
              keeps archived audio.
            </span>
            {playlist.entries.length > 100 && (
              <div className="button-row">
                <button
                  disabled={!currentPage}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <span>
                  {currentPage + 1} / {Math.ceil(playlist.entries.length / 100)}
                </span>
                <button
                  disabled={(currentPage + 1) * 100 >= playlist.entries.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {create && (
        <Modal
          title="Create playlist"
          onClose={() => setCreate(false)}
          actions={
            <button
              className="primary"
              disabled={!name.trim()}
              onClick={async () => {
                const result = await run("playlists.create", {
                  name: name.trim(),
                });
                if (result?.id) setPlaylistId(result.id);
                setCreate(false);
              }}
            >
              Create playlist
            </button>
          }
        >
          <label className="field">
            Name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </Modal>
      )}
      {edit && playlist && (
        <Modal
          title="Edit playlist details"
          onClose={() => setEdit(false)}
          actions={
            <button
              className="primary"
              disabled={!name.trim()}
              onClick={async () => {
                await run("playlists.update", {
                  id: playlist.id,
                  name: name.trim(),
                  description,
                });
                setEdit(false);
              }}
            >
              Save details
            </button>
          }
        >
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            Description
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </Modal>
      )}
      {match && playlist && (
        <MatchDialog
          entry={match}
          playlist={playlist}
          snapshot={snapshot}
          run={run}
          onClose={() => setMatch(null)}
        />
      )}
      {diff && playlist && (
        <Modal
          title="Review playlist refresh"
          wide
          onClose={() => setDiff(null)}
          actions={
            <button
              className="primary"
              disabled={diff.complete === false}
              onClick={async () => {
                await run("playlists.refreshApply", {
                  id: playlist.id,
                  preview: diff,
                });
                setDiff(null);
              }}
            >
              Apply reviewed snapshot
            </button>
          }
        >
          <p>
            Changes apply only to playlist membership and source order. Archived
            files and metadata locks remain intact.
          </p>
          {diff.complete === false && (
            <p className="warning">
              Incomplete refresh. The previous complete snapshot will be
              preserved.
            </p>
          )}
          <pre className="diff-preview">{JSON.stringify(diff, null, 2)}</pre>
        </Modal>
      )}
    </>
  );
}
function MatchDialog({
  entry,
  playlist,
  snapshot,
  run,
  onClose,
}: {
  entry: Occurrence;
  playlist: Playlist;
  snapshot: Snapshot;
  run: Run;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(
      `${entry.reference.artist} ${entry.reference.title}`.trim(),
    ),
    [results, setResults] = useState<any[]>([]),
    [candidate, setCandidate] = useState<any>(null),
    [local, setLocal] = useState(""),
    [exact, setExact] = useState(""),
    [authorized, setAuthorized] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [networkAck, setNetworkAck] = useState(
      snapshot.settings.onlineAcknowledged,
    );
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Review recording match"
      wide
      onClose={onClose}
      actions={
        <button
          className="primary"
          disabled={busy || !candidate || !authorized || !networkAck}
          onClick={() =>
            action(async () => {
              if (!snapshot.settings.onlineAcknowledged)
                await run("settings.update", { onlineAcknowledged: true });
              await run("source.acquire", {
                url: candidate.url,
                playlistId: playlist.id,
                occurrenceId: entry.id,
              });
              onClose();
            })
          }
        >
          Approve authorized recording
        </button>
      }
    >
      <div className="requested-reference">
        <strong>Requested reference</strong>
        <h3>{entry.reference.title}</h3>
        <p>
          {entry.reference.artist || "Unknown artist"} ·{" "}
          {entry.reference.album || "Unknown album"} ·{" "}
          {entry.reference.duration
            ? duration(entry.reference.duration)
            : "Unknown duration"}
        </p>
      </div>
      <details>
        <summary>Attach a file already in the library</summary>
        <label className="field">
          Library recording
          <select value={local} onChange={(e) => setLocal(e.target.value)}>
            <option value="">Choose a recording</option>
            {snapshot.tracks.map((t) => (
              <option value={t.id} key={t.id}>
                {t.metadata.artist} — {t.metadata.title} ({duration(t.duration)}
                )
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!local}
          onClick={() =>
            action(async () => {
              await run("references.attach", {
                playlistId: playlist.id,
                occurrenceId: entry.id,
                trackId: local,
              });
              onClose();
            })
          }
        >
          Attach selected recording
        </button>
      </details>
      {!snapshot.settings.onlineAcknowledged && (
        <div className="notice">
          <p>
            Searches disclose your IP and requested identifiers to the provider.
            Personal use is not a blanket copyright exception.
          </p>
          <label className="check-line">
            <input
              type="checkbox"
              checked={networkAck}
              onChange={(e) => setNetworkAck(e.target.checked)}
            />
            I understand and will archive only authorized media.
          </label>
        </div>
      )}
      <label className="field">
        Find YouTube candidates
        <div className="path-picker">
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
          <button
            disabled={busy || !query.trim() || !networkAck}
            onClick={() =>
              action(async () => {
                if (!snapshot.settings.onlineAcknowledged)
                  await run("settings.update", { onlineAcknowledged: true });
                setResults(await run("source.search", { query }));
              })
            }
          >
            Search
          </button>
        </div>
      </label>
      <p className="small muted">
        Searches reach YouTube. Compare recording version, duration and credits;
        the first result is not automatically chosen.
      </p>
      {results.map((row, index) => (
        <button
          key={row.url || index}
          className={`candidate ${candidate?.url === row.url ? "selected" : ""}`}
          onClick={() => setCandidate(row)}
        >
          <strong>{row.title}</strong>
          <span>
            {row.channel || "Unknown channel"} · {duration(row.duration)}
          </span>
          <small>
            {row.reason || "Review recording, version, credits and duration."}
          </small>
          <small className="path-text">{row.url}</small>
        </button>
      ))}
      <label className="field">
        Or review an exact YouTube URL
        <div className="path-picker">
          <input
            type="url"
            value={exact}
            onChange={(e) => setExact(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
          <button
            disabled={!exact}
            onClick={() =>
              setCandidate({
                url: exact,
                title: "Exact URL supplied by you",
                channel: "Verify at source",
                duration: 0,
                reason: "You must verify the exact recording before acquiring.",
              })
            }
          >
            Use URL
          </button>
        </div>
      </label>
      {candidate && (
        <div className="result-box">
          <strong>Selected candidate: {candidate.title}</strong>
          <p>
            {candidate.channel} · {duration(candidate.duration)}
          </p>
          <button onClick={() => run("openExternal", { url: candidate.url })}>
            Open candidate source
          </button>
        </div>
      )}
      <label className="check-line">
        <input
          type="checkbox"
          checked={authorized}
          onChange={(e) => setAuthorized(e.target.checked)}
        />
        I reviewed the recording and have permission to archive it.
      </label>
      <button
        className="quiet"
        onClick={() =>
          action(async () => {
            await run("references.skip", {
              playlistId: playlist.id,
              occurrenceId: entry.id,
            });
            onClose();
          })
        }
      >
        Keep occurrence, skip acquisition
      </button>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
