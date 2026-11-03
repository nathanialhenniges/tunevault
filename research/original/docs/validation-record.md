# TuneVault research validation

Prepared 2026-10-28, America/Chicago. This record separates research proof from future application testing.

## Latest update: 2026-10-29

This section supersedes the earlier browser-unavailable status below. The application itself remains a future rebuild.

- Generated six original fictional cover concepts with built-in imagegen, visually inspected each, saved the PNG masters and exact prompt manifest in `assets/demo-covers/`, and verified all square 1254px assets. The real preview images loaded successfully in Chrome with `complete=true` and nonzero `naturalWidth`.
- Added independent Blue/Orange accents across light/dark appearances. `check-interface.py` now passes 36 text/state pairs, including primary-button hover. Tokens are read from the actual HTML/CSS. This is a targeted contrast check, not full WCAG compliance.
- Expanded primary-source research: [desktop reference study](desktop-reference-study.md) inspected twelve official screenshots and relevant manuals; [device workflow comparison](device-workflow-comparison.md) distinguishes mounted storage/SD/folders, MTP and Apple-device handoff. MusicBee images were blocked; no unobserved visual claims are made for it.
- Added four simulated target routes, per-target batch history, profile/budget setup, actual cover images and missing-art fallbacks. Source-level agent checks retained six original assertions, covered artwork/accent wiring, and exercised target isolation/revision handling; these are distinct from real browser checks below.
- Browser checked 1440×900 library layouts in all four appearance/accent combinations; saved screenshots in `assets/previews/`. Checked 1024×768 library/inspector and Devices layouts with no document-width overflow. The inspector is dismissible at narrow width. Restored the temporary browser viewport override after testing.
- Browser exercised iPod preflight → preparation → explicit simulated acknowledgment → confirmation. It then showed `Confirmed` for iPod, `Not prepared` for USB, and `Confirmed` after returning to iPod. Added a custom USB “Travel player” with a 512MB budget and verified the target's own no-batch state. Android visibly explains direct MTP unavailability and folder fallback.
- Browser review caught a preflight scope problem: default preparation previously filtered review-needed tracks before counting them. Changed the default to include all library tracks in the plan; the browser then correctly displayed six ready and two needing metadata review. Those two are not silently omitted.
- Browser screenshots also exposed joined sidebar profile/status text; separated the status visually and captured final library screenshots after that fix.
- Source link/asset/manifest/PNG and inline-JavaScript syntax checks passed, as did `git diff --check` and a separate whitespace scan over new files. See [walkthrough](preview-walkthrough.md) for screenshots and demo steps.
- Nathanial confirmed “MP4” means portable players; music remains the focus. No video download/conversion scope was added.

Still not checked: full keyboard/200% zoom/screen-reader audit, real media downloads, Electron builds, installers/updates, GitHub CI execution, physical devices or direct native MTP. All preparation/transfer/capacity UI remains a labeled simulation.

## Completed

- Inspected the real GitHub repository through the connected GitHub tools, including its archived status, pinned commit, manifests, downloader/tag/playlist/transfer code and release workflow. No TuneVault app source was modified.
- Three research agents covered desktop/release architecture, media/devices/provider feasibility, and UI/UX. Technical and UX agents independently reviewed the self-contained Codex prompt; their targeted fixes were incorporated. The media agent also used the legal compliance/risk skills to draft the minimal legal documents and reviewed the prompt boundaries.
- Verified installed local yt-dlp/FFmpeg versions without running a download or modifying the tools.
- Generated and saved the wolf concept locally with transparent alpha. Verified PNG dimensions and alpha through `sips`. The source includes generation provenance; no trademark clearance is claimed.
- Local HTTP preview returns `200` and `Cache-Control: no-store`; the project preview is registered in `.claude/launch.json` at port1347.
- Inspected the original prototype's rendered dark library screenshot in Chrome. Nathanial rejected its generic feel/dark mode. Recorded concrete problems: heavy typography, slogan eyebrows, excess spacing, repeated status pills and undifferentiated navy surfaces. This screenshot is critique evidence, not approval of that design.
- `scripts/check-research.py` checks relative documentation/HTML asset links, inline JavaScript syntax, preview registration and PNG signature. It initially caught the missing validation document; that document was then added.

## Browser evidence limits

Chrome connection/navigation repeatedly timed out or reset while commands sometimes still completed. Native Chrome inspection eventually showed the original library and its demo state, and a screenshot was reviewed. An independent in-app browser was unavailable. Later native control also reported a missing Chrome window. Do not interpret these errors as an application functional failure or as a passed responsive test.

The revised design's final browser checks are recorded below only if actually completed. The prototype includes an assert-based `window.tunevaultSelfCheck()` for identity, case-insensitive search, readiness filtering, preserved repeated/unavailable playlist occurrences and HTML escaping. A successful source syntax check is not proof that its browser interactions work.

## Not claimed verified

- A rebuilt TuneVault application, bundled binary execution, live authorized extraction, private/public provider authentication/completeness, or current account eligibility.
- macOS/Windows builds, CI runs, installer execution, authenticated installed-version upgrades, Gatekeeper/SmartScreen behavior or updater key provisioning.
- Physical iPod/iMazing import, art/tags/playback/seek/order, or any generic-player model.
- Legal enforceability, global privacy compliance, final operator adoption of policies, or trademark availability.

## Publication hygiene

The requested local `remove-ai-marks` service health check failed with a disconnected response. Per [the installed skill](/Users/nathanialhenniges/.codex/skills/remove-ai-marks/SKILL.md), no local fallback was used: “Always check it first, and stop with a clear message if it is unreachable — never fall back to local cleaning.” No cleanup success is claimed. This research package remains local and unpublished; source code/tests and honest logo provenance were preserved. Revisit required prose hygiene before a later intentional publication; the unavailable service does not establish any defect in the research.

## Final check result

- Local link/asset, inline JavaScript syntax, preview registration and PNG checks passed after all documents were present. Run `python3 personal/tunevault/scripts/check-research.py` to reproduce.
- `git diff --check` passed; an explicit scan also found no trailing whitespace in the new untracked text files.
- The revised HTML/CSS and [design review](design-review.md) were inspected at source level. Sixteen documented text/state color pairs were calculated at or above 4.5:1 after a failing dark selection pair was corrected. This is not a full WCAG audit.
- `python3 personal/tunevault/scripts/check-interface.py` passed against the actual HTML/CSS tokens (sixteen color/state pairs). The UX agent also executed six pure export-state assertions for review, not-prepared, prepared, confirmed, changed and unrelated-target states. Those pure-function checks do not establish browser interaction behavior.
- The final browser inventory returned no available browsers, and native Chrome reported no window. Revised rendered screenshots, both requested viewport sizes, actual interaction self-check execution and keyboard/zoom testing therefore remain unverified. Do not label the revised concept approved or fully tested.
- No commits, pushes, public uploads/releases, GitHub setting changes, OS setting changes, music acquisition, media transfer, or updater-key creation were performed. The localhost preview server is scoped to `127.0.0.1:1347`.
