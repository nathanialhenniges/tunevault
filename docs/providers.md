# Sources and matching

Use online acquisition only for recordings you may lawfully copy and under
the source service's terms. The one-time notice is not proof of permission.

YouTube uses pinned yt-dlp, Deno/EJS and FFmpeg. Discovery returns ordered
references; acquisition is a separate durable job. Descriptions remain inert
text, with source provenance retained. No browser cookies are collected automatically. Explicit exported-cookie
connection is available with a separate credential warning and OS-encrypted
storage; disconnect/quit removes its temporary plaintext file.
Extractor plugins and external configuration discovery are disabled.

Spotify/Apple direct links report credentials-required until a permitted,
tested connector is available. They are reference providers, not subscription
audio extraction. Local selected-playlist exports are the usable fallback:
M3U/M3U8, CSV/TSV, Spotify playlist JSON and Apple Music XML/text. External
playlist paths are references and grant no filesystem access.

CSV/TSV columns: title, artist, album, duration, url (optional). Durations may
be seconds or MM:SS/HH:MM:SS. Preserve repeated rows. Choose one playlist,
not a whole private-account export. Never silently claim a partial list is
complete. Local matching requires strong approved identity; text similarity
alone must not silently merge recordings or remixes.

Candidate review shows title/channel/duration/URL and reasons. Attach a local
file, choose an exact authorized source or skip uncertain occurrences. A
recording lookup suggests metadata, which is explicitly reviewed before apply.
No lookup failure removes saved audio. MusicBrainz requests use a descriptive
User-Agent, rate limiting and cache.

## Metadata, artwork and other online services

Metadata suggestions are user-initiated; imports do not automatically enrich
files. Settings > Metadata & artwork controls `metadataOnline` (default true)
and `metadataServices` (`musicbrainz: true`, `coverArtArchive: true`).
Disabling online metadata blocks metadata/artwork requests
only. YouTube actions, updates and browser links remain separately controlled.
Service preferences are merged with defaults for existing settings.

| Service                                                                                                                      | Request and result                                                                                                                                             | Rights, limits and controls                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) / [MetaBrainz](https://metabrainz.org/privacy)      | First metadata source: explicit title/artist search, recording/release IDs; sends IP and identifying version/contact User-Agent. Review fields before applying | Shared request queue spaces requests by at least 1.1 seconds, with bounded retries/backoff. [Core data is CC0; supplementary data is CC BY-NC-SA 3.0](https://musicbrainz.org/doc/About/Data_License). Toggle MusicBrainz or all online metadata off |
| [Cover Art Archive](https://musicbrainz.org/doc/Cover_Art_Archive/API) / [Internet Archive](https://archive.org/about/terms) | Explicit artwork preview by MusicBrainz release ID, including trusted Archive redirects. Up to 1200px artwork; review before applying                          | Images remain [copyrighted by their owners](https://coverartarchive.org/). No implied embedding/export license. Toggle Cover Art Archive or all online metadata off                                                                                  |
| [YouTube / Google](https://www.youtube.com/t/terms)                                                                          | Requested source search, preview, acquisition and playlist refresh via pinned yt-dlp; optional explicitly connected cookies                                    | Separate network acknowledgement and source-service obligations. Metadata settings do not disable it. [Google privacy](https://policies.google.com/privacy) applies to Google/YouTube/CDN requests                                                   |
| [GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)                                        | Update release/artifact requests, including GitHub-controlled asset redirects; public Issues support if you post                                               | Automatic update checks have their own Settings control. Manual checks/downloads remain explicit. [GitHub privacy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) applies                                 |
| Spotify / Apple Music                                                                                                        | Local reference files; no active direct connector or subscription-audio extraction                                                                             | Importing a reference sends no list to these services and grants no content rights                                                                                                                                                                   |
| Browser links / iMazing                                                                                                      | Explicitly opened source, documentation, support and external-tool links                                                                                       | Browser/provider policies apply; metadata controls do not stop browser navigation. iMazing handoff is not transfer verification                                                                                                                      |

Applied service fields retain `service:id` provenance, for example
`musicbrainz:<recording-mbid>` and `coverartarchive:<release-mbid>` for artwork.
User edits and existing embedded metadata keep their own origins; choosing a
suggestion is not evidence that every field or recording identity is correct.

Search cache entries are reusable for seven days and artwork source/preview
entries for 24 hours. Expiry is a reuse limit, not a deletion schedule. SQLite
cache rows and Library folder artwork files may remain after expiry; approved
artwork/revisions and backups also persist. No claim is made that deleting the
Library folder alone erases app data or provider logs.

iTunes Search, Deezer, Discogs, Last.fm, TheAudioDB, Wikidata and Spotify metadata
APIs are not fallback metadata/artwork services in this build. Their availability
or appearance in research does not imply adopted integration or suitable rights.

## Provider access spike (2026-10-29)

Official Spotify Web API and Apple Music catalog playlist requests without
application credentials both returned HTTP 401. No private library, account
token or audio was accessed. Spotify's current
[authorization guidance](https://developer.spotify.com/documentation/web-api/concepts/authorization)
and [developer policy](https://developer.spotify.com/policy), and Apple's
[developer-token requirements](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens)
must be satisfied by a permitted connector before enabling direct reads. A
ChatGPT catalog-search connector does not supply a redistributable developer
credential or prove that complete ordered playlist retrieval is available.
No client secret or Apple private signing key is shipped in TuneVault.
