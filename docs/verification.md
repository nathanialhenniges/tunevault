# Verification record

Implementation run: 2026-10-29–30. Evidence levels below are deliberately separate.
This file records executed checks, not a promise that every acceptance item has
passed. Final platform CI and review results are appended as they become known.

## Source and real file processing

- TypeScript and source/test ESLint passed.
- 120 unit/integration tests passed in the latest completed local suite: SQLite/settings, native file grants,
  credential storage/cleanup contract, reference occurrence order/refresh,
  safe paths, chapter parsing, target identity/history, backup/revision restore,
  acquisition failure/retry/cancel with controlled provider fixtures, updater
  signatures/feed/hash/cache failures and renderer identity rules.
- Queued imports resume after restart; interrupted running work remains retryable.
  Synthetic compatibility packs exercised MP3/AAC/ALAC/FLAC/original profiles.
  Reordered playlists reused verified audio without recopying it. Volume swaps
  at audio, manifest and receipt boundaries failed safely; active target edits
  were rejected until writer cleanup completed.
- Additional checks cover safe vault moves, schema migration rollback/backups,
  restorable pre-restore revision history, mixed-folder failed-only retry,
  retained confirmation history, capacity observations, advanced profile/path
  limits, per-occurrence derivative tags, offline placeholder art, provider
  cache/backoff/cancellation, and explicit corresponding-source promotion gates.
- Actual bundled FFmpeg/ffprobe processed independently generated MP3, AAC,
  ALAC and FLAC. Independent tag reads checked title, artist, album credits,
  track/disc values, date, genre, composer, comment, ISRC/MBID and embedded art.
  Originals remain unchanged, and tag-only revisions do not re-encode audio.
- All bundled tools passed hash/version/native-architecture checks with an
  empty PATH. Nonfree FFmpeg was rejected; controlled redistributable builds
  include exact sources and recipe. This does not close every third-party
  corresponding-source review obligation before public distribution.

## Rendered and packaged application

- Actual Electron renderer inspected at 1440x900 and 1024x768 in all four
  Light/Dark x Blue/Orange themes, with real fictional cover PNGs and missing
  artwork fallbacks. These design fixtures contain no audio.
- 56 computed text/state contrast pairs passed 4.5:1; minimum 4.68:1. This is
  a semantic-token check, not a full screen-reader or accessibility audit.
- Packaged macOS arm64 E2E passed the real synthetic import/edit/export/restart
  flow, sandbox/context isolation checks, persisted themes and legal dialogs.
  Final packaged rerun also passed native System appearance events while hidden
  and preservation of unsaved inspector edits across all four themes.
  The latest local run also passed Reduce Transparency fallback/reactivation
  and exact preview-to-save support report contents.
- All three latest packaged UI workflows passed, including target reconnect
  after restart, saved content scope, numeric albums, batch undo, restore
  confirmation/recovery and narrow-window focus. The real offline placeholder
  preview/apply/Undo flow also passed.
- The 10,000-row packaged fixture passed: approximately 1.2–4.0 s launch to
  rendered count, 28–409 ms search and 94–782 ms page/scroll across two local
  runs with different system load.
  DOM is bounded to 100 track rows. At 200% zoom the document stayed within
  the 512 CSS-pixel viewport while the table retained its own horizontal scroll.
  These are observed local timings, not cross-platform performance guarantees.
- Native NSGlassEffectView loads on this macOS 27 host. The app uses its public
  basic view API and no private variant methods. Native glass is limited by
  opaque content surfaces and accessibility fallbacks. macOS 26-specific
  native loading also passed on macOS 26 arm64 and Intel CI runners.
  Owner-driven visual/accessibility checks remain separate.
- Icon Composer/actool compiled Aqua, DarkAqua and tintable icon stacks plus
  legacy ICNS. Assets.car/Info.plist and unchanged source PNG were verified.

Local automation uses hidden windows to avoid flashing theme-test screens on
the owner's desktop; native CI uses visible windows on its isolated runner.
Both run the real packaged renderer with the same sandbox;
native dialogs are deterministically selected in tests. That does not prove
physical drag/drop, OS prompts or native picker interaction by a person.

## Installed application

Native macOS arm64 DMG mount/ditto-copy/launch and manual replacement from
4.0.0 to 4.0.1 passed. The seeded synthetic media, field lock, repeated playlist
occurrences, target/confirmed receipts and dark/orange settings survived.
This was a disposable installer-test build, not a public release or proof of
Gatekeeper/quarantine handling. Production candidate hash matching remains a
separate release gate.

CI run 40840853255 at b617734 passed both macOS 26 native architectures,
including production packaging/E2E and installed N-to-N+1 replacement.
Windows passed source/media/package checks but timed out capturing a narrow
renderer screenshot. Native capture and quit handling were corrected locally;
the final cross-platform run must establish the current candidate result.

Run 41012834963 at cc544cc subsequently passed Windows x64 production E2E,
exact NSIS installer smoke and authenticated test-key installed upgrade;
macOS arm64 passed too. Those results precede the newest profiles/metadata
work and the controlled Windows LGPL tool build. A fresh native matrix must
verify the combined candidate. No earlier green run proves those later changes.

## Remaining external or manual gates

- Native Windows x64 NSIS install/authenticated update/uninstall retention.
- Declared minimum OS checks; CI does not exercise the oldest supported OS.
- Hands-on macOS 26 appearance, VoiceOver/NVDA, owner-driven native dialogs/drop,
  fresh quarantine/Gatekeeper and Windows reputation prompts.
- Real provider permission/access and live YouTube/MusicBrainz/CAA behavior;
  no copyrighted live media or real account cookies were used as fixtures.
- A permitted Spotify/Apple direct connector; offline references remain usable.
- Physical iPod touch/iMazing and a named USB player/model/firmware. Filesystem
  copy checks do not establish playback or iPod playlist order.
- Owner production update public key, protected signing secret/environments
  and corresponding-source/legal review. No production key was invented.
- Publishable-prose hygiene: the required local remove-ai-marks service returned
  an empty reply on /health. No cleaning or local fallback was performed.
  Supplied art provenance was intentionally left untouched.

No release, tag or GitHub setting change is authorized by these results.
