import Link from 'next/link';
import { basePath, releasesUrl } from '@/lib/shared';

const features = [
  ['Your music, kept local', 'Imports are copied into a library folder on your computer. Originals are never changed.'],
  ['Clean tags and artwork', 'Look up titles, artists, albums and covers from MusicBrainz, then approve each change.'],
  ['Ordered playlists', 'Build playlists or import them from M3U, CSV, Spotify JSON or Apple Music XML.'],
  ['Ready for your player', 'Prepare compatible files for an iPod, USB stick, SD card or any folder.'],
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${basePath}/logo.png`} alt="TuneVault logo" width={112} height={112} className="mb-6" />
      <h1 className="mb-3 text-4xl font-bold">TuneVault</h1>
      <p className="mb-8 max-w-xl text-lg text-fd-muted-foreground">
        A local music library for Mac and Windows. Import music you own, fix its tags, and get it
        onto your portable player.
      </p>
      <div className="mb-14 flex flex-wrap justify-center gap-3">
        <Link
          href="/docs/install"
          className="rounded-lg bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground"
        >
          Get started
        </Link>
        <a href={releasesUrl} className="rounded-lg border px-5 py-2.5 font-medium">
          Downloads
        </a>
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
        For music you own or have permission to copy. Apple Silicon Macs on macOS 15+ and Windows
        10/11 PCs.
      </p>
    </main>
  );
}
