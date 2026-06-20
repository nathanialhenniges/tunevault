# TuneVault - YouTube Playlist Downloader and Music Player

> **Disclaimer:** TuneVault is provided strictly for **educational
> and personal use only**. Downloading copyrighted content without
> the permission of the copyright holder may violate applicable
> laws in your jurisdiction. You are solely responsible for
> ensuring that your use of this software complies with all
> applicable local, state, national, and international laws and
> regulations. The developers of TuneVault do not endorse,
> encourage, or condone the illegal downloading or distribution
> of copyrighted material. By using this software, you acknowledge
> that you do so **at your own risk**. This software is not
> affiliated with or endorsed by YouTube or Google.

TuneVault is a cross-platform desktop application that downloads
YouTube (and public Apple Music) playlists as high-quality audio
files with full iTunes metadata tagging and album art. It includes
a built-in music player with queue management, seeking, shuffle,
and repeat modes, an inline metadata editor, and device sync for
loading playlists onto an iPod via iTunes.

Built for music collectors who want local copies of their
playlists without compromising on audio quality or metadata.

Your music, your library, your rules.

## Features

- **High-Quality Audio Downloads** - Download playlists as FLAC,
  MP3, or Opus with configurable quality settings.
- **Apple Music Import** - Paste a public Apple Music playlist
  link; each track is matched to YouTube or SoundCloud audio.
- **iTunes Metadata Tagging** - Automatically embeds title, artist,
  album, track number, album art, and more via ffmpeg.
- **Inline Metadata Editor** - Edit title, artist, and genre across
  one or many selected tracks; changes are written straight into
  the audio file tags (no re-encode).
- **Built-In Music Player** - Full playback with seek, shuffle,
  repeat, crossfade, volume control, a waveform visualizer, and
  keyboard media key support.
- **Device Sync (iPod)** - Create a device, assign playlists, and
  mirror them into a folder ready to drag into iTunes; staged vs.
  transferred tracks are tracked per device.
- **Drag-and-Drop Import** - Drop local audio files/folders onto
  the window to add them, or drop a playlist URL to fetch it.
- **Album Art & Color** - Refresh or replace per-track artwork, with
  a dominant-color tint behind Now Playing.
- **Library Management** - Browse, search, filter by playlist,
  verify files on disk, and bulk delete tracks.
- **Concurrent Downloads** - Configurable parallel download queue
  with per-track progress, cancellation, and error handling.
- **Cross-Platform** - Builds for macOS (dmg), Windows (nsis,
  portable), and Linux (AppImage, deb).
- **Dark and Light Themes** - Obsidian dark theme with orange
  accent as default, with light theme support.
- **No API Key Required** - Uses yt-dlp directly for metadata
  and downloads.

## Getting Started

1. Download the latest release for your platform from
   [GitHub Releases](https://github.com/nathanialhenniges/tunevault/releases).
2. Install and launch TuneVault.
3. Go to Settings and set your music output directory.
4. Paste a YouTube or public Apple Music playlist URL into the
   Fetch Playlist input.
5. Click Download All or select specific tracks to download.

## Usage

Paste any YouTube playlist URL to fetch its track listing:

```
https://www.youtube.com/playlist?list=PLxxxxxxxxxx
```

Downloaded tracks are saved to your configured music directory
as `~/Music/TuneVault/<PlaylistName>/NN - Artist - Title.ext`.

Each playlist folder includes a `track-order.txt` file. Edit
this file to customize the order tracks appear in the Library
and player queue -- just reorder or remove lines and reload.

## Tech Stack

| Layer       | Technology                         |
|-------------|------------------------------------|
| Framework   | Electron 33 + electron-vite        |
| Frontend    | React 19 + TypeScript              |
| Styling     | Tailwind CSS v4                    |
| State       | Zustand 5                          |
| Audio       | Howler.js (Web Audio API)          |
| Icons       | Heroicons React                    |
| Downloader  | yt-dlp (bundled binary)            |
| Tagger      | ffmpeg / ffprobe (bundled binaries)|
| Build       | electron-builder                   |
| CI/CD       | GitHub Actions (matrix build)      |

## Development

### Prerequisites

- Node.js 20+
- npm 9+
- Git
- yt-dlp, ffmpeg, and ffprobe binaries (or use the download
  script)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/nathanialhenniges/tunevault.git
cd tunevault
```

2. Install dependencies:

```bash
npm install
```

3. Download platform binaries (yt-dlp, ffmpeg, ffprobe):

```bash
npm run download-binaries
```

4. Start the development server:

```bash
npm run dev
```

### Development Scripts

- `npm run dev` - Start Electron + Vite dev server with hot
  reload.
- `npm run build` - Build main, preload, and renderer to `out/`.
- `npm run pack` - Build and package as unpacked directory
  (for testing).
- `npm run dist` - Build and create platform installers.
- `npm run dist:mac` - Build macOS dmg and zip.
- `npm run dist:win` - Build Windows nsis and portable.
- `npm run dist:linux` - Build Linux AppImage and deb.
- `npm run download-binaries` - Fetch yt-dlp, ffmpeg, and
  ffprobe for the current platform.
- `npm test` - Run the Vitest unit tests.
- `npm run typecheck` - Type-check main, preload, and renderer
  without emitting.

### Code Quality

- TypeScript with strict mode across two project references
  (`tsconfig.node.json` for main/preload, `tsconfig.web.json`
  for renderer).
- IPC channels defined once in `src/shared/ipc-channels.ts`
  and referenced everywhere.
- Service layer pattern separates business logic from IPC
  handlers.

## Project Structure

```
tunevault/
├── src/
│   ├── main/              # Electron main process
│   │   ├── ipc/           # IPC handler registration
│   │   ├── services/      # Business logic (library, yt-dlp, ffmpeg, etc.)
│   │   ├── index.ts       # Window creation, protocol, media keys
│   │   └── tray.ts        # System tray integration
│   ├── preload/           # Secure context bridge (window.api)
│   ├── renderer/          # React frontend
│   │   └── src/
│   │       ├── components/ # UI components (player, library, playlist, device, settings)
│   │       ├── hooks/      # Custom React hooks
│   │       ├── lib/        # Audio engine, API types
│   │       ├── store/      # Zustand stores
│   │       └── styles/     # Tailwind CSS
│   └── shared/            # Types and IPC channel constants
├── resources/
│   └── bin/               # Platform binaries (yt-dlp, ffmpeg, ffprobe)
├── build/                 # App icons and build assets
├── scripts/               # Build helper scripts
├── .github/workflows/     # CI/CD pipeline
├── electron-builder.yml   # Packaging configuration
└── package.json
```

## License

![GitHub license](https://img.shields.io/github/license/nathanialhenniges/tuneVault.svg?style=for-the-badge&logo=github)

This project is licensed under the MIT License.
