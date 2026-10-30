import { useEffect, useRef, useState } from "react";
import type { Metadata, MetadataField, Track } from "../../shared/types";
import { Artwork } from "./Library";
import { bytes, duration, Icon, message, Modal } from "./ui";

export const fields: [MetadataField, string][] = [
  ["title", "Title"],
  ["artist", "Artist credits"],
  ["album", "Album"],
  ["albumArtist", "Album artist"],
  ["trackNumber", "Track number"],
  ["trackTotal", "Track total"],
  ["discNumber", "Disc number"],
  ["discTotal", "Disc total"],
  ["date", "Release date"],
  ["genre", "Genre"],
  ["composer", "Composer"],
  ["comment", "Comment"],
  ["isrc", "ISRC"],
  ["musicbrainzId", "MusicBrainz ID"],
];
export type Run = (action: string, input?: unknown) => Promise<any>;
export default function Inspector({
  track,
  onClose,
  run,
  onlineAcknowledged,
}: {
  track: Track;
  onClose: () => void;
  run: Run;
  onlineAcknowledged: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(
    () => matchMedia("(max-width: 1199px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 1199px)");
    const changed = () => setNarrow(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (!narrow) return;
    const opener = document.activeElement as HTMLElement | null;
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(".main-content,.sidebar"),
    );
    const previous = background.map((element) => element.inert);
    background.forEach((element) => {
      element.inert = true;
    });
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      background.forEach((element, index) => {
        element.inert = previous[index];
      });
      if (opener?.isConnected) opener.focus();
    };
  }, [narrow]);
  const [changes, setChanges] = useState<Partial<Metadata>>({});
  const [locks, setLocks] = useState<MetadataField[]>(track.locks);
  const [preview, setPreview] = useState(false);
  const [lookups, setLookups] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[] | null>(null);
  const [coverPreview, setCoverPreview] = useState<{
    token: string;
    preview: string;
    origin: string;
  } | null>(null);
  const [artPath, setArtPath] = useState<string | null>(null);
  const [artPreview, setArtPreview] = useState("");
  const [padding, setPadding] = useState(true);
  const [busy, setBusy] = useState(false);
  const [networkAck, setNetworkAck] = useState(onlineAcknowledged);
  useEffect(() => {
    setChanges({});
    setLocks(track.locks);
    setLookups([]);
    setChapters(null);
  }, [track.id, track.revision]);
  const update = (field: MetadataField, value: string) =>
    setChanges((old) => ({ ...old, [field]: value }));
  async function save() {
    setBusy(true);
    try {
      await run("tracks.edit", { ids: [track.id], changes, locks });
      setChanges({});
      setPreview(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside
      ref={panel}
      className="inspector"
      role={narrow ? "dialog" : undefined}
      aria-modal={narrow ? true : undefined}
      tabIndex={-1}
      aria-labelledby="inspector-title"
      onKeyDown={(event) => {
        if (!narrow || document.querySelector("dialog[open]")) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          return;
        }
        if (event.key !== "Tab") return;
        const controls = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])',
          ) || [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header className="inspector-head">
        <h2 id="inspector-title">Track details</h2>
        <button
          className="icon-button quiet"
          onClick={onClose}
          aria-label="Close track details"
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="inspector-scroll">
        <div className="track-overview">
          <Artwork track={track} large />
          <div>
            <strong>{track.metadata.title || "Untitled recording"}</strong>
            <p>{track.metadata.artist || "Artist needs review"}</p>
            <span className="small muted">
              {track.demo
                ? "Fictional design fixture"
                : `${track.codec.toUpperCase()} · ${duration(track.duration)}`}
            </span>
            {track.demo && (
              <p className="small muted">AI-generated demo cover. No audio.</p>
            )}
          </div>
        </div>
        {fields.slice(0, 3).map(([key, label]) => (
          <label className="field" key={key}>
            {label}
            <input
              value={changes[key] ?? track.metadata[key]}
              disabled={track.demo}
              onChange={(e) => update(key, e.target.value)}
            />
          </label>
        ))}
        <div className="button-stack">
          <button
            className="primary"
            disabled={
              track.demo ||
              busy ||
              (!Object.keys(changes).length &&
                locks.join() === track.locks.join())
            }
            onClick={() => setPreview(true)}
          >
            Review changes…
          </button>
          <button
            disabled={track.demo || busy}
            onClick={() => run("tracks.undo", { ids: [track.id] })}
          >
            Undo previous revision
          </button>
        </div>
        <details>
          <summary>More tags & field locks</summary>
          {fields.slice(3).map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input
                value={changes[key] ?? track.metadata[key]}
                disabled={track.demo}
                onChange={(e) => update(key, e.target.value)}
              />
            </label>
          ))}
          <p className="small muted">
            Locked fields take precedence over suggested metadata.
          </p>
          {fields.map(([key, label]) => (
            <label className="check-line small" key={key}>
              <input
                type="checkbox"
                checked={locks.includes(key)}
                disabled={track.demo}
                onChange={(e) =>
                  setLocks(
                    e.target.checked
                      ? [...locks, key]
                      : locks.filter((k) => k !== key),
                  )
                }
              />
              Lock {label.toLowerCase()}
              <span className="muted">
                {track.origins[key] || "Unknown origin"}
              </span>
            </label>
          ))}
        </details>
        <details>
          <summary>Artwork</summary>
          <p className="small muted">
            Local art is preserved. Player copies use bounded RGB JPEG artwork.
          </p>
          <button
            disabled={track.demo}
            onClick={async () => {
              const path = await run("chooseArtwork");
              if (path) {
                setArtPath(path);
                setPadding(true);
                const result = await run("artwork.preview", {
                  path,
                  padding: true,
                });
                setArtPreview(result.preview);
              }
            }}
          >
            Choose local artwork…
          </button>
        </details>
        <details open={!!track.source?.description}>
          <summary>Description & tracklist</summary>
          <pre className="description">
            {track.source?.description || "No source description saved."}
          </pre>
          <div className="button-row">
            <button
              disabled={track.demo || !track.source?.description}
              onClick={() => run("description.copy", { id: track.id })}
            >
              Copy description
            </button>
            <button
              disabled={track.demo || !track.source?.description}
              onClick={() => run("description.export", { id: track.id })}
            >
              Save text sidecar
            </button>
            <button
              disabled={track.demo}
              onClick={async () =>
                setChapters(await run("mixes.parse", { id: track.id }))
              }
            >
              Review split…
            </button>
          </div>
          <p className="small muted">
            The whole mix is kept. Splitting creates linked copies and may
            re-encode.
          </p>
        </details>
        <details>
          <summary>Audio & source details</summary>
          <dl className="property-list">
            <dt>Codec / container</dt>
            <dd>
              {track.codec} / {track.container}
            </dd>
            <dt>Duration</dt>
            <dd>{duration(track.duration)}</dd>
            <dt>Bitrate</dt>
            <dd>{Math.round(track.bitrate / 1000)} kbps</dd>
            <dt>Sample rate</dt>
            <dd>{track.sampleRate.toLocaleString()} Hz</dd>
            <dt>File size</dt>
            <dd>{bytes(track.bytes)}</dd>
            <dt>Quality provenance</dt>
            <dd>
              {track.source?.quality ||
                "Existing local audio; lossless quality not inferred from extension."}
            </dd>
            <dt>Metadata revision</dt>
            <dd>{track.revision}</dd>
          </dl>
          {track.source && (
            <>
              <p className="small muted">
                Original title: {track.source.title}
                <br />
                Uploader: {track.source.uploader}
                <br />
                Acquired: {track.source.acquiredAt}
              </p>
              <button
                onClick={() => run("openExternal", { url: track.source!.url })}
              >
                Open original source
              </button>
            </>
          )}
          <button
            disabled={track.demo}
            onClick={() => run("reveal", { trackId: track.id })}
          >
            Reveal archived file
          </button>
          {track.missing && (
            <button
              onClick={async () => {
                const paths = await run("chooseImport");
                if (paths?.[0])
                  await run("tracks.relink", { id: track.id, path: paths[0] });
              }}
            >
              Relink missing file…
            </button>
          )}
        </details>
        <details>
          <summary>Metadata suggestions</summary>
          <p className="small muted">
            Search MusicBrainz. Nothing changes until you choose fields and
            apply. Your search reaches the service.
          </p>
          {!onlineAcknowledged && (
            <label className="check-line small">
              <input
                type="checkbox"
                checked={networkAck}
                onChange={(e) => setNetworkAck(e.target.checked)}
              />
              I understand network requests disclose my IP and search terms; I
              will only archive authorized media.
            </label>
          )}
          <button
            disabled={track.demo || !networkAck}
            onClick={async () => {
              if (!onlineAcknowledged)
                await run("settings.update", { onlineAcknowledged: true });
              const result = await run("lookup.search", { id: track.id });
              setLookups(
                Array.isArray(result)
                  ? result
                  : result?.recordings || result?.results || [],
              );
            }}
          >
            Find suggestions
          </button>
          {lookups.map((result, index) => (
            <div className="suggestion" key={result.id || index}>
              <strong>{result.title}</strong>
              <p>
                {result.artist ||
                  result["artist-credit"]?.map((a: any) => a.name).join(", ") ||
                  "Unknown artist"}
              </p>
              <div className="button-row">
                {(["title", "artist", "album", "date"] as MetadataField[])
                  .filter((key) => result[key])
                  .map((key) => (
                    <button
                      key={key}
                      onClick={() =>
                        setChanges((old) => ({ ...old, [key]: result[key] }))
                      }
                    >
                      Use {key}
                    </button>
                  ))}
              </div>
              {result.releases?.map((release: any) => (
                <div className="release-option" key={release.id}>
                  <span>
                    {release.title} · {release.date || "Date unknown"}
                    {release.country ? ` · ${release.country}` : ""}
                  </span>
                  <button
                    onClick={async () =>
                      setCoverPreview(
                        await run("lookup.artworkPreview", {
                          releaseId: release.id,
                          padding: true,
                        }),
                      )
                    }
                  >
                    Preview release artwork…
                  </button>
                </div>
              ))}
            </div>
          ))}
        </details>
      </div>
      {preview && (
        <Modal
          title="Apply metadata changes"
          onClose={() => setPreview(false)}
          actions={
            <button className="primary" disabled={busy} onClick={save}>
              Apply to archived copy
            </button>
          }
        >
          <p>
            Your original import is preserved. This writes a recoverable
            revision of the archived copy.
          </p>
          <table className="review-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(changes).map(([key, value]) => (
                <tr key={key}>
                  <td>{fields.find((f) => f[0] === key)?.[1]}</td>
                  <td>{track.metadata[key as MetadataField] || "Empty"}</td>
                  <td>{value || "Empty"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">
            Locked fields: {locks.length ? locks.join(", ") : "None"}
          </p>
        </Modal>
      )}
      {coverPreview && (
        <Modal
          title="Review release artwork"
          onClose={() => setCoverPreview(null)}
          actions={
            <button
              className="primary"
              onClick={async () => {
                await run("lookup.artworkApply", {
                  ids: [track.id],
                  token: coverPreview.token,
                });
                setCoverPreview(null);
              }}
            >
              Apply selected artwork
            </button>
          }
        >
          <img
            className="art-preview"
            src={coverPreview.preview}
            alt="Proposed release artwork"
          />
          <p className="small muted">{coverPreview.origin}</p>
          <p>
            This release image is a suggestion. Check that it matches this
            recording and that you may use it. Existing audio survives a failed
            image request.
          </p>
        </Modal>
      )}
      {artPath && (
        <Modal
          title="Review local artwork"
          onClose={() => setArtPath(null)}
          actions={
            <button
              className="primary"
              disabled={!artPreview}
              onClick={async () => {
                await run("tracks.artwork", {
                  ids: [track.id],
                  path: artPath,
                  padding,
                });
                setArtPath(null);
              }}
            >
              Apply artwork to archived copy
            </button>
          }
        >
          {artPreview && (
            <img
              className="art-preview"
              src={artPreview}
              alt="Proposed local artwork"
            />
          )}
          <label className="check-line">
            <input
              type="checkbox"
              checked={padding}
              onChange={async (e) => {
                setPadding(e.target.checked);
                const result = await run("artwork.preview", {
                  path: artPath,
                  padding: e.target.checked,
                });
                setArtPreview(result.preview);
              }}
            />
            Pad to square (clear to crop)
          </label>
          <p className="small muted">
            The original selected image is preserved. Device artwork uses
            bounded RGB JPEG copies; 600px / 500KB is a proposed older-player
            baseline.
          </p>
        </Modal>
      )}
      {chapters && (
        <SplitDialog
          track={track}
          initial={Array.isArray(chapters) ? chapters : []}
          run={run}
          onClose={() => setChapters(null)}
        />
      )}
    </aside>
  );
}

function SplitDialog({
  track,
  initial,
  run,
  onClose,
}: {
  track: Track;
  initial: { start: number; title: string }[];
  run: Run;
  onClose: () => void;
}) {
  const [text, setText] = useState(
    initial.map((c) => `${duration(c.start)} ${c.title}`).join("\n"),
  );
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  function parse() {
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d{1,3}:\d{2}(?::\d{2})?)\s+(.+)$/);
        if (!match)
          throw Error(
            "Use MM:SS or HH:MM:SS, a space, and a title on each line.",
          );
        const parts = match[1].split(":").map(Number);
        if (parts.slice(1).some((n) => n > 59))
          throw Error("Minutes and seconds must be 00–59.");
        return {
          start: parts.reduce((n, v) => n * 60 + v, 0),
          title: match[2],
        };
      });
  }
  return (
    <Modal
      title="Review mix boundaries"
      wide
      onClose={onClose}
      actions={
        <button
          className="primary"
          onClick={async () => {
            try {
              const parsed = parse();
              if (
                !parsed.length ||
                parsed.some(
                  (c, i) =>
                    c.start < 0 ||
                    c.start >= track.duration ||
                    (i > 0 && c.start <= parsed[i - 1].start),
                )
              )
                throw Error(
                  "Boundaries must increase and fall within the actual duration.",
                );
              if (!review) {
                setReview(true);
                return;
              }
              await run("mixes.split", { id: track.id, chapters: parsed });
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          {review ? "Create split copies" : "Validate boundaries"}
        </button>
      }
    >
      <p>
        The master is preserved. Re-encoding and crossfades can affect
        boundaries; credits remain your reviewed labels.
      </p>
      <label className="field">
        Boundaries and labels
        <textarea
          rows={10}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setReview(false);
          }}
          placeholder="00:00 Opening signal\n08:24 City in motion"
        />
      </label>
      {review && (
        <p className="notice">
          Boundaries validated. Review the labels, then create derivative
          copies.
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

export function BatchEditor({
  tracks,
  run,
  onClose,
}: {
  tracks: Track[];
  run: Run;
  onClose: () => void;
}) {
  const [changes, setChanges] = useState<Partial<Metadata>>({});
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lockFields, setLockFields] = useState(true);
  const [undoReview, setUndoReview] = useState(false);
  const [undoError, setUndoError] = useState("");
  const common = (key: MetadataField) =>
    tracks.every((t) => t.metadata[key] === tracks[0].metadata[key])
      ? tracks[0].metadata[key]
      : undefined;
  return (
    <>
      <Modal
        title={`Edit ${tracks.length} selected tracks`}
        wide
        onClose={onClose}
        actions={
          <button
            className="primary"
            disabled={busy || !Object.keys(changes).length}
            onClick={async () => {
              if (!review) {
                setReview(true);
                return;
              }
              setBusy(true);
              try {
                await run("tracks.edit", {
                  ids: tracks.map((t) => t.id),
                  changes,
                  ...(lockFields
                    ? { addLocks: Object.keys(changes) as MetadataField[] }
                    : {}),
                });
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {review ? "Apply changes" : "Preview changes"}
          </button>
        }
      >
        <button
          disabled={busy || !tracks.length}
          onClick={() => {
            setUndoReview(true);
            setUndoError("");
          }}
        >
          Undo previous revisions for selected tracks…
        </button>
        <p>
          Only fields you enable will change. Mixed values are preserved unless
          explicitly replaced.
        </p>
        {review ? (
          <table className="review-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(changes).map(([key, value]) => (
                <tr key={key}>
                  <td>{fields.find((f) => f[0] === key)?.[1]}</td>
                  <td>{common(key as MetadataField) ?? "Mixed values"}</td>
                  <td>{value || "Empty (cleared)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="batch-fields">
            {fields.map(([key, label]) => (
              <div className="batch-field" key={key}>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={key in changes}
                    onChange={(e) =>
                      setChanges((old) => {
                        const next = { ...old };
                        if (e.target.checked) next[key] = common(key) || "";
                        else delete next[key];
                        return next;
                      })
                    }
                  />
                  {label}
                </label>
                <input
                  aria-label={`Batch ${label}`}
                  disabled={!(key in changes)}
                  placeholder={common(key) ?? "Mixed values — unchanged"}
                  value={changes[key] ?? ""}
                  onChange={(e) =>
                    setChanges((old) => ({ ...old, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        )}
        <label className="check-line">
          <input
            type="checkbox"
            checked={lockFields}
            onChange={(e) => setLockFields(e.target.checked)}
          />
          Lock edited fields against future suggestions
        </label>
        {review && (
          <button className="quiet" onClick={() => setReview(false)}>
            Back to editing
          </button>
        )}
      </Modal>
      {undoReview && (
        <Modal
          title={`Undo ${tracks.length} selected track revisions`}
          dismissible={!busy}
          onClose={() => setUndoReview(false)}
          actions={
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setUndoError("");
                try {
                  await run("tracks.undo", {
                    ids: tracks.map((track) => track.id),
                  });
                  onClose();
                } catch (error) {
                  setUndoError(message(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Undo selected revisions
            </button>
          }
        >
          <p>
            Restore the previous saved metadata/audio revision for all{" "}
            {tracks.length} selected tracks. Current unapplied edits in this
            editor will be discarded. If any selected track has no recoverable
            revision, the batch remains unchanged.
          </p>
          <ul className="file-list">
            {tracks.map((track) => (
              <li key={track.id}>
                {track.metadata.title || "Untitled recording"}
              </li>
            ))}
          </ul>
          {undoError && (
            <p className="inline-error" role="alert">
              {undoError}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
