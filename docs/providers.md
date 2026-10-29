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
