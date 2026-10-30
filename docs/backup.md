# Backup and restore

Settings offers metadata-only or full-media backup into a chosen parent
folder. A new TuneVault-backup-* directory contains versioned bundle.json and,
when requested, media/. A metadata-only backup contains paths and history but
no audio. Store it privately; paths and source descriptions may be sensitive.

Restore selects the bundle directory. Schema, IDs, references and included
media hashes are checked before the current index is replaced. A recovery
bundle, including revision history, is saved before replacement. The UI asks
for confirmation and reports the recovery folder and missing-file count.
That recovery folder can itself be selected for Restore. Keep your existing vault and backups
until you verify the restored library. Full backups need free space for copies;
restoring missing original media from a metadata-only backup is impossible.

Do not manually copy a live SQLite/WAL pair as a portable backup. Use the
app's bundle operation. Backup validation failures must leave the current
library usable. Existing source audio and unknown target files are not deleted.

Restored target identities and receipt history remain, but destinations are
cleared and must be selected again. Historical jobs are cancelled and their
path-bearing payloads are removed. A backup is not permission to write to
arbitrary directories. Full-media bundles also preserve saved metadata
revision media/art; metadata-only revisions still require their existing files.

For metadata-only restore, existing media/art must stay inside the explicitly
selected vault. Paths outside that root are treated as missing and require an
explicit relink; a backup cannot grant read access to arbitrary local files.
Artwork is bounded and validated before it is served to the renderer.

Backup and restore exclude concurrent index writes and queued/running media
work. New bundles omit duplicate library data and must satisfy the same size
and record-count bounds as Restore before they are reported successful.
