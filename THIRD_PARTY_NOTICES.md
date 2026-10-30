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
