import { useEffect, useState } from "react";
import type {
  ExportPlan,
  Format,
  Job,
  Receipt,
  Snapshot,
  Target,
  Transport,
} from "../../shared/types";
import type { Run } from "./Inspector";
import { bytes, Empty, Icon, message, Modal } from "./ui";
import { receiptIsCurrent, targetState } from "./library-state";

const transports: Record<Transport, string> = {
  imazing: "iMazing / Apple-library handoff",
  usb: "USB drive / SD card",
  folder: "Folder / external transfer app",
  mtp: "Android / MTP · folder fallback",
};
const formats: Record<Format, string> = {
  original: "Original available format",
  mp3: "MP3",
  aac: "AAC-LC · M4A",
  alac: "Apple Lossless · M4A",
  flac: "FLAC · source quality retained",
};
const evidence: Record<Receipt["evidence"], string> = {
  "ready-locally": "Ready locally",
  exported: "Exported",
  "user-confirmed": "User-confirmed transfer",
  "volume-verified": "Copied and verified on volume",
};

export default function Devices({
  snapshot,
  targetId,
  setTargetId,
  run,
  openSetup,
  prepare,
}: {
  snapshot: Snapshot;
  targetId: string;
  setTargetId: (id: string) => void;
  run: Run;
  openSetup: () => void;
  prepare: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const [destinationChange, setDestinationChange] = useState<{
    targetId: string;
    before: string;
    after: string;
  } | null>(null);
  const [destinationBusy, setDestinationBusy] = useState(false);
  const target =
    snapshot.targets.find((t) => t.id === targetId) || snapshot.targets[0];
  const receipts = snapshot.receipts.filter((r) => r.targetId === target?.id);
  const batches = [...new Set(receipts.map((r) => r.batchId))];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Devices & exports</h1>
          <p>Independent destinations, profiles and transfer history.</p>
        </div>
        <button onClick={openSetup}>
          <Icon name="plus" size={16} />
          Add target…
        </button>
      </div>
      {!target ? (
        <Empty
          icon="device"
          title="Set up your first player"
          action={
            <button className="primary" onClick={openSetup}>
              Add export target
            </button>
          }
        >
          Choose how music gets onto your player. No device is assumed
          compatible.
        </Empty>
      ) : (
        <div className="target-workspace">
          <div className="target-list" aria-label="Saved export targets">
            {snapshot.targets.map((t) => (
              <button
                key={t.id}
                className={target.id === t.id ? "selected" : ""}
                onClick={() => setTargetId(t.id)}
              >
                <Icon name="device" />
                <span>
                  <strong>{t.name}</strong>
                  <small>{transports[t.transport]}</small>
                </span>
              </button>
            ))}
          </div>
          <article className="target-detail">
            <header>
              <h2>{target.name}</h2>
              <span className="subtle-badge">
                {target.profile.compatibility}
              </span>
            </header>
            <div className="tabs">
              {["overview", "content", "compatibility"].map((value) => (
                <button
                  key={value}
                  className={tab === value ? "selected" : ""}
                  aria-pressed={tab === value}
                  onClick={() => setTab(value)}
                >
                  {value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
            {tab === "overview" && (
              <>
                <dl className="property-list">
                  <dt>Transfer method</dt>
                  <dd>{transports[target.transport]}</dd>
                  <dt>Destination</dt>
                  <dd className="path-text">
                    {target.destination || "Not chosen"}
                  </dd>
                  <dt>Connection</dt>
                  <dd>
                    {target.connected
                      ? "Destination currently available"
                      : "Destination unavailable / disconnected"}
                  </dd>
                  <dt>Audio profile</dt>
                  <dd>
                    {formats[target.profile.format]}
                    {target.profile.format === "mp3"
                      ? ` · ID3v2.${target.profile.mp3TagVersion ?? 3} · ${target.profile.bitrate} kbps when conversion is needed`
                      : ""}
                  </dd>
                  <dt>Configured budget</dt>
                  <dd>
                    {target.budget ? bytes(target.budget) : "Not set"} · not
                    detected capacity
                  </dd>
                  <dt>Last observed destination capacity</dt>
                  <dd>
                    {target.lastCapacity ? (
                      <>
                        {bytes(target.lastCapacity.totalBytes)} total ·{" "}
                        {bytes(target.lastCapacity.freeBytes)} free as of{" "}
                        {new Date(
                          target.lastCapacity.observedAt,
                        ).toLocaleString()}
                        . Historical filesystem observation, not current free
                        space
                        {target.transport === "imazing"
                          ? " or iPod capacity"
                          : ""}
                        .
                      </>
                    ) : (
                      "Not measured yet; open export preflight while the destination is connected."
                    )}
                  </dd>
                </dl>
                {target.transport === "mtp" && (
                  <p className="notice">
                    Direct transfer unavailable on this platform. Prepare a
                    folder and transfer it with a separate Android/MTP
                    application.
                  </p>
                )}
                {target.transport === "imazing" && (
                  <p className="notice">
                    Prepare compatible files, transfer with iMazing, then
                    confirm this batch. TuneVault cannot verify the iPod Music
                    inventory or playlist order.
                  </p>
                )}
                <div className="button-row">
                  <button className="primary" onClick={prepare}>
                    <Icon name="export" size={16} />
                    Prepare files…
                  </button>
                  <button
                    onClick={async () => {
                      const chosen = await run("chooseTargetFolder");
                      if (chosen)
                        setDestinationChange({
                          targetId: target.id,
                          before: target.destination,
                          after: chosen,
                        });
                    }}
                  >
                    Change destination…
                  </button>
                  <button
                    onClick={() => run("reveal", { targetId: target.id })}
                  >
                    Reveal destination
                  </button>
                </div>
                <h3>Transfer history</h3>
                {!batches.length ? (
                  <p className="muted">No batches prepared for this target.</p>
                ) : (
                  batches.map((batchId) => {
                    const rows = receipts.filter((r) => r.batchId === batchId);
                    const first =
                      rows.find((row) => row.evidence === "user-confirmed") ||
                      rows[0];
                    const uniqueTracks = new Set(rows.map((row) => row.trackId))
                      .size;
                    const stale = rows.some((r) => {
                      const track = snapshot.tracks.find(
                        (t) => t.id === r.trackId,
                      );
                      return (
                        !track ||
                        !receiptIsCurrent(track, target, r, snapshot.playlists)
                      );
                    });
                    return (
                      <div className="receipt" key={batchId}>
                        <div>
                          <strong>
                            {stale
                              ? "Changed since transfer"
                              : evidence[first.evidence]}
                          </strong>
                          {stale && (
                            <p className="small muted">
                              Recorded evidence: {evidence[first.evidence]}
                            </p>
                          )}
                          <p>
                            {uniqueTracks} unique track
                            {uniqueTracks === 1 ? "" : "s"} ·{" "}
                            {new Date(first.createdAt).toLocaleString()}
                          </p>
                          <span className="small muted">
                            Batch {batchId.slice(0, 8)}
                          </span>
                          <details>
                            <summary>
                              Evidence history · {rows.length} records
                            </summary>
                            <ul>
                              {rows.map((row) => (
                                <li key={row.id}>
                                  {evidence[row.evidence]} ·{" "}
                                  {snapshot.tracks.find(
                                    (track) => track.id === row.trackId,
                                  )?.metadata.title ||
                                    "Archived recording"}{" "}
                                  · {new Date(row.createdAt).toLocaleString()}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </div>
                        <div className="button-row">
                          <button
                            onClick={() =>
                              run("reveal", { targetId: target.id, batchId })
                            }
                          >
                            Reveal files
                          </button>
                          {target.transport === "imazing" &&
                            !stale &&
                            first.evidence !== "user-confirmed" && (
                              <ConfirmTransfer
                                target={target}
                                batchId={batchId}
                                run={run}
                              />
                            )}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
            {tab === "content" && (
              <TargetContent
                key={target.id}
                snapshot={snapshot}
                target={target}
                run={run}
                prepare={prepare}
              />
            )}
            {tab === "compatibility" && (
              <Compatibility
                key={`${target.id}:${target.profile.revision}:${target.profile.compatibility}`}
                target={target}
                jobs={snapshot.jobs}
                run={run}
              />
            )}
          </article>
        </div>
      )}
      {destinationChange && (
        <Modal
          title="Change target destination"
          onClose={() => setDestinationChange(null)}
          actions={
            <button
              className="primary"
              disabled={destinationBusy}
              onClick={async () => {
                setDestinationBusy(true);
                try {
                  await run("targets.update", {
                    id: destinationChange.targetId,
                    destination: destinationChange.after,
                  });
                  setDestinationChange(null);
                } finally {
                  setDestinationBusy(false);
                }
              }}
            >
              Use selected destination
            </button>
          }
        >
          <p>
            Future exports will use the newly selected folder. Existing exported
            files and transfer history are preserved. The destination identity
            will be reviewed again before writing.
          </p>
          <dl className="property-list">
            <dt>Previous folder</dt>
            <dd className="path-text">{destinationChange.before}</dd>
            <dt>New folder</dt>
            <dd className="path-text">{destinationChange.after}</dd>
          </dl>
        </Modal>
      )}
    </>
  );
}
function TargetContent({
  snapshot,
  target,
  run,
  prepare,
}: {
  snapshot: Snapshot;
  target: Target;
  run: Run;
  prepare: () => void;
}) {
  const [chosen, setChosen] = useState(target.playlistIds);
  const [filter, setFilter] = useState("pending");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const savedPlaylists = snapshot.playlists.filter((playlist) =>
    target.playlistIds.includes(playlist.id),
  );
  const trackIds = new Set(
    savedPlaylists.flatMap((playlist) =>
      playlist.entries
        .filter((entry) => !entry.skipped && entry.trackId)
        .map((entry) => entry.trackId),
    ),
  );
  const content = target.playlistIds.length
    ? snapshot.tracks.filter((track) => trackIds.has(track.id))
    : snapshot.tracks;
  const rows = content.map((track) => ({
    track,
    state: targetState(track, target, snapshot.receipts, snapshot.playlists),
  }));
  const pending = rows.filter((row) =>
    ["Not prepared", "Changed since transfer", "Missing file"].includes(
      row.state,
    ),
  );
  const changed = rows.filter((row) => row.state === "Changed since transfer");
  const visible =
    filter === "pending" ? pending : filter === "changed" ? changed : rows;
  const pages = Math.max(1, Math.ceil(visible.length / 100));
  const currentPage = Math.min(page, pages - 1);
  const omissions = savedPlaylists.flatMap((playlist) =>
    playlist.entries
      .map((entry, index) => ({ entry, index, playlist }))
      .filter((row) => !row.entry.trackId || row.entry.skipped),
  );
  const dirty = JSON.stringify(chosen) !== JSON.stringify(target.playlistIds);
  return (
    <>
      <h3>Content for this target</h3>
      <p className="small muted">
        Choose playlists, or leave all unchecked to use the whole library.
        Exports preserve playlist occurrences and order; the table lists unique
        tracks.
      </p>
      {snapshot.playlists.map((playlist) => (
        <label className="check-line" key={playlist.id}>
          <input
            type="checkbox"
            checked={chosen.includes(playlist.id)}
            onChange={(event) =>
              setChosen(
                event.target.checked
                  ? [...chosen, playlist.id]
                  : chosen.filter((id) => id !== playlist.id),
              )
            }
          />
          {playlist.name}
          <span className="muted">{playlist.entries.length} occurrences</span>
        </label>
      ))}
      <div className="button-row">
        <button
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await run("targets.update", {
                id: target.id,
                playlistIds: chosen,
              });
              setPage(0);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save selected playlists
        </button>
        <button className="primary" disabled={dirty} onClick={prepare}>
          Review saved target export…
        </button>
      </div>
      {dirty && (
        <p className="small warning">
          Save the playlist selection before reviewing its export.
        </p>
      )}
      <h3>Saved target content</h3>
      <p>
        {pending.length} pending · {changed.length} changed · {rows.length}{" "}
        unique tracks
      </p>
      <label className="field">
        Show target content
        <select
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(0);
          }}
        >
          <option value="pending">Pending preparation / missing file</option>
          <option value="changed">Changed since transfer</option>
          <option value="all">All saved target content</option>
        </select>
      </label>
      <table className="review-table">
        <thead>
          <tr>
            <th>Track</th>
            <th>Target status</th>
          </tr>
        </thead>
        <tbody>
          {visible
            .slice(currentPage * 100, currentPage * 100 + 100)
            .map(({ track, state }) => (
              <tr key={track.id}>
                <td>
                  {track.metadata.title}
                  <span className="small muted">
                    {" "}
                    — {track.metadata.artist || "Unknown artist"}
                  </span>
                </td>
                <td>{state}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {!visible.length && (
        <p className="muted">No tracks match this target-content filter.</p>
      )}
      {pages > 1 && (
        <div className="pagination">
          <button
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            Page {currentPage + 1} of {pages}
          </span>
          <button
            disabled={currentPage + 1 === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
      {omissions.length > 0 && (
        <>
          <h3>Unresolved / skipped occurrences</h3>
          <ol className="reference-list">
            {omissions.slice(0, 100).map(({ entry, index, playlist }) => (
              <li key={entry.id}>
                {playlist.name} · position {index + 1}:{" "}
                {entry.reference.title || "Unavailable item"} —{" "}
                {entry.skipped ? "Skipped" : "No approved local recording"}
              </li>
            ))}
          </ol>
          {omissions.length > 100 && (
            <p>
              {omissions.length} omissions; open the playlist to inspect all
              occurrences.
            </p>
          )}
        </>
      )}
    </>
  );
}

function ConfirmTransfer({
  target,
  batchId,
  run,
}: {
  target: Target;
  batchId: string;
  run: Run;
}) {
  const [open, setOpen] = useState(false),
    [checked, setChecked] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Mark batch transferred…</button>
      {open && (
        <Modal
          title="Confirm transfer to this iPod"
          onClose={() => setOpen(false)}
          actions={
            <button
              className="primary"
              disabled={!checked}
              onClick={async () => {
                await run("export.confirm", { targetId: target.id, batchId });
                setOpen(false);
              }}
            >
              Mark selected batch as transferred
            </button>
          }
        >
          <p>
            Use iMazing to transfer the prepared files to{" "}
            <strong>{target.name}</strong>. Check the device's tags, artwork,
            playback and playlist order.
          </p>
          <label className="check-line">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            I transferred and checked this batch on this target.
          </label>
          <p className="small muted">
            This records your confirmation. It is not an automatic device
            inventory check and does not confirm another target.
          </p>
        </Modal>
      )}
    </>
  );
}
function Compatibility({
  target,
  jobs,
  run,
}: {
  target: Target;
  jobs: Job[];
  run: Run;
}) {
  const [model, setModel] = useState(target.profile.model),
    [firmware, setFirmware] = useState(target.profile.firmware),
    [format, setFormat] = useState<Format>(target.profile.format),
    [bitrate, setBitrate] = useState(target.profile.bitrate),
    [sampleRate, setSampleRate] = useState(target.profile.sampleRate),
    [artworkSize, setArtworkSize] = useState(target.profile.artworkSize),
    [artworkBytes, setArtworkBytes] = useState(target.profile.artworkBytes),
    [mp3TagVersion, setMp3TagVersion] = useState<3 | 4>(
      target.profile.mp3TagVersion ?? 3,
    ),
    [filenameLimit, setFilenameLimit] = useState(
      target.profile.filenameLimit ?? 120,
    ),
    [pathLimit, setPathLimit] = useState(target.profile.pathLimit ?? 240),
    [playlistNewline, setPlaylistNewline] = useState<"LF" | "CRLF">(
      target.profile.playlistNewline ?? "LF",
    ),
    [orderTags, setOrderTags] = useState(target.profile.orderTags ?? false),
    [tested, setTested] = useState(
      target.profile.compatibility === "User-tested",
    ),
    [testResults, setTestResults] = useState(target.profile.testResults || ""),
    [legacy, setLegacy] = useState(target.profile.legacyPlaylist),
    [queuedTest, setQueuedTest] = useState<Job | null>(null),
    [testBusy, setTestBusy] = useState(false),
    [testError, setTestError] = useState("");
  const testJob =
    jobs.find((job) => job.id === queuedTest?.id) ||
    jobs
      .filter(
        (job) =>
          job.payload.compatibilityTest === true &&
          job.payload.targetId === target.id,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ||
    queuedTest;
  const testActive = testJob && ["queued", "running"].includes(testJob.status);
  return (
    <>
      <p className="muted">
        A baseline profile is a starting point. Hardware playback, non-ASCII
        tags, seeking, artwork and playlist ordering need a real-device check.
      </p>
      <section aria-labelledby="synthetic-test-title">
        <h3 id="synthetic-test-title">Small compatibility test</h3>
        <p className="small muted">
          Prepare generated tones, artwork and playlist-order cases in the
          target folder. These are synthetic test files, not music from your
          library. File preparation does not prove playback on a player.
        </p>
        <button
          disabled={testBusy || !!testActive}
          onClick={async () => {
            setTestBusy(true);
            setTestError("");
            try {
              setQueuedTest(
                await run("targets.testPack", { targetId: target.id }),
              );
            } catch (error) {
              setTestError(message(error));
            } finally {
              setTestBusy(false);
            }
          }}
        >
          Prepare synthetic test pack…
        </button>
        {testJob && (
          <div className="result-box">
            <p role="status">Synthetic compatibility test · {testJob.status}</p>
            <p className={testJob.status === "failed" ? "warning" : "muted"}>
              {testJob.message || "Queued; test files are not ready yet."}
            </p>
            {testJob.status === "completed" && (
              <button onClick={() => run("reveal", { targetId: target.id })}>
                Reveal target folder
              </button>
            )}
          </div>
        )}
        {testError && (
          <p className="inline-error" role="alert">
            {testError}
          </p>
        )}
        <p className="small muted">
          Transfer the pack using this target's normal method. Only after
          checking the physical player, record its model, firmware, artwork,
          playback, seeking and playlist-order results. This action never marks
          compatibility User-tested automatically.
        </p>
      </section>
      <div className="form-grid">
        <label className="field">
          Model
          <input
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setTested(false);
              setTestResults("");
            }}
          />
        </label>
        <label className="field">
          Firmware / iOS version
          <input
            value={firmware}
            onChange={(e) => {
              setFirmware(e.target.value);
              setTested(false);
              setTestResults("");
            }}
          />
        </label>
      </div>
      <label className="field">
        Output format
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as Format)}
        >
          {Object.entries(formats)
            .filter(
              ([key]) =>
                target.transport !== "imazing" ||
                ["mp3", "aac", "alac"].includes(key),
            )
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
      </label>
      <p className="small muted">
        Compatible MP3 files are reused without another lossy encode. Converting
        a lossy source to FLAC or ALAC does not restore lost quality.
      </p>
      <details>
        <summary>Advanced profile</summary>
        <div className="form-grid">
          <label className="field">
            MP3 tag version
            <select
              value={mp3TagVersion}
              onChange={(e) =>
                setMp3TagVersion(Number(e.target.value) as 3 | 4)
              }
            >
              <option value={3}>ID3v2.3 · older-player baseline</option>
              <option value={4}>ID3v2.4 · test your player</option>
            </select>
          </label>
          <label className="field">
            Maximum filename (UTF-8 bytes)
            <input
              type="number"
              min={80}
              max={180}
              value={filenameLimit}
              onChange={(e) => setFilenameLimit(Number(e.target.value))}
            />
          </label>
          <label className="field">
            Maximum complete path (UTF-8 bytes)
            <input
              type="number"
              min={180}
              max={1024}
              value={pathLimit}
              onChange={(e) => setPathLimit(Number(e.target.value))}
            />
          </label>
          <label className="field">
            Playlist line endings
            <select
              value={playlistNewline}
              onChange={(e) =>
                setPlaylistNewline(e.target.value as "LF" | "CRLF")
              }
            >
              <option value="LF">LF</option>
              <option value="CRLF">CRLF</option>
            </select>
          </label>
          <label className="field">
            Lossy bitrate (kbps)
            <select
              value={bitrate}
              onChange={(e) => setBitrate(Number(e.target.value))}
            >
              {[128, 160, 192, 256, 320].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Conversion sample rate (Hz)
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(Number(e.target.value))}
            >
              {[44100, 48000].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Maximum artwork dimension (px)
            <input
              type="number"
              min={100}
              max={1200}
              value={artworkSize}
              onChange={(e) => setArtworkSize(Number(e.target.value))}
            />
          </label>
          <label className="field">
            Maximum artwork bytes
            <input
              type="number"
              min={10000}
              max={2000000}
              value={artworkBytes}
              onChange={(e) => setArtworkBytes(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="small muted">
          Playlist encoding: UTF-8 (supported fixed format). Primary M3U8 uses
          the selected line endings; optional legacy M3U uses CRLF. Byte limits
          are conservative across platforms; a long destination can require a
          higher path limit.
        </p>
        <label className="check-line">
          <input
            type="checkbox"
            checked={orderTags}
            onChange={(e) => setOrderTags(e.target.checked)}
          />
          Write playlist position/total into exported copies only
        </label>
        <p className="small muted">
          Ordered copies get per-occurrence track numbers and disc 1/1. Archive
          album numbers stay unchanged; these copies are not reused across
          batches. Player ordering still needs a physical test.
        </p>
        <p className="small muted">
          Bitrate/sample rate apply when conversion is needed. Compatible audio
          is copied. Profile revision {target.profile.revision}; output changes
          reset hardware compatibility to Baseline.
        </p>
        <label className="check-line">
          <input
            type="checkbox"
            checked={legacy}
            onChange={(e) => setLegacy(e.target.checked)}
          />
          Also write a legacy M3U playlist
        </label>
      </details>
      <label className="field">
        Physical player test results
        <textarea
          value={testResults}
          maxLength={4000}
          onChange={(e) => setTestResults(e.target.value)}
          placeholder="Record playback, seeking, non-ASCII tags, artwork and repeated A/B/A playlist order results."
        />
      </label>
      <label className="check-line">
        <input
          type="checkbox"
          checked={tested}
          onChange={(e) => setTested(e.target.checked)}
        />
        I tested this saved profile on the named physical player and firmware.
      </label>
      <p className="small muted">
        Save output changes first, then test that saved profile and record the
        results. Preparing synthetic files alone is not a hardware test.
      </p>
      <button
        onClick={() =>
          run("targets.update", {
            id: target.id,
            profile: {
              format,
              model,
              firmware,
              bitrate,
              sampleRate,
              artworkSize,
              artworkBytes,
              mp3TagVersion,
              filenameLimit,
              pathLimit,
              playlistEncoding: "utf8",
              playlistNewline,
              orderTags,
              compatibility: tested ? "User-tested" : "Baseline",
              testResults,
              legacyPlaylist: legacy,
            },
          })
        }
      >
        Save compatibility profile
      </button>
    </>
  );
}

export function TargetSetup({
  run,
  onClose,
}: {
  run: Run;
  onClose: () => void;
}) {
  const [name, setName] = useState(""),
    [transport, setTransport] = useState<Transport>("imazing"),
    [format, setFormat] = useState<Format>("mp3"),
    [destination, setDestination] = useState(""),
    [budget, setBudget] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [suggested, setSuggested] = useState("");
  // USB targets must be the player's mounted folder; others get a suggested
  // folder under Music/TuneVault/Exports that is created on Add target.
  const usb = transport === "usb";
  const folderName =
    name.trim() || (transport === "imazing" ? "iPod" : "Player");
  useEffect(() => {
    if (usb) return setSuggested("");
    let current = true;
    window.tunevault
      .invoke("defaultFolder", { kind: "export", name: folderName })
      .then((path: string) => current && setSuggested(path))
      .catch(() => current && setSuggested(""));
    return () => {
      current = false;
    };
  }, [usb, folderName]);
  return (
    <Modal
      title="Add export target"
      onClose={onClose}
      actions={
        <button
          className="primary"
          disabled={!name.trim() || (!destination && !suggested) || busy}
          onClick={async () => {
            setError("");
            setBusy(true);
            try {
              if (
                budget &&
                (!Number.isFinite(Number(budget)) || Number(budget) <= 0)
              )
                throw Error("Use a positive storage budget or leave it blank.");
              await run("targets.create", {
                name: name.trim(),
                transport,
                destination:
                  destination ||
                  (await run("defaultFolder", {
                    kind: "export",
                    name: folderName,
                    create: true,
                  })),
                budget: budget ? Math.floor(Number(budget) * 1e6) : null,
                profile: { format },
              });
              onClose();
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Add target
        </button>
      }
    >
      <label className="field">
        How do you add music to this player?
        <select
          value={transport}
          onChange={(e) => {
            setTransport(e.target.value as Transport);
            if (e.target.value === "imazing") setFormat("mp3");
          }}
        >
          {Object.entries(transports).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {transport === "mtp" && (
        <p className="notice">
          Direct MTP transfer is unavailable. This target will use an explicit
          folder handoff.
        </p>
      )}
      <label className="field">
        Target name
        <input
          value={name}
          maxLength={64}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            transport === "imazing" ? "iPod touch · 6th gen" : "Travel player"
          }
        />
      </label>
      <label className="field">
        Destination folder
        <div className="path-picker">
          <input
            value={destination || suggested}
            readOnly
            placeholder={
              usb ? "Choose the player's mounted folder" : "No folder selected"
            }
          />
          <button
            onClick={async () => {
              const path = await run("chooseTargetFolder");
              if (path) setDestination(path);
            }}
          >
            Choose…
          </button>
        </div>
      </label>
      {!destination && suggested && (
        <p className="small muted">
          Suggested folder. TuneVault creates it when you add this target.
        </p>
      )}
      <details>
        <summary>Profile and storage budget</summary>
        <label className="field">
          Output profile
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as Format)}
          >
            {Object.entries(formats)
              .filter(
                ([key]) =>
                  transport !== "imazing" ||
                  ["mp3", "aac", "alac"].includes(key),
              )
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          Optional budget (MB)
          <input
            type="number"
            min="1"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="No budget set"
          />
        </label>
        <p className="small muted">
          Budget is a limit, not detected capacity. Exports check real
          destination free space and never delete unknown files.
        </p>
      </details>
      <p className="small muted">
        Compatibility starts as Baseline. A preset name does not establish
        hardware verification.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

export function ExportDialog({
  snapshot,
  targetId,
  trackIds,
  playlistId,
  run,
  onClose,
}: {
  snapshot: Snapshot;
  targetId: string;
  trackIds?: string[];
  playlistId?: string;
  run: Run;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState(
      targetId || snapshot.targets[0]?.id || "",
    ),
    [plan, setPlan] = useState<ExportPlan | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState<any>(null);
  const input = {
    targetId: chosen,
    ...(playlistId ? { playlistId } : trackIds ? { trackIds } : {}),
  };
  const target = snapshot.targets.find((t) => t.id === chosen);
  const job = done ? snapshot.jobs.find((j) => j.id === done.id) || done : null;
  const complete = job?.status === "completed";
  return (
    <Modal
      title={
        done
          ? complete
            ? "Files prepared"
            : "Export activity"
          : "Review export"
      }
      wide
      onClose={onClose}
      actions={
        !done && (
          <button
            className="primary"
            disabled={
              !chosen ||
              busy ||
              (!playlistId && trackIds !== undefined && !trackIds.length)
            }
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                if (!plan) {
                  setPlan(await run("export.preview", input));
                  return;
                }
                setDone(await run("export.prepare", input));
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? "Working…"
              : plan
                ? "Prepare reviewed files"
                : "Run preflight"}
          </button>
        )
      }
    >
      {!done && (
        <label className="field">
          Export target
          <select
            value={chosen}
            onChange={(e) => {
              setChosen(e.target.value);
              setPlan(null);
            }}
          >
            {snapshot.targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!snapshot.targets.length && (
        <p className="notice">Set up a target in Devices & exports first.</p>
      )}
      {plan && !done && (
        <>
          <dl className="property-list">
            <dt>Selected occurrences</dt>
            <dd>
              {plan.occurrences} · {plan.uniqueMedia} unique media
            </dd>
            <dt>Estimated output</dt>
            <dd>{bytes(plan.estimatedBytes)} · estimate, not a guarantee</dd>
            <dt>Known verified existing audio</dt>
            <dd>
              {bytes(plan.knownBytes)} · selected occurrences already present
            </dd>
            <dt>Configured content budget</dt>
            <dd>{plan.budget === null ? "Not set" : bytes(plan.budget)}</dd>
            <dt>Current measured destination free space</dt>
            <dd>
              {plan.availableBytes === null
                ? "Unavailable"
                : bytes(plan.availableBytes)}
            </dd>
            <dt>Safety reserve</dt>
            <dd>{bytes(plan.safetyReserve)}</dd>
            <dt>Destination</dt>
            <dd className="path-text">{plan.destination}</dd>
          </dl>
          {plan.warning && <p className="notice">{plan.warning}</p>}
          <table className="review-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Track</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {plan.items.map((item, index) => (
                <tr key={item.occurrenceId || index}>
                  <td>{item.action}</td>
                  <td>{item.title}</td>
                  <td>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {plan.omissions.length > 0 && (
            <>
              <h3>Ordered omissions</h3>
              <ol className="reference-list">
                {plan.omissions.map((o) => (
                  <li key={o.ordinal}>
                    Position {o.ordinal}: {o.title} — {o.reason}
                  </li>
                ))}
              </ol>
              <p className="warning">
                This export is incomplete. Omitted occurrences remain in the
                playlist.
              </p>
            </>
          )}
          <p className="small muted">
            No files will be deleted. Exact output bytes are measured before
            committing this batch.
          </p>
        </>
      )}
      {done && !complete && (
        <div className="result-box">
          <strong>
            {job?.status === "failed"
              ? "Export failed"
              : job?.status === "cancelled"
                ? "Export cancelled"
                : job?.status === "interrupted"
                  ? "Export interrupted"
                  : "Preparing files…"}
          </strong>
          <p>
            {job?.message ||
              "The durable export job is queued. Files are not ready until the batch is committed."}
          </p>
          {["running", "queued"].includes(job?.status) && (
            <button onClick={() => run("jobs.cancel", { id: job.id })}>
              Cancel export
            </button>
          )}
          <p className="small muted">
            You can close this dialog and follow the job in Activity. No
            transfer is claimed.
          </p>
        </div>
      )}
      {complete && (
        <>
          <div className="handoff-success">
            <Icon name="folder" size={32} />
            <h3>
              {target?.transport === "usb"
                ? "Copy prepared and verified"
                : "Ready for handoff"}
            </h3>
          </div>
          <p>
            {target?.transport === "imazing"
              ? "Transfer these files with iMazing, check the actual iPod, then mark this batch transferred in the target history. Playlist creation and order need your device check."
              : target?.transport === "mtp"
                ? "Direct MTP is unavailable. Use another transfer application to send this folder to your player."
                : "The export receipt records file preparation. Playback compatibility still needs a device check."}
          </p>
          <button
            onClick={() =>
              run("reveal", {
                targetId: chosen,
                ...(job.payload?.batchId
                  ? { batchId: job.payload.batchId }
                  : {}),
              })
            }
          >
            Reveal prepared folder
          </button>
          <p className="small muted">
            Your canonical archive and unrelated target receipts are preserved.
          </p>
        </>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
