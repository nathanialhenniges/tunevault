# Multi-device library workflows for TuneVault

Research date: 2026-10-29. Primary evidence is from the products' own sites, published help, component catalogs, source repositories, and platform/device documentation. The MusicBee wiki is an explicitly project-linked manual, but identifies an older covered version; its detail is historical workflow evidence. No competitor was installed and no physical transfer was performed for this comparison.

## Recommended direction

Give TuneVault a reusable **Devices** workspace with saved device instances, separate storage destinations, an editable format profile, a persistent content selection, a reviewable transfer plan, and evidence-specific receipts. Keep iPod touch via iMazing, mounted players, SD cards, MTP players, and ordinary folders visibly distinct. Adapt these proven workflow ideas into TuneVault's own compact table UI and neutral dark/light themes; do not clone another app's appearance or imply affiliation.

An unnamed “MP3/MP4 player” is not a device protocol or compatibility specification. Build the folder/volume workflows on both operating systems, and validate actual MTP adapters before calling direct MTP transfer supported. A folder export remains a useful explicit handoff for an unsupported device; it must not be reported as a successful transfer to that device.

## What the comparable apps actually document

| Product / inspected source | Documented behavior | What TuneVault should adapt | Evidence limit |
| --- | --- | --- | --- |
| [MusicBee official product page](https://www.getmusicbee.com/) | Windows music library with playlist/device synchronization and conversion during transfer | Keep library selection, conversion and a named device in one saved workflow | Website feature claims are not hardware proof; product is Windows-focused |
| [MusicBee Devices manual linked by the official site](https://musicbee.fandom.com/wiki/Devices) | Device navigation, saved settings even when disconnected, virtual folder targets, playlist selection, conversion settings, artwork choices, and configurable playlist files; a playlist-specific folder can number files in order | Save the destination once; let the user choose a playlist and see the resulting filenames; expose art/playlist settings under Advanced | Manual says it covers 3.0.5992; do not treat its old iOS compatibility notes or every default as current release guarantees |
| [MediaMonkey portable-device manual](https://www.mediamonkey.com/wiki/WebHelp:Exporting_Tracks/5.0) | Separate device profiles for internal/external storage; persistent sync selection; one-time Send To; device-specific paths/artwork/playlist settings; deletion confirmation with no undo warning | Separate physical device from storage destination and from conversion settings; preview additions/updates/removals before applying | Windows feature documentation is not macOS support and does not establish TuneVault integration |
| [MediaMonkey auto-conversion manual](https://www.mediamonkey.com/wiki/WebHelp:Auto-Conversion_Configuration/5.0) | Device copies can be converted while library originals remain unchanged; ordered rules specify incompatible formats and codec/sample-rate/channel/bitrate limits | Preserve masters and make only the needed derivative; explain each conversion in the plan | Some customization is a paid Gold feature there; use the design principle, not its licensing or an equivalent sprawling rule editor |
| [foobar2000 Onewaysync component catalog](https://www.foobar2000.org/components/view/foo_ows) | Exports playlists plus files to Windows paths including MTP; on-the-fly encoders; current listed release 0.7.0 from 2020; Windows 32-bit | Reusable target plus playlist export task; make disconnect handling visible | Third-party component, not universal core/macOS capability |
| [foobar2000 iPod manager catalog](https://www.foobar2000.org/components/view/foo_dop) | Lists art, transcoding and playlist functions; release 0.7.2 from 2020; Windows 32-bit; currently says no download available | Compatibility is attached to a particular adapter/component, not a product name | Do not recommend this as a ready current cross-platform iPod touch 6 solution |
| [Strawberry official site](https://www.strawberrymusicplayer.org/) | Collection/tag/playlist management and transfers to mass-storage, MTP and older iPods; explicitly says device support is unavailable on Windows and only older iPod models work | A library-first tool can expose different device capabilities without pretending platform parity | “Cross-platform player” does not mean cross-platform device support; its old-iPod claim does not establish touch 6 support |
| [Strawberry source/dependencies](https://github.com/strawberrymusicplayer/strawberry) | Optional libmtp dependency for MTP and libgpod for iPod Classic | Transport support is a real native subsystem to package and test | Reusing source has its own GPL/dependency obligations; this is architecture evidence, not a recommendation to copy its implementation |
| [iMazing transfer guide](https://imazing.com/guides/how-to-transfer-music-from-a-mac-or-pc-computer-to-an-iphone-ipad-or-ipod) | Select device/Music, import folder or drag files, resolve duplicates, then inspect the completion report; Mac/PC pairing instructions | Prepare a clean handoff folder and show concise next steps; let the user confirm the exact completed batch | No established TuneVault-readable transfer receipt or supported music-import automation interface |

MediaMonkey is the strongest reference for the device workflow. MusicBee demonstrates why saved profiles and folder targets are valuable. foobar2000 and Strawberry are useful counterexamples to a blanket support claim: extensions, OS, architecture and device generation change what “supports devices” actually means.

## Evidence that changes the support plan

**iMazing can be the handoff for more than the touch.** Its August 2026 guide says classic/nano/shuffle transfers are supported starting with iMazing 3.6. It still documents a human-operated import. TuneVault can offer a generic Apple-device handoff template while retaining a specifically documented touch 6 profile; it must not infer native USB-folder access or automatic synchronization. [Current iMazing guide](https://imazing.com/guides/how-to-transfer-music-from-a-mac-or-pc-computer-to-an-iphone-ipad-or-ipod)

**A general format list can be misleading for one old device.** iMazing's general music page lists FLAC and describes creating playlists inside iMazing. That does not establish native FLAC playback in the sixth-generation touch's Music app, or that a TuneVault-exported M3U will automatically become an iPod playlist. Keep the explicit handoff step and the device-specific codec rules. [iMazing music page](https://imazing.com/iphone-music-transfer)

Apple's touch 6 specifications list MP3, AAC, Apple Lossless, AIFF and WAV among its audio formats; FLAC and Opus are absent. Its MP4 video support additionally specifies codecs, profiles, dimensions and frame rates. Even this one device demonstrates why container extension alone is insufficient. [Apple touch 6 specifications](https://support.apple.com/en-us/112023)

Sony publishes different transfer and format documentation per Walkman model. For example, its NW-A306 Windows instructions require file-transfer mode and a Music folder, while a legacy format guide separately specifies codec, container, bitrate and sample rate. These are examples for designing profiles, not claims that every Walkman has been tested. [NW-A306 transfer guide](https://helpguide.sony.net/dmp/1301/v1/en/contents/TP1000733594.html), [Sony legacy supported formats](https://helpguide.sony.net/gbmig/44081941/v1/eng/contents/01/13/06/06.html)

## Transport, format and player are three different questions

| Question | Examples | TuneVault must establish |
| --- | --- | --- |
| How can the computer reach the destination? | Mounted filesystem, removable card, MTP object store, iMazing handoff, ordinary folder | A real transport that the current installed build can operate |
| What can be stored there? | Writable volume, available bytes, filesystem file-size limits, MTP storage permission | Destination and write constraints before starting |
| What can the player consume? | MP3/AAC/FLAC, particular sample rates/tags/artwork, M3U path rules | Profile from the model's manual plus a small physical test |

A USB cable does not answer all three. An SD card mounted in the computer uses a filesystem; that same card inside an Android player may be exposed over MTP. A file copied successfully may remain absent from the player's media database until it rescans, or may be unplayable.

“MP4 player” can mean a portable product marketed as playing video. `.mp4` is a container that can hold different audio/video streams; `.m4a` commonly carries audio, including either AAC or ALAC. Determine the model and probe the streams. Nathanial confirmed portable players with music as the focus, so no video downloader/converter is requested. Actual video support would need a separate request and a tested video profile; it is not delivered by renaming an audio file.

## Credible support tiers

These are recommended build/verification tiers, not already implemented TuneVault features.

| Target / transport | macOS and Windows first-release route | Truthful status after completion | Direct-support gate |
| --- | --- | --- | --- |
| iPod touch 6 / iMazing | Prepare compatible tagged copies locally; reveal folder; optionally open iMazing; user transfers | Ready for iMazing → Exported locally → Transfer confirmed by you | Real touch 6 + installed iMazing test for file import, art, non-ASCII tags, long-mix seeking and exact playlist creation/order |
| Other Apple portable / iMazing | Same handoff mechanism; choose a profile based on the actual model; retain manual receipt | Prepared or user-confirmed, never automatically verified | Model-specific format checks and actual transfer; distinguish classic/nano/shuffle from iOS devices |
| USB mass-storage music player | User-selected mounted volume and TuneVault-managed subfolder; copy prepared artifacts | Copied → Hash-verified on volume; playback unverified | Writable mount, correct volume identity and manual/profile playback test |
| SD/microSD in reader | User-selected card plus the intended player profile; copy files/playlists | Verified on this card, not yet verified in player | Card identity and write test; player filesystem/media/playlist compatibility after insertion |
| Android or dedicated player using MTP | Direct only when a real native adapter passes the OS-specific spike; otherwise prepare a handoff folder for manual transfer | Copied through MTP; content verified only if read-back actually happened | Enumerate/open storage, send/list/read/cancel/reconnect on both OSs; prove target recognition and playback on a named device |
| Local export folder | Reusable folder target for another transfer tool, backup or unknown player | Exported to folder | No device claim; an external tool must perform the actual handoff |
| Vendor-specific/unsupported device | Folder handoff and model-specific instructions if known | Prepared for manual transfer | New adapter and hardware evidence before adding a direct-transfer claim |

Do not add Wi-Fi sync, network shares, cloud bridges, companion Android apps, bidirectional play-count sync, or direct Apple device-database editing merely because competitors have them. Those introduce new protocols, permissions or applications. The saved device/profile model can cover the requested players without those systems.

## MTP feasibility: a real adapter, not a file-dialog trick

Windows Portable Devices provides a native API to explore devices and send/receive content, with Microsoft support for MTP and mass-storage devices. It is object-based and device capabilities matter. Prefer an adapter using the existing Windows WPD stack; do not assume a displayed Explorer device has a drive letter or can be reached through Node filesystem calls. [Microsoft WPD API](https://learn.microsoft.com/en-us/windows/win32/wpd_sdk/wpd-application-programming-interface), [WPD device object/capabilities](https://learn.microsoft.com/en-us/windows/win32/wpd_sdk/device-object)

On macOS, OpenMTP provides concrete evidence that a desktop UI can use a separate MTP subsystem. Its source describes the Kalam backend and Intel/ARM support; its go-mtpx layer uses low-level USB calls and requires libusb for development. This is evidence of feasibility, not an immediately drop-in MIT-compatible, audited backend for TuneVault. Audit the exact sources/licenses/builds and native distribution before selecting anything. [OpenMTP source](https://github.com/ganeshrvel/openmtp), [go-mtpx setup](https://github.com/ganeshrvel/go-mtpx)

libmtp is another native candidate. Its project describes device-specific quirks and session failures; its Windows build instructions discuss libusb drivers/Zadig. Do not turn replacement of Windows' working device driver into TuneVault's default onboarding. A Windows WPD adapter and a separately validated macOS backend may share one UI contract while using different implementations. [libmtp project](https://github.com/libmtp/libmtp), [libmtp Windows instructions](https://github.com/libmtp/libmtp/blob/master/README.windows.txt)

MediaMonkey's current troubleshooting documents partial/frozen USB sync from driver, connection-mode, locked-device and cable issues. Show a concrete state such as “Unlock the player and enable File transfer,” not endless progress or a false zero-track success. [MediaMonkey USB troubleshooting](https://www.mediamonkey.com/support/knowledge-base/mediamonkey-device-sync/usb-sync-fails/)

Minimum MTP spike before committing to public direct support:

1. Use a named Android/portable device and record firmware, OS, architecture, transport mode and adapter build. Enumerate its internal storage and card separately without touching unrelated content.
2. Transfer generated audio, a non-ASCII filename, cover art and a playlist into a user-approved test subfolder. Confirm listing and reported object size; read back and compare a cryptographic hash where possible.
3. Cancel mid-transfer, unplug/reconnect, and relaunch the app. Reconcile incomplete objects and old receipts without duplicating good files or deleting unknown files. Re-identify objects after reconnect rather than blindly trusting an old handle.
4. Verify media indexing, actual playback, embedded art and playlist order on the player. File-transfer support and playback support are different test results.
5. Package/install that adapter on clean macOS and Windows builds without requiring developer tools, unsafe driver replacement, hidden global packages or a privileged background service.

If an adapter cannot read back bytes reliably, report **Copied, verification unavailable**. Matching name/size or a successful API call is not a content-hash verification. Do not imply filesystem atomic-rename or temporary-file semantics are available for every MTP responder.

## A TuneVault device wizard that stays simple

Use four short steps, with Advanced collapsed. Steps below are proposed TuneVault behavior derived from the research, not screenshots of another product.

| Step | What the user does | Defaults and safeguards |
| --- | --- | --- |
| 1. Choose transfer method | iMazing, USB/player volume, SD card, MTP when available, or export folder; give the target a name | Do not infer transport from “MP3/MP4.” If unimplemented MTP is detected, offer folder handoff visibly |
| 2. Choose destination | Select actual storage/subfolder; distinguish internal memory from card | Show path/location, connection state and available space if known; never autoformat; never select an unrelated drive silently |
| 3. Choose compatibility | iPod touch 6, Generic MP3, Lossless-capable player, or Custom | One-sentence format/art/playlist summary; “Based on documentation; playback not tested” until tested |
| 4. Test and save | Prepare/copy one generated test item, then confirm playback/art/order after transfer | Test is optional for creating the saved target but required for a hardware-verified label; save settings for next use |

Remember the device even while disconnected. Editing a compatibility preset does not automatically schedule deletion or rewrite existing copies. Reconnecting a different card with the same display name must prompt destination confirmation when identity cannot be established.

Recommended built-in profiles:

| Profile | Suggested settings | Compatibility label |
| --- | --- | --- |
| iPod touch 6 via iMazing | Keep compatible MP3/AAC; AAC-LC M4A derivative when needed; ALAC option for lossless originals; embedded JPEG cover | Device formats documented; physical handoff test pending |
| Generic MP3 portable | Keep already-compatible MP3; otherwise proposed 192 kbps CBR, 44.1 kHz if needed, retained mono/stereo, ID3v2.3, conservative JPEG art; relative M3U8 with legacy M3U option | Conservative candidate; not “all players” |
| Lossless-capable player | FLAC only where the manual/profile permits; keep original lossless audio; per-model art and playlist rules | User/custom-model capability, not automatically every modern player |
| Folder handoff | User's selected output profile; ordered playlist and transfer report in a local folder | Prepared files; destination device unverified |

Custom profile fields: supported codecs/containers, conversion target, bitrate/rate/channels, ID3/art settings, filename/path policy, music folder, playlist format/encoding/location/path separators, and optional reported player limits. Keep the ordinary screen to **Format**, **Artwork**, **Playlists**, and **Advanced**; do not surface an encoder command line. Save a copy of a built-in preset instead of modifying its definition globally.

No “Sony,” “FiiO,” “SanDisk,” “Android,” or “MP4” umbrella profile should silently claim every model's support. Model-specific presets can be added from a manufacturer's documentation with source URL, relevant firmware and a last-verified date. User-defined values must be clearly distinguished from physically tested presets.

## The saved plan and preflight

Use three independent saved objects: a **device instance**, one or more **storage destinations**, and a **compatibility profile revision**. Each destination has its own selected playlists/items, transfer history and pending changes. A profile can be reused across two devices without merging their receipts.

When the user opens a target, show a compact summary and an actionable table. Example data below is fictional:

```text
Portable player · SD card · Generic MP3
Disconnected · last verified on card yesterday

Plan for this selection: 12 new · 3 changed · 1 playlist reorder
Estimated 84 MB additional · card free space unavailable until connected

Action      Track / playlist        Reason
Add         Track A                 Not sent to this target
Update      Track B                 Artwork changed
Keep        Track C                 Current copy verified
Rewrite     Road playlist           Order changed; audio reusable
Review      Track D                 No approved source/file

[Review changes]                         [Prepare files]
```

On connection, recheck destination identity/writability, filesystem/path constraints, source availability, target profile revision, codec/tag/cover validity, and required space. Separate exact prepared artifact sizes from estimates; an unknown free-space value is “Unknown,” not zero or unlimited. Include temporary/copy overhead and a small reserve in budgeting. Do not silently pick random tracks when a selection is too large.

FAT32's roughly 4 GiB individual-file limit matters for long mixes even when the card has ample free capacity. Detect the actual filesystem and reject an oversized artifact before copy; do not reformat a user's card. [Microsoft filesystem limits](https://learn.microsoft.com/en-us/windows/win32/fileio/filesystem-functionality-comparison)

The first release should use additive/update behavior. Show **Remove from this target** separately from **Remove from library**. If later adding mirror cleanup, preview exact TuneVault-owned removals and require confirmation; never copy a competitor's “delete all other media” option without an ownership boundary. A source-playlist removal is not permission to erase an archive master or another target's copy.

## Exact playlist order across devices

Store playlist occurrences, not just a set of unique tracks. Preserve `[A, B, A, unavailable, C]` and its unresolved slot. Parallel conversion completion cannot reorder it.

For a player that reads a supported playlist format, keep one compatible file and reference it in the exact occurrence order. For folder-based playback, offer a playlist-specific directory with zero-padded occurrence filenames; repeated occurrences may require additional files and count toward space estimates. Do not overwrite the canonical album's track numbers to encode an arbitrary playlist.

A profile must describe whether paths are relative to the playlist or storage root, accepted separators/encoding/newlines, playlist location, and whether the player ignores duplicate references. Use a test playlist containing three short synthetic items with an intentional repeat. The app cannot guarantee order on an unknown player just because its generated M3U looks correct.

Keep artwork policy per derivative: embedded JPEG, an appropriate sidecar, both or none. Preserve the original artwork and user tags. Converting FLAC to MP3 for one device must not replace the lossless master. Converting a lossy source to FLAC must retain the lossy-source label.

## Transfer progress, reconciliation and receipts

The visible pipeline is **Prepare → Transfer → Verify → Done / Needs attention**. Separate audio conversion progress from file transfer, and show per-row failures alongside successful rows. Cancellation stops new work, reconciles the current item, and leaves a retryable plan. It never deletes archive sources or erases unrelated target content.

| Receipt state | Evidence stored | What the user can infer |
| --- | --- | --- |
| Ready locally | Validated artifact path/hash, profile and metadata revisions | Compatible candidate is prepared on the computer |
| Exported to folder | Local destination write completed | Handoff files exist; the device may not have them |
| Copied, not content-verified | Transport success/object reference/name/size, no read-back hash | Transport accepted the copy; full integrity not established |
| Hash-verified on volume/device | Actual read-back bytes match the artifact hash | Copy integrity established; playback/indexing still separate |
| Transfer confirmed by you | User, timestamp, exact batch/artifact/playlist revision and target | Human-confirmed handoff, such as through iMazing |
| Playback tested | Model/firmware, test item/profile, date and user-confirmed result | That tested profile worked on that device; no universal guarantee |
| Changed since last transfer | Desired content/tags/art/profile/order differs from receipt | Review/update is needed for this target |

Receipts should include target and storage identity, artifact hash, metadata/art/profile revisions, playlist/order revision, batch/timestamps and evidence type. A changed cover or playlist order is a real pending change even if the encoded audio stays the same. A renamed path should not make a known device lose all identity; a different volume at the same path must not inherit its receipts.

## Smallest complete acceptance set

- [ ] Two saved destinations using different profiles; one offline. Sending a track to one does not mark the other complete.
- [ ] Internal storage and removable card of one conceptual device remain separate; swapping cards or drive letters triggers correct identity reconciliation.
- [ ] Existing compatible MP3 reused; FLAC master converted only for a needed derivative; embedded art/tags checked after export.
- [ ] Unknown/insufficient free space, read-only mount, file over filesystem limit, source/destination overlap, case/Unicode collision and reserved filenames handled before writing.
- [ ] Add/change/reorder/no-op plans, missing source and partial failure preserve exact selected membership and duplicate order.
- [ ] Copy interrupted by cancel/unplug/disk-full; successful receipts retained, incomplete ones retryable, unknown target files untouched.
- [ ] Real iPod touch 6/iMazing manual import with art/non-ASCII metadata/long mix and playlist order checked separately.
- [ ] At least one named USB or SD-backed player physically plays the chosen format, artwork and ordered repeat-containing playlist before a hardware-verified label.
- [ ] MTP direct transfer has successful packaged native adapter tests on each claimed OS/architecture; otherwise folder handoff is clearly labeled.

## Evidence boundaries

The only currently identified owned player is Nathanial's iPod touch 6. No new portable model, its manual, firmware, USB mode, filesystem, cover limit or playlist rules is known. No actual MTP adapter, current competitor installer, player copy, iMazing operation or media playback was tested. This research supports a concrete multi-device design and implementation gates; it does not establish ready support for every product labeled MP3 or MP4.
