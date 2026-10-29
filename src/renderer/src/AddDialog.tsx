import { useState } from "react";
import type { ProviderPreview, Settings } from "../../shared/types";
import type { Run } from "./Inspector";
import { bytes, Icon, message, Modal } from "./ui";

export default function AddDialog({
  settings,
  run,
  onClose,
}: {
  settings: Settings;
  run: Run;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"files" | "source" | "references">("files");
  const [paths, setPaths] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<ProviderPreview | null>(null);
  const [format, setFormat] = useState("tsv");
  const [text, setText] = useState("");
  const [name, setName] = useState("Imported playlist");
  const [ack, setAck] = useState(settings.onlineAcknowledged);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function execute(fn: () => Promise<void>) {
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
  async function pick(folder = false) {
    await execute(async () => {
      const result = await run(folder ? "chooseImportFolder" : "chooseImport");
      const chosen = Array.isArray(result) ? result : result ? [result] : [];
      if (chosen.length) {
        setPaths(chosen);
        setPreview(await run("import.preview", { paths: chosen }));
      }
    });
  }
  return (
    <Modal
      title="Add music"
      wide
      onClose={onClose}
      actions={
        <>
          {tab === "files" && (
            <button
              className="primary"
              disabled={busy || !paths.length || !settings.vault}
              onClick={() =>
                execute(async () => {
                  await run("import.start", { paths });
                  onClose();
                })
              }
            >
              Import selected files
            </button>
          )}
          {tab === "source" && (
            <button
              className="primary"
              disabled={busy || !url || !ack}
              onClick={() =>
                execute(async () => {
                  if (!settings.onlineAcknowledged)
                    await run("settings.update", { onlineAcknowledged: true });
                  if (!source) {
                    setSource(await run("source.preview", { url }));
                    return;
                  }
                  if (source.capability === "available") {
                    await run("source.acquire", { url });
                    onClose();
                  }
                })
              }
            >
              {source?.capability === "available"
                ? "Archive authorized audio"
                : "Preview source"}
            </button>
          )}
          {tab === "references" && (
            <button
              className="primary"
              disabled={busy || !text.trim() || !name.trim()}
              onClick={() =>
                execute(async () => {
                  await run("references.import", { name, text, format });
                  onClose();
                })
              }
            >
              Import ordered references
            </button>
          )}
        </>
      }
    >
      <div className="tabs" aria-label="Add method">
        {[
          ["files", "Local files"],
          ["source", "Paste a link"],
          ["references", "Playlist references"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "selected" : ""}
            aria-pressed={tab === value}
            onClick={() => {
              setTab(value as typeof tab);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "files" && (
        <>
          <div className="drop-prompt">
            <Icon name="folder" size={30} />
            <strong>Bring your existing music</strong>
            <p>
              Choose files or a folder. TuneVault copies audio into your vault
              and keeps the originals untouched.
            </p>
            <div className="button-row">
              <button onClick={() => pick()} disabled={busy}>
                Choose audio files…
              </button>
              <button onClick={() => pick(true)} disabled={busy}>
                Choose folder…
              </button>
            </div>
          </div>
          {!settings.vault && (
            <div className="notice">
              <strong>Choose your archive location first.</strong>
              <p>
                Audio stays in a folder you control, separate from the app's
                index.
              </p>
              <button
                onClick={() =>
                  execute(async () => {
                    const vault = await run("chooseVault");
                    if (vault) await run("settings.update", { vault });
                  })
                }
              >
                Choose vault folder…
              </button>
            </div>
          )}
          {paths.length > 0 && (
            <div className="result-box">
              <strong>
                {paths.length} selected source{paths.length === 1 ? "" : "s"}
              </strong>
              {preview && <ImportPreview preview={preview} />}
              <ul className="file-list">
                {paths.slice(0, 12).map((path) => (
                  <li key={path}>{path.split(/[\\/]/).pop()}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {tab === "source" && (
        <>
          <label className="field">
            YouTube video or playlist / Spotify or Apple playlist reference
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setSource(null);
              }}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </label>
          <p className="small muted">
            YouTube is an acquisition source only for audio you are authorized
            to copy. Spotify and Apple supply references; subscription audio is
            never extracted.
          </p>
          {!settings.onlineAcknowledged && (
            <div className="notice">
              <strong>Before using online sources</strong>
              <p>
                Only archive audio you own or have permission to copy. Personal
                or educational use is not a general copyright exception.
                Requests reveal your IP and requested identifiers to the
                provider.
              </p>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I understand and will use authorized sources.
              </label>
              <div className="button-row">
                <button
                  className="quiet"
                  onClick={() => run("openLegal", { document: "terms" })}
                >
                  Terms
                </button>
                <button
                  className="quiet"
                  onClick={() => run("openLegal", { document: "privacy" })}
                >
                  Privacy
                </button>
              </div>
            </div>
          )}
          {source && (
            <div className="result-box">
              <strong>{source.name || source.provider}</strong>
              <p className={source.capability === "available" ? "" : "warning"}>
                {source.capability.replaceAll("-", " ")} ·{" "}
                {source.complete
                  ? "Complete reference"
                  : "Completeness not established"}
              </p>
              <p>{source.explanation}</p>
              <ol className="reference-list">
                {source.references?.slice(0, 80).map((row, index) => (
                  <li key={index}>
                    {row.title || "Unavailable item"}
                    {row.artist ? ` — ${row.artist}` : ""}
                    {row.unavailable ? " · unavailable" : ""}
                  </li>
                ))}
              </ol>
              {source.capability !== "available" && (
                <button onClick={() => setTab("references")}>
                  Use an exported playlist instead
                </button>
              )}
            </div>
          )}
        </>
      )}
      {tab === "references" && (
        <>
          <p>
            Import only the playlist you choose. Repeated and unavailable
            occurrences keep their positions. File paths and URLs do not grant
            automatic access to audio.
          </p>
          <div className="form-grid">
            <label className="field">
              Playlist name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              Reference format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="tsv">Tab-separated columns</option>
                <option value="csv">CSV</option>
                <option value="m3u">M3U / M3U8</option>
                <option value="spotify-json">
                  Spotify selected playlist JSON
                </option>
                <option value="apple-xml">Apple Music playlist XML</option>
              </select>
            </label>
          </div>
          <label className="field">
            Playlist data
            <textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "title\tartist\talbum\tduration\turl\nSong title\tArtist name\tAlbum\t240\t"
              }
            />
          </label>
          <p className="small muted">
            CSV/TSV columns: title, artist, album, duration (seconds), optional
            url. Spotify/Apple imports are snapshots, not live sync.
          </p>
        </>
      )}
      {busy && (
        <p role="status" className="muted">
          Working…
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
function ImportPreview({ preview }: { preview: any }) {
  const rows = Array.isArray(preview)
    ? preview
    : preview.files || preview.tracks || preview.items || [];
  return (
    <>
      <p>
        {preview.totalBytes
          ? `${bytes(preview.totalBytes)} estimated copy size`
          : "Files are probed before the archive copy is committed."}
      </p>
      {rows.length > 0 && (
        <ul className="file-list">
          {rows.slice(0, 12).map((row: any, index: number) => (
            <li key={index}>
              {row.title ||
                row.metadata?.title ||
                row.path?.split(/[\\/]/).pop() ||
                "Audio file"}{" "}
              {row.error && <span className="warning">— {row.error}</span>}
            </li>
          ))}
        </ul>
      )}
      {preview.errors?.map((err: any, i: number) => (
        <p key={i} className="warning">
          {typeof err === "string" ? err : err.message}
        </p>
      ))}
    </>
  );
}
