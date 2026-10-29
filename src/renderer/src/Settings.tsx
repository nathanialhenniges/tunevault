import { useEffect, useState } from "react";
import type { Settings as AppSettings } from "../../shared/types";
import type { Run } from "./Inspector";
import { message } from "./ui";
import logo from "./assets/branding/tunevault-wolf-concept.png";

export default function Settings({
  settings,
  run,
  demo,
  setDemo,
}: {
  settings: AppSettings;
  run: Run;
  demo: boolean;
  setDemo: (v: boolean) => void;
}) {
  const [info, setInfo] = useState<any>(null),
    [update, setUpdate] = useState<any>(null),
    [includeMedia, setIncludeMedia] = useState(false),
    [updateBusy, setUpdateBusy] = useState(false),
    [credentials, setCredentials] = useState<{
      connected: boolean;
      secureStorage: boolean;
    } | null>(null),
    [credentialBusy, setCredentialBusy] = useState(false),
    [credentialError, setCredentialError] = useState("");
  useEffect(() => {
    run("app.info")
      .then(setInfo)
      .catch(() => {});
    run("credentials.status")
      .then(setCredentials)
      .catch((error) => setCredentialError(message(error)));
  }, []);
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
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings & About</h1>
          <p>Your archive, appearance and app information.</p>
        </div>
      </div>
      <div className="settings-sections">
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
          <h2>Library & backups</h2>
          <label className="field">
            Canonical archive folder
            <div className="path-picker">
              <input
                readOnly
                value={settings.vault}
                placeholder="Choose a vault location"
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
            Changing the folder does not move or erase existing music. Back up
            your archive before changing storage.
          </p>
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
                if (path) await run("restore", { path });
              }}
            >
              Restore validated backup…
            </button>
          </div>
          <p className="small muted">
            An index-only backup is not an audio backup. Restore validates
            temporary state before replacing the current index.
          </p>
        </section>
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
              Connect only a Netscape-format cookies.txt file you intentionally
              exported for YouTube. Keep it private; never attach it to a public
              issue. Connecting credentials does not grant rights to download
              media.
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
              OS secure credential storage is unavailable. Connecting cookies is
              disabled.
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
            TuneVault's encrypted copy and temporary plaintext; your original
            export remains yours to manage.
          </p>
          {credentialError && (
            <p className="inline-error" role="alert">
              {credentialError}
            </p>
          )}
        </section>
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
            Checks contact GitHub with your IP and app version. Download and
            installation require your choice. Updates pause during active media
            jobs.
          </p>
          <div className="button-row">
            <button
              disabled={updateBusy}
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
                    setUpdate(await run("updates.download"));
                  } finally {
                    setUpdateBusy(false);
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
            {updateBusy && (
              <button onClick={() => run("updates.cancel")}>
                Cancel update operation
              </button>
            )}
          </div>
          {updateBusy && (
            <p className="muted" role="status">
              Checking or downloading authenticated release…
            </p>
          )}
          {update && (
            <div className="result-box">
              <strong>
                {(
                  {
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
        <section className="about-section">
          <div className="about-brand">
            <img src={logo} alt="TuneVault blue wolf logo" />
            <div>
              <h2>TuneVault</h2>
              <p>
                {info?.version
                  ? `Version ${info.version}`
                  : "Local music archive & portable-player library"}
              </p>
              <p className="small muted">
                Published by Nathanial Henniges · MIT app license
              </p>
            </div>
          </div>
          <div className="button-row">
            <button onClick={() => run("openLegal", { document: "terms" })}>
              Terms of use
            </button>
            <button onClick={() => run("openLegal", { document: "privacy" })}>
              Privacy
            </button>
            <button
              onClick={() => run("openLegal", { document: "third-party" })}
            >
              Third-party notices
            </button>
            <button onClick={() => run("openLegal", { document: "install" })}>
              Install & update help
            </button>
          </div>
          <p className="small muted">
            Legal documents are drafts for review. The blue wolf logo and
            fictional fixture artwork were AI-generated; their original PNG
            provenance is retained. App code is MIT; bundled third-party tools
            retain their own licenses.
          </p>
          <button
            onClick={() =>
              run("openExternal", {
                url: "https://github.com/nathanialhenniges/tunevault/issues",
              })
            }
          >
            Contact through GitHub Issues
          </button>
          <p className="small muted">
            Never post cookies, credentials, private library paths or unredacted
            logs in public issues.
          </p>
          <details>
            <summary>Runtime & bundled tools</summary>
            <pre className="diagnostics">
              {info
                ? JSON.stringify(info, null, 2)
                : "App information unavailable."}
            </pre>
            <button
              onClick={async () => {
                const diagnostics = await run("diagnostics");
                setInfo(diagnostics);
              }}
            >
              Run tool diagnostics
            </button>
          </details>
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
            Six supplied generated covers and two missing-art cases. Read-only
            fixtures contain no music and are never added to your actual
            library.
          </p>
        </section>
      </div>
    </>
  );
}
