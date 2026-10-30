# Install and update

The intended artifacts are an Apple Silicon macOS 15+ DMG and a Windows 10+
x64 per-user NSIS installer. Intel Macs are not supported. Linux AppImage
packaging has been discussed but is not implemented or verified.
An artifact's existence is not proof of native
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
update checks use the owner's committed trusted public key. Builds without a
trusted key report Not configured. Before a signed release feed is published,
the app reports No published update is available yet; that is not a verified
current-release result. A signature is verified before parsing metadata, and the selected
installer is checked against authenticated size/SHA-512 before use.

The app ID remains com.nathanialhenniges.tunevault. Version 4 uses a new durable
library index; it does not silently ingest or modify historical folders.
Import existing owned audio by choosing a Library folder and Add files/folder. Existing
source files are copied, not moved. Keep backups before replacing any app.
Uninstalling retains library data, media, exports and backups.
