# Update trust and owner setup

Production update checks are disabled until an owner-provided Ed25519 public key is committed in `resources/update-keys.json`. The current empty `publicKeys` array fails closed. No production key was generated for this rebuild.

The release signature authenticates updates to an already trusted installation. It is separate from Apple/Microsoft code signing and does not remove Gatekeeper, unknown-publisher or SmartScreen warnings. First-install trust still depends on obtaining the installer from the official repository. A compromised release-signing workflow or private key can authorize a malicious update.

## First production key

Perform these steps on an owner-controlled machine. The commands below are setup instructions; they have not been run to create a production key.

1. Choose a private directory outside every repository and cloud-synced working folder. Generate an Ed25519 key there:

   ```sh
   mkdir -m 700 ~/TuneVault-release-key
   openssl genpkey -algorithm ED25519 -out ~/TuneVault-release-key/private.pem
   chmod 600 ~/TuneVault-release-key/private.pem
   openssl pkey -in ~/TuneVault-release-key/private.pem -pubout -out ~/TuneVault-release-key/public.pem
   ```

2. Save an encrypted offline backup of the private key and test recovery. The signing script expects an unencrypted PEM in memory through the protected environment secret; keep the backup encrypted and never commit the private PEM. Do not put it in logs, artifacts, installer resources or PR jobs.
3. Copy the public PEM, including its newlines, into `resources/update-keys.json` as a JSON string:

   ```json
   {
     "schema": 1,
     "publicKeys": [
       "-----BEGIN PUBLIC KEY-----\nPUBLIC_KEY_CONTENT\n-----END PUBLIC KEY-----\n"
     ]
   }
   ```

4. Commit and review only the public-key change. Ordinary development and PR checks require no production private key.
5. In GitHub, separately configure a protected `release-signing` environment with required owner approval and a `RELEASE_SIGN_PRIVATE_KEY` secret containing the complete private PEM. The owner can set it without printing the key:

   ```sh
   gh secret set RELEASE_SIGN_PRIVATE_KEY \
     --repo nathanialhenniges/tunevault \
     --env release-signing < ~/TuneVault-release-key/private.pem
   ```

6. Configure a separate protected `release-publish` environment. This repository does not change environment protection or GitHub settings automatically. Review who can edit release workflows and approve those environments.

The source fixtures under `tests/fixtures/update-test-*` are disposable public test credentials. They are not production trust anchors. Only the separate `TUNEVAULT_INSTALLER_TEST=1` build resolves the loopback test configuration; production builds use `src/update/config.ts` and the committed production public keys.

## Candidate authentication and publication

The native verification workflow builds production candidates once on macOS arm64, macOS x64 and Windows x64, tests their packaged resources/UI, then exercises separate installed-upgrade fixtures. The evidence records the production candidate's filename, size and SHA-512. An unsuccessful or missing matrix leg blocks the release workflow.

The manual **Prepare or promote verified release** workflow defaults `publish` to false. It collects all three candidates, adds release notes/notices, signs one envelope, validates it, and uploads an authenticated candidate artifact. `scripts/release-envelope.mjs` requires the private key to derive one of the committed public keys. Its exact UTF-8 bytes are signed before any client parses the JSON.

For an owner-approved local signing run with the protected key already loaded into `RELEASE_SIGN_PRIVATE_KEY`:

```sh
node scripts/release-envelope.mjs dist/release-candidate
node scripts/check-release.mjs dist/release-candidate
```

These commands do not upload anything. The expected directory contains the exact tested `TuneVault-<version>-mac-arm64.dmg`, `TuneVault-<version>-mac-x64.dmg`, `TuneVault-<version>-win-x64.exe`, platform evidence JSON files, release notes, license and third-party notices. Package, tag, installer and envelope versions must agree. Native installed-upgrade evidence and matching artifact hashes are required.

Publication requires a separate owner action, an existing reviewed `v<version>` tag, a dispatch with `publish=true`, and the protected publication environment. `scripts/publish-release.mjs` uses `gh release create --verify-tag`, uploads the complete candidate, downloads the public result again and reruns the release checks. It never pushes a tag. Do not approve publication while a corresponding-source, platform or hardware claim remains unsupported.

## Client verification and installation

The client fetches bounded metadata and signature files from the official repository, verifies the signature over the original bytes, validates the stable version/channel/OS/architecture and exact GitHub asset URL, and rejects downgrades. Downloaded installers must match the authenticated size and SHA-512. Cached files are hashed again before reveal/installation. Redirects are restricted to GitHub's supported asset hosts.

Windows disables automatic download and install-on-quit, compares updater feed identity with the authenticated asset, verifies the cached installer, and installs only after an explicit user action with no active media jobs. Stable updater 6 must have no stale `publisherName` in the unsigned package's `app-update.yml`; the package verification script checks it on Windows.

macOS downloads and verifies the DMG, then offers Reveal installer and the manual Quit, Replace, Reopen workflow. It does not invoke unsigned Squirrel replacement or claim silent auto-installation. Library/user data is retained independently of the application bundle.

## Rotation and recovery

For normal rotation, generate the next key outside the repository. Ship a bridge release containing both old and new public keys, signed by the old private key so existing installations can verify it. Keep releases signed with the old key while installations that skipped the bridge still need an automatic path. Verify installed upgrades and retain both owner backups before retiring anything. This implementation emits one detached signature per envelope; it does not promise dual-signature publication.

If the old private key is lost before a bridge is available, existing clients cannot authenticate a new key. Distribute a clearly explained manual reinstall through the official repository; preserve user data and verify backups. If a key is compromised, stop automated publication, investigate the signing workflow and provide a manual recovery path. A release signed by the compromised key cannot establish renewed trust for a client that already trusts that key.

Never work around a signature, digest, version or architecture failure by disabling verification. The offline library remains usable while updates are unavailable.
