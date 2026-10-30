import { useEffect, useId, useRef, useState } from "react";
import type { Settings } from "../../shared/types";
import { Icon } from "./ui";

type Run = (action: string, input?: unknown) => Promise<any>;

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
  const [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false);
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="first-run" aria-labelledby={headingId}>
      <section className="first-run-card">
        <img className="first-run-logo" src={logo} alt="" />
        <h1 id={headingId} ref={heading} tabIndex={-1}>
          Before you start
        </h1>
        <p>
          TuneVault is a personal and educational project by Nathanial Henniges.
          It is free, open source and provided as is, without support or
          warranty.
        </p>
        <ul className="first-run-points">
          <li>
            Only use it for music you own or are licensed to keep. Downloading
            content you have no right to copy may break a service's terms and
            the copyright law where you live.
          </li>
          <li>
            Personal or educational use is not a legal exception. You are
            responsible for what you download, copy and transfer.
          </li>
          <li>
            TuneVault is not affiliated with, endorsed by or connected to Apple,
            Spotify, YouTube, Google, SoundCloud or iMazing.
          </li>
          <li>
            Your library stays on this computer. TuneVault has no account and
            sends no analytics.
          </li>
        </ul>
        <p className="small">
          Read the{" "}
          <button
            className="link"
            onClick={() => run("openLegal", { document: "terms" })}
          >
            Terms of use
          </button>{" "}
          and{" "}
          <button
            className="link"
            onClick={() => run("openLegal", { document: "privacy" })}
          >
            Privacy policy
          </button>
          .
        </p>
        <label className="first-run-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          I understand and will only use TuneVault for music I have the right to
          keep.
        </label>
        <div className="first-run-actions">
          <button onClick={() => window.close()}>Quit</button>
          <button
            className="primary"
            disabled={!agreed || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await run("settings.update", { disclaimerAccepted: true });
              } finally {
                setBusy(false);
              }
            }}
          >
            Agree and continue
          </button>
        </div>
      </section>
    </main>
  );
}

const steps = [
  {
    icon: "library",
    title: "Welcome to TuneVault",
    body: "Your music library, kept on your own computer. Organize and tag your music, build playlists, then send them to an iPod, an MP3 player or any folder.",
  },
  {
    icon: "folder",
    title: "Choose your vault",
    body: "The vault is the folder where TuneVault keeps a safe copy of every track. Pick a folder with plenty of free space. You can move it later in Settings.",
  },
  {
    icon: "plus",
    title: "Add music",
    body: "Drag files or folders onto the window, or use Add music… to import files, folders or a link to music you have the right to keep. TuneVault reads tags and artwork as it goes.",
  },
  {
    icon: "playlist",
    title: "Build playlists",
    body: "Create playlists, drag to reorder them and fix tags in the details panel. Every edit can be reviewed before saving and undone afterwards.",
  },
  {
    icon: "device",
    title: "Send to your devices",
    body: "In Devices & exports, add each player once. Prepare export shows exactly what will be copied, converted or skipped before anything is written.",
  },
  {
    icon: "check",
    title: "You're all set",
    body: "Back up your library from Settings & About. You can reopen this guide there at any time.",
  },
];

export function Onboarding({
  settings,
  run,
  onFinish,
  onAddMusic,
}: {
  settings: Settings;
  run: Run;
  onFinish: () => void;
  onAddMusic: () => void;
}) {
  const [step, setStep] = useState(0);
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => opener?.focus();
  }, []);
  const current = steps[step];
  const last = step === steps.length - 1;
  return (
    <dialog
      ref={dialog}
      className="modal onboarding"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onFinish();
      }}
    >
      <div className="onboarding-body">
        <span className="onboarding-icon" aria-hidden="true">
          <Icon name={current.icon} size={28} />
        </span>
        <p className="small muted">
          Step {step + 1} of {steps.length}
        </p>
        <h2 id={titleId}>{current.title}</h2>
        <p>{current.body}</p>
        {current.icon === "folder" && (
          <div className="onboarding-vault">
            <input
              readOnly
              aria-label="Vault folder"
              value={settings.vault || "No vault chosen yet"}
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
        )}
        <div className="onboarding-dots" aria-hidden="true">
          {steps.map((item, index) => (
            <span key={item.title} className={index === step ? "on" : ""} />
          ))}
        </div>
      </div>
      <footer className="modal-actions">
        {!last && (
          <button className="quiet" onClick={onFinish}>
            Skip guide
          </button>
        )}
        <span className="spacer" />
        {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
        {last ? (
          <>
            <button
              onClick={() => {
                onFinish();
                onAddMusic();
              }}
            >
              Add music…
            </button>
            <button className="primary" onClick={onFinish}>
              Get started
            </button>
          </>
        ) : (
          <button
            className="primary"
            autoFocus
            onClick={() => setStep(step + 1)}
          >
            Next
          </button>
        )}
      </footer>
    </dialog>
  );
}
