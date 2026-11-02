import Link from "next/link";
import { basePath, releasesUrl } from "@/lib/shared";
import { getDownloads } from "@/lib/downloads";

const features = [
  [
    "Your music, kept local",
    "Imports are copied into a library folder on your computer. Originals are never changed.",
  ],
  [
    "Clean tags and artwork",
    "Look up tags with MusicBrainz and artwork with Cover Art Archive, then approve each change.",
  ],
  [
    "Ordered playlists",
    "Build playlists or import them from M3U, CSV, Spotify JSON or Apple Music XML.",
  ],
  [
    "Ready for your player",
    "Prepare compatible files for an iPod, USB stick, SD card or any folder.",
  ],
];

export default async function HomePage() {
  const { release, testedCommit, downloads } = await getDownloads();
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${basePath}/logo.png`}
        alt="TuneVault logo"
        width={112}
        height={112}
        className="mb-6"
      />
      <h1 className="mb-3 text-4xl font-bold">TuneVault</h1>
      <p className="mb-8 max-w-xl text-lg text-fd-muted-foreground">
        A local music library for Mac and Windows. Import music you own, fix its
        tags, and get it onto your portable player.
      </p>
      <p className="mb-6 max-w-xl text-sm text-fd-muted-foreground">
        A personal project by Nathanial Henniges, made for fun and educational
        use. The app is MIT licensed; use only music you own or are authorized
        to copy.
      </p>
      <section
        id="downloads"
        aria-labelledby="downloads-title"
        className="mb-14 w-full max-w-3xl rounded-xl border bg-fd-card p-6"
      >
        <h2 id="downloads-title" className="mb-3 text-xl font-semibold">
          Download TuneVault
        </h2>
        <p className="mb-4 text-sm text-fd-muted-foreground">
          {release
            ? `Version ${release}`
            : testedCommit
              ? `CI test builds · ${testedCommit}`
              : "Public releases will appear on GitHub Releases."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {downloads.map(({ label, href, expires }) => (
            <div key={label}>
              <a
                href={href}
                className="inline-block rounded-lg bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground"
              >
                {label}
                {expires ? " test build (.zip)" : " installer"}
              </a>
              {expires && (
                <p className="mt-2 text-xs text-fd-muted-foreground">
                  Expires {expires}
                </p>
              )}
            </div>
          ))}
        </div>
        {testedCommit && (
          <p className="mt-4 text-sm text-fd-muted-foreground">
            Test builds require GitHub sign-in. Extract the ZIP, then open the
            Mac DMG or Windows EXE. These are temporary CI artifacts, not
            published releases.
          </p>
        )}
        <p className="mt-4 text-sm text-fd-muted-foreground">
          Installers are unsigned: this personal project does not use Apple
          Developer ID signing/notarization or a Microsoft publisher
          certificate. Your OS may show a security warning.{" "}
          <Link href="/docs/install" className="underline">
            Read the installation guidance
          </Link>{" "}
          before proceeding.
        </p>
        <a href={releasesUrl} className="mt-4 inline-block text-sm underline">
          View GitHub Releases
        </a>
      </section>
      <div className="mb-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/docs/install"
          className="rounded-lg bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground"
        >
          Get started
        </Link>
      </div>
      <div className="grid w-full max-w-3xl gap-4 text-left sm:grid-cols-2">
        {features.map(([title, body]) => (
          <div key={title} className="rounded-xl border bg-fd-card p-5">
            <h2 className="mb-1 font-semibold">{title}</h2>
            <p className="text-sm text-fd-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
      <p className="mt-12 max-w-xl text-sm text-fd-muted-foreground">
        For music you own or have permission to copy. Apple Silicon Macs on
        macOS 15+ and Windows 10/11 PCs.
      </p>
    </main>
  );
}
