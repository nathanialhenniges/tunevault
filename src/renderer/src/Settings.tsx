import { useEffect, useRef, useState } from "react";
import type { Settings as AppSettings } from "../../shared/types";
import type { Run } from "./Inspector";
import { Icon, message, Modal } from "./ui";
import MetadataSettings from "./MetadataSettings";

export const settingsPanes = [
  ["general", "General", "settings"],
  ["library", "Library", "library"],
  ["sources", "Sources", "music"],
  ["updates", "Updates", "refresh"],
  ["privacy", "Privacy", "shield"],
  ["advanced", "Advanced", "sliders"],
] as const;
export type SettingsPane = (typeof settingsPanes)[number][0];

export default function Settings({
  settings,
  run,
  pane,
  onPane,
  windowed = false,
  onShowGuide,
  demo,
  setDemo,
}: {
  settings: AppSettings;
  run: Run;
  pane: SettingsPane;
  onPane: (pane: SettingsPane) => void;
  windowed?: boolean;
  onShowGuide: () => void;
  demo: boolean;
  setDemo: (v: boolean) => void;
}) {
  const [info, setInfo] = useState<any>(null),
    [toolDiagnostics, setToolDiagnostics] = useState<any>(null),
    [supportReport, setSupportReport] = useState<{
      token: string;
      text: string;
    } | null>(null),
    [reportBusy, setReportBusy] = useState(false),
    [reportError, setReportError] = useState(""),
    [reportSaved, setReportSaved] = useState(false),
    [restorePath, setRestorePath] = useState<string | null>(null),
    [restoreResult, setRestoreResult] = useState<{
      restored: number;
      missing: number;
      recoveryBackup: string;
    } | null>(null),
    [restoreBusy, setRestoreBusy] = useState(false),
    [restoreError, setRestoreError] = useState(""),
    [update, setUpdate] = useState<any>(null),
    [includeMedia, setIncludeMedia] = useState(false),
    [updateBusy, setUpdateBusy] = useState(false),
    [downloadPending, setDownloadPending] = useState(false),
    [credentials, setCredentials] = useState<{
      connected: boolean;
      secureStorage: boolean;
    } | null>(null),
    [credentialBusy, setCredentialBusy] = useState(false),
    [credentialError, setCredentialError] = useState("");
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    run("app.info")
      .then(setInfo)
      .catch(() => {});
    run("credentials.status")
      .then(setCredentials)
      .catch((error) => setCredentialError(message(error)));
  }, []);
  useEffect(() => {
    const refreshStatus = () => {
      run("updates.status")
        .then(setUpdate)
        .catch(() => {});
    };
    refreshStatus();
    return window.tunevault.onChanged(refreshStatus);
  }, [run]);
  async function changeCredentials(action: "connect" | "disconnect") {
    setCredentialBusy(true);
    setCredentialError("");
    try {
      await run(`credentials.${action}`);
      setCredentials(await run("credentials.status"));
    } catch (error) {
      setCredentialError(message(error));
    } finally {
      setCredentialBusy(false);
    }
  }
  function moveTab(step: number) {
    const ids = settingsPanes.map(([id]) => id);
    const next =
      ids[(ids.indexOf(pane) + step + ids.length) % ids.length] || "general";
    onPane(next);
    tabs.current[next]?.focus();
  }
  const title = settingsPanes.find(([id]) => id === pane)?.[1] || "General";
  return (
    <>
      {!windowed && (
        <div className="page-head">
          <div>
            <h1>Settings</h1>
            <p>Choose how TuneVault looks, where it keeps music and more.</p>
          </div>
        </div>
      )}
      <div
        className="settings-tabs"
        role="tablist"
        aria-label="Settings sections"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") moveTab(1);
          else if (e.key === "ArrowLeft" || e.key === "ArrowUp") moveTab(-1);
          else return;
          e.preventDefault();
        }}
      >
        {settingsPanes.map(([id, label, icon]) => (
          <button
            key={id}
            ref={(element) => {
              tabs.current[id] = element;
            }}
            id={`settings-tab-${id}`}
            role="tab"
            aria-selected={pane === id}
            aria-controls="settings-panel"
            tabIndex={pane === id ? 0 : -1}
            className={pane === id ? "selected" : ""}
            onClick={() => onPane(id)}
          >
            <Icon name={icon} size={20} />
            {label}
          </button>
        ))}
      </div>
      <div
        className="settings-sections"
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`settings-tab-${pane}`}
        aria-label={title}
      >
        {pane === "general" && (
          <>
            <section>
              <h2>Appearance</h2>
              <p className="muted">
                Artwork keeps its original colors. System follows your operating
                system.
              </p>
              <div className="form-grid">
                <label className="field">
                  Appearance
                  <select
                    value={settings.appearance}
                    onChange={(e) =>
                      run("settings.update", { appearance: e.target.value })
                    }
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label className="field">
                  Accent
                  <select
                    value={settings.accent}
                    onChange={(e) =>
                      run("settings.update", { accent: e.target.value })
                    }
                  >
                    <option value="blue">Blue</option>
                    <option value="orange">Orange</option>
                  </select>
                </label>
              </div>
            </section>
            <section>
              <h2>Welcome guide</h2>
              <p className="muted">
                Walk through choosing a library folder, adding music and sending
                it to a player again.
              </p>
              <div className="button-row">
                <button onClick={onShowGuide}>Show welcome guide</button>
              </div>
            </section>
          </>
        )}
        {pane === "library" && (
          <>
            <section>
              <h2>Library folder</h2>
              <label className="field">
                Library folder
                <div className="path-picker">
                  <input
                    readOnly
                    value={settings.vault}
                    placeholder="Choose a library folder"
                  />
                  <button
                    onClick={async () => {
                      const path = await run("chooseVault");
                      if (path) await run("settings.update", { vault: path });
                    }}
                  >
                    Choose…
                  </button>
                </div>
              </label>
              <p className="small muted">
                Changing the folder does not move or erase existing music. Back
                up your library before changing storage.
              </p>
            </section>
            <section>
              <h2>Backups</h2>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={includeMedia}
                  onChange={(e) => setIncludeMedia(e.target.checked)}
                />
                Include media in backup (requires enough destination space)
              </label>
              <div className="button-row">
                <button
                  onClick={async () => {
                    const path = await run("chooseBackup");
                    if (path) await run("backup", { path, includeMedia });
                  }}
                >
                  Export backup…
                </button>
                <button
                  onClick={async () => {
                    const path = await run("chooseRestore");
                    if (path) {
                      setRestorePath(path);
                      setRestoreError("");
                      setRestoreResult(null);
                    }
                  }}
                >
                  Restore from backup…
                </button>
              </div>
              {restoreResult && (
                <div className="result-box" role="status">
                  <strong>
                    Restored {restoreResult.restored} track
                    {restoreResult.restored === 1 ? "" : "s"}
                  </strong>
                  <p>
                    {restoreResult.missing} media files are missing. Relink
                    missing files without deleting playlist history.
                  </p>
                  <label className="field">
                    Recovery backup
                    <input readOnly value={restoreResult.recoveryBackup} />
                  </label>
                  <p className="small muted">
                    Keep this recovery bundle until you have checked the
                    restored library.
                  </p>
                </div>
              )}
              <p className="small muted">
                An index-only backup is not an audio backup. Restore validates
                temporary state before replacing the current index.
              </p>
            </section>
          </>
        )}
        {pane === "sources" && (
          <>
            <MetadataSettings settings={settings} run={run} />
            <section>
              <h2>Cookie credentials</h2>
              <p className="muted">
                Optional exported YouTube cookies can authorize requested source
                operations. TuneVault does not automatically collect browser
                cookies.
              </p>
              <div className="notice">
                <strong>Cookies can act as account credentials.</strong>
                <p>
                  Connect only a Netscape-format cookies.txt file you
                  intentionally exported for YouTube. Keep it private; never
                  attach it to a public issue. Connecting credentials does not
                  grant rights to download media.
                </p>
              </div>
              <p role="status">
                {credentials?.connected
                  ? "Connected for requested YouTube operations"
                  : credentials
                    ? "Not connected"
                    : "Checking local credential status…"}
              </p>
              {credentials && !credentials.secureStorage && (
                <p className="warning">
                  OS secure credential storage is unavailable. Connecting
                  cookies is disabled.
                </p>
              )}
              <div className="button-row">
                <button
                  disabled={credentialBusy || !credentials?.secureStorage}
                  onClick={() => changeCredentials("connect")}
                >
                  {credentials?.connected
                    ? "Replace exported YouTube cookies…"
                    : "Connect exported YouTube cookies…"}
                </button>
                <button
                  disabled={credentialBusy || !credentials?.connected}
                  onClick={() => changeCredentials("disconnect")}
                >
                  Disconnect and remove saved credentials
                </button>
              </div>
              <p className="small muted">
                The native file picker and confirmation keep credentials opt-in.
                Saved cookies use OS-backed encryption. Disconnect removes
                TuneVault's encrypted copy and temporary plaintext; your
                original export remains yours to manage.
              </p>
              {credentialError && (
                <p className="inline-error" role="alert">
                  {credentialError}
                </p>
              )}
            </section>
          </>
        )}
        {pane === "updates" && (
          <section>
            <h2>Updates</h2>
            <label className="check-line">
              <input
                type="checkbox"
                checked={settings.autoUpdates}
                onChange={(e) =>
                  run("settings.update", { autoUpdates: e.target.checked })
                }
              />
              Automatically check for app releases
            </label>
            <p className="muted">
              Checks contact GitHub with your IP and release request. Download
              and installation require your choice. Updates pause during active
              media jobs.
            </p>
            <div className="button-row">
              <button
                disabled={
                  updateBusy ||
                  [
                    "downloading",
                    "ready-for-manual-replacement",
                    "ready-to-install",
                  ].includes(update?.status)
                }
                onClick={async () => {
                  setUpdateBusy(true);
                  try {
                    setUpdate(await run("updates.check"));
                  } finally {
                    setUpdateBusy(false);
                  }
                }}
              >
                Check for updates
              </button>
              {update?.status === "available" && (
                <button
                  disabled={updateBusy}
                  onClick={async () => {
                    setUpdateBusy(true);
                    try {
                      setDownloadPending(true);
                      setUpdate(await run("updates.download"));
                    } finally {
                      setUpdateBusy(false);
                      setDownloadPending(false);
                    }
                  }}
                >
                  Download verified installer
                </button>
              )}
              {["ready-for-manual-replacement", "ready-to-install"].includes(
                update?.status,
              ) && (
                <button
                  onClick={() =>
                    run(
                      info?.platform === "win32"
                        ? "updates.install"
                        : "updates.reveal",
                    )
                  }
                >
                  {info?.platform === "win32"
                    ? "Install verified update"
                    : "Reveal verified DMG"}
                </button>
              )}
              {(downloadPending || update?.status === "downloading") && (
                <button
                  onClick={async () => {
                    await run("updates.cancel");
                    setUpdate(await run("updates.status"));
                  }}
                >
                  Cancel download
                </button>
              )}
            </div>
            {(updateBusy || update?.status === "downloading") && (
              <p className="muted" role="status">
                Checking or downloading authenticated release…
              </p>
            )}
            {update && (
              <div className="result-box">
                <strong>
                  {(
                    {
                      unchecked: "No release check this session.",
                      downloading:
                        "Downloading the authenticated installer. It is not ready to install yet.",
                      "not-configured":
                        "Authenticated updates need the publisher’s release public key before use.",
                      current:
                        "You are running the current authenticated release.",
                      available: "A new authenticated release is available.",
                      "ready-for-manual-replacement":
                        "Verified DMG ready. Quit TuneVault, replace the application, then reopen.",
                      "ready-to-install":
                        "Verified installer ready. Install when your media jobs are finished.",
                    } as Record<string, string>
                  )[update.status] ||
                    update.message ||
                    update.status ||
                    "Update check completed"}
                </strong>
                {update.version && <p>Version {update.version}</p>}
                {(update.notes || update.changelog) && (
                  <pre className="description">
                    {update.notes || update.changelog}
                  </pre>
                )}
              </div>
            )}
            <p className="small muted">
              macOS uses a verified DMG and Quit / Replace / Reopen. Installers
              are not Developer ID or Microsoft publisher signed; update
              authentication does not remove OS warnings.
            </p>
          </section>
        )}
        {pane === "privacy" && (
          <>
            <section>
              <h2>Your data</h2>
              <p className="muted">
                Your library, settings and backups stay on this computer.
                TuneVault has no account and sends no analytics. It goes online
                only for update checks and the sources and lookups you ask for.
              </p>
            </section>
            <section>
              <h2>Agreements</h2>
              <p role="status">
                {settings.disclaimerAccepted
                  ? "You accepted the first-run use notice."
                  : "The first-run use notice has not been accepted."}
              </p>
              <p role="status">
                {settings.onlineAcknowledged
                  ? "You acknowledged the online acquisition notice."
                  : "The online acquisition notice will show before your first online download."}
              </p>
              <div className="button-row">
                <button
                  disabled={!settings.onlineAcknowledged}
                  onClick={() =>
                    run("settings.update", { onlineAcknowledged: false })
                  }
                >
                  Show the online notice again
                </button>
              </div>
            </section>
            <section>
              <h2>Documents</h2>
              <div className="button-row">
                <button
                  onClick={() => run("openLegal", { document: "privacy" })}
                >
                  Privacy policy
                </button>
                <button onClick={() => run("openLegal", { document: "terms" })}>
                  Terms of use
                </button>
              </div>
              <p className="small muted">
                Legal documents are drafts for review.
              </p>
            </section>
          </>
        )}
        {pane === "advanced" && (
          <>
            <section>
              <h2>Support report</h2>
              <p className="muted">
                Preview a report limited to library counts, runtime and
                bundled-tool information. Save only after reviewing the exact
                text below.
              </p>
              <p className="small muted">
                GitHub Issues are public. Review the report before sharing it,
                and never post credentials, cookies, private paths or unredacted
                logs.
              </p>
              <div className="button-row">
                <button
                  disabled={reportBusy}
                  onClick={async () => {
                    setReportBusy(true);
                    setReportError("");
                    setReportSaved(false);
                    try {
                      setSupportReport(await run("diagnostics.preview"));
                    } catch (error) {
                      setReportError(message(error));
                    } finally {
                      setReportBusy(false);
                    }
                  }}
                >
                  Preview support report
                </button>
                {supportReport && (
                  <button
                    disabled={reportBusy}
                    onClick={async () => {
                      setReportBusy(true);
                      setReportError("");
                      setReportSaved(false);
                      try {
                        const result = await run("diagnostics.export", {
                          token: supportReport.token,
                        });
                        if (result !== null) setReportSaved(true);
                      } catch (error) {
                        setReportError(message(error));
                      } finally {
                        setReportBusy(false);
                      }
                    }}
                  >
                    Save reviewed report…
                  </button>
                )}
              </div>
              {supportReport && (
                <pre
                  className="diagnostics"
                  aria-label="Support report preview"
                  tabIndex={0}
                >
                  {supportReport.text}
                </pre>
              )}
              {reportSaved && <p role="status">Reviewed report saved.</p>}
              {reportError && (
                <p className="inline-error" role="alert">
                  {reportError}
                </p>
              )}
            </section>
            <section>
              <h2>Runtime & bundled tools</h2>
              {info ? (
                <dl className="property-list">
                  <dt>Version</dt>
                  <dd>{info.version}</dd>
                  <dt>Platform</dt>
                  <dd>
                    {info.platform === "darwin"
                      ? "macOS"
                      : info.platform === "win32"
                        ? "Windows"
                        : info.platform}{" "}
                    · {info.arch}
                  </dd>
                  <dt>Node.js</dt>
                  <dd>{info.runtime?.node || "Unknown"}</dd>
                  <dt>Liquid Glass</dt>
                  <dd>{info.nativeGlass ? "On" : "Off"}</dd>
                </dl>
              ) : (
                <p className="muted">App information unavailable.</p>
              )}
              {toolDiagnostics && (
                <pre className="diagnostics" tabIndex={0}>
                  {JSON.stringify(toolDiagnostics, null, 2)}
                </pre>
              )}
              <div className="button-row">
                <button
                  onClick={async () => {
                    const diagnostics = await run("diagnostics");
                    setToolDiagnostics(diagnostics);
                  }}
                >
                  Run tool diagnostics
                </button>
              </div>
            </section>
            <section>
              <h2>Design fixtures</h2>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={demo}
                  onChange={(e) => setDemo(e.target.checked)}
                />
                Show the fictional design library
              </label>
              <p className="small muted">
                Six AI-generated demo covers and two missing-art cases.
                Read-only fixtures contain no music and are never added to your
                actual library.
              </p>
            </section>
          </>
        )}
      </div>
      {restorePath && (
        <Modal
          title="Review library restore"
          dismissible={!restoreBusy}
          onClose={() => {
            if (!restoreBusy) setRestorePath(null);
          }}
          actions={
            <button
              className="primary"
              disabled={restoreBusy}
              onClick={async () => {
                setRestoreBusy(true);
                setRestoreError("");
                try {
                  const result = await run("restore", { path: restorePath });
                  setRestoreResult(result);
                  setRestorePath(null);
                } catch (error) {
                  setRestoreError(message(error));
                } finally {
                  setRestoreBusy(false);
                }
              }}
            >
              Restore selected backup
            </button>
          }
        >
          <p>
            This replaces the current library index, settings and receipts with
            the selected backup after validation. A recovery bundle of the
            current state is saved first. Existing audio files are preserved.
          </p>
          <label className="field">
            Selected backup folder
            <input readOnly value={restorePath} />
          </label>
          <p className="small muted">
            An index-only backup cannot restore missing audio. Review the
            selected folder before continuing.
          </p>
          {restoreBusy && (
            <p role="status">Validating and restoring the selected backup…</p>
          )}
          {restoreError && (
            <p className="inline-error" role="alert">
              {restoreError}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
