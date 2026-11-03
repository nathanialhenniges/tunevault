# TuneVault media, metadata, playlists, and portable-device research

Research date: 2026-10-28. This is a feasibility and implementation brief, not proof that a particular downloaded file, API account, installer, or physical device works. Recommendations below are design decisions unless explicitly described as documented behavior. Nathanial's intended use is personal archiving; installer distribution and provider API reach are separate concerns.

## Recommended product boundary

Build a local audio library with two independent operations: acquire or import a source, then prepare a device-specific copy. Preserve original media and user metadata. Keep playlist membership/order separate from the canonical recording and from each exported file. Treat Spotify and Apple Music links as potential playlist references, never as a promise to extract subscription audio.

The first release can fully deliver local-file import, authorized YouTube URL/playlist acquisition, metadata review, source-description preservation, playlists, format conversion, and export tracking. Direct Spotify/Apple Music connectors need genuine access and permitted-use review; they must not hold the core library hostage. Provide user-supplied M3U/CSV/text playlist import and an honest provider-unavailable explanation when credentials/access are absent.

The requested end-to-end flow remains a product requirement: paste Spotify/Apple Music playlist URL → read ordered song references → reuse matching local tracks → find YouTube candidates for the remainder → review uncertain matches → archive selected authorized recordings → prepare the device copy. This is reference matching, not extraction of Spotify/Apple subscription audio. Technical API access and provider contract restrictions still apply to metadata; this research does not conclude that the entire personal workflow is illegal or impossible.

Do not silently delete the link-import requirement from the rebuild. Implement the common reference-list pipeline first, then validate each provider's reading method with a focused spike. A provider can be `available`, `credentials-required`, `partial`, `unsupported`, or `temporarily-failed`; preserve any recovered names and the original URL for review/fallback. Public-page parsing, if pursued after checking applicable terms, must be a bounded read of available public data with parser fixtures, explicit completeness evidence, and no bypass of account/access controls. A parser returning 30 entries from a 200-entry playlist is a partial result, not success.

## What each input can mean

| Input | Feasible first-release behavior | Boundary |
| --- | --- | --- |
| Local audio files or folders | Copy into a managed library; probe codec/tags/art; review duplicates | Never move/delete the user's originals by default; reject DRM content clearly |
| YouTube video | Extract source information, download available authorized audio, retain its provenance, review metadata | Video title/uploader/thumbnail are not guaranteed recording title/artist/album cover |
| YouTube playlist | Read complete ordered membership, show a preview, queue selected entries, refresh later | Missing/private/deleted entries stay visible as unresolved slots; never claim a partial fetch is a complete playlist |
| Long DJ mix | Keep whole mix by default with description and chapter list; offer reviewed splitting | Chapter labels and timestamps can be wrong; crossfades do not become studio originals |
| Spotify playlist link | Conditional authorized metadata import; otherwise accept user-exported list or explain access limits | No subscription audio download and no public one-click guarantee |
| Apple Music playlist link | Conditional permitted metadata workflow; local Music export is a practical alternative | Private library data requires authorization; catalog metadata/artwork is not an unrestricted tagging database |
| Generic MP3/MP4 player | Export to a selected folder/volume using a conservative profile | Exact model, filesystem, tags, playlist encoding, and playback order require hardware verification |
| iPod touch 6th generation | Prepare AAC/MP3/ALAC files and a clear iMazing handoff | A folder copy is not an iOS Music-library import |

## yt-dlp, not legacy youtube-dl

yt-dlp documents structured JSON output, predictable progress templates, extraction/conversion, metadata and thumbnail embedding, description/info sidecars, ordered playlist indices, and chapter splitting. It explicitly advises integrations against parsing its ordinary human-oriented stdout. Use structured output and do not infer success from the process merely starting. Keep `--ignore-config` in app-managed execution so a user's global downloader options cannot silently change archive behavior. The info JSON can contain personal information; archive a sanitized allowlist rather than blindly sharing it. [Official yt-dlp README](https://github.com/yt-dlp/yt-dlp#readme)

YouTube support now needs EJS challenge-solver scripts and an external JavaScript runtime. Deno is recommended and enabled by default; its documented minimum is 2.3.0. Node's documented minimum is 22. Bun support is deprecated, with versions after 1.3.14 unsupported. Full executables/PyInstaller bundles include EJS; other installation methods differ. Pin a tested downloader/runtime/EJS combination and expose its versions in Diagnostics. Treat this as a release dependency, not something a friend must troubleshoot in a terminal. [Official EJS setup guide](https://github.com/yt-dlp/yt-dlp/wiki/EJS)

YouTube may demand Proof of Origin tokens for certain clients/requests, and the upstream guide associates missing tokens with 403 errors and possible account/IP blocking. Requirements change. Do not silently install arbitrary plugins or scrape browser cookies to retry indefinitely. Classify auth/rate-limit/extractor/runtime failures and offer a bounded retry or dependency update. A third-party token-provider integration needs its own packaging/security decision. [Official PO Token guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)

Recommended acquisition contract:

1. Validate the accepted URL types and normalize the canonical video/playlist ID. Resolve redirects under network restrictions; do not expose arbitrary executable arguments or shell commands.
2. Fetch a playlist preview without media transfer. Paginate/continue fully; retain the fetched time and completion state. Ask whether a video URL containing a playlist parameter means one video or the playlist.
3. Resolve individual entries before download. Flat playlist extraction is suitable for a quick preview, not complete metadata assurance.
4. Store the provider, source ID, canonical URL, raw source title/uploader/description, available structured music fields, duration, extraction date, and format provenance. Exclude cookies, auth headers, expiring signed media URLs, machine paths, and unrelated extractor fields from portable exports.
5. Queue acquisition independently from conversion/tagging. A failed artwork lookup should not force a second network download.
6. Mark a source ready only after the subprocess exits successfully, its expected file exists, and ffprobe can read the intended stream. Preserve partial jobs as retryable, never as completed library tracks.
7. Keep app-managed originals and derivatives distinct. Do not let extraction/post-processing defaults delete the only retained source. If retaining the original is disabled, say so before the job and retain honest quality provenance.

No auto browser-cookie import, comments scrape, ads removal, source trimming, loudness processing, or remote-AI metadata upload is needed for the core request. Description text is untrusted content and must render as text, not executable HTML.

## Formats and the iPod touch 6

Apple lists AAC, MP3 including VBR, Apple Lossless, AIFF, and WAV among the sixth-generation iPod touch's supported audio formats; FLAC and Opus are absent. Do not extrapolate a newer iPhone's format list to this device. [Apple's device specifications](https://support.apple.com/en-us/112023)

| Profile/output | Intended use | Recommended behavior |
| --- | --- | --- |
| Original available audio | Archive master | Keep downloaded codec/container without a needless lossy re-encode when practical; record the actual source format |
| MP3 | Broad old-player compatibility candidate | Default generic profile: 192 kbps CBR, stereo or retained mono, 44.1 kHz when conversion is needed; ID3v2.3 and baseline JPEG cover are proposed conservative defaults, not universal compatibility proof |
| AAC-LC in M4A | Compact iPod touch library | Prefer a compatible existing AAC stream by remuxing when valid; otherwise encode a device derivative, with 256 kbps as a configurable export target, never a quality claim |
| ALAC in M4A | Apple-compatible lossless derivative | Useful for an actually lossless source; does not restore quality lost upstream |
| FLAC | Explicit archive/export option | Label a conversion from lossy input as “FLAC encoded from a lossy source”; keep source codec visible; do not select for the iPod Music handoff |
| WAV / AIFF | Advanced interoperability option | Large files; tagging/artwork support varies by reader; do not choose as the device default |
| Opus / Ogg Vorbis | Advanced modern-player option | No default iPod touch 6 compatibility promise; expose only if implemented and verified |
| MP4 video | Separate optional video scope | MP4 is a container, not a universal audio codec or a guarantee that a device marketed as an “MP4 player” can play a file |

The MP3 bitrate, sample-rate, tag, and cover limits above are product defaults to validate on real equipment. Do not transcode an already compatible MP3 just to normalize a number. Do not upsample masters or repeatedly transcode one device copy into another.

FFmpeg distinguishes containers/muxers from encoded streams, supports MP3 ID3 configuration and attached pictures, and has format-specific metadata behavior. Use explicit tested export recipes rather than changing a filename extension. The `.m4a` extension alone cannot distinguish AAC from ALAC; probe the stream. [FFmpeg formats documentation](https://ffmpeg.org/ffmpeg-formats.html)

FLAC's lossless encoding preserves the PCM it is given; it cannot reconstruct information removed by an earlier lossy encode. A YouTube-derived FLAC may be valid FLAC while retaining the source's lossy history. Show container/codec and source history as separate properties. [FLAC format documentation](https://xiph.org/flac/documentation.html)

## iMazing handoff: useful without pretending to own the transfer

iMazing documents importing a folder including its subfolders or dragging audio files into a device's Music section. It can detect existing tracks, present duplicate choices, and show a completion report. Its documented iOS import formats include MP3, AAC/M4A, Apple Lossless, AIFF, and WAV. [iMazing computer-to-device music guide](https://imazing.com/guides/how-to-transfer-music-from-a-mac-or-pc-computer-to-an-iphone-ipad-or-ipod)

Use a stable per-device staging folder. “Prepare for iPod” should create compatible, tagged copies plus a human-readable transfer report, then offer “Show folder,” “Open iMazing” when available, and “Mark selected tracks as transferred.” The last operation is explicitly user-confirmed and timestamps the exact export revisions. It must not claim programmatic verification.

Proposed per-target states:

| State | What is actually known |
| --- | --- |
| Needs preparation | Desired library revision has no valid target derivative |
| Ready to transfer | Derivative exists locally and passed probe/tag checks |
| Exported to folder | Files were written to the selected destination |
| Transfer confirmed by you | User says this exact handoff revision reached the iPod |
| Copied and verified on volume | Only for a mounted storage target after hash verification |
| Changed since transfer | Tags, cover, content, or export settings differ from the last confirmed revision |
| Unavailable / needs review | Missing source, incompatible export, or unresolved match prevents preparation |

Playlist creation/order inside iMazing and the iPod Music app is a separate acceptance test. Do not imply importing a directory or M3U into iMazing automatically reproduces playlist order. Do not claim unsupported CLI integration: this research did not establish an official supported command for importing music and confirming playlist state. Opening iMazing is not a transfer.

Actual device iOS version, iMazing version/license, trust/pairing state, storage, supported artwork dimensions, long-mix seeking/resume, and playlist handoff must be tested with Nathanial's device. Device-specific adjustments belong in a profile, not in archive master metadata.

## Generic USB players: exact order without destroying album tags

No additional MP3-player model is currently known. Start with a user-selected export folder; enable direct copy only for a genuine mounted filesystem. MTP-only players are a separate integration and must not be shown as mounted drives. Avoid claiming that all “MP3/MP4 players” accept the same formats.

SanDisk's own documentation illustrates why profiles matter: some Clip players sort within albums by track number and have model-specific text/database limits. This is evidence of variability, not a TuneVault promise to support those exact models. [SanDisk sorting reference](https://support-en.sandisk.com/app/answers/detailweb/a_id/46598/~/learn-about-clip-jam%2C-voice%2C-sport%2C-and-plus-mp3-player-file-sorting)

Its Clip Sport Plus manual documents M3U files located with the playlist's media. The correct playlist format/location must be checked against the actual player. [SanDisk Clip Sport Plus manual](https://downloads.sandisk.com/downloads/um/clipsportplus-um.pdf)

Recommended profile fields: codec/container, bitrate mode/target, sample rate, channel handling, ID3 version, artwork type/dimensions/byte cap, filename/path limits, filename normalization, playlist encoding/newlines/path separators, and destination subfolder. Keep the normal UI to profile selection; hide these fields under Advanced.

Export a stable ordered M3U8 with relative paths for modern players and a separate legacy M3U option when needed. Preserve duplicate playlist occurrences. Use zero-padded filename prefixes in a playlist-specific export folder (for example `001 - Artist - Title.mp3`) where folder playback is needed. If a profile must override track numbers to preserve order, alter only those derivative files and make the override explicit. Never overwrite canonical album track numbers to represent one arbitrary playlist.

Direct-copy safety: constrain all paths to the selected target; reject path traversal, symlink escape, Windows reserved names, and case/Unicode-normalization collisions. Show required bytes versus free space, handle media disappearance mid-copy, write temporary files, verify hashes, and commit the target manifest only after successful writes. Initial release should not delete device files automatically. Any future mirror cleanup can only touch files recorded as TuneVault-owned and requires a reviewable removal list.

## Metadata and artwork: confidence, provenance, and manual locks

Recommended precedence: user-locked values > trusted existing file tags > user-approved catalog match > structured source music fields > conservative title parsing > blank value needing review. An uploader is not automatically the artist; a video upload date is not automatically the song release date. Unknown is a valid state.

Keep source-derived metadata immutable alongside editable library tags. Each field should record its origin, updated time, and lock/approval status. A refresh may suggest new values but must not overwrite manual edits. Support title, artists, album, album artist, track/disc numbers and totals, year/date, genre, composer where available, comment, source URL, provider IDs, optional ISRC/MBIDs, duration, codec/bitrate/sample rate, artwork origin, and mix chapters. Keep long descriptions in the database and optional `.txt` sidecar instead of forcing them into old-player display fields.

ID3v2.3 provides title, artist, album, track number, and attached-picture frames. TuneVault should verify the actual written tags with an independent read/probe step, including non-ASCII names and embedded cover art. [ID3v2.3 specification](https://id3.org/id3v2.3.0)

Use MusicBrainz as an optional recording/release suggestion source, with a meaningful application User-Agent and a shared queue limited to no more than one request per second per IP. Cache stable results and back off on 503 errors. [MusicBrainz rate-limiting rules](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)

Cover Art Archive has release/release-group artwork lookup and 250/500/1200 thumbnail variants. A valid recording match does not uniquely determine a release's cover; let the user select the release. Keep artwork provenance and allow a local replacement image. [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API)

Artwork pipeline recommendation: preserve the selected original; decode and validate image bytes/dimensions; generate a derivative appropriate to the target; embed a baseline RGB JPEG front cover, with an initial 600 px / 500 KB cap as a TuneVault profile choice pending physical tests. Preserve aspect ratio/padding choices and show a crop preview for video thumbnails. Do not fetch random search-engine art or indiscriminately embed Spotify/Apple Music artwork.

Fingerprint lookup is an optional later helper, not automatic identification of every remix or long mix. AcoustID requires application registration, limits its free service to non-commercial use and at most three requests per second, and sends a fingerprint plus duration. Commercial/public distribution needs review of that actual use, not an assumption that open-source client code makes the service unrestricted. [AcoustID service rules](https://acoustid.org/webservice)

MusicBrainz warns that fingerprint matching can confuse karaoke/instrumental/radio edits and very short clips, and timing shifts can prevent matches. A fingerprint match should be evidence in the review UI, not unconditional replacement of recording identity. [MusicBrainz fingerprint limitations](https://musicbrainz.org/doc/Guides/AcoustID)

## Match review: refuse the wrong song politely

When matching a user-supplied reference list to local files or lawful source candidates, show title, artist, duration, version markers, source channel, availability, and why a candidate was suggested. Exact IDs/approved prior mappings outrank text similarity. Duration is useful evidence but not proof. Preserve live/remix/remaster/cover/instrumental/clean/explicit markers rather than deleting them during normalization.

Only auto-accept previously approved exact mappings or conservatively strong matches with no version conflict. Do not advertise numerical confidence as measured probability unless calibrated against a labeled corpus. “Needs review” should keep the item unresolved; allow audition/open source, choose another, paste exact URL, skip, or attach a local file. Record the user decision for the next refresh. A 55-minute mix must never be auto-matched as a three-minute album track merely because names overlap.

## Spotify: public-install feasibility is constrained

Spotify's current quota page limits development-mode apps to five allowlisted authenticated users and requires the app owner to have Premium. Public extended-quota eligibility lists an established organization, active launched service, at least 250,000 monthly active users, and other requirements. This makes an out-of-box public Spotify integration a substantial access dependency, not a checkbox Nathanial can simply ship. [Current quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

The February migration guide restricts new development-mode playlist contents to playlists the user owns or collaborates on, renames track endpoints to `/items`, and changes response fields. The March 9 update postponed endpoint changes for existing integrations, so old and new apps may differ. Recheck the actual registered app and current endpoint behavior during implementation. [February migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [March postponement update](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)

Do not repeat the February guide's one-client-ID rule as current: the July changelog raises the limit to 25 and pools development quota per developer account. The March changelog restores external IDs; the May changelog adds stable `account_id`. Treat 2026 API summaries as dated snapshots and test missing/nullable fields. [July changes](https://developer.spotify.com/documentation/web-api/references/changes/july-2026), [March changes](https://developer.spotify.com/documentation/web-api/references/changes/march-2026), [May changes](https://developer.spotify.com/documentation/web-api/references/changes/may-2026)

Spotify permits a user-playlist-metadata transfer exception but also restricts integration with another service's streams/content, requires attribution/link-backs for Spotify metadata/art, and requires deleting user personal data after disconnection. This is not blanket permission to use Spotify as a permanent art/tag source for YouTube downloads. Keep a public connector disabled until its exact workflow satisfies the current policy; obtain a permitted route rather than disguising a Spotify-to-YouTube downloader. [Spotify Developer Policy](https://developer.spotify.com/policy)

If an authorized connector is later implemented, use Authorization Code with PKCE in the system browser, not an embedded client secret. Limit scopes to the read workflow; validate state and redirect; store refresh credentials in OS secure storage. [Spotify PKCE guide](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)

Existing scraping of embeds/public serialized web state is not a reliable substitute for complete, authorized playlist API access. Public links may contain only previews or fail when their internal page format changes. Never label that result “all tracks” without a verifiable complete snapshot.

There is a concrete personal fallback without a hosted API backend: Spotify's official Download Your Data export includes JSON playlist information such as playlist name, modification date, songs, artists, and albums. Import only the chosen playlist from this local file; do not ingest the user's entire private account-data bundle or require uploading it. This is an offline snapshot, so refreshing means importing a newer export, not live sync. [Spotify's data-export contents](https://support.spotify.com/us/article/understanding-your-data/)

## Apple Music: data API is not an audio extraction API

Apple documents catalog playlist lookup by ID and storefront. Private/library playlist requests require a Music User Token. All API requests require a developer token; non-native cross-platform clients must manage signing/token distribution, and Apple documents a maximum six-month token expiration. Never ship a developer private key inside the desktop app. A public token-service dependency would need explicit approval; a private local key workflow is not suitable as the normal installer experience. [Catalog playlist endpoint](https://developer.apple.com/documentation/applemusicapi/get-a-catalog-playlist), [Library playlist endpoint](https://developer.apple.com/documentation/applemusicapi/get-a-library-playlist), [Developer tokens](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens), [User authorization](https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit)

Apple's agreement ties MusicKit use to access to users' Apple Music subscriptions, restricts download/upload/modification of MusicKit content, and restricts using album artwork/music text separately from playback or playlist management. User playlist metadata must serve a disclosed, directly relevant function. This does not establish permission to bulk embed Apple catalog artwork into unrelated archive files. Keep the exact integration gated until reviewed against current terms. [Apple Developer Program License Agreement, MusicKit section](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)

For the first release, allow user-exported local Music playlists/reference lists plus their owned DRM-free files. Never extract Apple Music subscription downloads or claim a “lossless Apple Music downloader.” A preview URL is not the full recording.

Apple explicitly documents Music on Mac → File → Library → Export Playlist as XML or song information as text. These exports contain information, not song media. Also support pasted tab-separated visible song columns. This gives Nathanial an immediate personal playlist-reference path without distributing a private key or adding a backend. It does not prove that the current Windows Music app has the same menu. [Apple's Music playlist export guide](https://support.apple.com/guide/music/save-a-copy-of-a-playlist-mus27cd5060f/mac)

## Playlist synchronization: specification that preserves intent

Use separate identities for the recording, the source asset, and each playlist occurrence. One video can appear twice at distinct positions; two recordings can share a title. A database keyed only by video ID cannot preserve this correctly.

Recommended records: `tracks`, `source-assets`, `metadata-revisions`, `playlists`, `playlist-entries` with stable local occurrence ID and ordinal, `source-snapshots` with completion/ETag/snapshot token when available, `match-decisions`, `export-profiles`, `export-artifacts`, `targets`, and per-target receipts. This is a conceptual model, not a requirement to add a framework for every record.

Refresh algorithm:

1. Fetch a complete new source snapshot before changing local membership. Pagination/network failure leaves the previous good snapshot intact and labels the attempted refresh incomplete.
2. Show added, removed, reordered, unavailable, and metadata-changed items separately. Compare occurrence-aware membership, not a set of video IDs.
3. Ask to apply playlist membership/order changes. Source removals remove a playlist occurrence, not the recording/file from the library.
4. Preserve user locks, approved source mappings, manual entries, local annotations, and archived assets. Distinguish following source order from a manually arranged local copy; do not silently override the latter.
5. Queue only missing/changed outputs. If an entry remains the same and only position changes, reuse its content and regenerate the relevant playlist/export arrangement.
6. Derive “needs transfer” from content + metadata/art revision + export-profile revision + target receipt, not simply “downloaded today.” A changed cover needs a new device export even when the audio hash is unchanged.
7. Keep device receipts independent per target. An iPod confirmation cannot mark a generic USB player synchronized.

Default to refresh on request and optionally on launch. Background refresh must be visible/cancellable and must never trigger destructive cleanup or silently change source mappings. No cloud account or permanent server is needed for this local synchronization model.

## Long mixes and descriptions

Default: one item titled as the mix, with its source description and available chapters. Expand “Description & tracklist” when needed. Allow copying plain tracklist text and exporting it next to the mix.

Optional split workflow: preview detected chapters/timestamps, allow edits, validate increasing nonnegative start times within duration and positive segment lengths, identify gaps/overlap, then generate derived segment tracks linked to their parent and original ranges. Preserve the whole mix. For handmade timestamp descriptions, parse strict `MM:SS`/`HH:MM:SS` starts and flag uncertain text instead of inventing boundaries. One timestamp alone is not a verified whole tracklist. Keep DJ/album metadata distinct from individual song guesses.

Splitting may re-encode or cut at codec boundaries depending on the operation. Never promise sample-accurate, lossless cuts from every compressed source. A short boundary audition and duration checks should be available before exporting many chapter files. An unchaptered mix cannot reliably be decomposed into all songs from its URL alone.

## Acceptance checks for the future rebuild

- [ ] Generate small synthetic audio fixtures; assert actual MP3/AAC/ALAC/FLAC codec, duration tolerance, expected tags, and a decodable embedded cover. No commercial tracks belong in tests.
- [ ] Test repeated video IDs at multiple playlist positions, a missing private entry, reordering, remote removal, local manual entry, and a partial snapshot failure.
- [ ] Test title collisions, multi-artist/non-ASCII metadata, user locks surviving refresh, incorrect/remix matches requiring review, and a mix versus single-song duration mismatch.
- [ ] Test descriptions containing HTML/script-like text and URLs; render inertly and keep source text readable.
- [ ] Test chapter zero/negative/out-of-order/out-of-range times, one remaining chapter, hour-long timestamps, crossfade labels, and unavailable split output.
- [ ] Test target copy interrupted by disconnection, disk full, retry, hash mismatch, changed artwork, changed export profile, duplicate filenames, Windows reserved names, Unicode/case collision, and path escape.
- [ ] Test that “ready,” “exported,” “user-confirmed transfer,” and “volume-verified” cannot accidentally become the same state.
- [ ] Probe/launch bundled yt-dlp, FFmpeg/ffprobe, and EJS runtime in installed macOS/Windows builds without globally installed tools. Test missing dependency, offline mode, rate limit, and retry/cancel.
- [ ] On the real iPod touch 6 + iMazing, import one MP3 and one AAC with art and non-ASCII names; confirm Music sorting, artwork, playback/seek and a long mix; verify playlist handoff separately. Test ALAC if exposing the profile.
- [ ] On a future named generic player, verify the exact codec/tag/art/M3U profile and order physically; record model/firmware and test date before calling it supported.

## Unresolved evidence boundaries

No copyrighted recordings were downloaded, no Spotify/Apple developer credentials were tested, no private playlists were opened, no actual iMazing transfer was performed, and no generic player is owned/identified for validation. Current public documents do not prove permission or access for a public Spotify/Apple metadata-to-download product. The rebuild prompt must carry these gates forward explicitly instead of promising every requested URL is supported.
