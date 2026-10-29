import { useState } from "react";
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
import { receiptIsCurrent } from "./library-state";

const transports: Record<Transport, string> = {
  imazing: "iMazing / Apple-library handoff",
  usb: "USB drive / SD card",
  folder: "Folder / external transfer app",
  mtp: "Android / MTP · folder fallback",
};
const formats: Record<Format, string> = {
  original: "Original available format",
  mp3: "MP3 · 192 kbps · ID3v2.3",
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
                  <dd>{formats[target.profile.format]}</dd>
                  <dt>Configured budget</dt>
                  <dd>
                    {target.budget ? bytes(target.budget) : "Not set"} · not
                    detected capacity
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
                    const first = rows[0];
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
                            {rows.length} unique track
                            {rows.length === 1 ? "" : "s"} ·{" "}
                            {new Date(first.createdAt).toLocaleString()}
                          </p>
                          <span className="small muted">
                            Batch {batchId.slice(0, 8)}
                          </span>
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
              <>
                <p className="muted">
                  This target's receipts apply only to the exact metadata and
                  profile revisions below. Old history remains available after
                  edits.
                </p>
                <table className="review-table">
                  <thead>
                    <tr>
                      <th>Track</th>
                      <th>Revision</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {snapshot.tracks.find((t) => t.id === r.trackId)
                            ?.metadata.title || "Missing track"}
                        </td>
                        <td>
                          {r.trackRevision} / profile {r.profileRevision}
                        </td>
                        <td>
                          {evidence[r.evidence]}
                          {(() => {
                            const track = snapshot.tracks.find(
                              (t) => t.id === r.trackId,
                            );
                            return (
                              !track ||
                              !receiptIsCurrent(
                                track,
                                target,
                                r,
                                snapshot.playlists,
                              )
                            );
                          })()
                            ? " · changed"
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!receipts.length && (
                  <p>No content has been prepared for this target.</p>
                )}
              </>
            )}
            {tab === "compatibility" && (
              <Compatibility key={target.id} target={target} jobs={snapshot.jobs} run={run} />
            )}
          </article>
        </div>
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
function Compatibility({ target, jobs, run }: { target: Target; jobs: Job[]; run: Run }) {
  const [model, setModel] = useState(target.profile.model),
    [firmware, setFirmware] = useState(target.profile.firmware),
    [format, setFormat] = useState<Format>(target.profile.format),
    [legacy, setLegacy] = useState(target.profile.legacyPlaylist),
    [queuedTest, setQueuedTest] = useState<Job | null>(null),
    [testBusy, setTestBusy] = useState(false),
    [testError, setTestError] = useState("");
  const testJob = jobs.find((job) => job.id === queuedTest?.id) ||
    jobs.filter((job) => job.payload.compatibilityTest === true && job.payload.targetId === target.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || queuedTest;
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
              setQueuedTest(await run("targets.testPack", { targetId: target.id }));
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
            <p role="status">
              Synthetic compatibility test · {testJob.status}
            </p>
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
        {testError && <p className="inline-error" role="alert">{testError}</p>}
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
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        </label>
        <label className="field">
          Firmware / iOS version
          <input
            value={firmware}
            onChange={(e) => setFirmware(e.target.value)}
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
        <dl className="property-list">
          <dt>Sample rate</dt>
          <dd>{target.profile.sampleRate} Hz when conversion is required</dd>
          <dt>Artwork cap</dt>
          <dd>
            {target.profile.artworkSize}px /{" "}
            {bytes(target.profile.artworkBytes)} · proposed older-player
            baseline
          </dd>
          <dt>Profile revision</dt>
          <dd>{target.profile.revision}</dd>
        </dl>
        <label className="check-line">
          <input
            type="checkbox"
            checked={legacy}
            onChange={(e) => setLegacy(e.target.checked)}
          />
          Also write a legacy M3U playlist
        </label>
      </details>
      <button
        onClick={() =>
          run("targets.update", {
            id: target.id,
            name: target.name,
            transport: target.transport,
            destination: target.destination,
            budget: target.budget,
            profile: {
              ...target.profile,
              format,
              model,
              firmware,
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
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Add export target"
      onClose={onClose}
      actions={
        <button
          className="primary"
          disabled={!name.trim() || !destination || busy}
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
                destination,
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
            value={destination}
            readOnly
            placeholder="No folder selected"
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
  trackIds: string[];
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
    ...(playlistId ? { playlistId } : { trackIds }),
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
            disabled={!chosen || busy || (!playlistId && !trackIds.length)}
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
            <dt>Available space</dt>
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
