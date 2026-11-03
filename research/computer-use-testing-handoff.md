# TuneVault: ChatGPT computer-use testing handoff

## Next objective

Test the actual TuneVault 4.0.0 native application through computer use, collect screenshots and reproducible results, and complete only acceptance checks supported by direct evidence. Work one test at a time. Ask Nathanial to perform physical-device actions, listen to playback, and handle OS security prompts. Do not claim a test passed from code, CI, a screenshot, or a successful file copy alone.

This is a testing handoff, not authorization to publish releases, change GitHub settings, sign production releases, delete existing libraries, or modify application code.

## Read this first

- Publisher: Nathanial Henniges personally. Personal project for fun and educational use; MIT app code. Only use owned, licensed, or synthetic test audio.
- Current support: Apple Silicon M1+ Macs, macOS 15+; Windows 10/11 x64. No Intel Mac, Linux, or Windows ARM release support.
- Installers are unsigned. Update-envelope authentication is separate from OS code signing.
- On 2026-11-03, `/Applications/TuneVault.app` reports **2.6.0**. That is the old app. Do not test it as the rebuild or replace it without Nathanial's confirmation and backup plan.
- The tested rebuild is **4.0.0, application commit `6b738ad`**. Version alone cannot distinguish earlier 4.0.0 builds: retain the download's native CI run identity.
- The development checkout was clean on branch `main`, HEAD `a7ab282` (verification-doc update). No source edits are needed for this test session.
- The rebuild goal is blocked on external acceptance, not marked complete.

## Get the correct build

Start at https://nathanialhenniges.github.io/tunevault/#downloads . Links can change; inspect the displayed commit, requirements, expiry and sign-in notice before downloading.

The following exact test artifacts were unexpired when rechecked on 2026-11-03. Both expire on 2026-11-16 around 22:22 UTC and require GitHub sign-in:

- Mac ARM64: https://github.com/nathanialhenniges/tunevault/actions/runs/41535525282/artifacts/13184167366
- Windows x64: https://github.com/nathanialhenniges/tunevault/actions/runs/41535525282/artifacts/13185130870
- Native CI evidence: https://github.com/nathanialhenniges/tunevault/actions/runs/41535525282

Extract the artifact ZIP; the installer is inside `dist/` (DMG on Mac, EXE on Windows). Preserve the accompanying `test-results/evidence-*.json`. Do not confuse production-candidate installers with disposable-key upgrade fixtures or older downloads. These are temporary CI builds, not a published release.

Use a dedicated OS test account if available, with Nathanial handling account setup. A different Library folder alone does not isolate app settings or the SQLite index. If no isolated environment is available, stop before installation or launch against existing data and let Nathanial choose a safe backup/test arrangement. Do not enable E2E flags or inject test IPC to simulate manual acceptance.

Use the available computer-use surface for the native app. A browser-only session cannot perform native-app or physical-player tests; report that limitation instead of substituting website screenshots.

Nathanial must handle credentials, Gatekeeper/Open Anyway and Windows reputation/security warnings. Never disable Gatekeeper/antivirus, recursively remove quarantine, or bypass a browser security interstitial. Observe and record the actual prompt if one appears; do not manufacture a fresh-install result from a previously trusted app.

## What already passed

Run 41535525282, commit `6b738ad`, passed on native macOS ARM64 and Windows x64:

- Typecheck, lint, 178 unit/integration tests.
- 11 packaged E2E tests per platform, native package/tool/icon checks.
- Exact production installer smoke tests and separate disposable-key installed N-to-N+1 upgrade tests with retained data.
- Split retry regression: completed segments are not duplicated after partial failure/restart; edits survive and corrupted completed bytes block retry.
- Keyboard reorder regression: repeated moves preserve focus and distinct duplicate-song occurrences.

These results do not prove physical playback, minimum-OS operation, screen-reader usability, fresh security prompts or production release signing. A local full packaged suite also passed 11 tests; its installed-upgrade test was intentionally skipped outside the dedicated native phase.

## Session rules and evidence

1. Inventory the visible app/version, host OS, architecture, available test device and iMazing version. Record unknown values as unknown. The engineering host was macOS 27.0.1, not minimum-supported macOS 15.
2. Before changing data, agree on a clearly named disposable test Library folder and export destination with Nathanial. Keep existing files and devices untouched unless explicitly selected for the test.
3. Read current screen/accessibility state before each action. Use normal UI controls. Take a screenshot for a meaningful result or failure; avoid exposing personal music, serial numbers, account details, cookies or unrelated windows.
4. Use PASS / FAIL / BLOCKED / NOT RUN. Include exact observations and artifact/device identities. A disabled or unavailable feature is not a pass.
5. For a bug: record build/run, OS, starting state, exact steps, expected result, actual result, persistence after reopening, and screenshot. Stop destructive repetition; do not repair source in this testing chat.
6. Never mark transfer or compatibility confirmed until Nathanial reports the corresponding physical checks. Computer use cannot hear audio or inspect a disconnected player's screen.

## Test order

### 1. Install, launch, onboarding, About

- Let Nathanial handle any OS security approval and any consent he must personally accept. Record what the unsigned prompt says.
- Launch the selected 4.0.0 candidate. Verify About shows Version 4.0.0; retain the download run ID as build provenance.
- In a genuinely fresh profile, verify the disclaimer blocks entry. Do not reset existing acceptance/settings to manufacture first-run evidence.
- Verify setup cannot advance without a Library folder; choose the agreed test folder, then add only approved test files.
- Verify About exposes runtime/bundled-tool/library versions and **Third-party notices** opens an offline readable page/dialog.
- Reopen the welcome guide through Help > Welcome Guide. Record whether focus returns sensibly on close.

### 2. Native UI, accessibility and persistence

- Test System, Light and Dark appearance, with Blue and Orange accents. Start in the owner's current appearance to avoid a bright flash.
- Check 1440x900 and 1024x768 where the display permits, then 200% zoom. Record actual sizes/settings; do not claim exact dimensions from estimation.
- Use keyboard navigation for Library selection, search, opening/closing dialogs and repeated playlist reorder (Alt+Up/Down). Verify visible focus, labels, Escape behavior and no trapped/unreachable actions.
- With Nathanial operating or authorizing the relevant accessibility tools, test VoiceOver on Mac or NVDA on Windows: headings, table/selection state, control names, dialogs and job/status announcements. A visible accessibility tree is not a screen-reader pass.
- Exercise actual native file/folder pickers and drag/drop with disposable test files. Automated picker mocks are not evidence for this step.
- On macOS 26+ inspect native appearance and reduced-transparency behavior if that environment is available. Nathanial controls OS accessibility settings; record and restore any agreed temporary change.
- Quit/reopen: check the test Library, tags/locks, playlist order, target history and appearance persist. Do not reset or delete real app data.

### 3. iPod touch 6 through iMazing (owner-assisted)

- In Devices & exports create a named iMazing target using the agreed disposable folder. Record iPod model, iOS version, iMazing version and host OS; omit serials from shared reports.
- Open its **Compatibility** tab. Save the intended format/profile before testing it.
- Choose **Prepare synthetic test pack…**. Wait for completion, then **Reveal target folder**. Verify the generated files/report exist. Preparation alone is only a local result.
- Test MP3, AAC and ALAC separately where the target/profile exposes them. Use unique test folders so one pack does not replace another.
- Ask Nathanial to transfer through iMazing and check playback, embedded artwork, non-ASCII tags, seeking and exact repeated A/B/A playlist order on the iPod. Do not infer playlist creation/order from importing a folder or M3U.
- A long owned/synthetic mix is a separate check: ask Nathanial to seek near the start/middle/end and report what actually played. The short compatibility tones do not establish long-mix seeking.
- Enter the observed **Physical player test results**, model and firmware. Only check **I tested this saved profile on the named physical player and firmware** after Nathanial confirms the actual checks. Save the compatibility profile.
- The compatibility pack itself creates no ordinary library transfer receipt. For a separate normal prepared batch, use **Mark batch transferred…** only after that exact batch was physically transferred and checked; keep another target pending.

### 4. Named USB/SD player (owner-assisted)

- Record player model/firmware and intended filesystem/connection. Choose only the explicitly agreed test subfolder on the correct volume.
- Prepare/copy the synthetic pack using that target. Confirm known-file verification and inspect the omission/report details; never delete unknown files to make room.
- Ask Nathanial to check real playback, seeking, tags, artwork, repeated playlist order and supported formats on the player.
- Record verified-copy and user-tested-playback evidence separately. Do not label every portable player universally compatible.
- A mid-write unplug test is optional and requires a disposable test volume and explicit owner agreement. Do not unplug a volume containing valuable files. Reconnect must not lose target identity/history; inspect errors and retry recovery.
- MTP folder handoff is not direct MTP transfer or playback verification.

### 5. Updates and minimum OS

- Before a published signed release feed exists, a manual update check should show **No published update is available yet**, not an unhandled remote-method/404 error. Do not call this proof of a current public release or production update installation.
- Production download/signature/install tests cannot be completed without an owner-approved release/feed. Do not create one, change keys or use a CI test private key as production trust.
- Test macOS 15 ARM64 and Windows 10 x64 only if those real OS environments are available. A newer OS, Info.plist minimum, compatibility mode or CI on a newer runner cannot prove minimum-OS support.
- Windows work requires a Windows computer-use session or Nathanial's friend following the same report format. Mark it BLOCKED on a Mac-only session.

## Finish with this report

Build/run and download source:
Host OS / architecture:
Test profile/folder (redact private path portions):
Device model / firmware / iMazing version where applicable:

| Test | PASS / FAIL / BLOCKED / NOT RUN | Direct observation | Screenshot or owner confirmation |
| --- | --- | --- | --- |
| Correct 4.0.0 candidate / install prompt | | | |
| First-run / setup / About / notices | | | |
| Light / Dark / System and both accents | | | |
| Keyboard / zoom / native pickers / drag-drop | | | |
| VoiceOver or NVDA | | | |
| Quit/reopen persistence | | | |
| iPod formats / artwork / tags / A-B-A order | | | |
| Long-mix playback / seeking | | | |
| USB copy verification versus player playback | | | |
| Manual update check | | | |
| Minimum OS | | | |

List reproducible bugs and the single next owner action. State every unrun check. Return the report to the original TuneVault engineering chat; do not mark the rebuild complete or claim release/legal/source-review approval.

## Engineering references

Repository: https://github.com/nathanialhenniges/tunevault

Local checkout: `/Users/nathanialhenniges/Developer/nathanialhenniges/tunevault`

Read these if filesystem/repository access is available; otherwise use their GitHub versions without asking Nathanial to reconstruct the chat:

- `docs/verification.md`: completed checks and remaining gates.
- `docs/hardware-acceptance.md`: physical acceptance checklist.
- `docs/install-update.md`: unsigned install/update boundaries.
- `docs/formats-devices.md`: formats, profiles and transfer evidence.
- `docs/release.md` and `docs/update-trust.md`: owner-controlled publication, signing and corresponding-source review. UI testing does not close these gates.
- `AGENTS.md`: repository safety rules.

Prepared 2026-11-03 from the current checkout and fresh GitHub run/artifact checks. No credentials included. No app installation, device write or settings change was performed to prepare this handoff.
