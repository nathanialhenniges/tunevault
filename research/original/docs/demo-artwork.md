# Fictional cover artwork for the TuneVault mockup

Created 2026-10-29 with the built-in imagegen tool. These are fictional artist/release concepts for interface design, not real music releases, commercial album scans, or evidence of downloaded recordings. Generation provenance is retained in the original PNG files. Exact generation prompts and machine-readable filenames are in [the asset manifest](../assets/demo-covers/manifest.json).

| Demo track | Fictional release / artist | Artwork direction | Asset |
| --- | --- | --- | --- |
| Midnight Arcade | After Hours / Northbound FM | Rainy diner photography, amber and teal | [Cover](../assets/demo-covers/after-hours.png) |
| Soft Signal | Small Satellites / Lunar Transit | Cream/rust orbital paper collage | [Cover](../assets/demo-covers/small-satellites.png) |
| Afterimage; Glass Horizon | Blue Hours / The Quiet North | Winter lake and reeds at dusk | [Cover](../assets/demo-covers/blue-hours.png) |
| Night Shift · full mix | Night Shift / Signal / Noise | Monochrome radio hardware with orange print | [Cover](../assets/demo-covers/night-shift.png) |
| Silver Lines | Coast to Coast / Morrow | Faded coastal payphone/travel photograph | [Cover](../assets/demo-covers/coast-to-coast.png) |
| First Light | Sunday Tapes / Park Radio | Painted cassette recorder in afternoon light | [Cover](../assets/demo-covers/sunday-tapes.png) |

Each original is a 1254 × 1254 square PNG. They were visually inspected after generation. The varied imagery is deliberate: a working music library should not look like one repeated gradient tile. No existing artist or album style was requested as an imitation target. This is not trademark/name clearance.

The preview renders covers at 34px in track rows and 102px in the metadata inspector. Artist/track information remains accessible text alongside the image, so decorative thumbnail `alt` text is empty. Missing or failed artwork falls back to a glyph. “Stay a Little Longer” and “untitled demo 04” intentionally retain missing artwork to demonstrate recovery/review states. Repeated playlist references reuse one cover rather than creating unrelated images.

## Codex reuse instructions

Copy `assets/demo-covers/` and the existing wolf concept into the future TuneVault repository's demo/design-fixture assets when the files are available. Copy the PNG bytes without stripping generation provenance. Read `manifest.json`; do not require new image-generation calls or replace these files with gradients. Keep demo assets distinct from real library data and label any sample-library mode. First launch for an ordinary user should show an empty library/import action rather than pretending these songs were downloaded.

Use the fixture set for design screenshots, artwork-present/missing/broken tests, and repeated-album behavior. It supplies no audio. Generate small synthetic audio separately for codec/tag/integration tests, and only embed a cover when the test explicitly needs one. In a real library, cache appropriately sized thumbnails rather than loading full-resolution masters into every visible row.

These assets improve the preview and implementation handoff; they do not establish device artwork compatibility or license permissions for a user's real collection.
