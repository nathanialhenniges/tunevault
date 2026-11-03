# Owner decisions and requirement changes

Recorded from Nathanial Henniges's instructions in the TuneVault implementation
conversation through 2026-11-03. This is a curated decision record, not a verbatim
chat transcript or a claim that every acceptance gate passed. The complete
original prompt remains unchanged in [the archive](original/docs/codex-rebuild-prompt.md).

## Product and data safety

- Music library first: local imports, authorized YouTube acquisition and
  playlist-reference matching. Spotify/Apple Music references are not audio
  extraction or permission to use subscription recordings.
- Electron and TypeScript, with a responsive UI and real file processing,
  persistence, packaging and native verification. No static mockup substitute.
- The old tracked application was intentionally deleted. Preserve `.git` and
  unexpected new work; do not restore the historical app, reset the checkout or
  create a worktree containing it.
- Multiple portable-player targets: iPod touch 6 via iMazing, plus USB/SD/folder
  workflows. “MP4 players” means portable music devices; no video downloading or
  conversion. Prepared, copied/verified and user-confirmed transfers stay distinct.
- Reuse the supplied logo and all six fictional generated covers only in labeled
  demo/design fixtures. Preserve original PNG bytes and generation provenance;
  do not insert fictional recordings into a real user's library.
- Preserve the separate research workspace. This archive is a copy, not a move.

## Platforms and native identity

- The later platform decision is Apple Silicon M-series Macs only, macOS 15+;
  Windows 10+ x64. Remove Intel Mac release support. Original prompt references
  to Mac x64 targets are superseded by this decision.
- Linux was discussed as a possible basic distribution but is not implemented or
  verified; do not advertise a Linux `.app` or AppImage as available.
- Use the real TuneVault icon/logo, native app title, Dock/taskbar icon and About
  presentation. Follow platform icon conventions, including Icon Composer for
  the modern Mac icon. Preserve the original concept/provenance.
- Support native Liquid Glass on macOS 26+ with appropriate fallbacks; this does
  not change the macOS 15 minimum. Verify appearance rather than claiming that
  module loading proves native UX quality.
- Blue and Orange accents work independently with System/Light/Dark appearance.
  Avoid bright startup flashes and preserve current appearance and unsaved work.
- About shows app/runtime/bundled-tool/library versions and offers accessible
  offline third-party notices. Settings and About are separate views.

## Onboarding and interface

- Show a startup loading screen, followed by a mandatory blocking first-run
  disclaimer: personal/educational intent, own/licensed content and no affiliation.
  This later explicit requirement supersedes the original offline-first wording
  where it conflicts. Do not weaken the blocking requirement silently.
- Replace a long text tour with welcome/disclaimer, then a library setup task
  sheet: suggested Library folder, explicit folder choice, then adding music.
  Next cannot continue without a Library folder. Persist consent/onboarding with
  migration-safe defaults.
- Provide actionable empty states, limited one-time contextual tips and Help >
  Welcome Guide to reopen. Use the real accent-aware logo, focus management,
  announced step changes, reduced motion and native Mac/Windows behavior.
- Library uses native selection conventions, keyboard navigation, accessible
  selected state and an inspector following selection; avoid per-row checkboxes.
  Use compact rows, sticky headers and restrained controls.
- Inspector remains in the layout in the later redesign; group fields and pair
  track/disc numbers with totals. Playlist rows remain one line with keyboard
  ordering alternatives. These later directions supersede conflicting early
  mockup details.
- Plain-language UI: “Library folder”, “Check files”, “Untested”, and “songs”
  replace vault, preflight, Baseline and occurrences in visible copy where suitable.

## Metadata and acquisition tools

- Keyless metadata services only: MusicBrainz first, Cover Art Archive for art
  up to 1200px. Master online/offline preference and per-service controls, shared
  rate limiting/cache/backoff, explicit review/apply and `service:id` provenance.
- AcoustID was explicitly cancelled and removed because it needs a shipped app
  key. Do not revive it, Chromaprint/fpcalc integration or a client-key build path
  from earlier plans. Ignore obsolete stored AcoustID preferences safely.
- Manual edits override lookup provenance per field; field locks use the current
  draft state. Applying some suggested fields must not relabel manual fields.
- Controlled LGPL FFmpeg 8.0.1 plus LAME is used on both Mac ARM64 and Windows x64,
  replacing the earlier Windows GPL ffmpeg-static plan. Keep bundled-tool hashes,
  architecture checks, exact sources and corresponding-source release gates.
- Installed apps use bundled tools, not PATH dependencies. No API keys or user
  accounts are required for the keyless metadata features. Provider access and
  rights still need honest, separate handling.

## Distribution, legal and website

- Public unsigned Mac DMG and Windows NSIS installers are the intended release
  formats. GitHub Releases and authenticated update downloads; no paid OS signing
  requirement. Explain personal-project, fun/educational intent and security
  prompts without suggesting that educational intent grants media rights.
- macOS unsigned updates use verified DMG download and guided Quit/Replace/Reopen.
  Update-envelope signing is not Developer ID/notarization or Microsoft signing.
- Development update checks should work without an unhandled GitHub 404, following
  WolfWave's useful development/release separation. No published feed is an honest
  state, not proof of production update installation.
- Native CI/CD must cover all advertised architectures, bundled tools, packaging,
  real installer smoke and installed upgrades. Do not label unrun hardware,
  minimum-OS, security-prompt or accessibility checks passed.
- MIT app license; minimal honest Terms/Privacy; Nathanial Henniges personally as
  publisher; GitHub Issues for contact. Third-party libraries and binaries retain
  their own licensing obligations. Owner source/legal review remains separate.
- Do not publish releases, push tags or change GitHub settings without a separate
  owner instruction. Early discussion of branch/release cleanup is historical,
  not continuing authorization to delete anything.
- Redesign the public website with Mobbin references and a closer relationship
  to `mrdemonwolf/wolfwave`: split hero, direct platform downloads, clear workflow
  sections and real app screenshots. The website is separate from the app UI.
- Preserve download requirements, GitHub sign-in/expiry disclosures for temporary
  CI ZIPs and unsigned-install guidance. A test artifact is not a public release.

## Collaboration and handoff

- Support both Codex and Claude collaboration; retain root `AGENTS.md` and the
  Claude entrypoint. Historical per-file ownership messages coordinated that
  session; agree on current ownership before concurrent edits.
- Keep concise updates: what works, what was verified, what remains and one next
  action. Preserve unrelated work and never claim checks that were not run.
- Save the testing handoff for ChatGPT native computer use. Computer use must
  request owner help for physical-player checks and security/credential prompts.
  The handoff records the old installed 2.6.0 versus new 4.0.0 candidate distinction.
- The last native application acceptance referenced here is run 41535525282 at
  `6b738ad`; see [verification](../docs/verification.md) for actual evidence and
  remaining external gates. Future results should be appended there rather than
  silently rewriting historical research as current proof.
