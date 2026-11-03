# TuneVault rebuild brief

Prepared 2026-10-28. Status: research and implementation handoff, not a rebuilt application.

## Start here

**Build a local music library that helps you archive recordings, fix their details, maintain ordered playlists, and prepare the right files for an older player.** Electron + TypeScript is the recommended desktop stack. It keeps macOS and Windows in one familiar codebase without adding a Rust toolchain or hosted service.

| Deliverable | Location |
| --- | --- |
| Paste into a new Codex chat | [Self-contained rebuild prompt](codex-rebuild-prompt.md) |
| Working visual concept, fictional data | [Interface preview](interface-preview.html) |
| Screenshots and interactive demo walkthrough | [Visual handoff](preview-walkthrough.md) |
| Existing source inspection | [Repository audit](existing-repository-audit.md) |
| Framework and storage decisions | [Desktop architecture](desktop-architecture-research.md) |
| Unsigned releases, CI/E2E and updater | [Release/testing research](release-testing-research.md) |
| Audio, metadata, playlists and iPod | [Media/device research](media-device-research.md) |
| UX evidence and interaction details | [UI/UX research](ui-ux-research.md) |
| Critique and revised dark/light design rules | [Design review](design-review.md) |
| Inspected desktop app screens and original TuneVault patterns | [Desktop reference study](desktop-reference-study.md) |
| Multi-device transports, setup and transfer plans | [Device workflow comparison](device-workflow-comparison.md) |
| Logo and generation record | [Brand concept](brand-concept.md) |
| Six fictional album covers and Codex reuse | [Demo artwork](demo-artwork.md) |
| Legal assumptions and implementation gates | [Legal release notes](legal-release-notes.md) |
| Minimal legal drafts | [Terms](terms-of-use-draft.md), [Privacy](privacy-policy-draft.md) |
| What was actually checked | [Validation record](validation-record.md) |

To preview: run `./scripts/serve.sh personal/tunevault 1347` from this workspace, then open `http://127.0.0.1:1347/docs/interface-preview.html`. This is a design simulation, not a downloader or music transfer tool.

Local checks: `python3 personal/tunevault/scripts/check-research.py` and `python3 personal/tunevault/scripts/check-interface.py`. They verify handoff links/syntax/registration and theme text contrast; they do not replace rendered or device testing.

## Confirmed by Nathanial

- Personal archiving purpose, with public macOS and Windows installers available to others from the start.
- macOS and Windows desktop app. Electron is acceptable; another framework only if it materially improves this workload.
- Clean modern library with subtle 2000s player details. Simple default views; detailed metadata and technical options can be hidden.
- Blue and Orange accents, independently available in light/dark appearance; future app settings also offer System appearance and persist user choices.
- Primary physical target: iPod touch 6th generation, using iMazing. No other player model is owned/identified yet.
- Multiple saved targets and custom profiles for MP3/MP4 players, USB/SD/folder workflows and honest MTP capability/folder fallback. A portable “MP4 player” is not blanket video/codec compatibility. Nathanial confirmed this means portable MP4 players; video downloading/conversion is outside scope.
- YouTube video/playlist import and local drag-in. Spotify/Apple Music playlists should supply song references for local reuse and YouTube candidate matching, not subscription-audio extraction.
- Preserve exact playlist order; support multiple output formats including FLAC; retain descriptions/tracklists for mixes.
- Editable tags/art, saved playlists and refresh, per-device pending/changed/transferred tracking.
- Public installers will remain unsigned by Apple/Microsoft. A free cryptographic key for verifying update metadata/downloads is approved.
- Strong CI, end-to-end tests, release automation and an updater. Terms/Privacy should be short and honest; use legal skills for drafts.
- Publisher and MIT copyright holder: Nathanial Henniges personally. Chosen contact: TuneVault GitHub Issues; no public email. Do not post sensitive information in public issues. The archived repository needs owner unarchiving before accepting new issues/releases.
- Future implementation will start in a TuneVault folder cleared by Nathanial except for `.git`. This research does not erase that repository.

## Core feature scope

These are implementation requirements, not claims about the preview. Deliver them in tested vertical slices; do not substitute static mock screens for working behavior.

### Library and metadata

- [ ] Import files/folders by drop or picker; organized copy by default, originals untouched.
- [ ] Search, sort, multi-select, albums/artists, favorites and saved filters such as missing artwork, unresolved source, missing file and needs export.
- [ ] Batch edit tags with mixed-value handling, field locks, before/after review, and undo to a saved metadata revision.
- [ ] Read/write tested MP3, AAC/M4A, ALAC and FLAC tags/art correctly; show actual codec/quality provenance.
- [ ] Suggest recording/release metadata with MusicBrainz and Cover Art Archive, rate limits, attribution and local artwork replacement. Never invent certainty from a video title.
- [ ] Duplicate review using source IDs and audio/file evidence; keep live/remix/remaster variants distinct. Relink missing media without losing playlists or receipts.
- [ ] Export/import the library index and settings for backup/restore; verify missing media and avoid copying the whole library for every change.

### Sources, mixes and playlists

- [ ] Add YouTube videos/playlists through pinned yt-dlp, FFmpeg/ffprobe and supported EJS runtime. Durable cancellable jobs, retries and actionable errors.
- [ ] Preserve descriptions and provenance, with optional plain-text sidecars. Keep whole mixes; review/edit chapters and optionally create linked split derivatives.
- [ ] Spotify/Apple Music reference flow: pasted URL -> capability/completeness check -> ordered references -> local matches -> reviewed YouTube candidates. Preserve partial or unavailable rows and original URL.
- [ ] Local reference imports: M3U/M3U8, documented CSV/TSV, Spotify selected playlist data export, Apple Music playlist XML/text when available. These provide an offline route when link access is unavailable; they are not live sync.
- [ ] Manual playlists, duplicate occurrences, drag reorder plus keyboard equivalent, playlist descriptions, and source snapshots.
- [ ] Non-destructive refresh diff: added, removed, reordered, changed and unavailable. Source removal never deletes archived media. Manual refresh first, optional refresh on launch.

### Device exports

- [ ] Profiles for iPod touch 6 via iMazing, generic MP3/MP4-player audio over folder/USB, SD cards, custom devices, and archive originals/FLAC. Separate target/destination identity from transport and compatibility preset; expose Android/MTP access honestly with folder fallback until native transport is verified.
- [ ] Device setup, per-target selected content/profile/history, preflight additions/updates/omissions, disconnected states and a small compatibility test export. Never mix receipts between targets.
- [ ] Format/size/order preview with advanced tag/art/path options hidden. Playlist order never overwrites canonical album track numbers.
- [ ] Reuse unchanged renditions; calculate pending work from exact content, tags, artwork, profile and playlist revisions.
- [ ] iMazing: prepare staging folder/report, reveal files, optionally open installed iMazing, let user confirm transfer. No fake automatic iOS sync.
- [ ] Mounted USB: optional direct copy, safe paths and measured space, temporary writes/hash verification, disconnect recovery. MTP is not a mounted filesystem and remains separate scope.
- [ ] States distinguish ready locally, exported, user-confirmed iPod transfer, volume-verified copy and changed since transfer. Receipts are per device and revision.

### Release and trust

- [ ] Public unsigned macOS arm64/x64 and Windows x64 installers with separate binary/package/E2E evidence. Windows ARM and Linux remain future scope; do not market them from emulation alone.
- [ ] Windows NSIS update path; macOS automatic check/download with verified DMG and manual replacement. Normal Electron macOS auto-install requires signing and cannot be promised here.
- [ ] Free Ed25519 release metadata verification, pinned public key and verified artifact hashes. No private keys in the repo/installer; OS code-signing remains absent.
- [ ] CI tests actual packaged resources and installed Windows upgrades, data migration and failures. Release only after all required artifact gates pass.
- [ ] Short Terms, Privacy, About/third-party notices, local-first data behavior, opt-in credential use, redacted support diagnostics, clear unsigned-install instructions.

## Guardrails that make this feasible

“Find songs on YouTube” is the matching workflow, not proof that a particular recording is licensed for download. “Educational” or “personal” is not a universal copyright exception. Terms cannot grant rights in someone else's media or waive all liabilities. See [legal notes](legal-release-notes.md).

Spotify/Apple link reading is requested but conditional on real access, complete data and permitted use; the old keyless public-page scraper is not a reliable public integration contract. The full requested flow is retained, with a provider validation spike and usable local-list fallback. See [provider evidence](media-device-research.md).

FLAC encoding does not recover lossless quality from YouTube's lossy source. iPod touch 6's standard Music formats do not include FLAC; prepare MP3/AAC/ALAC copies. MP4 is a container rather than a guarantee about an unknown “MP4 player.” See [format/device evidence](media-device-research.md).

## Deliberately outside this rebuild

Full streaming/player replacement, equalizer/visualizer, cloud accounts/music sync, social sharing, recommendations, subscriptions, video editor, DRM circumvention, proxy/IP rotation, MTP integration, and a private iOS-sync implementation. A short local preview for match/chapter review is useful; a whole playback platform is not required.

## Remaining real-world gates

The repository is currently archived and must be unarchived by the owner before remote writes/releases. Actual Spotify/Apple credentials and permission, unsigned OS prompts, installed updater transitions, physical iPod playback/artwork/order, and any future named USB player still need implementation-time proof. None is claimed tested by this research.
