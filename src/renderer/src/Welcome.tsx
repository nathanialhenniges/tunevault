import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { CURRENT_DISCLAIMER_VERSION, type Settings } from "../../shared/types";
import { bytes, Icon, message, OperationErrorContext } from "./ui";
import "./welcome.css";

type Run = (action: string, input?: unknown) => Promise<any>;
export type AddInput =
  | { kind: "files"; paths: string[] }
  | { kind: "references"; text: string; format: string; name: string };

export function Splash({ logo, status }: { logo: string; status: string }) {
  return (
    <main className="splash" aria-busy="true">
      <img className="splash-logo" src={logo} alt="" />
      <h1>TuneVault</h1>
      <div className="splash-progress" aria-hidden="true">
        <span />
      </div>
      <p className="muted" role="status">
        {status}
      </p>
    </main>
  );
}

export function Disclaimer({ logo, run }: { logo: string; run: Run }) {
  const [pane, setPane] = useState<"welcome" | "consent">("welcome");
  const [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false);
  const error = useContext(OperationErrorContext);
  const heading = useRef<HTMLHeadingElement>(null),
    container = useRef<HTMLElement>(null);
  const headingId = useId();
  useEffect(() => heading.current?.focus(), [pane]);
  return (
    <main
      className="first-run welcome-window"
      aria-labelledby={headingId}
      ref={container}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
        }
        if (event.key !== "Tab") return;
        const controls = [
          ...container.current!.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),a[href]",
          ),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === heading.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <section className="welcome-window-card">
        <header className="welcome-identity">
          <img src={logo} alt="" width="96" height="96" />
          <p className="small muted">Your music. Your library.</p>
          <h1 id={headingId} ref={heading} tabIndex={-1}>
            {pane === "welcome"
              ? "Welcome to TuneVault"
              : "Use it for music you own"}
          </h1>
        </header>
        <p className="sr-only" role="status">
          {pane === "welcome"
            ? "Step 1 of 2: Welcome"
            : "Step 2 of 2: Authorized use"}
        </p>
        {pane === "welcome" ? (
          <>
            <p className="welcome-intro">
              Keep your own music organized, tagged and ready for your iPod or
              MP3 player.
            </p>
            <ul className="welcome-assurances">
              <li>
                <Icon name="shield" />
                <span>Stays on this computer. No account, no analytics.</span>
              </li>
              <li>
                <Icon name="folder" />
                <span>Your original files are never changed.</span>
              </li>
              <li>
                <Icon name="refresh" />
                <span>Review your edits. Undo them when you need to.</span>
              </li>
            </ul>
          </>
        ) : (
          <div className="welcome-consent">
            <p>
              Only add music you own or are licensed to keep. You are
              responsible for what you copy and transfer. Personal or
              educational use is not a legal exception.
            </p>
            <p>
              TuneVault is a free, open-source personal project by Nathanial
              Henniges, provided as is without warranty.
            </p>
            <p className="small muted">
              Not affiliated with Apple, Spotify, YouTube, Google, SoundCloud or
              iMazing.
            </p>
            <p className="welcome-legal">
              <button
                className="link"
                onClick={() => run("openLegal", { document: "terms" })}
              >
                Terms of use
              </button>
              <span aria-hidden="true">·</span>
              <button
                className="link"
                onClick={() => run("openLegal", { document: "privacy" })}
              >
                Privacy policy
              </button>
            </p>
            <label className="welcome-agreement">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>
                I understand and will only use TuneVault for music I have the
                right to keep.
              </span>
            </label>
          </div>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <footer className="welcome-actions">
          <button onClick={() => window.close()}>Quit</button>
          <span className="spacer" />
          {pane === "consent" && (
            <button disabled={busy} onClick={() => setPane("welcome")}>
              Back
            </button>
          )}
          {pane === "welcome" ? (
            <button className="primary" onClick={() => setPane("consent")}>
              Continue
            </button>
          ) : (
            <button
              className="primary"
              disabled={!agreed || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await run("settings.update", {
                    disclaimerAccepted: true,
                    disclaimerVersion: CURRENT_DISCLAIMER_VERSION,
                  });
                } catch {
                  /* Keep the saved-operation error beside the action. */
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Agree and continue"}
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}

export function Onboarding({
  settings,
  logo,
  run,
  onFinish,
  onAdd,
  pendingPaths = [],
}: {
  settings: Settings;
  logo: string;
  run: Run;
  onFinish: () => void;
  onAdd: (input: AddInput) => void;
  pendingPaths?: string[];
}) {
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [suggested, setSuggested] = useState<{
    path: string;
    availableBytes: number | null;
    exists: boolean;
  } | null>(null);
  const [vault, setVault] = useState<{
    path: string;
    available: boolean;
    availableBytes: number | null;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const ready = !!vault?.available && vault.path === settings.vault;
  useLayoutEffect(() => {
    if (!dialog.current?.open) {
      opener.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    }
    heading.current?.focus();
  }, [step]);
  useEffect(
    () => () => {
      dialog.current?.close();
      if (opener.current?.isConnected) opener.current.focus();
    },
    [],
  );
  useEffect(() => {
    let current = true;
    void Promise.all([
      run("defaultFolder", { kind: "vault", info: true }),
      run("vault.status"),
    ])
      .then(([proposal, status]) => {
        if (current) {
          setSuggested(proposal);
          setVault(status);
        }
      })
      .catch((reason) => {
        if (current) setError(message(reason));
      });
    return () => {
      current = false;
    };
  }, [settings.vault, run]);
  async function execute(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  async function choose(useDefault: boolean) {
    await execute(async () => {
      const path = await run(
        useDefault ? "defaultFolder" : "chooseVault",
        useDefault ? { kind: "vault", create: true } : undefined,
      );
      if (!path) return;
      await run("settings.update", { vault: path });
      setVault(await run("vault.status"));
    });
  }
  async function pick(folder = false) {
    await execute(async () => {
      const selected = await run(
        folder ? "chooseImportFolder" : "chooseImport",
      );
      const paths = Array.isArray(selected)
        ? selected
        : selected
          ? [selected]
          : [];
      if (paths.length) onAdd({ kind: "files", paths });
    });
  }
  return (
    <dialog
      ref={dialog}
      className="modal setup-sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onFinish();
      }}
    >
      <header className="setup-heading">
        <img src={logo} alt="" width="42" height="42" />
        <div>
          <p className="small muted">Welcome guide</p>
          <h2 id={titleId}>Set up your library</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close setup"
          disabled={busy}
          onClick={onFinish}
        >
          <Icon name="close" />
        </button>
      </header>
      <ol className="setup-progress" aria-label="Library setup tasks">
        <li
          className={step === 0 ? "current" : "done"}
          aria-current={step === 0 ? "step" : undefined}
        >
          <span>{ready ? <Icon name="check" size={15} /> : "1"}</span>Choose
          your library folder
        </li>
        <li
          className={step === 1 ? "current" : ""}
          aria-current={step === 1 ? "step" : undefined}
        >
          <span>2</span>Add your music
        </li>
      </ol>
      <div className="setup-content">
        <p className="sr-only" role="status">
          Step {step + 1} of 2:{" "}
          {step === 0 ? "Choose your library folder" : "Add your music"}
        </p>
        <h3 ref={heading} tabIndex={-1}>
          {step === 0 ? "Choose your library folder" : "Add your music"}
        </h3>
        {step === 0 ? (
          <>
            <p>
              TuneVault keeps managed copies here. Your original files stay
              where they are.
            </p>
            <label className="field">
              Library folder
              <input
                readOnly
                value={
                  settings.vault ||
                  suggested?.path ||
                  "Finding your Music folder…"
                }
              />
            </label>
            <p className="small muted">
              {ready
                ? "Ready to use"
                : settings.vault
                  ? "Your saved library folder is unavailable. Choose its location to continue."
                  : "Suggested folder · created only when you choose it"}
              {(ready ? vault?.availableBytes : suggested?.availableBytes) !=
              null
                ? ` · ${bytes((ready ? vault!.availableBytes : suggested!.availableBytes)!)} free on this disk`
                : ""}
            </p>
            <div className="button-row">
              {!ready && (
                <button
                  className="primary"
                  disabled={busy || !suggested}
                  onClick={() => choose(true)}
                >
                  Use this folder
                </button>
              )}
              <button disabled={busy} onClick={() => choose(false)}>
                Choose another…
              </button>
            </div>
            <p className="setup-footnote small muted">
              You can move the library folder later in Settings. Keep enough
              space for your music and saved revisions.
            </p>
          </>
        ) : (
          <>
            <p>
              Bring in owned or licensed files. You will review the selection
              before copying.
            </p>
            <div
              className={`setup-drop-zone ${dragging ? "dragging" : ""}`}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("Files")) {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragging(true);
                }
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragging(false);
                if (!ready || busy) return;
                const files = Array.from(event.dataTransfer.files);
                void execute(async () => {
                  const paths = await window.tunevault.droppedPaths(files);
                  if (paths.length) onAdd({ kind: "files", paths });
                });
              }}
            >
              <Icon name="music" size={30} />
              <strong>Drop music files or folders here</strong>
              <span className="small muted">
                Or choose what to bring into your library folder.
              </span>
              <div className="button-row">
                <button
                  className="primary"
                  disabled={!ready || busy}
                  onClick={() => pick()}
                >
                  Choose files…
                </button>
                <button disabled={!ready || busy} onClick={() => pick(true)}>
                  Choose folder…
                </button>
              </div>
              {pendingPaths.length > 0 && (
                <button
                  disabled={!ready || busy}
                  onClick={() => onAdd({ kind: "files", paths: pendingPaths })}
                >
                  Review {pendingPaths.length} dropped{" "}
                  {pendingPaths.length === 1 ? "file" : "files"}
                </button>
              )}
            </div>
            <button
              className="setup-reference-button"
              disabled={!ready || busy}
              onClick={() =>
                execute(async () => {
                  const path = await run("chooseReference");
                  if (path) {
                    const file = await run("references.readFile", { path });
                    onAdd({
                      kind: "references",
                      text: file.text,
                      format: file.format,
                      name: file.name,
                    });
                  }
                })
              }
            >
              Import playlist file…
              <Icon name="arrow" size={16} />
            </button>
            <p className="small muted">
              CSV/TSV, M3U, Spotify JSON or Apple Music XML. Playlist references
              do not download audio.
            </p>
          </>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className="small muted">
            Working…
          </p>
        )}
      </div>
      <footer className="modal-actions">
        <button className="quiet" disabled={busy} onClick={onFinish}>
          Later
        </button>
        <span className="spacer" />
        {step === 1 && (
          <button disabled={busy} onClick={() => setStep(0)}>
            Back
          </button>
        )}
        {step === 0 ? (
          <button
            className="primary"
            disabled={!ready || busy}
            onClick={() => setStep(1)}
          >
            Next
          </button>
        ) : (
          <button
            className="primary"
            disabled={!ready || busy}
            onClick={onFinish}
          >
            Open library
          </button>
        )}
      </footer>
    </dialog>
  );
}

export function ContextTip({
  id,
  anchor,
  children,
  onDismiss,
}: {
  id: string;
  anchor: string;
  children: string;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<CSSProperties>({
    visibility: "hidden",
  });
  useLayoutEffect(() => {
    const element = document.querySelector<HTMLElement>(anchor);
    if (!element) return;
    const previous = element.getAttribute("aria-describedby");
    element.setAttribute(
      "aria-describedby",
      [previous, id].filter(Boolean).join(" "),
    );
    const layout = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.min(300, innerWidth - 32);
      const height = ref.current?.offsetHeight || 110;
      setPosition({
        left: Math.max(
          16,
          Math.min(
            rect.left + rect.width / 2 - width / 2,
            innerWidth - width - 16,
          ),
        ),
        top: Math.max(
          16,
          Math.min(rect.bottom + 12, innerHeight - height - 16),
        ),
        width,
      });
    };
    layout();
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", layout, true);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }
    };
    document.addEventListener("keydown", escape, true);
    return () => {
      if (previous) element.setAttribute("aria-describedby", previous);
      else element.removeAttribute("aria-describedby");
      window.removeEventListener("resize", layout);
      window.removeEventListener("scroll", layout, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [anchor, id, onDismiss]);
  return (
    <aside
      ref={ref}
      id={id}
      className="context-tip"
      role="note"
      style={position}
    >
      <p role="status">{children}</p>
      <button onClick={onDismiss}>Got it</button>
    </aside>
  );
}
