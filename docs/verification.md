# Verification record

Implementation run: 2026-10-29–30. Evidence levels below are deliberately separate.
This file records executed checks, not a promise that every acceptance item has
passed. Final platform CI and review results are appended as they become known.

## Current local acceptance audit (2026-10-30)

- Typecheck, lint and 169 unit/integration tests passed after cancellation and
  restore-safety fixes. Eight E2E tests passed, including the real unpackaged
  Electron development preview and the packaged production application.
- The current Mac ARM64 package passed bundled-tool, updater configuration,
  notice and native-icon verification. Installed-upgrade fixtures run separately
  in native CI; the skipped local installed test is not an upgrade pass.
- Source cancellation now covers the initial provider-preview subprocess and
  blocks late playlist writes. Restore rejects malformed records, broken links
  and changed same-path media before replacing existing state; safe preference
  restoration cannot grant permissions or switch the current Library folder.
- Ordered export filenames now remain sortable at 10,000 songs and beyond.
- The latest 10,000-track local fixture measured 2.92 seconds to startup,
  20.5 ms search and 56.3 ms paging/scroll, with 100 rendered rows at 200% zoom
  on the available Mac ARM64 host. These are observations, not minimum-OS proof.
- A live MusicBrainz request using only a synthetic title/artist query passed
  through the production bounded request code. This does not verify live CAA
  artwork, YouTube acquisition or provider permission for any media.
- Original supplied logo, six demo covers and cover manifest matched their
  research-source bytes. No provenance was stripped.
- Native CI found a missing development Electron executable and an E2E race
  with the preceding artwork undo. The tests now use Electron's official lazy
  loader and wait for the rendered undo state. A fresh native run must verify
  those fixes on both advertised platforms.

## Native acceptance for 285495b

[CI run 41044248326](https://github.com/nathanialhenniges/tunevault/actions/runs/41044248326)
passed on macOS 26 ARM64 and Windows x64. Both jobs built their production
candidate once, passed packaged E2E/resource checks and completed installed
N-to-N+1 upgrade fixtures with retained user data. Windows included the exact
NSIS installation and authenticated test-key update; Mac exercised the DMG
installation and manual replacement route. These test-key fixtures are not a
published production update and do not remove the manual gates below.

## Source and real file processing

- TypeScript and source/test ESLint passed.
- An earlier 120-test unit/integration suite passed: SQLite/settings, native file grants,
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

Current platform policy: Apple Silicon Macs on macOS 15+ and Windows 10+ x64.
Earlier Intel Mac checks below or above are historical evidence, not a current
release target. Linux AppImage support is not implemented or verified.

The platform-policy change passed typecheck, lint, 131 unit/integration tests,
macOS ARM64 DMG packaging/resource verification and six packaged E2E tests.
The app executable is ARM64 and its Info.plist requires macOS 15.0; the controlled
media tools also have a 15.0 deployment minimum. These local checks ran on the
available newer Mac, not macOS 15. Windows installer minimum-version enforcement
and the reduced native CI matrix subsequently passed in the run recorded above.

- Declared minimum OS checks; CI does not exercise the oldest supported OS.
- Hands-on macOS 26 appearance, VoiceOver/NVDA, owner-driven native dialogs/drop,
  fresh quarantine/Gatekeeper and Windows reputation prompts.
- Real provider permission/access and live YouTube/MusicBrainz/CAA behavior;
  no copyrighted live media or real account cookies were used as fixtures.
- A permitted Spotify/Apple direct connector; offline references remain usable.
- Physical iPod touch/iMazing and a named USB player/model/firmware. Filesystem
  copy checks do not establish playback or iPod playlist order.
- Owner verification of protected production signing secret/environments and
  corresponding-source/legal review. The production public key is committed;
  no production private key was used or invented by this implementation run.
- Publishable-prose hygiene: the default local remove-ai-marks endpoint uses
  port 8765, currently owned by WolfWave, and no alternate endpoint is configured.
  Health checks returned an empty reply; that is not a working hygiene service.
  WolfWave was not changed. No cleaning or local fallback was performed.
  Supplied art provenance was intentionally left untouched.

No release, tag or GitHub setting change is authorized by these results.
