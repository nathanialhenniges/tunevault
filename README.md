# TuneVault

TuneVault is a local music archive for Apple Silicon Macs running macOS 15+
and x64 PCs running Windows 10+. Import owned audio,
review metadata, keep ordered playlists and prepare files for portable players.
Nathanial Henniges personally maintains and publishes the app.

## Features

- **Local library:** SQLite persistence, copied imports, search, albums,
  favorites, field locks, metadata revisions and undo.
- **Ordered playlists:** repeated occurrences, offline reference imports,
  reviewed source snapshots and visible omissions.
- **Portable players:** independent iMazing, folder, USB/SD and MTP-folder
  targets, compatible renditions and per-target receipt history.
- **Appearance:** persisted System/Light/Dark with independent Blue/Orange.
  macOS 26+ native glass sidebar and Icon Composer app icon, with opaque
  accessibility/older-platform fallbacks.
- **Authorized acquisition:** pinned yt-dlp/Deno/FFmpeg; provider access and
  permission remain separate from local library operation.
- **Update authentication:** Ed25519 envelope and artifact verification;
  macOS assisted DMG replacement and Windows NSIS update machinery.

Direct Spotify/Apple connectors require a permitted implementation and real
provider access. Their exported playlist references work offline. Direct MTP
and physical-player compatibility are not claimed. Public update checks fail
closed until an owner production key is configured. See
[verification](docs/verification.md) for the checks actually run.

## Getting Started

Public installers have not been published by this rebuild. Current installer
targets are an Apple Silicon DMG and a Windows x64 NSIS installer. Intel Macs
are not supported. A Linux AppImage has been discussed but is not implemented
or verified. For development:

```bash
npm ci
npm run tools:prepare
npm run tools:verify
npm run dev
```

Choose a vault in Settings, then Add music. Originals stay untouched.
See [installation/update guidance](docs/install-update.md) before installing
an unsigned candidate.

## Usage

Use Library to import, search, review tags and artwork. Create ordered playlists
or import selected CSV/TSV, M3U, Spotify JSON or Apple XML references. Review
online candidates before archiving audio you are authorized to copy.

Add a named target in Devices & exports, review its format and destination,
then preview and prepare. iMazing requires your transfer and confirmation;
a folder export does not prove a device received files. Keep the whole
TuneVault-owned export tree because incremental playlists may reference a
verified file from an earlier batch. Unknown target files are never deleted.

Use [backup/restore](docs/backup.md) before replacing important data. The
fictional design library is opt-in under Settings and contains no audio.

## Tech Stack

| Layer           | Technology                                                                 |
| --------------- | -------------------------------------------------------------------------- |
| Desktop runtime | Electron 45.1.0, embedded Node 24.22.1                                     |
| UI              | React 19.3.1, TypeScript 6.0.3                                             |
| Build           | electron-vite 6, Vite 8, electron-builder 26.18.0                          |
| Index/jobs      | node:sqlite in a utility process                                           |
| Audio           | Pinned FFmpeg/ffprobe, music-metadata, node-taglib-sharp, yt-dlp, Deno/EJS |
| Artwork         | sharp with bounded image validation                                        |
| Checks          | ESLint, Vitest 5, Playwright Electron                                      |
| Updates         | electron-updater 6.8.11, Node Ed25519/SHA-512                              |

## Development

### Prerequisites

- Node 24.13+ and npm; use the committed package-lock.json.
- An Apple Silicon Mac with macOS 15+ or a Windows 10+ x64 PC for the corresponding packaging/installer gates.
- Xcode with Icon Composer for macOS native icon compilation.
- Xcode Command Line Tools for the controlled macOS media-tool build.
- Network access to prepare pinned third-party sources/binaries.

Installed users do not need Node, npm, Homebrew, Python or a terminal.

### Setup

```bash
npm ci
npm run tools:prepare
npm run tools:verify
npm run typecheck
npm test
npm run dev
```

### Scripts

- `npm run dev`: Electron development app.
- `npm run lint`: source/test ESLint checks.
- `npm run typecheck`: TypeScript checks.
- `npm test`: unit and real bundled-media integration tests.
- `npm run build`: renderer, preload, main and utility-process build.
- `npm run package:dir`: native unpacked application; no publishing.
- `npm run package`: native installers; no publishing.
- `npm run package:verify`: bundled tools, notices, icon and production config.
- `npm run test:e2e`: packaged Electron flows; set TUNEVAULT_EXECUTABLE when needed.
- `npm run test:upgrade`: disposable native N -> N+1 installer fixtures.
- `npm run icon:verify`: native Icon Composer appearance catalog checks.
- `npm run release:check`: required candidate/evidence checks.

### Code Quality

Keep privileged commands narrow, validate native file grants and preserve
source media. Keep tests isolated from real libraries/devices. Source checks,
packaged checks, installed upgrades and physical playback are distinct proof.
Read [AGENTS.md](AGENTS.md) or [CLAUDE.md](CLAUDE.md) before agent edits.

## Project Structure

```text
src/main/        Native windows, menus, file grants and IPC
src/preload/     Sandboxed typed bridge
src/worker/      One utility-process entry
src/core/        SQLite, media, sources, playlists and exports
src/renderer/    React UI and labeled fictional design fixtures
src/update/      Authenticated update verification/service
resources/      Tools, trusted update public keys and source assets
build/          Icon Composer project and platform icon derivatives
scripts/        Tool, package, installer and release gates
tests/         Unit, integration and packaged/installed E2E
docs/          Architecture, backup, legal and release guidance
```

## License

![MIT license](https://img.shields.io/github/license/nathanialhenniges/tunevault.svg)

Original app code: [MIT](LICENSE), copyright 2026 Nathanial Henniges.
[Third-party components](THIRD_PARTY_NOTICES.md) retain their own licenses.
The fictional demo album covers are AI-generated and contain no audio.

## Contact

- [TuneVault GitHub Issues](https://github.com/nathanialhenniges/tunevault/issues)
- [Nathanial's website](https://mrdemonwolf.com)
- [Join my server](https://mrdwolf.net/discord)

Issues are public: never post credentials, cookies or private logs.

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
