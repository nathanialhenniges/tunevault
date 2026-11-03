# TuneVault

Research and rebuild preparation for `nathanialhenniges/tunevault`, a personal desktop audio archive, metadata, playlist, and portable-player library tool for macOS and Windows.

## Scope

- This folder holds research, a UI prototype, brand concepts, and a self-contained future Codex prompt. Application implementation belongs in the TuneVault repository.
- Start with `docs/project-brief.md` and `docs/codex-rebuild-prompt.md` when present. Research documents contain dated evidence and source links; recheck volatile APIs before implementation.
- Keep research and prose in `docs/`, prototype assets in `assets/`, and checks in `scripts/`. Use lowercase-kebab filenames.
- Preserve the TuneVault repository and installed tools: inspection only during this research task. Do not erase, rebuild, publish, or transfer music to a device.
- Distinguish prepared exports from physically verified transfers. iMazing handoff is not automatic iPod sync.
- Preserve source quality provenance. Encoding a lossy stream as FLAC does not restore lossless audio.
- Use only media the user may lawfully archive. No DRM circumvention or extraction of Spotify/Apple Music subscription audio.
- Keep AI-generated logo provenance and describe it honestly as a concept.
- Release intent: personal archiving app with public unsigned macOS and Windows installers. A free cryptographic key for update verification is approved; OS certificate signing is not planned. Never promise automatic unsigned macOS app replacement.
- Nathanial rejected the first preview's generic feel and weak dark theme. Use the design-review findings: restrained native typography, compact library tables, neutral charcoal dark surfaces, explicit theme-state contrast, and no marketing slogans or repeated decorative status badges. The prototype is a direction to evaluate, not an approved final design.
- Nathanial personally is the publisher/MIT copyright holder. GitHub Issues is the chosen contact route; no public email. Terms cannot promise immunity from all liability.
- Blue and Orange accents must work independently of light/dark appearance. The future app also needs persisted System appearance. Theme changes must not recolor artwork or reset work.
- Six fictional imagegen album covers and their exact prompts live in `assets/demo-covers/manifest.json`. Reuse the actual assets in demo/design fixtures; preserve provenance and intentional missing-art states. No demo audio is supplied.
- Multi-device planning separates device/destination identity, transport and compatibility profile. Read `docs/device-workflow-comparison.md` and `docs/desktop-reference-study.md`; do not claim USB, MTP and iPod transfers are interchangeable. Nathanial confirmed MP4 means portable MP4 players; music remains the focus and video download/conversion is outside scope.

## Preview

Use the root static server: `./scripts/serve.sh personal/tunevault 1347`, then open `/docs/interface-preview.html`. The named launch entry is `tunevault-interface-concept`. Demo controls simulate workflows only.

## Validation

Run `git diff --check` after text edits, `python3 personal/tunevault/scripts/check-research.py`, and `python3 personal/tunevault/scripts/check-interface.py` from the workspace root. Inspect the prototype in a browser at desktop and narrow desktop sizes. Prototype data is fictional and must be labeled. Record unavailable browser/hardware checks in `docs/validation-record.md` rather than claiming they passed.
