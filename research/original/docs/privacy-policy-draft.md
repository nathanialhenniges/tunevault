# TuneVault Privacy Policy

Unpublished draft for the planned rebuild, prepared 2026-10-28. The statements below describe the proposed design, not verified behavior of the existing repository or a released app. Nathanial Henniges personally is the confirmed operator, and GitHub Issues is his chosen contact route. Verify the issue tracker accepts new issues, the effective date, actual dependencies, network requests, settings, and retention before publication. See `legal-release-notes.md`.

## Scope

Nathanial Henniges personally maintains and distributes TuneVault. This notice covers the TuneVault desktop app. Websites, release hosting, support channels, and third-party services have their own privacy practices.

## Your local library

TuneVault stores the library you create on your computer. This can include audio and artwork, file paths, titles and other tags, source URLs and descriptions, playlists, match decisions, device/export profiles, transfer confirmations, settings, and local diagnostic logs.

The planned app has no TuneVault account system, hosted music library, advertising, analytics, automatic crash-report upload, or cloud music synchronization. It does not send your complete library or local audio files to the maintainer as part of normal operation. It does not sell or share personal information for targeted advertising.

Local storage is not a promise of anonymity or full-disk encryption. Other people or software with access to your computer, backups, or chosen export folders may be able to access those files. Operating-system backup and cloud-folder settings are under your control.

## Requests to external services

Network features send the information needed for the action you request. The receiving service can also see connection information such as your IP address and request time.

| Feature | Information the receiving service may receive |
| --- | --- |
| Source lookup, search, or download through yt-dlp | Requested URL/video or playlist ID, search terms, normal request headers, and any credentials/cookies you explicitly authorize for that service |
| MusicBrainz metadata suggestions | The recording/artist/album search terms or identifiers you choose to look up |
| Cover Art Archive and artwork hosts, including redirect destinations | Requested artwork identifiers/URLs and normal network request information |
| An enabled authorized Spotify/Apple Music connector | Authorization requests, requested playlist/catalog identifiers, and requests needed for the feature; subject to that connector's permissions |
| GitHub release/update checks and downloads | Requests for release information and selected update files; requested download paths can reveal platform or version choices |
| Opening a source or help link | The destination receives a normal browser request under your browser's settings |

These services process requests under their own policies. Relevant policies include [Google](https://policies.google.com/privacy), [MusicBrainz](https://musicbrainz.org/doc/Privacy_Policy), [Internet Archive](https://archive.org/about/terms.php), [Spotify](https://www.spotify.com/legal/privacy-policy/), [Apple](https://www.apple.com/legal/privacy/), and [GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). TuneVault's notice does not control their retention or practices. Only list connectors and destinations actually present in the released build.

## Credentials and browser cookies

Browser-cookie access is optional and must be enabled explicitly for a supported feature. It is not needed to maintain a local library. Authorized cookies or tokens are used for the selected service and are not sent to TuneVault's maintainer. Credentials are excluded from exported diagnostics, and persistent tokens use operating-system secure storage where supported. Revoke third-party authorizations through the provider if you no longer want them used. Clear any app-managed credential copy separately; deleting a local copy does not necessarily revoke the provider's session.

## Support and diagnostic reports

Diagnostic reports are shared only when you choose to send them. Review the preview and redact private names, paths, URLs, and playlist information before sharing. Automated redaction cannot guarantee that every personal detail has been removed. Never send passwords, access tokens, browser cookies, or unreleased recordings.

If you open a GitHub issue, the maintainer receives the issue content and the GitHub account information visible with it. That information is used to respond, troubleshoot, maintain security, and meet applicable legal obligations. Support information held by the maintainer is kept only as needed for those purposes. GitHub also retains public issues under its own practices. Do not post sensitive information in an issue; start with a minimal message asking how to handle a request that needs private details.

## Your choices and retention

You control your local library and exports. Local records and files remain until you remove them or an implemented cleanup control removes them as described in the app. Uninstalling the app may leave library folders, exports, backups, or operating-system credentials behind. Deleting a TuneVault record does not delete copies on a player, in backups, or held by another service.

You can choose whether to use online lookup/download features, enable optional credentials, enable automatic update checks where offered, or send support information. For access, correction, or deletion requests concerning information held by the maintainer, use the contact route below without posting private details. Rights and response requirements depend on applicable law; this notice does not limit those rights. The maintainer cannot directly inspect or delete your local library.

## Changes and contact

The effective date and material changes will be identified in the release documentation. New collection or sharing must be explained before it starts, with permission where required; silently changing this page is not a substitute for that permission.

For privacy questions or requests concerning information held by the maintainer, contact Nathanial Henniges through [TuneVault's GitHub Issues](https://github.com/nathanialhenniges/tunevault/issues). Issues are public. Do not post cookies, passwords, tokens, identity documents, private playlists, or other sensitive details. You can begin with a minimal request for instructions without identifying those details publicly.
