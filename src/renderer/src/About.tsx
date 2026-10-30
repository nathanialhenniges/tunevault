import { useEffect, useState } from "react";
import type { Run } from "./Inspector";

export default function About({ run, logo }: { run: Run; logo: string }) {
  const [info, setInfo] = useState<any>(null),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    run("app.info")
      .then(setInfo)
      .catch(() => {});
  }, [run]);
  const versionText = info
    ? `TuneVault ${info.version} · ${info.platform}-${info.arch}`
    : "";
  return (
    <>
      <div className="page-head">
        <div>
          <h1>About TuneVault</h1>
        </div>
      </div>
      <div className="settings-sections about-page">
        <section className="about-section">
          <div className="about-brand">
            <img src={logo} alt="TuneVault logo" />
            <div>
              <h2>TuneVault</h2>
              <p>{info ? `Version ${info.version}` : "Version unavailable"}</p>
              <p className="small muted">
                Local music library and portable-player exports
              </p>
              <p className="small muted">
                Copyright © 2026 Nathanial Henniges · MIT License
              </p>
            </div>
          </div>
          <div className="button-row">
            <button
              disabled={!info}
              onClick={async () => {
                await navigator.clipboard.writeText(versionText);
                setCopied(true);
              }}
            >
              Copy version info
            </button>
            <button
              onClick={() =>
                run("openExternal", {
                  url: "https://github.com/nathanialhenniges/tunevault/issues",
                })
              }
            >
              Report an issue
            </button>
            {copied && (
              <span className="small muted" role="status">
                Copied
              </span>
            )}
          </div>
          <p className="small muted">
            Never post cookies, credentials, private library paths or unredacted
            logs in public issues.
          </p>
        </section>
        <section>
          <h2>Legal</h2>
          <div className="button-row">
            <button onClick={() => run("openLegal", { document: "license" })}>
              License
            </button>
            <button
              onClick={() => run("openLegal", { document: "third-party" })}
            >
              Third-party notices
            </button>
            <button onClick={() => run("openLegal", { document: "privacy" })}>
              Privacy policy
            </button>
            <button onClick={() => run("openLegal", { document: "terms" })}>
              Terms of use
            </button>
            <button onClick={() => run("openLegal", { document: "install" })}>
              Install & update help
            </button>
          </div>
          <p className="small muted">
            App code is MIT licensed. Bundled tools such as FFmpeg, yt-dlp and
            Deno keep their own licenses, listed in Third-party notices.
          </p>
        </section>
      </div>
    </>
  );
}
