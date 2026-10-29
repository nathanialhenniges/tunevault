# TuneVault Privacy Policy

Draft for legal review. Not yet adopted for a public release. Platform network
and retention checks are release acceptance gates, not completed claims.

Nathanial Henniges personally maintains TuneVault. This notice covers the
app; GitHub, source services and your browser have their own policies.

The library index, settings, source descriptions, metadata revisions,
playlists, jobs, device profiles and receipts are stored locally in SQLite.
Audio is copied to the vault you choose; originals are preserved. Exports and
backups are ordinary local files. Other people or software with access to
those locations can read them. TuneVault does not provide disk encryption.

This implementation has no account server, advertising, telemetry, remote AI,
cloud music sync or automatic support uploads. Online operations contact the
service needed for the requested action; those services receive your IP
address, request time and normal request information:

| Operation                                    | Information sent                                                 |
| -------------------------------------------- | ---------------------------------------------------------------- |
| YouTube lookup/search/acquisition            | Requested source identifiers, URLs and search terms              |
| Cover Art Archive / Internet Archive artwork | Requested release/artwork identifiers and request headers        |
| MusicBrainz suggestions                      | Requested recording, artist or release search terms              |
| GitHub update checks/downloads               | Release and artifact requests revealing version/platform choices |
| Open external link                           | Browser request under your browser settings                      |

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
