# Verification record

Implementation run: 2026-10-29. Evidence levels below are deliberately separate.
This file records executed checks, not a promise that every acceptance item has
passed. Final platform CI and review results are appended as they become known.

## Source and real file processing

- TypeScript and source/test ESLint passed.
- 47 unit/integration tests passed: SQLite/settings, native file grants,
  credential storage/cleanup contract, reference occurrence order/refresh,
  safe paths, chapter parsing, target identity/history, backup/revision restore,
  acquisition failure/retry/cancel with controlled provider fixtures, updater
  signatures/feed/hash/cache failures and renderer identity rules.
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
- The 10,000-row packaged fixture passed: approximately 1.2–4.0 s launch to
  rendered count, 28–409 ms search and 94–782 ms page/scroll across two local
  runs with different system load.
  DOM is bounded to 100 track rows. At 200% zoom the document stayed within
  the 512 CSS-pixel viewport while the table retained its own horizontal scroll.
  These are observed local timings, not cross-platform performance guarantees.
- Native NSGlassEffectView loads on this macOS 27 host. The app uses its public
  basic view API and no private variant methods. Native glass is limited by
  opaque content surfaces and accessibility fallbacks. macOS 26-specific
  visual checks still need that OS/native runner.
- Icon Composer/actool compiled Aqua, DarkAqua and tintable icon stacks plus
  legacy ICNS. Assets.car/Info.plist and unchanged source PNG were verified.

Automation uses hidden windows to avoid flashing theme-test screens on the
owner's desktop. It runs the real packaged renderer with the same sandbox;
native dialogs are deterministically selected in tests. That does not prove
physical drag/drop, OS prompts or native picker interaction by a person.

## Installed application

Native macOS arm64 DMG mount/ditto-copy/launch and manual replacement from
4.0.0 to 4.0.1 passed. The seeded synthetic media, field lock, repeated playlist
occurrences, target/confirmed receipts and dark/orange settings survived.
This was a disposable installer-test build, not a public release or proof of
Gatekeeper/quarantine handling. Production candidate hash matching remains a
separate release gate.

## Remaining external or manual gates

- Native Windows x64 NSIS install/authenticated update/uninstall retention.
- Native macOS x64 packaging/installed upgrade and declared minimum OS checks.
- Real macOS 26 appearance, VoiceOver/NVDA, owner-driven native dialogs/drop,
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
