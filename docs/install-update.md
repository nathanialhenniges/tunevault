# Install and update

The intended artifacts are separate macOS arm64/x64 DMGs and a Windows x64
per-user NSIS installer. An artifact's existence is not proof of native
installation or hardware compatibility; see verification.md for actual checks.

These builds have no Developer ID/notarization or Microsoft publisher signing.
On macOS, verify the official download and use the operating system's
per-app Open/Open Anyway process if you choose to proceed. Do not disable
Gatekeeper globally or remove quarantine recursively. On Windows, inspect the
unknown-publisher prompt; never disable antivirus to install TuneVault.

The macOS path is Check -> authenticated DMG download -> Reveal installer ->
Quit -> replace TuneVault in Applications -> reopen. TuneVault does not
silently replace an unsigned macOS application.

Windows uses NSIS and a user-triggered authenticated update path. Both
automatic download and automatic installation on quit are disabled. Production
update checks remain not configured until the owner supplies a trusted public
key and a signed release envelope. Do not treat a missing key as a successful
update check. A signature is verified before parsing metadata, and the selected
installer is checked against authenticated size/SHA-512 before use.

The app ID remains com.nathanialhenniges.tunevault. Version 4 uses a new durable
library index; it does not silently ingest or modify historical folders.
Import existing owned audio by choosing a vault and Add files/folder. Existing
source files are copied, not moved. Keep backups before replacing any app.
Uninstalling retains library data, media, exports and backups.
