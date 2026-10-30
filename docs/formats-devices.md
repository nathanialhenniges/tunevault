# Formats and portable players

MP4 players means portable audio devices here. Video acquisition/conversion
is outside scope. Extensions and device marketing labels do not prove codecs.

| Profile                | Intended output                                   | Evidence boundary                               |
| ---------------------- | ------------------------------------------------- | ----------------------------------------------- |
| iPod touch 6 / iMazing | MP3, AAC-LC or ALAC                               | Prepared folder; owner confirms actual transfer |
| Generic USB/SD/folder  | MP3 192 kbps baseline when conversion is needed   | Filesystem hashes, not playback                 |
| Archive/custom         | Original codec or FLAC, selected advanced options | Lossy history remains visible                   |
| Android/MTP            | Folder handoff                                    | Direct MTP unavailable                          |

Compatible MP3 audio is copied/remuxed rather than repeatedly lossy encoded.
MP3 uses ID3v2.3, M4A uses container metadata and FLAC uses its own tags/art.
FFmpeg output is independently checked with ffprobe and music-metadata.
The older-player artwork baseline is RGB JPEG, 600 px/500 KB, pending hardware
proof. Profiles remain Baseline until the user records model/firmware testing.

Relative M3U8 files preserve occurrence order, including repeated tracks.
Unavailable and skipped entries appear in the omission report. A partial
export must not be called a complete copy. Album track numbers remain archive
metadata, independent of playlist position and export filenames.

No target file deletion is automatic. Only a chosen destination is written.
Unknown files remain untouched. Budgets are separate from measured free space;
exact rendered bytes and a reserve are checked before finalization.

For iMazing, prepare/reveal the folder, import with iMazing, check your iPod and
then confirm the selected batch. This app cannot prove playlist creation/order
inside iPod Music. Generic USB verification proves copied bytes only. MTP and
iOS Music databases are not treated as ordinary mounted folders.

Advanced profiles expose conversion bitrate/sample rate, artwork bounds,
MP3 ID3v2.3/2.4, UTF-8 filename/path byte limits, LF/CRLF UTF-8 playlists,
and optional per-occurrence ordering tags. Ordering tags change only target
renditions; repeated occurrences get distinct derivative tags and canonical
library metadata stays unchanged. iMazing batches remain self-contained.

Preflight separates known media bytes, estimated additional bytes, configured
budget, current free space, and a dated last-known capacity observation.
An old observation is not a current measurement of a disconnected player.
Confirming a handoff appends evidence and retains the prepared records.
Marking a profile User-tested requires explicit model, firmware and results;
generating a synthetic test pack never establishes hardware compatibility.

Raw AAC, AIFF, WAV, Vorbis, Opus and audio-only WebM inputs have bundled-tool
tag/artwork tests. Compatible AAC/WebM audio can be remuxed into taggable
containers without re-encoding. Full-resolution extracted artwork is retained
separately from player-sized derivatives. ID3v2.3 month-only dates also use
a TUNEVAULT_DATE frame to retain precision; other players may display only
the standard year field.
