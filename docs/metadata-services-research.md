# Metadata services research (2026-10-30)

Research only; nothing here is adopted. Lines marked **Opinion** are recommendations, not findings.

## Owner decision: keyless services only

AcoustID was dropped because it requires a shipped application API key. The
owner does not want API keys or unavailable features in the app. Only MusicBrainz
and Cover Art Archive remain as metadata/artwork providers. Earlier AcoustID
recommendations and checklists below are historical research, not implementation
instructions. No fingerprint tool, identification action or AcoustID setting is
included in the product. Legacy stored preferences are ignored for compatibility.

## 1. Current state

**Fetching.** All lookups start when the user acts. Inspector → Metadata suggestions → "Find suggestions" (`src/renderer/src/Inspector.tsx:378-412`) runs `lookup()` (`src/core/library.ts:2993-3036`). That function sends one MusicBrainz recording search for `title artist` with `limit=10`, then caches the results in SQLite for 7 days. "Preview release artwork…" fetches `coverartarchive.org/release/<mbid>/front-500` (`library.ts:1090-1095`) and caches the source for 24 hours. The user then reviews and applies (`library.ts:1138-1158`). `fetchBounded` (`src/core/network.ts`) allows only HTTPS to `musicbrainz.org`, `coverartarchive.org` and `*.archive.org` (redirects) (`:29-41`). It spaces requests 1.1 s apart (`:68`), honours 429/503 `Retry-After`, and sends `User-Agent: TuneVault/4.0.0 (https://github.com/nathanialhenniges/tunevault)` (`:3-4`). That version is hard-coded, so it will drift from `package.json`.

**Provenance.** `Track.origins` stores a per-field origin (`src/shared/types.ts:24`), but metadata from a lookup is recorded only as `"approved-lookup"` (`library.ts:1157`). Artwork records `Cover Art Archive release <id>` (`library.ts:1123`).

**Outbound destinations:**

| Destination | Trigger | Code |
|---|---|---|
| `musicbrainz.org` | Find suggestions | `library.ts:3005` |
| `coverartarchive.org` → `*.archive.org` | Preview release artwork | `library.ts:1091`, `network.ts:35-38` |
| `github.com` → `release-assets/objects.githubusercontent.com` | Update check (automatic 15 s after launch if enabled) and download | `src/update/service.ts:13-17`, `src/main/index.ts:895-912` |
| YouTube (`www.youtube.com` plus the media/CDN hosts yt-dlp reaches, such as `*.googlevideo.com`) | Source search (`ytsearch5:`), preview, acquisition, playlist refresh | `library.ts:835-850, 1545+, 1705-1745` |
| (none) Deno/EJS | Runs YouTube's challenge script locally with no network grants; remote components disabled | `library.ts:1508-1511`, `docs/sidecars.md:35` |
| Browser links | `openExternal` allowlist: GitHub, YouTube, MusicBrainz, CAA, imazing.com | `src/main/index.ts:670-680` |

The renderer CSP has `connect-src 'self'` (`src/renderer/index.html:8`). There is no telemetry.

**Controls.** No setting turns metadata lookups on or off or chooses services. The only gate is the one-time `onlineAcknowledged` notice (`library.ts:1186-1190`), which also gates YouTube. Settings → Privacy can only re-show that notice (`src/renderer/src/Settings.tsx:480-492`). The Sources pane covers YouTube cookies only (`Settings.tsx:277+`). Updates has the one real network toggle (`Settings.tsx:336-352`). There is no offline mode.

**Documentation gaps:**
- `docs/privacy-policy.md:20-26` names YouTube, CAA/Internet Archive, MusicBrainz and GitHub. It is missing:
  - the User-Agent contents (app version and repo URL);
  - the YouTube CDN hosts and the githubusercontent redirect hosts;
  - local cache retention (7 days for lookups, 24 hours for art);
  - links to each provider's privacy policy and terms;
  - a per-service way to turn it off;
  - that MetaBrainz logs IP, User-Agent and query parameters ([MetaBrainz privacy](https://metabrainz.org/privacy)).
- `docs/terms-of-use.md:21` lists independence from YouTube, Google, Spotify, Apple and iMazing, but not MetaBrainz/MusicBrainz, the Internet Archive or GitHub. It also says nothing about the data licenses or artwork copyright.
- `docs/providers.md:27-29` mentions MusicBrainz but not Cover Art Archive or any data licenses.
- `THIRD_PARTY_NOTICES.md` lists software only. It has no data-source attribution: MusicBrainz CC0 core data, and the statement that CAA images belong to their copyright owners.

## 2. The old app (`1618e44`)

- `metadata.service.ts` ran a MusicBrainz recording search (`limit=1`), then fetched `inc=genres+tags` for genre. It took art from CAA `front-500`.
- It *always* queried the iTunes Search API too. iTunes filled any missing genre, album or year and supplied 600×600 art (`:142-229`, upscaled from `artworkUrl100`).
- MusicBrainz calls were throttled to 1.1 s. The User-Agent was `TuneVault/3.0 (<noreply email>)`.
- Settings had a "Look up metadata while downloading" checkbox, **on by default** (`shared/models.ts:238`). Its description read: "Fetches genre, album, year and cover art from MusicBrainz and iTunes. Slower — MusicBrainz allows one request per second" (`SettingsView.tsx:209-212`).
- The Device "Fill in missing metadata" panel back-filled only empty fields.
- The README named MusicBrainz, Cover Art Archive and iTunes. There was no privacy policy, and nothing recorded which service supplied each field.

## 3. Candidates

| Service | Data | Key/account | Rate limit | Terms that matter | Verdict |
|---|---|---|---|---|---|
| [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) | Title, artist, release, date, MBIDs; tags/genres | None. Needs a UA with contact info | ~1 req/s per IP; 503 beyond | Core data CC0; **tags and genre associations are CC BY-NC-SA 3.0** ([Database](https://musicbrainz.org/doc/MusicBrainz_Database), [license](https://musicbrainz.org/doc/About/Data_License)) | **Use (primary)** |
| [Cover Art Archive](https://musicbrainz.org/doc/Cover_Art_Archive/API) | Front/back art by release or release-group; 250/500/1200 px thumbnails plus original | None | "No rate limiting rules" but documents 503 | Images "copyrighted by their respective copyright owners" ([home](https://coverartarchive.org/)) | **Use (primary art)** |
| [iTunes Search API](https://performance-partners.apple.com/search-api) | Genre, album, year, art (100 px URL, larger by URL rewrite) | None | ~20 calls/min | Content is promotional only, must sit near an iTunes/App Store badge, "not for independent entertainment value" | **Unsuitable** for writing art or tags into files |
| [Deezer](https://developers.deezer.com/termsofuse) | Album, genre, year, art up to ~1000 px | Developer account to accept terms; public read endpoints reportedly keyless | Not in terms; ~50 req/5 s widely reported (unverified) | "Strictly … non-commercial"; "strictly private use within a family scope"; may change without notice | Not recommended |
| [Discogs](https://www.discogs.com/developers) | Rich release data, genre/style, year, images | Auth required for search and images | 60/min (25 unauthenticated) | Images are Restricted Data; "Data provided by Discogs" plus link next to data; no content >6 h stale; no caching beyond need ([API terms](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)) | Optional later, user-supplied token, no images |
| [Last.fm](https://www.last.fm/api/tos) | Folksonomy tags, album info | API key and account | Unspecified; suspension for "several calls per second" | Non-commercial; **excludes images/artwork** (5.1.8); 100 MB cap; "powered by AudioScrobbler" credit | Optional genre-only, low priority |
| [AcoustID](https://acoustid.org/webservice) + [Chromaprint](https://acoustid.org/chromaprint) | MusicBrainz recording IDs from audio | App API key (Picard-style shipped key) | 3 req/s | "Free for non-commercial use only"; Chromaprint as a whole LGPL 2.1 ([license](https://raw.githubusercontent.com/acoustid/chromaprint/master/LICENSE.md)); fpcalc v1.6.2 binaries for macOS/Windows | **Use, opt-in** for untagged files |
| [TheAudioDB](https://www.theaudiodb.com/free_music_api) | Artist/album info, fan art (720/500/250 px) | Shared free key `123` | 30/min free | Terms page 404'd during research; fan-made art; strict free-tier result caps | Not recommended (terms unverifiable) |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access) | Genre and dates via MBID links | None. Needs a good UA | Back off on 429 | CC0; "Powered by Wikidata" requested; Commons images vary per file | Optional genre source |
| Spotify Web API | Tags, art | App and user OAuth; owner needs Premium; **5-user dev-mode cap** since Feb/Mar 2026 ([migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)) | — | No standalone metadata or cover art; no transferring data to another service; attribution and link-back ([policy](https://developer.spotify.com/policy) II.4-5, III.5, III.9) | **Unsuitable** |

**Privacy.** Every service receives the IP address, the User-Agent and the query. For text search the query is the title and artist. AcoustID sends a fingerprint and the duration, not audio. Discogs and Last.fm also tie requests to a key or token.

**Reliability.** MusicBrainz and CAA are community services with periodic 503s; CAA coverage is thin for indie and electronic music, which is why the old app added iTunes. AcoustID depends on community submissions. Deezer and Spotify can change terms or revoke access without notice.

## 4. Recommendations (Opinion)

**Order**
1. Text search on MusicBrainz, or AcoustID first when the file has no usable tags and the user enabled it.
2. Art from CAA: release `front-1200`, then `front-500`, then release-group `front`.
3. Genre only when enabled: MusicBrainz genres (CC BY-NC-SA; label them as such), then Wikidata.
4. Do not reinstate iTunes, Deezer, Spotify or TheAudioDB. If the owner wants iTunes back for coverage, make it off by default, use it only for suggestions, and show the terms caveat. Its art license does not fit embedding in files.

**Settings → "Metadata & artwork" section.** Add an "Online lookups" master switch, which works as offline mode, plus per-service toggles. Each toggle carries one line of what it sends:
- "MusicBrainz — sends title and artist";
- "Cover Art Archive — sends release ID";
- "AcoustID — sends an audio fingerprint and duration (off by default)".

Offline mode should block metadata, update and YouTube requests in the worker and in `fetchBounded`, not only hide buttons. Keep lookups user-initiated; any automatic fill should be a separate opt-in toggle (the old default was on).

**Provenance.** Store `origins[field] = "musicbrainz:<recording-mbid>"`, `"acoustid:<id>"`, `"wikidata:<qid>"` and similar instead of `"approved-lookup"`. Show a small source chip beside each field in the Inspector and in the apply-review table, with a link to the source record.

**Attribution.** Put the source and license under each suggestion card. Add a "Data sources" list to About and to `THIRD_PARTY_NOTICES.md`, plus a "Powered by Wikidata" credit if Wikidata is used.

**Privacy Policy addition** (replace the table at `privacy-policy.md:20-26`):

| Service | Sent | When | Why | Provider policy / terms | Turn off |
|---|---|---|---|---|---|
| MusicBrainz (MetaBrainz) | IP, User-Agent (TuneVault version, repo URL), title/artist query | You click Find suggestions | Suggest tags | [Privacy](https://metabrainz.org/privacy) · [Data license](https://musicbrainz.org/doc/About/Data_License) | Settings › Metadata, or don't search |
| Cover Art Archive / Internet Archive | IP, User-Agent, release ID | You preview artwork | Suggest art | [CAA](https://coverartarchive.org/) · [IA terms](https://archive.org/about/terms.php) | Settings › Metadata |
| AcoustID (if added) | IP, fingerprint, duration, app key | You choose Identify by sound | Identify untagged audio | [Web service](https://acoustid.org/webservice) | Off by default |
| YouTube/Google via yt-dlp | IP, video IDs/URLs, search terms, optional cookies | Search, preview, download, refresh | Requested sources | [YouTube Terms](https://www.youtube.com/t/terms) · [Google Privacy](https://policies.google.com/privacy) | Don't use online sources; disconnect cookies |
| GitHub | IP, version/platform release requests | Auto-check after launch; download | Updates | [GitHub Privacy](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) · [Terms](https://docs.github.com/site-policy/github-terms/github-terms-of-service) | Settings › Updates |

Also state that lookup results are cached locally for 7 days and artwork for 24 hours, and that clearing the cache or deleting the vault removes them.

**Terms addition.** Add MetaBrainz, the Internet Archive and GitHub (and AcoustID, if added) to the independence sentence at `terms-of-use.md:21`. Add: "Metadata is provided by third parties under their licenses (MusicBrainz core data CC0; tags and genres CC BY-NC-SA 3.0). Artwork belongs to its copyright owners; confirm you may use it."

**Implementation checklist**
- [ ] `src/shared/types.ts`: add `Settings.offline` and `Settings.metadataServices: Record<"musicbrainz"|"coverart"|"acoustid"|"wikidata", boolean>`, plus structured origins.
- [ ] `src/core/library.ts`: add defaults in `settings()` (~`:280`); add `requireService()` beside `requireOnline()` (`:1186`); make `lookup()` (`:2993`) and `artworkPreview` (`:1059`) check it; write per-service origins (`:1123`, `:1157`); add the release-group and 1200 px fallback.
- [ ] `src/core/network.ts`: take the User-Agent version from `package.json` or `app.getVersion()`; add per-host spacing (MusicBrainz 1.1 s, AcoustID 0.34 s); extend the host allowlist only for enabled services.
- [ ] `src/main/index.ts`: skip the update check (`:895-912`) when offline; extend the `openExternal` allowlist (`:670-680`) for source links.
- [ ] `src/renderer/src/Settings.tsx`: add a `metadata` pane and the offline switch.
- [ ] `src/renderer/src/Inspector.tsx`: add per-field source chips and attribution under suggestions.
- [ ] AcoustID only: fpcalc sidecar in `docs/sidecars.md` and the build scripts, LGPL notice, app key.
- [ ] `docs/privacy-policy.md`, `docs/terms-of-use.md`, `docs/providers.md`, `THIRD_PARTY_NOTICES.md`: add the text above.
- [ ] Tests in `tests/core` for disabled services, offline mode and origins.
