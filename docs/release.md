# Release and trust gates

No release is authorized by the rebuild request. Do not create/push a tag,
change GitHub settings or publish assets without a separate instruction.

1. Install with npm ci and prepare the native tool bundle using tools:prepare.
2. Run lint, typecheck, unit/integration tests, binary verification and build.
3. Package on each native runner: macOS arm64, macOS x64 and Windows x64.
4. Test the exact packaged executable and bundled resources with test:e2e.
5. Run scripts/build-upgrade-candidates.mjs for isolated N -> N+1 installers.
   These separate test builds embed a disposable public key and loopback
   transport; production builds cannot use that endpoint/configuration.
6. Audit source/license completeness and OS metadata/icons. Keep evidence and
   candidate hashes. A missing native gate blocks release promotion.
7. Only after owner authorization, sign the release envelope with the protected
   release key and promote all verified candidates together. No partial feed.

The production updater trusts only resources/update-keys.json publicKeys.
It is intentionally empty until the owner supplies a key. Generate an Ed25519
key offline, keep its private half in encrypted owner backup and the protected
release environment, and commit only its public PEM. Never put a production
private key in the repository, logs, installers or PR jobs. See update-trust.md
for exact setup and rotation details.

macOS unsigned updates are verified DMG downloads and manual replacement.
Windows uses real NSIS installed upgrades; running an unpacked exe is not
installed-upgrade proof. Both automatic download and install-on-quit are off.
Test-only signing keys are deliberately disposable and confer no production
trust. Installer test artifacts must never be published as production builds.

Current native requirements are declared by the pinned runtime and sidecars;
the controlled Mac media build targets macOS 14+. Fresh quarantine/Gatekeeper
and Windows reputation prompts remain manual checks. Physical iPod and USB
playback are separate gates described in hardware-acceptance.md.

Corresponding-source review is a fail-closed promotion gate. After reviewing
the exact tested candidates and their bundled-tool obligations, the owner
provides `RELEASE_SOURCE_REVIEW_JSON` in the protected signing environment,
or `resources/release-source-review.json` for local staging. No approved
production record is supplied by the repository.

The schema is `{ "schema": 1, "platforms": { ... } }`. Each required platform
(`darwin-arm64`, `darwin-x64`, `win32-x64`) must have `artifactSha512` matching
its tested installer, `status: "corresponding-source-reviewed"`, an actual
`reviewedBy` and ISO `reviewedAt`, plus `sourceArchives` entries containing
`name`, `sha256`, and an HTTPS `url`. Review covers the complete bundled-tool
arrangement, including yt-dlp/PyInstaller dependencies, not only FFmpeg/LAME.
Staging verifies cached archives or downloads their exact reviewed bytes.
The final gate checks their hashes again. Source archives and the review
record travel with the candidate and eventual release. Missing review,
changed installer identity or changed source bytes prevents promotion.
