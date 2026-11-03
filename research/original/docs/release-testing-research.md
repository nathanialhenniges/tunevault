# TuneVault unsigned releases, updates, and E2E research

Researched: 2026-10-28. Status: implementation plan and primary-source research; no app build, workflow execution, release, secret provisioning, or update was performed. Public installers are intended for others even though TuneVault is a personal archive application.

## Unsigned release policy

Nathanial explicitly chose **no OS code signing**. Prepare unsigned macOS DMGs and Windows NSIS installers, with honest installation guidance and the limitations below. Do not make paid signing credentials a build prerequisite. CI quality does not replace OS publisher verification.

An unsigned/non-notarized macOS download can be blocked by Gatekeeper. Document Apple's per-app Privacy & Security → Open Anyway process where the OS permits it. Do not ship instructions that disable Gatekeeper globally, strip quarantine recursively, or tell users to suppress antivirus. Apple Silicon executable integrity can still involve toolchain-generated ad-hoc signatures; this is not an identified Developer ID signature or notarization, and must not be advertised as either. Verify the exact artifact on actual supported macOS versions. [Apple's per-app opening guidance](https://support.apple.com/en-gb/102445), [electron-builder macOS signing options](https://www.electron.build/docs/mac/).

Unsigned Windows installers can show unknown-publisher/SmartScreen warnings. Say that plainly in the download/install guide. Passing E2E or a malware scan is not proof that Windows will trust the publisher. [Microsoft code-signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).

Prepare release CI and unsigned candidate artifacts without publishing during this research task. The eventual rebuild must implement release automation, but uploading a new public release now is outside scope.

## Update strategy under the unsigned constraint

| Platform | Recommended first-release behavior | Supported claim |
| --- | --- | --- |
| Windows | `electron-updater` with an NSIS per-user installer; auto-check, user-controlled download, explicit Restart and update action when no media jobs are active | A real installed-version-to-next-version update, after E2E proof |
| macOS | Automatic release checks, version/changelog display, compatible DMG download/checksum validation, Reveal installer, and guided quit/replace/reopen | Update notification/download assistance; replacement remains manual |

**The normal Electron/macOS updater requires a signed app.** Electron's docs state this explicitly, and current `electron-updater` `MacUpdater` delegates to native Squirrel.Mac. An unsigned app must not call `quitAndInstall()` and claim this is supported. Custom replacement helpers are possible software projects, but are an extra privileged update mechanism with permissions, rollback, Gatekeeper and integrity behavior to own; they are not a one-setting fix. Keep macOS manual replacement unless Nathanial later changes the signing policy or explicitly chooses that separate project. [Electron autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater), [electron-builder update requirements](https://www.electron.build/docs/features/auto-update/), [current MacUpdater implementation](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/MacUpdater.ts).

### Stable-version boundary

Checked through the npm registry on 2026-10-28: `electron-builder` latest is **26.18.0**, and `electron-updater` latest is **6.8.11**; the `next` tags are **27.0.0-alpha.14** and **7.0.0-alpha.13**. The `/docs/` builder site currently describes unreleased v27, while `/v26/docs/` is stable documentation. Recheck package dist-tags when implementation starts and pin the tested stable pair. Do not install an alpha just because the main documentation looks newer.

For stable v26 unsigned Windows, opt out of OS signing explicitly and inspect the actual generated `app-update.yml` to ensure it has **no stale `publisherName`**. Direct inspection of the official `electron-updater@6.8.11` npm tarball confirmed `NsisUpdater` returns without Authenticode checking when that field is absent; `AppUpdater` defaults both `autoDownload` and `autoInstallOnAppQuit` to true, so the authenticated flow below must explicitly turn both off. `downloadUpdate()` returns downloaded paths for the independent digest check. This source inspection is not a Windows installation test. [Exact inspected npm package](https://registry.npmjs.org/electron-updater/-/electron-updater-6.8.11.tgz), [stable update guide](https://www.electron.build/v26/docs/features/auto-update/).

Unreleased v27 introduces a different explicit `win.verifyUpdateCodeSignature: false` opt-out and fails closed when a publisher is missing; that setting must not be assumed available in stable v26. Confirm the selected version's source/config schema before implementation. Do not add a custom verifier that returns success for every signature. [Upcoming Windows configuration changes](https://www.electron.build/docs/migration/v27-build-changes/).

### Approved free update-verification key

Nathanial approved a free cryptographic update-verification key while keeping the OS app unsigned. These are separate trust layers: the key authenticates releases to existing TuneVault installations; it does not establish OS publisher identity or remove OS warnings.

**Stable implementation recommendation:** use a small **Ed25519-signed release envelope** verified through Node's standard `crypto` API, in front of stable `electron-updater` on Windows and the assisted DMG downloader on macOS. No paid service or new cryptographic library is needed. This is a proposed integration contract, not existing implemented code.

1. Release CI emits bounded UTF-8 `release-envelope.json` bytes with schema version, release version, channel, minimum OS versions and assets keyed by OS/architecture, including exact filename/approved HTTPS URL, size, SHA-512 and dependency-manifest reference. It emits a detached Ed25519 signature over those **exact bytes**. Do not parse and reserialize before verification.
2. The application embeds the trusted public key from its first release. Fetch the envelope/signature with strict size/time/host limits; verify the bytes, then parse and validate the schema, channel, semantic version, OS and architecture. Missing, invalid, unknown-key or tampered signatures fail closed. Replayed older versions never cause downgrade.
3. Windows sets `autoDownload=false` and `autoInstallOnAppQuit=false`. Check for update metadata, compare the returned version, installer URL, size and checksum with the verified envelope, and reject any discrepancy before downloading. After download, independently verify the actual cached installer against the envelope before enabling the explicit Restart and update action. Rehash the final local file immediately before installation. No unauthenticated feed field may change which executable is installed. Verify the pinned updater's cache/install behavior in source and E2E; keep the verified envelope/asset identity through this flow to avoid a check/use race.
4. macOS downloads the DMG asset described by the verified envelope to a temporary file, validates size and digest, finalizes it, and reveals it for manual installation. It never delegates unsigned replacement to Squirrel.Mac. Persist only verified pending-download state, never mark the new app installed until a new-version launch is observed.
5. A failed update check or validation leaves the current app/library usable and offers Retry/manual release page. Never execute an unverified download. The initial install still relies on the user's trust in the official GitHub download; embedding a key cannot retroactively authenticate an untrusted first binary.

Reference: [Node cryptographic signing and verification](https://nodejs.org/api/crypto.html#cryptoverifyalgorithm-data-key-signature), [stable electron-updater flow](https://www.electron.build/v26/docs/features/auto-update/).

**Future simplification:** unreleased v27/v7 documents built-in Ed25519 update-manifest verification and key rotation. If it is stable and tested when the rebuild begins, prefer that native mechanism over a custom envelope on Windows; reuse its verified metadata for the macOS assisted download where the supported API permits it. The next-version docs sign a canonical subset of manifest fields, not raw YAML bytes. Do not mix that protocol with the raw-byte envelope. [Upcoming signed manifests](https://www.electron.build/docs/features/signed-update-manifests/), [upcoming key rotation](https://www.electron.build/docs/features/key-rotation/).

Owner/CI key setup requirements, to implement later:

- Generate an Ed25519 keypair once outside the repo through Node `crypto.generateKeyPairSync('ed25519')` or an equivalent established tool; do not generate secrets in this research task.
- Store the private key in a protected GitHub environment secret and an owner-controlled encrypted offline backup. Embed only the public key and key ID. Never echo, commit, upload as an artifact, or expose the private key to PR jobs. Base64 encoding is transport, not encryption.
- Let ordinary builds/tests embed the fixed public key without access to the private key. Restrict signing to the release step after all candidate tests. Exercise verification tests with a separate disposable test key.
- Rotation needs a bridge release trusting current and next public keys, with releases signed so older installs can verify the bridge. Retain old-key compatibility long enough for skipped versions, or provide an explicit manual recovery path. Lost or compromised keys may require manual reinstall; document this honestly.
- A compromised GitHub release account without the private key should fail verification for existing clients. A compromised signing key or signing workflow can authorize malicious artifacts; tests and checksums cannot eliminate that risk.

Use GitHub Releases as the first distribution/feed host; no extra Cloudflare service or VPS is required. Gate release creation on successful candidate validation. Do not publish update metadata before its complete artifacts exist. Release checks must preserve an offline usable library: timeout/network errors are a small nonblocking status with Retry, not a startup failure. Respect user settings, skip prereleases unless opted in, reject unsupported architecture, show download progress, retain the current working app on failure, and never install during an active download/export or OS shutdown.

Keep whole-app dependency updates initially. Do not let yt-dlp mutate the installed bundle itself. Provide versions in Diagnostics and a repair/update action for provider breakage. Test a specific official nightly or stable yt-dlp release before shipping; its maintainers recommend nightly for regular users and warn that stable can lag provider changes. [yt-dlp update policy](https://github.com/yt-dlp/yt-dlp#update).

## E2E CI/CD plan

Use **Playwright's Electron API** for the main E2E suite, with the exact pinned Electron version tested. This API is officially experimental; isolate its launch code in the test fixture so a future change does not affect app code. Launch the packaged executable through `executablePath`, not only a Vite dev server. Mock native file dialogs at the Electron boundary for deterministic tests and separately do manual OS-dialog/drop checks. Playwright does not drive native Electron file dialogs. Avoid weakening production fuses merely to make an automation fixture pass; if the production build disables Node CLI inspection, use a test artifact with that single documented difference plus a non-debug production launch/IPC smoke test. [Playwright Electron API and known limitations](https://playwright.dev/docs/api/class-electron), [Electron automated testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing).

Proposed pipeline:

1. **Pull request checks:** lockfile install, formatting/lint/typecheck, focused unit tests, local deterministic media fixtures, and dependency/license-manifest validation. Keep tokens read-only and no release secrets for untrusted PR code.
2. **Packaged E2E matrix:** native macOS arm64, native macOS x64, Windows x64 on explicit supported current runner images; verify actual runner architecture and bundled binary architectures. Linux/Xvfb can provide a cheaper extra early check, but cannot substitute for either supported OS. Use fresh temporary userData/library/export roots per test and never touch the runner user's actual music folder. [Playwright CI/Xvfb guidance](https://playwright.dev/docs/ci).
3. **Installer tests:** on Windows run the actual NSIS installer, launch the installed app, exercise media processing, update to a second test version from a loopback feed, reopen the same library, and uninstall while retaining user data. On macOS mount the DMG, copy the app, launch the copy, exercise processing, and test the documented manual replacement preserving the same library. Hosted macOS CI is not proof of browser quarantine/Gatekeeper prompts.
4. **Candidate gates:** reject missing binaries/notices, wrong architecture, wrong versions, unparseable manifests, bad hashes/sizes, missing platform assets, mismatched release tags, or an app that only works because Homebrew/tools are on `PATH`. Verify updater metadata with the exact production verifier with the approved update key.
5. **Release job:** only a protected tag or approved dispatch after all required platform jobs pass; pin third-party Actions to audited commit SHAs, grant `contents: write` only to the publishing job, build once and promote the same tested artifacts, publish all artifacts before/with the release/feed atomically as supported. Failed or incomplete runs leave no public update. Keep changelog, hashes, dependency versions, test evidence, and notices beside artifacts.
6. **Post-release probe:** read the public feed/assets back, verify tag/version/architecture/digests, and run an installed prior-version updater canary where possible. A canary discovers faults; it cannot undo an update already delivered to users, so candidate gates remain mandatory.

Use generated media or checked-in small owned/public-domain fixtures and fake provider responses for normal CI. Live provider extraction is opt-in/scheduled against an authorized sample; it is too variable for every PR's sole gate. Export-order and transfer-state logic must be asserted from the database, generated playlists, and filesystem, not screenshot comparison alone.

Updater test cases must cover no update, one new update, prerelease filtering, offline/timeout, bad manifest, changed manifest after download, wrong digest, truncated artifact, wrong architecture, missing asset, denied installation path, active media jobs, canceled download, restart, and upgrade preserving metadata locks/playlists/receipts/schema. For Windows test the exact unsigned-signature opt-out in the packaged `app-update.yml`; for macOS assert that the UI offers manual replacement and never reports an automatic install succeeded.

Save screenshots/traces/logs and platform manifests on failure, redact tokens/paths, set job timeouts, and limit test media sizes. Do not call a workflow green when a required OS matrix leg was skipped. Installation on real devices and a fresh quarantined Mac download remain manual release checks.

## Evidence boundary

No candidate installer or upgrade has run. CI design is not execution evidence. No Gatekeeper/SmartScreen workflow or on-device transfer was tested here. Source/API research cannot guarantee that unsigned OS installation or replacement is frictionless.
