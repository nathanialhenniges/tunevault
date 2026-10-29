# TuneVault

Electron/TypeScript local music archive. Publisher: Nathanial Henniges personally.

- Preserve unrelated work. The old tracked application was intentionally deleted; never restore it wholesale.
- Main owns native permissions and narrow validated IPC. Sandboxed renderer never receives raw Node/IPC access.
- A single utility process owns SQLite, media jobs and exports. Do not block the UI with probing/conversion.
- Original import files remain untouched. Keep stable IDs and duplicate playlist occurrences.
- Each target has independent revisions/receipts. Prepared/exported/user-confirmed/volume-verified are distinct.
- Never delete unknown export files or pretend iMazing/MTP handoffs verify a device transfer.
- Bundle tools, validate hashes and architecture, never rely on PATH in installed apps.
- Demo art is fictional/generated, opt-in only. Preserve original PNG bytes and provenance.
- Run typecheck, unit/integration and packaged E2E. Source tests are not native installer/hardware proof.
- No releases, tags, GitHub settings, or production signing keys without explicit owner instruction.
- Keep legal drafts honest and About-accessible. MIT app code does not relicense bundled binaries.
