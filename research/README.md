# TuneVault requirements and research archive

This directory preserves the original planning material and later owner decisions
so future work does not depend on this chat or the separate research workspace.
Copied on 2026-11-03. The original workspace was read only and remains unchanged.

## Start here

1. [Later decisions and requirements](owner-decisions.md): changes made during
   implementation, including platform support and removal of key-based services.
2. [Complete original implementation prompt](original/docs/codex-rebuild-prompt.md):
   all instructions below its opening divider, preserved verbatim.
3. [Original project brief](original/docs/project-brief.md) and
   [preview walkthrough](original/docs/preview-walkthrough.md).
4. [Computer-use testing handoff](computer-use-testing-handoff.md): the saved
   testing plan, native build links and owner-assisted device checklist.
5. [Current verification record](../docs/verification.md) and
   [physical acceptance checklist](../docs/hardware-acceptance.md): actual evidence
   and remaining gates; the archive is not proof of completed implementation.

## What is preserved

`original/` contains every file from the original TuneVault research directory:
architecture and device research, release/testing research, design reviews,
legal drafts, the interactive HTML prototype, its screenshots, the original logo,
six fictional album covers with their generation manifest, research checks and
the original research-specific `AGENTS.md`.

Relative paths are preserved so the prototype and its images remain together.
The prototype simulates workflows; it is not the working application. Its
research validation scripts may depend on their original workspace/tools and
are archived as evidence, not added to the application's test commands.

[original-manifest.json](original-manifest.json) records each original relative
path, byte size and SHA-256. Original Markdown, HTML, images and manifests were
copied without rewriting or stripping provenance. Identical cover/logo copies
already used by the app remain in their existing locations.

## Historical versus current

The original prompt and dated research are historical records. Later explicit
owner decisions supersede earlier recommendations; use [owner-decisions.md](owner-decisions.md)
together with current code, repository-root `AGENTS.md` and verification records.
The archived `AGENTS.md` describes the original research task, not a new
instruction to undo the rebuild. Old legal drafts do not replace the current
[Terms](../docs/terms-of-use.md), [Privacy](../docs/privacy-policy.md) or
[third-party notices](../THIRD_PARTY_NOTICES.md).

Other notes already committed in this repository:

- [Onboarding research](../docs/onboarding-research.md).
- [Metadata services research](../docs/metadata-services-research.md).
- [Website research and design references](../site/DESIGN.md).
- [Architecture](../docs/architecture.md), [formats/devices](../docs/formats-devices.md),
  [providers](../docs/providers.md), [sidecars](../docs/sidecars.md) and
  [backup/restore](../docs/backup.md).
- [Release gates](../docs/release.md), [update trust](../docs/update-trust.md) and
  [install/update guidance](../docs/install-update.md).

The testing handoff is a dated snapshot. Recheck its installed-app version,
artifact availability and expiry before testing. Never infer hardware playback,
minimum-OS support, production signing or legal approval from passing CI.

This archive is kept outside `docs/` so it is not automatically bundled with the
app's user-facing documentation. Nothing here authorizes releases, tags,
repository settings changes or destructive cleanup.
