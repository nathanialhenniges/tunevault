# TuneVault UI and UX research

Research date: 2026-10-28. This document specifies a proposed product; it does
not claim that TuneVault already implements these behaviors. Product documentation
and inspected Mobbin screens supply evidence. Recommendations below are design
inferences for Nathanial's workflow, not findings from usability tests.

Nathanial rejected the initial visual preview. [The subsequent design review](design-review.md)
supersedes its visual treatment: neutral utility surfaces, native fonts, compact
rows, and purposeful status replace navy-heavy chrome, oversized type, slogans,
and repetitive badges. Workflow findings below still apply.

## Recommended direction

A calm desktop music workbench: a library table, playlist sidebar, optional
metadata inspector, and a clear route to **Prepare for device**. Use subtle
2000s music-player details in the chrome, not tiny controls or an imitation
Winamp skin. Nathanial confirmed this direction and public macOS/Windows
installers from the first release. Only the iPod touch 6th generation is a named
device; generic USB MP3 support is a conservative baseline pending real hardware.

The core promise is: **Add music, check the details, prepare the right files,
and know what still needs transferring.** Downloading is one way to fill the
library. This is not a streaming app or a full player replacement. A short
local-audio preview is useful for checking a match; an equalizer, radio,
recommendations, listening statistics, and visualizer do not serve this scope.

## Evidence and what to borrow

| Reference | Observed or documented pattern | TuneVault implication |
| --- | --- | --- |
| [MusicBrainz Picard quick start](https://picard.musicbrainz.org/quick-start/) | Lookup and acoustic scan are distinct identification paths; the user checks a proposed match before saving. | Treat enrichment as a proposal, and make the review step understandable without knowing MusicBrainz terminology. |
| [Picard metadata pane](https://picard-docs.musicbrainz.org/en/latest/getting_started/metadata_pane.html) | Original and proposed values appear together. Multi-file edits can overwrite every selected title; the docs caution that undo is absent. | Show a field-level before/after review, selection count, and a durable way to restore TuneVault's previous metadata revision. |
| [Mp3tag tag-source import](https://docs.mp3tag.de/tag-sources/import/) | Search, choose a result, then choose which fields and artwork to import. Its docs explicitly reject the idea that unknown files are magically identified. | Let users accept only artist/title/artwork without overwriting a trusted album or filename. Explain uncertainty plainly. |
| [Mp3tag playlists](https://docs.mp3tag.de/playlists/) | Playlist load order is preserved, but duplicate references disappear from its file list. Its playlist generator previews output. | Keep playlist occurrences separately from library tracks; preview exact export order and paths before writing. |
| [MusicBee official site](https://www.getmusicbee.com/) | Device synchronization and on-the-fly conversion are part of the library workflow. | Present format decisions through target profiles rather than requiring codec knowledge for every export. This page also has historical platform claims, so do not treat it as present-day iOS compatibility proof. |
| [Strawberry official repository](https://github.com/strawberrymusicplayer/strawberry) | Local collection organization, tags, art, and playlists coexist in one desktop tool. | Use one durable local library, instead of a download history that loses the relationship between source, metadata, and playlists. Its full playback feature set is outside this project. |
| [Stacher official changelog](https://changelog.stacher.io/) | Recent changes include playlist table views, grouping, chapter controls, failed-download retry, and download-count feedback. | Show structured queue items and recover individual failures; keep source groups and chapter information available after download. A change log is feature evidence, not hands-on validation. |

These references support workflows, not a claim that any one app meets all
TuneVault requirements. No competitor was installed or tested during this pass.

### Screens inspected through Mobbin

- [Apple Music library, web](https://mobbin.com/screens/8a2a4241-7833-471f-b5e4-72f89d71412b):
  a left library/playlist rail, restrained content area, and small playback strip.
  Borrow the stable rail and clear library hierarchy. TuneVault does not need
  the subscription navigation or persistent player strip.
- [Spotify playlist, web](https://mobbin.com/screens/ab26c38c-82b0-4b0a-b933-d9d7ce2feebf):
  numbered tracks and aligned metadata make a playlist scannable. Borrow the
  row structure; shrink the large decorative playlist header to leave room for
  metadata and device status.
- [Deezer playlist, web](https://mobbin.com/screens/9d77e029-2b8a-49a6-9e06-74cfa4f14e2e):
  search within a playlist and columns for track, artist, album, and duration.
  Borrow scoped search and a compact action row.
- [SoundCloud playlist, web](https://mobbin.com/screens/63fbb7e5-4901-4c75-b57e-61c798976177):
  playlist description and ordered content are visible together. Preserve the
  description, but put long prose behind an inspector section so it does not
  displace the working list.

These are web references, not proof of desktop accessibility or device support.
Screens were visually inspected. No screenshots are redistributed; links point
to the canonical Mobbin records rather than temporary image URLs.

---

**Your Mobbin AI usage is high this month**

Usage is unlimited during beta. If your usage stays at this level, you may need to purchase more credits once limits take effect. [View usage and plan options](https://mobbin.com/settings/billing-and-usage)

## Information architecture

Use four primary destinations. Settings live in the platform application menu
and a small sidebar control, not as another primary workspace.

| Destination | Job | Default visible information |
| --- | --- | --- |
| Library | Find and fix saved music | Title/artist, album, duration, metadata readiness, selected-target status |
| Playlists | Preserve ordered collections and check source changes | Source, last checked, numbered occurrences, unresolved items, change review |
| Queue | Understand work in progress | Item, stage, progress, error/retry, completed result |
| Devices & exports | Prepare files and track handoff | Target profile, selected playlists, pending/changed count, last export/confirmation |

An optional **Needs review** filter on Library gathers missing artwork,
uncertain matches, incomplete tags, and missing files. It should say why each
item needs attention. Do not create a fifth permanent inbox with another copy
of every track. Keep work actionable in the place the user is already looking.

At a wide desktop size, use a 200-220px sidebar, a flexible table, and an optional
300-340px inspector. At a narrow desktop size, collapse the inspector into a
sheet and retain text labels in the navigation. Avoid forcing horizontal scroll
through irrelevant columns: title/artist and readiness stay; album and technical
columns can hide. Resizing should preserve selection, edits, and queue state.

## Primary workflows

### 1. Add a URL or local files

1. **Add music** opens one small dialog: paste a URL, choose files/folder, or
   drop files. Clipboard contents are read only after an explicit paste action.
2. Detect a single item versus a collection. If a video URL also contains a
   playlist parameter, explicitly choose **This video** or **Whole playlist**
   before starting. Never surprise the user with hundreds of downloads.
3. Show a compact preview: source, title, item count/order, artwork when known,
   estimated work, and destination in the library. Mark unavailable items in
   place. For catalog playlists, say **Match tracks to available sources**;
   do not imply that Spotify/Apple Music audio will be downloaded.
4. Confirm **Add to library**. The dialog closes into persistent Queue activity.
   The user can keep working; an optional **View queue** action follows completion.
5. A new track appears as saved only after the file exists, probes correctly,
   and the durable library record commits. A network response is not success.

For local import, default to an organized copy into the vault with an explicit
destination preview. Never move/delete the user's original files silently.
If linking files in place is offered, label the consequence: moving those files
outside TuneVault may break the link. A later relink flow repairs it without
creating a second track. Bulk folder import needs a count/size preview and a
cancel action, not mandatory tagging of every file before anything is usable.

### 2. Review metadata and artwork

Select a row to see artwork, title, artist, album, track/disc, year, and source.
These basic fields are enough for normal use. **More details** reveals genre,
album artist, identifiers, original source metadata, technical audio properties,
description, and chapter notes.

Use this enrichment review:

1. **Find metadata** displays candidates with artist, title, version/remix/live
   qualifiers, duration, release, and source. Prefer a clearly explained match
   label over an invented precise confidence percentage.
2. Compare **Current** and **Suggested** per field, with individual checkboxes.
   Show the artwork preview and its origin separately. A video thumbnail is
   labeled **Video thumbnail**, not **Album cover**.
3. **Apply selected changes** creates a revision and writes only chosen fields
   to vault-managed files. User-edited fields remain protected on future refresh.
4. **Restore previous metadata** offers a concrete diff. Physical source files
   are not magically reversible unless an actual backup/rewrite strategy exists.

For multi-selection, show **Editing 12 tracks**, leave differing fields in a
**Mixed values** state, and require intentional input to replace them. Empty
input must not silently mean clear every tag. Provide an explicit **Clear field**
action. Preserve unknown/custom tags unless the user explicitly removes them.

Matching failure is normal: obscure remixes, DJ sets, covers, and uploader-edited
titles may lack canonical releases. **Keep source details** and manual editing
are first-class successful outcomes. Never substitute a studio recording for a
live/remix/sped-up version just to turn the row green.

### 3. Maintain playlist order and check changes

The playlist view defaults to **Source order**, with an explicit numbered
position. Sorting by artist or title changes the view only. It does not rewrite
the underlying playlist, and the export screen clearly states which order it
will use. Local playlist edits use drag/drop plus **Move up/down** keyboard/menu
actions. Remote order changes are accepted in a review, not merged invisibly.

A refresh says, for example: **3 added · 2 moved · 1 unavailable**. The user can
review the diff and choose **Apply source changes** or **Keep current snapshot**.
Archive removed entries in history; never delete their audio from the library.
If the provider is offline or returns an incomplete result, keep the last good
snapshot and say **Could not finish checking**, not **0 tracks remain**.

Track identity, downloaded asset identity, and playlist occurrence identity
must be distinct. A song at positions 3 and 11 stays twice in the playlist while
sharing one library file when appropriate. Unavailable/private/deleted entries
remain numbered placeholders. Export reports skipped occurrences and never
claims exact completeness if any are missing. Do not overwrite album track tags
with playlist positions; put export order into the playlist and numbered
export filenames where the target needs them.

When two sources appear to be the same recording, offer **Use existing track**,
**Keep separate version**, and **Review**. Title alone is never enough to merge.
A repeated URL need not be redownloaded to add another playlist occurrence.

### 4. Keep a long mix intact, optionally split it

Default to **Keep as one mix**, preserving the source title, description, URL,
artwork provenance, and chapter/timestamp data. A missing album is acceptable;
do not fill a DJ mix with fabricated studio-album tags.

**Split into tracks** is an optional action. Show detected boundaries as editable
start/end times and titles, plus **Description timestamps · Needs review** when
they came from unstructured text. Let the user keep the original mix alongside
derived tracks. Warn that a crossfade can be cut and that timestamps are not
proof of the underlying recording identity. Reject overlapping, decreasing,
negative, or out-of-duration boundaries. Preserve the unmodified description
even if parsing fails. An explicitly generated fallback title is labeled as such.

### 5. Prepare for a target and finish handoff

**Prepare for device** asks for a target once and remembers it. Initial targets:
**iPod touch 6 · iMazing handoff**, **Generic USB MP3**, and an ordinary
**Export folder**. Explain that a container name such as MP4 does not guarantee
compatibility with an unknown player.

Before writing, show the selected playlist(s), ordered item count, format,
artwork/tag compatibility, estimated space, target folder, and exactly what
will change. Offer **Only new or changed items** after a prior export. A target
summary might read **8 new · 2 changed · 64 already prepared · 1 needs review**.
The count must be tied to a selected target and metadata/export revision.

For iMazing: prepare a versioned batch folder, open/reveal it, and show short
handoff steps. Status becomes **Prepared for iMazing**. A separate
**Mark transferred after checking iPod** records user confirmation with time and
batch identity. TuneVault cannot claim physical transfer just because iMazing
opened. An unconfirmed export remains visible next session.

For a mounted USB target: copy only after the user chooses the correct volume
and sees the preview. Stage files, verify final copies, then record **Copy
verified**. This proves readable bytes on the mounted storage, not playback or
playlist order in device firmware. Let the user record a separate playback check.
If the volume disappears, stop safely and resume/reconcile later; never mark
the whole batch complete.

No export deletes existing unknown files. If cleanup is added later, it must
enumerate only TuneVault-owned targets and require a separate reviewed action.
Never offer a misleading **Sync** button that hides whether it downloads,
updates metadata, prepares files, or writes to a device.

## State model and copy

Keep independent state dimensions. A track can have saved audio, uncertain
metadata, and a prepared but unconfirmed iPod export at the same time.

| Dimension | User-facing states |
| --- | --- |
| Acquisition | Not saved, queued, downloading, converting, saved, failed, canceled |
| Metadata | Source details, needs review, reviewed, edited by you |
| Source check | Never checked, up to date at [time], changes available, incomplete check, unavailable |
| Target preparation | Not prepared, preparing, prepared, outdated, failed |
| Handoff evidence | Not confirmed, user confirmed at [time], USB copy verified at [time] |

Use precise recovery text: **Artwork could not be loaded. Keep current image
or choose another.** / **Your iPod batch is ready. Transfer it in iMazing, then
confirm here.** / **YouTube check failed. Your last saved playlist is unchanged.**
Logs remain available behind **Technical details**, with credentials and private
paths redacted. Do not make a raw terminal log the only error explanation.

Queue items expose the actual stage, item X of Y, bytes/percentage when known,
and retry/cancel controls. Do not display a fabricated ETA. Cancellation preserves
already completed tracks and labels the rest; closing the app during work must
explain whether it will stop or continue. Restart recovery reconciles files and
job records instead of calling every interrupted job failed or redownloading all.

## Visual system and progressive disclosure

- Neutral silver/gray light surfaces and charcoal dark surfaces, with one cyan
  action accent and thin separators. Reserve navy for the brand rather than
  tinting the entire working environment. Use native system fonts and normal
  row-title weights; see the revised tokens and measurements in the design review.
- Restrained early-2000s cues: a compact silver/charcoal toolbar, simple status
  strip, small monochrome source icons, tabular counters. No fake OS controls,
  blinking equalizers, pixel-sized body text, or decorative audio meters.
- Primary toolbar: **Add music**, search, and **Prepare for device**. Contextual
  actions appear only after selection. Keep four visible actions at most in a
  normal working state; overflow holds rarer operations.
- Display useful defaults. Hide raw format selectors, filename templates,
  codecs, source JSON, and dependency diagnostics under named advanced sections.
  Device incompatibility and quality loss must remain visible before export.
- Make the chosen target obvious in the status column. Avoid a universal
  **Synced** badge that could refer to any playlist or any device.
- Keep text labels next to unfamiliar icons. Provide tasteful empty artwork
  without fabricating an artist's cover. Generated TuneVault brand art must not
  be reused as if it were song artwork.

## Keyboard and accessibility requirements

Use platform-native menu conventions and Cmd on macOS / Ctrl on Windows.
Proposed shortcuts: Cmd/Ctrl+O add files, Cmd/Ctrl+L focus URL input,
Cmd/Ctrl+F search current view, Enter inspect/open selection, Escape close
inspector/dialog, and Cmd/Ctrl+Z undo supported library edits. Never bind Delete
to physical file deletion without an explicit reviewed dialog. Do not intercept
typing/editing shortcuts while focus is in an input.

Start with a semantic HTML table and native checkboxes/buttons. W3C recommends
native tables where available; an interactive grid is a different widget with
different focus behavior. If later adopting grid navigation for large libraries,
implement and test its full keyboard model rather than adding `role=grid` alone.
Mark sortable headers with the current sort state. [W3C table pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/)

An actual ARIA toolbar needs managed focus and arrow navigation; a normal row
of buttons should not claim that role without implementing it. [W3C toolbar
pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)

Require visible keyboard focus, accessible control names, no hover-only actions,
focus return after dialogs, and keyboard alternatives for rearranging tracks.
Color never carries readiness or errors alone. Normal text needs at least 4.5:1
contrast and large text 3:1. Keep controls at least 24×24 CSS px where practical;
prefer 32-40px desktop hit areas and 44px for major actions. The larger values
are TuneVault design targets, not claims about WCAG's minimum. [W3C contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

Announce important queue results and errors without moving focus. Throttle
progress announcements; screen readers should not announce every byte update.
Respect reduced motion and OS light/dark/high-contrast preferences. Test with
VoiceOver and NVDA in the actual packaged apps. [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

## Validation plan for the rebuild

Do not call the UI usable because screenshots look polished. Run these tasks
in the packaged app on each target OS, then perform the physical iPod check.

- [ ] Add a video URL containing a playlist parameter; choose only the video.
- [ ] Import a 25-item playlist with repeated tracks and unavailable entries;
      inspect order, retry one failure, and verify the exported sequence.
- [ ] Add local files containing Unicode names and bad/missing tags; cancel
      midway without losing original files or already imported items.
- [ ] Reject an incorrect live/remix match; accept artwork only from another
      candidate; refresh and verify manual field protection.
- [ ] Bulk-edit album artist without replacing different track titles.
- [ ] Preserve a long mix's description; review chapter boundaries; keep both
      original and split outputs without duplicates appearing unexpectedly.
- [ ] Refresh a playlist after additions, removals, and reorders; simulate a
      partial provider failure and confirm the last good snapshot survives.
- [ ] Prepare an iMazing batch, quit/reopen, and find it still awaiting transfer
      confirmation. Change metadata and see the target become outdated.
- [ ] Disconnect a USB target mid-copy; reconnect and reconcile without data
      loss or false success. No files on an unselected volume may be touched.
- [ ] Complete these flows keyboard-only at 1280×800 and at increased text size;
      inspect 1440×900 and narrow 1024×768 layouts without hidden primary actions.
- [ ] Verify VoiceOver/NVDA labels, focus, table semantics, and completion/error
      announcements in packaged macOS/Windows builds.

Unverified: real-world usability, packaged app behavior, unknown MP3 firmware,
and physical iPod/iMazing results. These require implementation and hands-on
testing; research cannot close those evidence gaps.
