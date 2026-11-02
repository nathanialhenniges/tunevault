import Link from "next/link";
import { basePath, releasesUrl, repoUrl } from "@/lib/shared";
import { getDownloads } from "@/lib/downloads";
import "./home.css";

const workflows = [
  {
    title: "Bring your files together",
    text: "Import files or folders into one local library. TuneVault copies your music and leaves the originals untouched.",
    href: "/docs/library",
  },
  {
    title: "Get the details right",
    text: "Review tags from MusicBrainz, choose artwork from Cover Art Archive, or edit everything yourself. Apply the changes you approve.",
    href: "/docs/metadata",
  },
  {
    title: "Keep your playlists in order",
    text: "Build playlists or import M3U, CSV, Spotify JSON and Apple Music XML references. Repeated songs keep their place.",
    href: "/docs/playlists",
  },
  {
    title: "Prepare for your player",
    text: "Make compatible copies for an iPod through iMazing, a USB player, an SD card or any folder. Each target keeps its own export history.",
    href: "/docs/devices",
  },
];

function AppCapture({
  scene,
  alt,
}: {
  scene: "library" | "metadata" | "devices";
  alt: string;
}) {
  return (
    <>
      {["light", "dark"].map((theme) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={theme}
          src={`${basePath}/screenshots/${scene}-${theme}.png`}
          alt={alt}
          width={scene === "metadata" ? 320 : 1100}
          height={800}
          loading="lazy"
          decoding="async"
          className={`tv-show-${theme}`}
        />
      ))}
    </>
  );
}

export default async function HomePage() {
  const { release, testedCommit, downloads } = await getDownloads();
  return (
    <main id="nd-page" tabIndex={-1} className="tv-home">
      <section className="tv-hero" aria-labelledby="hero-title">
        <div className="tv-hero-copy">
          <h1 id="hero-title">
            Your music,<span>kept local.</span>
          </h1>
          <p className="tv-lead">
            Build your library, fix tags and artwork, and prepare music for your
            portable player. Made for Mac and Windows.
          </p>
          <section
            id="downloads"
            aria-labelledby="downloads-title"
            className="tv-downloads"
          >
            <h2 id="downloads-title" className="sr-only">
              Download TuneVault
            </h2>
            <div className="tv-platforms">
              {downloads.map(({ label, href, expires }) => (
                <div className="tv-platform" key={label}>
                  <a href={href} className="tv-download-button">
                    {label.startsWith("Mac")
                      ? "Download for Mac"
                      : "Download for Windows"}
                    {expires && (
                      <span className="tv-download-format">Test ZIP</span>
                    )}
                  </a>
                  <p>
                    {label.startsWith("Mac")
                      ? "macOS 15+ · Apple Silicon M1 or newer"
                      : "Windows 10/11 · 64-bit (x64)"}
                  </p>
                  {expires && <p className="tv-expiry">Expires {expires}</p>}
                </div>
              ))}
            </div>
            <p className="tv-build-info">
              {release ? (
                `Version ${release}`
              ) : testedCommit ? (
                <>
                  Test build <code>{testedCommit}</code> · GitHub sign-in
                  required
                </>
              ) : (
                "No installer downloads are available here yet."
              )}
            </p>
            {testedCommit && (
              <details className="tv-test-help">
                <summary>How to use a test build</summary>
                <p>
                  Extract the ZIP, then open its Mac DMG or Windows EXE. These
                  are temporary CI artifacts from a successful native build, not
                  published releases.
                </p>
              </details>
            )}
            <p className="tv-unsigned">
              Unsigned personal-project installers. Your OS may show a security
              warning. <Link href="/docs/install">Installation help</Link>
            </p>
            <div className="tv-hero-links">
              <Link href="/docs/install">Get started</Link>
              <a href={releasesUrl}>View GitHub Releases</a>
            </div>
          </section>
        </div>

        <figure className="tv-product">
          <div className="tv-app-frame">
            <AppCapture
              scene="library"
              alt="TuneVault's Albums view with a local library, artwork, search and saved filters"
            />
          </div>
          <figcaption>
            The actual TuneVault app. Synthetic test audio and fictional artwork
            shown; no personal music or device transfers.
          </figcaption>
        </figure>
      </section>

      <section
        id="features"
        className="tv-benefits"
        aria-label="Library features"
      >
        <div className="tv-benefits-inner">
          <article>
            <h2>Keep the originals</h2>
            <p>
              Import a copy into your library. Your source files stay untouched,
              with no account or cloud music sync.
            </p>
          </article>
          <article>
            <h2>Review every change</h2>
            <p>
              Check tags and artwork before applying them. Lock the fields you
              want to keep, and undo a previous revision.
            </p>
          </article>
          <article>
            <h2>Give each player a setup</h2>
            <p>
              Keep separate formats, destinations and export histories for
              iMazing, USB/SD and folder workflows.
            </p>
          </article>
        </div>
      </section>

      <section className="tv-workflow" aria-labelledby="features-title">
        <div className="tv-workflow-copy">
          <h2 id="features-title">
            Put the details
            <br />
            in order.
          </h2>
          <div className="tv-workflow-list">
            {workflows.map(({ title, text, href }) => (
              <div key={title}>
                <h3>
                  <Link href={href}>{title}</Link>
                </h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <p className="tv-transfer-note">
            Preparing files is separate from transferring them. iMazing handoffs
            need your transfer and confirmation; a folder export does not prove
            device playback.
          </p>
        </div>
        <figure className="tv-track-details">
          <div className="tv-details-frame">
            <AppCapture
              scene="metadata"
              alt="TuneVault's track details panel showing editable title, artist and album fields for a fictional demo track"
            />
          </div>
          <figcaption>
            Track details from the same synthetic demo library.
          </figcaption>
        </figure>
      </section>

      <section className="tv-export" aria-labelledby="export-title">
        <h2 id="export-title">A separate setup for every player.</h2>
        <p>
          Choose a format and destination, check the files, then prepare your
          export. iMazing handoffs wait for your transfer and confirmation.
        </p>
        <figure className="tv-export-shot">
          <div className="tv-app-frame">
            <AppCapture
              scene="devices"
              alt="TuneVault's Devices and exports workspace with separate iPod and folder targets and tracks awaiting preparation"
            />
          </div>
          <figcaption>
            Actual target workspace with synthetic test audio. No physical
            device transfer is shown or implied.
          </figcaption>
        </figure>
      </section>

      <section className="tv-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Before you download</h2>
        <details>
          <summary>Do I need an account?</summary>
          <p>
            The app works without a TuneVault account. Temporary CI test
            downloads require GitHub sign-in; published release downloads are
            separate.
          </p>
        </details>
        <details>
          <summary>Can I use it with my iPod?</summary>
          <p>
            The iPod touch 6 workflow prepares compatible files for transfer
            through iMazing. You transfer the files and confirm the batch after
            checking it. Other players use their own folder, USB or SD-card
            setup.
          </p>
        </details>
        <details>
          <summary>Can I import Spotify or Apple Music playlists?</summary>
          <p>
            You can import exported playlist references, including Spotify JSON
            and Apple Music XML. These describe songs and their order; TuneVault
            does not extract subscription audio.
          </p>
        </details>
        <details>
          <summary>What music can I archive?</summary>
          <p>
            Use music you own or are authorized to copy. Online acquisition also
            depends on the provider&apos;s terms and access. An educational
            purpose does not grant music or artwork rights.
          </p>
        </details>
      </section>

      <section className="tv-project" aria-labelledby="project-title">
        <h2 id="project-title">A personal project, shared.</h2>
        <p>
          TuneVault is made by Nathanial Henniges for fun and educational use.
          The app code is{" "}
          <a href={`${repoUrl}/blob/main/LICENSE`}>MIT licensed</a>. Use only
          music you own or are authorized to copy.
        </p>
        <p>
          Installers have no Apple Developer ID signing/notarization or
          Microsoft publisher certificate. Update authentication is separate
          from OS signing and does not remove security warnings.
        </p>
        <Link href="/docs/install" className="tv-guide-link">
          Read the installation guide
        </Link>
        <a href="#downloads" className="tv-download-button tv-closing-download">
          Choose your build
        </a>
        <p>Apple Silicon Macs (M1 or newer), macOS 15+ · Windows 10/11 x64.</p>
      </section>
      <footer className="tv-footer">
        <span>TuneVault · Nathanial Henniges</span>
        <nav aria-label="Project and legal links">
          <Link href="/docs">Documentation</Link>
          <a href={`${repoUrl}/issues`}>GitHub Issues</a>
          <Link href="/docs/legal/privacy-policy">Privacy</Link>
          <Link href="/docs/legal/terms-of-use">Terms</Link>
          <Link href="/docs/legal/third-party-notices">
            Third-party notices
          </Link>
        </nav>
      </footer>
    </main>
  );
}
