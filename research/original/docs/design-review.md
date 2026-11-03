# TuneVault desktop design review

Reviewed 2026-10-28 after Nathanial rejected the initial preview's appearance.
This review replaces the initial visual direction where it conflicts with the
older UI research. It does not change the acquisition or device requirements.

Update 2026-10-29: the preview now includes six fictional cover PNGs, Blue/Orange accents in both appearances, target setup and independent demo histories. See [visual handoff](preview-walkthrough.md) for captured browser screenshots and [demo artwork](demo-artwork.md) for the asset manifest. The current contrast checker covers 36 text/state pairs across all four combinations; the sixteen-pair table below records the earlier blue-only revision. Current browser checks are in [validation](validation-record.md).

## What was wrong

Nathanial described the first preview as AI slop and specifically called out
dark mode. The root agent inspected its rendered screenshot; this agent reviewed
the corresponding HTML/CSS and the root agent's screenshot observations. The
following are concrete issues, not inferred user-research results:

- The main surface, sidebar, inspector, controls, and status strip shared closely
  related navy shades. Branding dominated the entire working environment.
- Large heavy headings, bold row titles, spaced uppercase eyebrows, and slogans
  made the app resemble a product landing page. They consumed space without
  helping find a song, edit a tag, or prepare an export.
- Every reviewed row had a colored badge. Repeated success indicators competed
  with the two tracks that actually needed attention.
- The inspector used a nearly full-width square cover before the editable
  fields, pushing useful tags and mix descriptions down the panel.
- Wide padding and tall rows reduced information density. The working table
  lacked a source column and a useful selected-target export state.
- A decorative sidebar progress line suggested measured storage/work without
  having real device data behind it.

These issues were structural. A different accent color alone would not fix them.

## Primary-source findings

| Source inspected | Relevant guidance | Specific design decision |
| --- | --- | --- |
| [Apple HIG: Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Text-first rows suit scanning. Concise contents, meaningful headings, selection feedback, and alternating backgrounds help a multicolumn table. Mac tables can support sorting and resizing. | Make songs the dominant content, with compact title/artist rows and aligned album/source/time/export columns. Use a subdued alternating row treatment and a separate selected-state treatment. Sorting/resizing belong in the final app; this preview does not claim those controls work. |
| [Apple HIG: Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Navigation and collections belong in a sidebar; labels should stay succinct and hierarchy shallow. Space-limited windows may collapse it. Critical actions should not depend on the sidebar bottom remaining visible. | Keep Library/Playlists/Devices/Activity, use plain group labels, and leave Add/Export in the main action area. The lower target summary is supplementary. |
| [Apple HIG: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Prioritize relevant frequent actions, use restrained grouping, and avoid bright chrome competing with colorful content. | Add and Export remain adjacent contextual commands. Search/filter forms a second group. Album art supplies color; toolbar surfaces stay neutral. Final Electron builds should use native window behavior and menu equivalents. |
| [Apple HIG: Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode) | Dark appearance needs its own adapted colors and foreground contrast, rather than a mechanical inversion. Test controls and content in both appearances. | Separate neutral content, panels, and chrome; define text, control, border, hover, selected, warning, dialog, and focus tokens. Follow system appearance initially; the preview toggle exists to review both designs. |
| [Mp3tag: Main window](https://docs.mp3tag.de/getting-started/main-window/) | A file list presents filesystem and tag data in columns; the tag panel displays selected metadata and artwork. Filter/status/menu/toolbar each serve a different task. | Preserve the relationship between selected track and editable inspector. Reserve detailed descriptions/technical properties for disclosure sections. Keep selection counts and operations factual. |
| [Mp3tag: View menu](https://docs.mp3tag.de/menus/view/) | The tag panel, filter, and toolbar can be shown/hidden; extended tags have their own view. | The inspector is optional, with its own close control and a drawer layout at narrow sizes. Do not make hiding advanced information hide a failed export or uncertain match. |

Apple's current official Markdown representations were also inspected directly
when the HTML pages returned JavaScript-only shells. No third-party paraphrase
was used as evidence for the HIG claims above. These are source-based design
inferences, not a claim of Apple certification or native implementation.

## Revised specification and implementation

| Area | Revised treatment |
| --- | --- |
| Typography | Native `-apple-system` / Segoe UI stack, 13px normal-weight body, 13px song titles, 21px medium section title. Technical values use a monospace stack. System fonts are deliberate for this desktop utility. |
| Density | 53px two-line song rows, 34px artwork, 184px sidebar, 282px inspector; smaller padding and fewer oversized headings. |
| Dark surfaces | `#161719` content, `#202124` panels/sidebar, `#292b2e` chrome. Cyan is for selection/focus/actions rather than large background planes. |
| Light surfaces | White content, `#f5f5f5` panels, `#f0f0f1` sidebar, `#e5e6e8` chrome. The light theme has its own neutral contrast hierarchy. |
| Table | Title/artist, album, source, duration, and iPod export state. Unreviewed rows show a warning; ordinary reviewed rows avoid celebratory badges. |
| Export status | Not prepared, Prepared, Confirmed, Changed, or Review tags, calculated from the current demo batch/revision. These remain explicitly simulated. |
| Inspector | 102px cover beside identity/source-art information, followed by editable tags. Description/tracklist and audio/export details remain distinct disclosure sections. |
| Copy | Songs, source, selected target, counts, and actions replace slogans. The fictional-data label remains visible. |
| Fake telemetry | Decorative progress/storage bar removed. There is no claim of measured device capacity or completed transfer. |
| Interaction states | Explicit dark/light tokens cover controls, inputs, hover, active, selected rows, disabled controls, warnings, modal surfaces, and focus rings. |

At narrower desktop widths the inspector is a dismissible overlay; it does not
compress the library into unreadable columns. At very narrow widths the source
and album columns hide while core identity and export status remain available.
The final app still needs user-resizable columns and accessible sorting, as
specified by the rebuild requirements. Those are not represented as working
controls in this design simulation.

## Objective checks

Calculated contrast uses sRGB relative luminance and `(lighter + .05) /
(darker + .05)`. These values are token calculations, not measurements of a
physical screen or proof of the full accessibility experience.

| Foreground/background role | Light | Dark |
| --- | --- | --- |
| Primary text / content | 15.15:1 | 14.50:1 |
| Secondary text / panel | 5.37:1 | 7.84:1 |
| Secondary text / chrome | 4.69:1 | 6.91:1 |
| Primary text / selected row | 12.30:1 | 7.85:1 |
| Secondary text / selected row | 4.75:1 | 4.73:1 |
| Accent text / content | 4.65:1 | 8.22:1 |
| Warning text / panel | 5.76:1 | 9.17:1 |
| Primary-button text / button | 5.76:1 | 5.47:1 |

The first dark secondary-text/selection calculation was 4.08:1. Its token was
corrected to `#b2b5bc`, producing 4.73:1. All sixteen listed text/background pairs
then passed the 4.5:1 small-text threshold. [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

JavaScript syntax and `git diff --check` passed after the revision. Existing
search, filters, selection, editing, playlist-diff, Add Music, and simulated
handoff paths were retained. The six-assertion self-check remains available as
`window.tunevaultSelfCheck()`.

Rerun the sixteen token-based contrast checks with
`python3 personal/tunevault/scripts/check-interface.py` from the workspace root.
The checker reads the actual stylesheet and primary-button declarations rather
than maintaining a second hardcoded palette.

Final acceptance still needs rendered review of both themes at 1440×900 and
1024×768, selected rows, hover/focus/input/modal states, long titles, 200% zoom,
and VoiceOver/NVDA in packaged apps. Root records actual rendered checks in
`validation-record.md`; this agent does not claim a new screenshot was inspected
or a physical device was tested.
