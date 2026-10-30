# TuneVault Privacy Policy

Draft for legal review. Not yet adopted for a public release. Platform network
and retention checks are release acceptance gates, not completed claims.

Nathanial Henniges personally maintains TuneVault. This notice covers the
app; GitHub, source services and your browser have their own policies.

The library index, settings, source descriptions, metadata revisions,
playlists, jobs, device profiles and receipts are stored locally in SQLite.
Audio is copied to the Library folder you choose; originals are preserved. Exports and
backups are ordinary local files. Other people or software with access to
those locations can read them. TuneVault does not provide disk encryption.

This implementation has no account server, advertising, telemetry, remote AI,
cloud music sync or automatic support uploads. Online operations contact the
service needed for the requested action; those services receive your IP
address, request time and normal request information:

| Service and destinations                                                                                                                                                | Information sent                                                                                                                            | When and why                                                                                                            | Provider policies and terms                                                                                                                                                               | Your control                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| MusicBrainz / MetaBrainz (`musicbrainz.org`)                                                                                                                            | IP address, request headers including a TuneVault version/contact User-Agent, title and artist query or recording/release ID                | You request metadata suggestions; results are reviewed before applying                                                  | [Privacy](https://metabrainz.org/privacy), [data licenses](https://musicbrainz.org/doc/About/Data_License)                                                                                | Turn off online metadata lookups or MusicBrainz in Settings > Metadata & artwork; no automatic enrichment                           |
| Cover Art Archive / Internet Archive (`coverartarchive.org`, redirects to `archive.org` and its subdomains)                                                             | IP address, request headers including the TuneVault User-Agent, release/artwork ID                                                          | You preview release artwork; approved artwork can be saved locally                                                      | [CAA and image rights](https://coverartarchive.org/), [Internet Archive terms and privacy](https://archive.org/about/terms)                                                               | Turn off online metadata lookups or Cover Art Archive in Settings > Metadata & artwork                                              |
| AcoustID (unavailable integration)                                                                                                                                      | Nothing: this build sends no fingerprint requests                                                                                           | Optional sound identification is unavailable pending a registered application key and verified bundled fingerprint tool | [API usage conditions and key requirements](https://acoustid.org/webservice), [Chromaprint](https://acoustid.org/chromaprint)                                                             | Off by default; enabling a preference does not make an unavailable integration operational                                          |
| YouTube / Google via yt-dlp (YouTube hosts and media/CDN destinations such as `*.googlevideo.com`)                                                                      | IP address, client request headers, requested video/playlist IDs and URLs, search terms; connected cookies when you explicitly provide them | You search, preview, acquire authorized audio or refresh a source playlist                                              | [YouTube terms](https://www.youtube.com/t/terms), [Google privacy](https://policies.google.com/privacy)                                                                                   | Do not start online source actions; cancel jobs and disconnect cookies. The metadata switch does not control YouTube                |
| GitHub (`github.com`, API/release endpoints and GitHub-controlled asset redirects including `release-assets.githubusercontent.com` and `objects.githubusercontent.com`) | IP address, request headers, release and artifact requests revealing version/platform choices                                               | Automatic update check when enabled after first-run acceptance; manual checks and requested downloads                   | [Privacy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement), [terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) | Turn off automatic checks in Settings > Updates; do not start manual checks/downloads. The metadata switch does not control updates |
| External browser links, including GitHub Issues and service/source records                                                                                              | Browser requests, headers and any account/cookie information supplied by your browser; anything you choose to post                          | You open a link or request support                                                                                      | Destination provider's policies; GitHub policies linked above apply to Issues                                                                                                             | Do not open the link or post information; review browser privacy settings                                                           |

The metadata User-Agent identifies TuneVault, its version and the public repository
contact URL. MetaBrainz says its API logs include IP addresses, User-Agent strings,
requested endpoints and query parameters. Online metadata lookups are enabled by
default but require an explicit request and network acknowledgement; the
`metadataOnline` setting blocks metadata/artwork requests only. MusicBrainz and
Cover Art Archive can also be disabled separately. This is not an app-wide offline
switch: YouTube, updates and external browser links have independent controls.
No audio or fingerprint is sent to MusicBrainz or Cover Art Archive. A future
AcoustID integration would send a fingerprint, duration and application key, not
the audio file; it must update this notice and pass implementation checks before
being enabled.

Metadata search results may be reused from a local cache for seven days; artwork
source/preview cache entries for 24 hours. Expiry stops reuse and is not automatic
deletion. Cache records and source/preview files can remain in app data or the
Library folder until removed; approved artwork and metadata revisions have their
own retention. Deleting only the Library folder does not erase the SQLite app
data, backups or remote provider logs. Closing the app clears its in-memory
network cache. These controls do not delete data already received by providers.

Spotify/Apple direct connectors and automatic browser-cookie collection are not enabled.
Offline reference-file import does not send those lists to their providers.
No credentials are required for ordinary local library use. You can explicitly
connect an exported Netscape YouTube/Google cookie file after a separate warning.
It contains account credentials. TuneVault stores an OS-encrypted copy and
gives yt-dlp a private temporary cookie file for YouTube requests. The temporary
copy is removed on disconnect/normal quit and reconciled after a crash;
disconnect removes the encrypted copy too. Your selected original is untouched.
Revoke sessions through the provider separately. Do not post this file or put
secrets in source URLs/metadata. OS secure storage must be available to connect.

Automatic update checks are switchable in Settings. Without an owner-supplied
trusted update key, the updater reports not configured and fails closed.
A user starts downloads and installation/replacement. Network errors do not
prevent offline library use.

Records, media, revision files, exports and backups persist until you remove
them. Uninstall retains user data. Removing an app or local record does not
remove copies from devices, backups or source services. Backups contain
private paths and metadata; protect them like your library.

Support reports are opt-in: preview their exact counts/runtime/tool versions
inside the app before saving a file. They exclude library names, media, paths,
source URLs and credentials. The app keeps no persistent support log and never
uploads a report automatically. Review any file yourself before sharing.

Support is voluntary through
[TuneVault GitHub Issues](https://github.com/nathanialhenniges/tunevault/issues).
The maintainer receives what you post and your public GitHub profile details,
uses it for support/security and keeps it as needed for those purposes and
legal obligations. GitHub applies its own retention practices. Never post
credentials, cookies, private paths or private playlists. Ask how to handle a
sensitive request without posting the sensitive details.

You control whether to use online actions and what to share. For questions or
requests about information held by the maintainer, use the contact route
above. Applicable privacy rights remain intact. The maintainer cannot inspect
or erase your local library remotely. Material behavior changes require an
updated notice; changing this document alone does not authorize new collection.
