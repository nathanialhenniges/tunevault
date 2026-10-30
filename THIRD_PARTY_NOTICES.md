# Third-party components

TuneVault's original code is MIT licensed, copyright 2026 Nathanial Henniges.
This does not relicense the following separate components or their dependencies.
Consult the exact bundled manifests, license texts and sources before redistribution.

| Component                           | License / distribution notes                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron / Chromium / embedded Node | MIT and numerous component licenses; see LICENSE and LICENSES.chromium.html in the Electron distribution                                                |
| React / React DOM                   | MIT; package license files retained                                                                                                                     |
| node-taglib-sharp                   | LGPL-2.1-or-later, Ben Russell and TagLib# contributors; pure TypeScript MP4 freeform-tag writer, unmodified source/license retained in the npm package |
| music-metadata                      | MIT; package license files retained                                                                                                                     |
| sharp / libvips                     | Apache-2.0 and LGPL/component notices in the packaged dependencies                                                                                      |
| fast-xml-parser                     | MIT; package license retained                                                                                                                           |
| electron-updater                    | MIT; package license retained                                                                                                                           |
| electron-liquid-glass               | MIT, Meridius Labs; optional macOS native NSGlassEffectView bridge, no private variant methods used                                                     |
| yt-dlp standalone bundle            | GPLv3+ bundle and separately licensed dependencies; do not confuse its source Unlicense with bundle obligations                                         |
| Deno                                | MIT and dependency licenses from its exact distribution                                                                                                 |
| FFmpeg / ffprobe                    | Build-specific LGPL/GPL obligations; nonfree builds are rejected                                                                                        |
| LAME                                | LGPL; controlled FFmpeg source build includes exact sources and build recipe                                                                            |

Tool manifests record exact versions, artifact URLs, hashes and build/license
information. The controlled FFmpeg build on macOS and Windows includes unmodified FFmpeg and
LAME source tarballs, license texts and reproducible build recipe in the tools
resources. Other platform source distributions and configurations must pass the
same release gates. See tools resources for yt-dlp's matching source and
third-party notices. Upstream links alone are not a substitute for a complete
corresponding-source obligation where one applies.

The TuneVault logo and app icon are original TuneVault branding, copyright
Nathanial Henniges. The six fictional demo album covers are AI-generated
design assets, not acquired music. Demo assets contain no audio and are never
inserted into a real user's library.

No public release has been approved by this document. Before distribution,
audit the exact packaged binaries and their dependency/source arrangements,
including PyInstaller dependencies. The release workflow must not turn an
unresolved licensing gate into an implied approval.

## Data sources and online services

These notices cover data/services separately from bundled software. The MIT
license on TuneVault does not relicense provider data, images, music or trademarks.
Lookups are requested by the user and reviewed before applying; there is no
automatic metadata enrichment.

| Service / source                     | Use, attribution and applicable terms                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MusicBrainz / MetaBrainz             | Primary metadata suggestions. [MusicBrainz core database data is CC0; supplementary data is CC BY-NC-SA 3.0](https://musicbrainz.org/doc/About/Data_License). Do not treat tags/genres or every API field as CC0. Applied fields identify the source as `musicbrainz:<recording-mbid>`. [API rate limits](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) and [MetaBrainz privacy](https://metabrainz.org/privacy) apply |
| Cover Art Archive / Internet Archive | User-requested release artwork, up to 1200px, with `coverartarchive:<release-mbid>` provenance. [Images are copyrighted by their respective owners](https://coverartarchive.org/); the metadata license does not cover images or grant embedding/export permission. [API](https://musicbrainz.org/doc/Cover_Art_Archive/API) and [Archive terms/privacy](https://archive.org/about/terms)                                           |
| YouTube / Google                     | Requested source discovery and authorized audio acquisition, not a metadata fallback. [YouTube terms](https://www.youtube.com/t/terms) and [Google privacy](https://policies.google.com/privacy) apply. yt-dlp software licensing does not grant recording or service-access rights                                                                                                                                                 |
| GitHub                               | Release/update distribution and public Issues support. [Terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), [privacy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Artifact requests may redirect to GitHub-controlled download hosts                                                                                                                |
| Spotify / Apple Music references     | Locally imported playlist references only; direct connectors and subscription-audio extraction are unavailable. File import grants no music, metadata or artwork rights                                                                                                                                                                                                                                                             |
| External browser links / iMazing     | Opened only at the user's request under browser and destination-service conditions. External-tool handoff does not prove a device transfer                                                                                                                                                                                                                                                                                          |

Settings > Metadata & artwork controls online metadata and individual services;
it does not disable YouTube, independent update requests or browser links.
MusicBrainz/CAA request headers identify TuneVault's version and repository
contact URL. Search results may be reused for seven days and artwork cache
entries for 24 hours; expiry does not automatically delete persisted cache
records/files, approved artwork, revisions or backups. See the Privacy Policy
for destinations, information sent and independent controls.

Research-only alternatives (iTunes Search, Deezer, Discogs, Last.fm,
TheAudioDB, Wikidata and Spotify metadata APIs) are not enabled or attributed
as TuneVault data sources. No affiliation or endorsement by any listed provider
is asserted.
