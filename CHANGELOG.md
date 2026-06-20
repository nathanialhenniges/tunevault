# Changelog

All notable changes to TuneVault will be documented in this file.

## [2.6.1] - 2026-06-19

### Added
- Inline metadata editor — select one or more library tracks and edit title, artist, and genre; changes are written back into the audio file tags (stream-copied, no re-encode)
- Track inspector drawer with full per-track details and album art
- Per-track album art: refresh from source or replace, re-embedded into the file
- Genre field with a suggestion list, surfaced in the editor and written to tags
- Drag-and-drop import — drop audio files/folders onto the window to add them to the library, or drop a YouTube playlist URL to fetch it; duplicate files prompt a keep/skip conflict dialog

### Changed
- Device sync reworked — each device now syncs independently (no global lock), with live per-device copy progress, a staged-vs-transferred file count, a "Mark transferred" action, and a manage panel for clearing staged/transferred copies
- Apple Music import now resolves tracks concurrently and no longer aborts the whole import when a single lookup fails

### Fixed
- macOS "Support Ending for Intel-based Apps" warning — bundled ffmpeg/ffprobe were x86_64-only (from evermeet.cx) and ran under Rosetta. Now ship arm64-native builds; mac dmg/zip pinned to `arch: arm64` (Apple Silicon only)
- Crossfade timer was not cancelled when a track changed mid-fade, which could corrupt playback and promote an unloaded track — the fade is now torn down on load/unload
- Apple Music playlists re-scraped on every open because the fetch cache was written under a different key than it was read with; the 30-minute cache now hits
- Rate-limit (HTTP 429) retries never fired because the signal was only on stderr — yt-dlp now surfaces it in the failure so the queue retries
- Two concurrent downloads of the same playlist could clobber each other's batch bookkeeping (a unique batch id is now used per run)
- Album-art downloads now cap redirects, time out, reject error responses, and handle 307/308 instead of writing an error body to disk
- Now Playing / visualizer popovers (crossfade, style) now close on outside-click and Escape
- Device folder status no longer goes stale when a device is replaced or its folder changes without the device count changing
- Visualizer no longer allocates a buffer every animation frame (steady GC churn while open)

### Accessibility
- Right-click track menu is now fully keyboard-operable (menu/menuitem roles, focus management, arrow/Home/End/Escape)
- Toasts announce via an `aria-live` region and long error messages wrap instead of truncating
- Error boundary offers a "Try Again" that resets without a full reload
- Icon-only device controls and the device playlist picker now have accessible labels
- Decorative animation and transitions respect the OS "Reduce Motion" setting

### Security
- Hardened the `tunevault://` audio protocol — only the `Range` header is forwarded and an empty music directory is rejected (it previously resolved to the working directory)
- Restricted the `tvcache://` art proxy to known image CDNs with a content-type and size cap (prevents the renderer from making the main process fetch arbitrary URLs)
- All yt-dlp invocations pass URLs/search terms after a `--` separator and reject non-http(s) sources, closing an argument-injection vector
- Sanitized filenames can no longer resolve to `.`, `..`, or hidden/traversal entries

### Removed
- Unused `@fontsource-variable/dm-sans` and `@fontsource-variable/fraunces` font packages (the UI ships Bricolage Grotesque + Hanken Grotesk)

### Internal
- Library batch writes (genre/art patches, imports) now serialize through the write queue alongside download upserts to prevent lost updates
- Added tests for filename path-traversal protection and malformed date handling
- CI now runs a renderer/main build-smoke on PRs and cancels superseded runs

## [2.6.0] - 2026-06-17

### Added
- Native macOS/Windows redesign — system fonts, segmented controls, Windows Mica blur effect
- macOS window vibrancy (translucent sidebar/titlebar)
- Native app menu with standard macOS keyboard shortcuts (⌘, for Settings, ⌘\ to toggle sidebar)
- Multi-device sync, local file import, accent color picker, genre field support
- Import public Apple Music playlists with YouTube/SoundCloud as audio source
- Artwork cache with dominant-color extraction for Now Playing background tinting
- Clear cache / Erase all data options in Settings
- Compact/comfortable track-density toggle in Settings

### Fixed
- Sidebar "Downloaded" section now only shows YouTube/Apple Music playlists (not local imports)
- Settings changes no longer trigger a toast on every keystroke
- Text contrast meets WCAG AA throughout (text-muted, instructional labels, vibrancy backing)
- Removed spurious "Library loaded" toast

### Changed
- Page titles enlarged and made consistent across all views
- CI now only builds full installers on version tags — PRs get a fast build-only check

## [2.5.0] - 2026-02-25

### Added
- In-app auto-update checker via `electron-updater` — check for new versions, download, and install from Settings without leaving the app
- "Updates" section in Settings showing current version with Check / Download / Restart controls
- User-initiated updates only (`autoDownload: false`) — no surprise downloads

## [2.4.1] - 2026-02-25

### Fixed
- Replace hardcoded `calc(100vh - Npx)` heights with flex layout in Library and Playlist virtual scroll containers — lists now adapt to any window size without overflow or gaps
- Reset scroll position to top when navigating between routes (Playlists, Downloads, Library, Settings)
- Reset scroll position when switching between playlists
- QueueView panel clipping — switched from fixed `max-h-80` inner scroll to flex layout so scrollbar is no longer cut off
- Virtual scroll `estimateSize` mismatches causing jitter (Library: 45→50, Playlist: 48→52)
- Playlist filter not resetting to "All" when navigating to Library without a filter
- `DownloadQueue` `useMemo` invalidating every render due to `Array.from()` creating a new array reference on each pass
- Sidebar "Downloaded" playlists section now scrolls when it overflows on small windows

## [2.4.0] - 2026-02-23

### Added
- Shared `Modal` component — all modals now use a single reusable component with portal rendering, focus trap, Escape/backdrop-click dismiss, and consistent `z-[100]` layering
- Redesigned Playlist Info modal with native styled view: playlist thumbnail, channel, track count, total duration, and per-track rows with thumbnails, position, duration, and bitrate
- Pretty/Markdown view toggle in Playlist Info modal header — switch between the styled track list and raw `playlist-info.md` content
- "Open in Editor" button to open `playlist-info.md` in the system default editor
- New `openFile` IPC channel (`shell.openPath`) for opening files with default apps

### Fixed
- Redownload confirmation modal now has focus trap, Escape, and backdrop-click dismiss (was missing all three)
- All modals use consistent `z-[100]` (some were `z-50`, causing layering issues behind other UI)

### Removed
- `react-markdown` and `remark-gfm` dependencies (replaced by native React views)
- `MarkdownViewer` component
- Local `FocusTrapModal` from LibraryView (replaced by shared `Modal`)

## [2.3.0] - 2026-02-22

### Performance
- Extract `SeekBar` sub-component from `PlayerBar` to isolate 250ms seek tick re-renders
- Consolidate Zustand selectors with `useShallow` in PlayerBar, LibraryView, and Visualizer store
- Cache visualizer gradient — `createLinearGradient()` now called only on canvas resize instead of 60×/sec
- Batch circular visualizer strokes into 8 alpha buckets (256 → 8 `stroke()` calls/frame)
- Lazy-load `react-markdown` + `remark-gfm` via new `MarkdownViewer` wrapper (only loaded when Playlist Info modal opens)
- Sidebar download badge uses a derived primitive count selector — no longer re-renders on every progress tick
- Wrap `NowPlaying` with `React.memo` to prevent cascading re-renders from PlayerBar
- Wrap `DownloadItem` with `React.memo` and custom comparator (compares id, status, percent, speed, eta, error)
- Replace 4 separate `.filter()` passes in `DownloadQueue` with single-pass `useMemo` for O(n) stats
- Move `SPEED_OPTIONS`, `CROSSFADE_OPTIONS`, `VISUALIZER_STYLES` to module scope in PlayerBar
- Wrap `toggleOne` in `PlaylistView` with `useCallback`
- Reduce virtual list overscan from 10 to 5 in `TrackList` and `PlaylistView`
- Add `loading="lazy"` and `decoding="async"` to all thumbnail `<img>` tags (TrackList, PlaylistView, QueueView, DownloadItem)

### Added
- DM Sans variable font for section headings (Sidebar title, Library, Downloads, Playlists, Settings)
- Button press micro-interaction (scale-down on `:active` for play/pause)
- Download progress bar shimmer animation for active downloading/converting states
- Track row hover nudge (subtle 2px rightward shift on library rows)
- Album art glow (accent-colored blur behind NowPlaying thumbnail)
- Empty state enhancements with accent blur glow and pulsing icon animation (Library, Downloads, Playlists)

### Fixed
- `settingsStore` MediaQueryList listener leak — stores reference and removes before re-adding on each `load()` call

### Dependencies
- Added `@fontsource-variable/dm-sans`

## [2.2.0] - 2026-02-22

### Added
- Waveform visualizer with three styles: bars, waveform, and circular
- Visualizer toggle in PlayerBar with right-click style picker
- Playlist auto-sync: configurable interval to check synced playlists for new tracks
- Sync Now button in Library toolbar
- Per-playlist auto-sync toggle
- Pending sync results banners with one-click download
- `visualizerStore` and `syncStore` Zustand stores

## [2.1.0] - 2026-02-22

### Added
- Keyboard shortcut overlay (toggle with `?`)
- Drag-and-drop YouTube URLs onto the app window
- Retry failed downloads button in completion summary
- Persistent sort preferences in Library (saved across sessions)
- Shift-click multi-select for track checkboxes
- Debounced search input in Library

## [2.0.0] - 2026-02-22

### Added
- Virtual scrolling for Library and Playlist track lists (`@tanstack/react-virtual`)
- Column sorting in Library (title, playlist, duration)
- Editable playback queue with drag-and-drop reordering
- Error boundary wrapper for graceful crash recovery
- Focus traps for all modal dialogs
- Playback speed control (0.5×–2×)
- Crossfade between tracks (0–6s)
- Memoized filtered tracks and track row components

### Performance
- Lazy-loaded routes (Playlists, Downloads, Library, Settings)
- Throttled download progress updates to renderer
- Capped playlist cache size

## [1.3.0] - 2026-02-22

### Added
- OIIA OIIA wolf animation (full spin with squash-and-stretch wobble, inspired by the cat meme)
- Improved playlist UX: sticky header, inline per-track download progress, live download counter, empty state, column labels
- Download All button now visually selects all checkboxes in the UI

### Fixed
- Full release date written to audio metadata (ID3v2.4 TDRC/TDRL) instead of year-only
- Tracks always sorted by original playlist position (removed track-order.txt reordering)
- Download state and selection reset when fetching a new playlist
- Same songs allowed in different playlists (separate IDs, files, and library entries)

## [1.2.0] - 2026-02-22

### Added
- Background downloads: closing the window during active downloads hides it to the system tray instead of quitting
- App version number displayed in the sidebar footer
- Restore the window anytime via the tray icon; use Quit from tray or Cmd+Q to force exit

## [1.1.0] - 2026-02-22

### Added
- Track metadata enrichment: release date, bitrate, and URL fields on downloaded tracks
- Date Format setting with 4 options (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, DD Mon YYYY)
- Release Date Source setting (YouTube or MusicBrainz free API lookup)
- MusicBrainz service for release date lookups with fallback to yt-dlp metadata
- Bitrate display in playlist track rows and library track list
- Download completion summary banner showing done/skipped/failed counts
- Playlist caching (localStorage + main process, 30-minute TTL) for instant re-loads
- Refresh button to re-fetch a playlist bypassing the cache
- "Cached" badge on playlist header when loaded from cache
- Enriched `track-order.txt` with date, bitrate, and URL per track
- Konami code easter egg with spinning wolf loader

### Changed
- Default audio format changed from FLAC to MP3

### Fixed
- Cancel button now properly stops queued downloads and notifies the renderer
- Cancel All now halts the entire batch queue loop instead of only aborting active downloads
- Cancelling a queued (not yet started) track now works correctly

## [1.0.2] - 2026-02-21

### Fixed
- CI release permissions for GitHub Actions
- Linux `.deb` package author field
- Windows ffmpeg cleanup to prevent 900MB builds

## [1.0.1] - 2026-02-21

### Fixed
- Clean up extracted ffmpeg directory on Windows to prevent bloated builds

## [1.0.0] - 2026-02-20

### Added
- Download YouTube playlists as high-quality audio (FLAC, MP3, Opus)
- iTunes-compatible metadata tagging with album art via ffmpeg
- Built-in music player with queue, shuffle, and repeat
- Library management with track verification
- Customizable track ordering via drag-and-drop and `track-order.txt`
- Dark and light theme support with system theme detection
- Keyboard shortcuts for playback control
- System tray integration with playback controls
- Recent playlists dropdown for quick access
- Configurable music directory, audio format, and download concurrency
- Educational use disclaimer modal
- Custom `tunevault://` protocol for local audio playback
- Cross-platform support (macOS, Windows, Linux)
- CI/CD with GitHub Actions for automated builds and releases
