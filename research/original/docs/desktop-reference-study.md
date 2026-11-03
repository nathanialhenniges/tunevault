# Desktop library and portable-player reference study

Researched: 2026-10-29. Scope: desktop interaction patterns for an original TuneVault interface that manages a music archive and prepares exports for multiple portable players. This is research and a design proposal, not implementation or hands-on testing of competing applications.

## Recommended direction

**Use the clarity of a desktop music library, the review safety of a tag editor, and a separate workspace for each device destination.** Keep the TuneVault wolf identity, cover imagery, typography, spacing, and color tokens original. Borrow task structure and familiar behavior rather than recreating another application's screen, artwork, icons, branding, or skin.

The most useful combination is Swinsian's restrained library density, Picard's old/new metadata comparison, Mp3tag's selection-aware inspector, and MediaMonkey's separation of device content from compatibility settings. MusicBee provides a relevant feature comparison, but its screenshots could not be visually verified in this run.

## What was actually inspected

Official screenshot image files were downloaded to temporary local research storage and opened with the image-viewing tool. The table describes pixels actually inspected; documentation-only claims are identified separately. These are public examples, which may show an older release or skin. They are not proof of current performance, accessibility, runtime behavior, or every app's present default theme.

| Reference | Actual screen evidence inspected | Useful pattern for TuneVault | What to leave behind |
| --- | --- | --- | --- |
| Swinsian, macOS | Official [library hero](https://swinsian.com/image/hero.png), [album grid](https://swinsian.com/image/art-grid.png), [column browser](https://swinsian.com/image/browser.png), [tag editor](https://swinsian.com/image/tag-editor.png), [column chooser](https://swinsian.com/image/custom-columns.png). The library has compact rows, aligned columns and a full-width selected row; covers organize albums. The editor sits beside the table. | Keep the track table as the main workspace; let albums be a real alternate browse mode; offer an adjacent inspector and a column menu. | A large permanent player, an album-art gutter consuming table width, or dozens of default columns. The screenshot's dated controls are not a mandate to recreate its chrome. |
| MediaMonkey, Windows | Official [gallery](https://www.mediamonkey.com/windows/) library, device-sync and playlist-editor images; official manual [device Summary](https://mediamonkey.com/wiki/images/Wiki-MM5_Device_Profile_Summary.jpg) and [Sync List](https://mediamonkey.com/wiki/images/Wiki-MM5_Device_Profile_Sync_List_to_Device.jpg). The device view has separate Summary, content-selection and Sync-profile areas, a destination name, capacity information and a bottom action. | Give each destination its own content selection and compatibility profile; keep storage context next to the export action. | Orange across nearly all chrome, multiple permanent playback/list panels, and broad deletion settings presented like ordinary sync preferences. TuneVault's default must remain additive. |
| MusicBrainz Picard, cross-platform | Official [main-window screenshot](https://picard.musicbrainz.org/static/img/picard-mainwindow.png). Local clusters and matched albums sit above a three-column tag table, with old/new values and selected cover artwork. | A dedicated metadata-review state showing field, current value and proposed value; make accepting changes explicit. | Exposing the full specialist clustering/tagging interface during ordinary library browsing. Matching is a task, not the permanent whole-app layout. |
| Mp3tag, Windows | Official [main-window screenshot](https://www.mp3tag.de/images/sht_main.png). A selected row is adjacent to editable fields and artwork information, including format, dimensions and size. | Selection-aware detail editing; contextual technical art details; column sorting and keyboard editing. | A toolbar full of small unexplained icons, filename-first hierarchy for every task, or silently overwriting mixed batch fields. |
| MusicBee, Windows | Official [homepage](https://getmusicbee.com/) text read: library/tagging, skins, device playlists and conversion are described. The image URLs were identified, but direct image downloads returned HTTP 403. | Relevant scope precedent for library plus per-device conversion. | Do not treat screenshot names or feature marketing as observed UI evidence. No MusicBee visual layout claim is made here. |

The [Picard main-screen manual](https://picard-docs.musicbrainz.org/en/latest/getting_started/screen_main.html) explains its field/current/proposed metadata table. The [Mp3tag main-window manual](https://docs.mp3tag.de/getting-started/main-window/) documents configurable columns, keyboard editing, mixed selections, and cover inspection. TuneVault should apply those ideas through its own simpler controls.

## Why the library should feel like a music application

The observed screens devote most space to music and artwork rather than explanatory slogans or statistics. For TuneVault, the first view should contain actual album covers, readable track/artist identity, a selected item and an inspector that helps finish a task. A few meaningful objects communicate the product better than a dashboard of repeated status cards.

Use two intentional views of the same library:

- **Tracks:** compact, sortable table for correcting details, selecting songs and comparing target readiness. Default columns: title/artist, album, duration, and the selected destination's status. Keep codec, source, sample rate and path optional.
- **Albums:** square artwork with album and artist beneath it, restrained spacing and an accessible size control. Opening an album reveals its ordered tracks. It should not become a streaming-service discovery page.

Keep selection visible across rows and inspector. A selected row needs a clear fill/edge and legible foreground, including inactive-window and keyboard-focus states. A small status label or icon accompanies color; it does not replace it. Show the selected destination in the table heading so “Ready” cannot be mistaken for readiness on every player.

Blue and orange are alternate TuneVault accent systems, not separate information architectures. Light uses quiet pale/neutral surfaces; dark uses neutral charcoal with several distinguishable elevations. Reserve accent for selected/navigation state, focus and the primary action. Avoid making all dark text cyan/orange or tinting every panel. In the inspected MediaMonkey orange skin, strong accent surrounds almost the entire workspace; TuneVault should use less of it, leaving cover art as the main source of color.

These are design judgments from the inspected references, not measured accessibility results. Contrast and all interaction states still require verification in each of the four theme combinations.

## Multi-device navigation and identity

A device and an export format are different things. One player may have internal storage and an SD card; one compatibility preset may be used by several players. The UI should represent:

```text
Devices & exports
  iPod touch 6
    iMazing staging folder
  Portable player
    Internal storage
    SD card
  Export folder
```

These are example destinations, not a claim that Nathanial owns the unnamed player or that its transports are implemented. The sidebar can keep the first level compact and show storage choices in the device workspace. Do not permanently expand every destination into a tree of settings and audio formats.

Maintain separate identity for physical device, storage/destination, transfer method and compatibility preset. A user-facing name or removable drive letter alone is insufficient identity. Reconnecting a different volume with the same name must not inherit a transfer receipt or be written automatically.

The official [MediaMonkey synchronization manual](https://mediamonkey.com/wiki/WebHelp:Exporting_Tracks/5.0) separates a device's storage profiles, selected content and conversion/tag/art/path settings. It also warns that playlist support varies by device and describes deletion options. Those are useful capability distinctions; TuneVault should make deletion a separate reviewed operation rather than copying that broad sync checkbox.

### Add destination without a settings maze

Use a small progressive dialog, not a large configuration wizard:

1. **How will you transfer?** iMazing handoff, mounted USB/SD, or export folder. If MTP is not implemented, explain that choice and offer staging/manual handoff; do not label it a normal filesystem destination.
2. **Name and location.** Pick the destination through the native chooser. Show which storage is selected and whether it is connected. A staging folder is not a connected iPod.
3. **Compatibility.** Choose iPod touch 6, conservative MP3, or a documented custom preset. Show a short readable summary such as “MP3 · embedded JPEG · ordered playlist”; reveal detailed codec/tag/path controls only when requested.
4. **Review.** Select playlists and show Preview export. No automatic transfer occurs merely because onboarding finished.

For an unknown player, offer a tiny **compatibility test pack** generated from owned/synthetic audio, with a small selection of tag/art/order cases. User confirmation can record model/firmware, preset revision and what actually played. Label that evidence “Confirmed by you,” with a date, rather than claiming universal device certification. A generic profile is an unverified default until tested.

Nathanial confirmed MP4 means portable players and music remains the focus. Do not add MP4-video resolution/frame-rate settings, video downloading or video conversion. Portable audio management and video transcoding are separate scopes.

## The device workspace

Use three compact sections or tabs: **Overview**, **Content**, and **Compatibility**. Keep export history accessible from Overview. Avoid duplicating the whole library, queue and playback UI around these sections.

Overview should show destination name, transfer method, connection state, storage/budget and one next action. For an iMazing handoff, use “Staging folder available” and “Last marked transferred”; do not display invented iPod free space. For mounted storage, show the measured volume free space separately from any TuneVault size budget. For an unknown/disconnected destination, show a useful reconnect/reselect state.

Content selects playlists or specific tracks and explains whether source-following changes are included. Selected content must persist independently of connection state. A playlist removed from the selection does not silently remove its files from a device.

Compatibility displays the preset and advanced overrides, with an explicit impact notice when edits make previous exports stale. Share a preset by reference only when intended: changing one player's override must not unexpectedly change every other player using the same starting preset.

### Preview changes before preparing or copying

The preflight needs actionable rows rather than a single “Sync” button:

| Change | What the user should see |
| --- | --- |
| New audio | File will be prepared/copied; show required conversion only if needed. |
| Metadata/art changed | Existing destination rendition is stale; show which revision changed. |
| Playlist reordered | Playlist/order artifact changes; avoid recopying identical audio unnecessarily. |
| Unresolved or incompatible | Keep a visible row with Fix, Replace source, or Skip. Never silently shorten the playlist. |
| Unchanged | Reuse existing verified rendition/receipt; collapsed by default with a count. |
| No longer selected | Explain retained files; deletion requires a separate explicit review. |

Show occurrence count separately from unique audio count. `[A, B, A]` may involve two audio files but three playlist positions. List bytes already available, new estimated bytes, staging needs and destination reserve; recompute exact output size before committing a copy.

The final action uses the transfer method's honest verb:

- iMazing: **Prepare files**, then **Reveal folder**, optional **Open iMazing**, and **Mark this batch transferred**.
- Mounted USB/SD: **Copy changes**, verify committed bytes/hashes, then offer safe-eject guidance where supported.
- Export folder: **Prepare export**, then **Reveal folder**.

One destination's receipt must not mark another destination current. Store the exact content/art/preset/playlist revisions behind a receipt. Returning to a device should reveal what changed since its last successful or user-confirmed batch.

## Metadata review and batch safety

Use an inspector during browsing and a larger review sheet for batch or suggested edits. Show a count such as “Editing 12 selected tracks,” mixed values as **Keep existing**, and a field/current/proposed comparison before Apply. Offer per-field locks and a revision undo. A blank input must not ambiguously mean both keep and erase.

Mp3tag documents automatic saving when selection changes; TuneVault should deliberately choose explicit Apply for batch/review operations to reduce accidental edits. Picard's visible old/new values are the stronger safety pattern for suggested metadata. These are selected adaptations, not claims that the reference applications are unsafe.

Artwork should use real supplied/generated demo covers in the concept, with meaningful alternative text and a missing-art state. Show large artwork in album/detail views; table art stays small. Inspector details can reveal embedded format, dimensions, size and the target's derived artwork. Keep archive artwork separate from a player's resized JPEG so one destination does not degrade the master.

## macOS and Windows conventions

Keep the same library/data model and primary actions, with normal platform window controls, menus, file chooser and shortcut modifiers. A Windows user should not get decorative macOS traffic-light controls; a Mac user should not get a simulated Windows title bar. Reuse the existing Electron native integration rather than creating custom window chrome for nostalgia.

Menus, toolbar labels, right-click menus and keyboard commands should refer to the same operations. Do not require drag gestures for playlist reorder or file assignment. Preserve table headers, resizable columns, multi-select and visible focus where applicable; selection and sort must not silently change stored playlist order.

Use the references for familiar behavior, then test TuneVault's actual implementation. Screenshots do not establish keyboard accessibility or screen-reader compatibility. Native file dialogs, drag/drop, 200% zoom, keyboard reorder, high-contrast/focus states and platform-specific titlebar behavior need real checks.

## Specific prototype and prompt gaps to close

- Show several named destinations and switch their content/status views; a generic profile dropdown alone does not demonstrate multi-device management.
- Distinguish physical player, internal/SD storage and transfer method, including disconnected and unsupported-MTP states.
- Show an export diff with new audio, artwork-only changes, reorder-only changes, retained files and unresolved entries.
- Use real cover imagery in albums and the selected-track inspector; do not replace music identity with repeated icon tiles or slogans.
- Give blue/orange and light/dark the same selection, focus, disabled, warning and modal coverage; a color-toggle screenshot alone is insufficient.
- Show a mixed-value batch edit and old/new metadata review; demonstrate explicit Apply and a visible revision undo.
- Make the queue accessible without a permanent full-height third list or a large player that competes with library/export tasks.
- Keep public install/update guidance separate from music-device “sync” so the same word does not describe two unrelated operations.

No source code, screenshots or competitor artwork were copied into TuneVault's product assets. The official images were used for visual inspection only; this document links to their owners' sources. No competing app was installed, no device was attached, and MusicBee's blocked screenshots remain unverified.
