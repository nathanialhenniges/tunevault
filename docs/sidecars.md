# Bundled media tools

TuneVault uses absolute paths to its own tool bundle. Installed users do not need Homebrew, Python, Node, npm or a terminal. Developer preparation is separate from runtime use:

```sh
npm ci
npm run tools:prepare
npm run tools:verify
```

`resources/tools/lock.json` pins downloaded source/binary URLs, sizes and SHA-256 values. `scripts/prepare-tools.mjs` prepares only the requested native target. The generated architecture-specific manifest records the final executable hashes and versions. electron-builder copies that target directory outside ASAR to the installed `tools` resources directory. No installed tool self-update is enabled.

| Component          | macOS bundle                                                  | Windows x64 bundle                                                                      | Source / licensing                                                                                               |
| ------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| FFmpeg and ffprobe | Controlled native 8.0.1 build                                 | Same controlled 8.0.1 recipe, built natively with MSYS2 MinGW-w64 and linked statically | LGPL-2.1-or-later with LAME on every platform; exact source archives, licenses and recipe are bundled            |
| LAME               | 3.100, statically linked into the controlled media tools      | Same                                                                                    | LGPL; exact source archive and license are bundled                                                               |
| yt-dlp             | Official self-contained 2026.10.26 universal macOS executable | Official self-contained 2026.10.26 x64 executable                                       | Official standalone bundle has GPLv3+ and dependency obligations; source Unlicense does not relicense the bundle |
| EJS                | 0.8.0 inside the pinned yt-dlp executable                     | Same pinned upstream distribution                                                       | Version matched to yt-dlp's `pyproject.toml`; no remote component installation                                   |
| Deno               | Official 2.9.8 native architecture archive                    | Official 2.9.8 x64 archive                                                              | MIT plus its distribution's component licenses                                                                   |

Pinned inputs come from the [official FFmpeg n8.0.1 source archive](https://github.com/FFmpeg/FFmpeg/archive/refs/tags/n8.0.1.tar.gz), [Debian's unmodified LAME 3.100 source archive](https://deb.debian.org/debian/pool/main/l/lame/lame_3.100.orig.tar.gz), [yt-dlp 2026.10.26 release](https://github.com/yt-dlp/yt-dlp/releases/tag/2026.10.26) and [Deno 2.9.8 release](https://github.com/denoland/deno/releases/tag/v2.9.8). Their exact asset digests live in the lockfile or controlled build recipe. The [upstream EJS guide](https://github.com/yt-dlp/yt-dlp/wiki/EJS) documents official executable bundling and restricted Deno execution.

The controlled build exists because an actual check of the upstream eugeneware `b6.1.1` arm64 asset found FFmpeg 6.0 and `--enable-nonfree`, and its Windows asset is a GPL build whose complete corresponding source is not published beside it. Both were rejected. The supplied release name alone was insufficient evidence of version or redistributability.

## Controlled FFmpeg build

`scripts/build-ffmpeg.mjs` downloads hash-pinned, unmodified FFmpeg 8.0.1 and LAME 3.100 source archives and builds them natively: with Apple's compiler and `make` on macOS, and inside the MSYS2 MINGW64 shell on Windows. Windows executables link the MinGW runtime, zlib and LAME statically; the build fails if `ffmpeg.exe` or `ffprobe.exe` import any non-system DLL. CI caches the result per platform by the recipe's hash. It disables network protocols, external dependency autodetection, nonfree/GPL FFmpeg components and unneeded codecs; enables MP3/AAC/ALAC/FLAC processing, Opus/Vorbis input, PNG/JPEG artwork, local file/pipe protocols and the filters needed by the app. System zlib is explicitly enabled for PNG support.

The resulting resources include both complete source archives, LGPL license texts, the build recipe and `ffmpeg-build.json` with source checksums/configuration. `recipeSHA256` invalidates cached builds when the recipe changes. Source content is unmodified. Toolchain ad-hoc executable signatures support Apple Silicon integrity; they are not Developer ID signing or notarization.

The independent tools check validates exact versions/digests, rejects `--enable-nonfree`, runs with an empty `PATH`, and asserts required encode/decode capabilities. Runtime validation also checks native Mach-O/PE architecture and rejects missing, changed or escaping executables. A valid filename alone is not sufficient.

## Acquisition runtime

Common yt-dlp arguments ignore user configuration, disable plugin directories and remote components, clear implicit JS runtimes, select the bundled Deno explicitly and point FFmpeg to its validated bundle. The official pinned standalone executable includes EJS 0.8.0. Upstream's Deno challenge runner uses restricted permissions, no automatic network/filesystem grants, no prompt and no remote configuration. TuneVault does not pass `-A` or enable extractor plugins.

Provider changes can still require a new tested whole-app release. A successful `--version` or local media test is not evidence that a live YouTube request is permitted or currently works. No DRM, CAPTCHA or access-control bypass is implemented.

## Platform and release boundaries

Declared native artifact targets are Apple Silicon Macs running macOS 15+ and Windows 10+ x64 PCs. The controlled Mac build and package configuration target macOS 15+. The updater's Windows minimum is 10.0.0, without a build-19045 restriction. These declarations are compatibility targets, not proof that every minimum-version OS was tested. Intel Macs and Windows ARM are not supported release artifacts. Linux AppImage packaging has been discussed but is not implemented or verified.

The available local evidence is macOS arm64. Windows x64 requires its native CI and installer/upgrade checks; an unpacked executable launch alone does not establish native installed-platform support. Historical Intel Mac checks do not establish a current supported target. Fresh quarantine/Gatekeeper, SmartScreen and physical portable-player behavior remain separate manual evidence.

Before public distribution, audit the exact packaged binaries and all dependencies for corresponding-source and notice requirements. The bundle includes yt-dlp's matching source archive and upstream third-party notices, but that is not blanket clearance for every PyInstaller component or Windows FFmpeg dependency. Preserve a compliant corresponding-source distribution or offer for the exact files shipped; a generic upstream link cannot replace an applicable obligation. Do not promote a candidate with unresolved source/license completeness.

See [third-party notices](third-party-notices.md), [release gates](release.md) and [update trust](update-trust.md).
