import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
  stat,
  statfs,
  readdir,
  realpath,
  rename,
  rm,
  lstat,
} from "node:fs/promises";
import path from "node:path";
import type {
  Chapter,
  ExportPlan,
  Job,
  Metadata,
  MetadataField,
  Occurrence,
  Playlist,
  Profile,
  ProviderPreview,
  Receipt,
  Reference,
  Settings,
  Snapshot,
  Source,
  Target,
  Track,
} from "../shared/types";
import {
  object,
  text,
  ids,
  hashFile,
  safeName,
  confined,
  youtubeUrl,
  delay,
} from "./safety";
import {
  artwork,
  embeddedArtwork,
  fields,
  inspect,
  run,
  writeMedia,
  extension,
  type ToolPaths,
} from "./media";
import {
  parseChapters,
  parseReferences,
  reconcile,
  validateChapters,
} from "./references";
import { verifyTools } from "../update/tools";
import { fetchBounded } from "./network";
const tables = [
  "tracks",
  "playlists",
  "targets",
  "jobs",
  "receipts",
  "revisions",
  "previews",
  "cache",
] as const;
type Table = (typeof tables)[number];
const now = () => new Date().toISOString();
const defaultProfile: Profile = {
  format: "mp3",
  bitrate: 192,
  sampleRate: 44100,
  artworkSize: 600,
  artworkBytes: 500000,
  revision: 1,
  compatibility: "Baseline",
  model: "",
  firmware: "",
  legacyPlaylist: false,
};
export class LibraryService {
  private db: DatabaseSync;
  private toolsPromise: Promise<ToolPaths> | null = null;
  private running = new Map<string, AbortController>();
  private pumping = false;
  private closed = false;
  private lookupAt = 0;
  private cookieFile: string | null = null;
  setCookieFile(file: string | null) {
    if (
      file !== null &&
      (!path.isAbsolute(text(file, 4000)) || !existsSync(file))
    )
      throw new Error("Cookie session file is unavailable");
    this.cookieFile = file;
  }
  private activeTargets = new Set<string>();
  readonly dataDir: string;
  readonly toolsDir: string;
  constructor(options: { dataDir: string; toolsDir: string }) {
    this.dataDir = options.dataDir;
    this.toolsDir = options.toolsDir;
    mkdirSync(this.dataDir, { recursive: true });
    this.db = new DatabaseSync(path.join(this.dataDir, "library.sqlite"));
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    const version = Number(
      (this.db.prepare("PRAGMA user_version").get() as any).user_version,
    );
    if (version > 1)
      throw new Error("Library was created by a newer TuneVault version");
    if (version === 0) {
      this.db.exec("BEGIN");
      try {
        for (const table of tables)
          this.db.exec(
            `CREATE TABLE ${table} (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)))`,
          );
        this.db.exec(
          "CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL CHECK(json_valid(data))); PRAGMA user_version=1; COMMIT",
        );
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS playlist_occurrences (id TEXT PRIMARY KEY, playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE, track_id TEXT REFERENCES tracks(id), ordinal INTEGER NOT NULL CHECK(ordinal>=0), UNIQUE(playlist_id,ordinal)); CREATE TABLE IF NOT EXISTS receipt_links (receipt_id TEXT PRIMARY KEY REFERENCES receipts(id) ON DELETE CASCADE, track_id TEXT NOT NULL REFERENCES tracks(id), target_id TEXT NOT NULL REFERENCES targets(id));",
    );
    for (const job of this.all<Job>("jobs"))
      if (job.status === "running")
        this.save("jobs", {
          ...job,
          status: "interrupted",
          message: "Interrupted by application restart; Retry resumes safely",
          updatedAt: now(),
        });
  }
  close() {
    this.closed = true;
    for (const controller of this.running.values()) controller.abort();
    this.db.close();
  }
  private all<T>(table: Table): T[] {
    return this.db
      .prepare(`SELECT data FROM ${table} ORDER BY rowid`)
      .all()
      .map((r: any) => JSON.parse(r.data));
  }
  private get<T>(table: Table, id: unknown): T {
    const row = this.db
      .prepare(`SELECT data FROM ${table} WHERE id=?`)
      .get(text(id, 100)) as any;
    if (!row) throw new Error(`${table} item does not exist`);
    return JSON.parse(row.data);
  }
  private save<T extends { id: string }>(table: Table, value: T) {
    this.db.exec("SAVEPOINT save_record");
    try {
      this.db
        .prepare(
          `INSERT INTO ${table}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
        )
        .run(value.id, JSON.stringify(value));
      if (table === "playlists") {
        const playlist = value as unknown as Playlist;
        this.db
          .prepare("DELETE FROM playlist_occurrences WHERE playlist_id=?")
          .run(value.id);
        const insert = this.db.prepare(
          "INSERT INTO playlist_occurrences(id,playlist_id,track_id,ordinal) VALUES(?,?,?,?)",
        );
        playlist.entries.forEach((entry, ordinal) =>
          insert.run(entry.id, playlist.id, entry.trackId, ordinal),
        );
      }
      if (table === "receipts") {
        const receipt = value as unknown as Receipt;
        this.db
          .prepare(
            "INSERT INTO receipt_links(receipt_id,track_id,target_id) VALUES(?,?,?) ON CONFLICT(receipt_id) DO UPDATE SET track_id=excluded.track_id,target_id=excluded.target_id",
          )
          .run(receipt.id, receipt.trackId, receipt.targetId);
      }
      this.db.exec("RELEASE save_record");
    } catch (error) {
      this.db.exec("ROLLBACK TO save_record; RELEASE save_record");
      throw error;
    }
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  private settings(): Settings {
    const row = this.db
      .prepare("SELECT data FROM settings WHERE id=1")
      .get() as any;
    return row
      ? JSON.parse(row.data)
      : {
          vault: "",
          appearance: "system",
          accent: "blue",
          autoUpdates: true,
          onlineAcknowledged: false,
          selection: [],
          view: "tracks",
          filter: "all",
        };
  }
  private saveSettings(value: Settings) {
    this.db
      .prepare(
        "INSERT INTO settings(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(JSON.stringify(value));
  }
  private tools() {
    return (this.toolsPromise ??= verifyTools(this.toolsDir));
  }
  async snapshot(): Promise<Snapshot> {
    const tracks = this.all<Track>("tracks");
    for (const track of tracks) track.missing = !existsSync(track.path);
    const targets = this.all<Target>("targets");
    for (const target of targets)
      target.connected = existsSync(target.destination);
    return {
      tracks,
      library: tracks,
      playlists: this.all("playlists"),
      targets,
      jobs: this.all("jobs"),
      receipts: this.all("receipts"),
      settings: this.settings(),
    };
  }
  async dispatch(action: string, input: unknown = {}): Promise<unknown> {
    const data = object(input ?? {});
    switch (action) {
      case "snapshot":
        return this.snapshot();
      case "artwork.get": {
        const track = this.get<Track>("tracks", data.id);
        return { path: track.artwork };
      }
      case "settings.update": {
        const settings = this.settings();
        for (const key of Object.keys(data)) {
          if (
            ![
              "vault",
              "appearance",
              "accent",
              "autoUpdates",
              "onlineAcknowledged",
              "selection",
              "view",
              "filter",
            ].includes(key)
          )
            throw new Error("Unknown setting");
        }
        if (
          data.appearance &&
          !["system", "light", "dark"].includes(data.appearance)
        )
          throw new Error("Invalid appearance");
        if (data.accent && !["blue", "orange"].includes(data.accent))
          throw new Error("Invalid accent");
        if (data.view && !["tracks", "albums"].includes(data.view))
          throw new Error("Invalid view");
        for (const key of ["autoUpdates", "onlineAcknowledged"])
          if (key in data && typeof data[key] !== "boolean")
            throw new Error("Invalid setting");
        if (data.selection) ids(data.selection);
        if (data.filter) text(data.filter, 100);
        if (data.vault !== undefined) {
          text(data.vault, 4000);
          const vault = await realpath(data.vault);
          if (!(await stat(vault)).isDirectory())
            throw new Error("Vault must be a selected folder");
          if (
            settings.vault &&
            settings.vault !== vault &&
            this.all("tracks").length
          )
            throw new Error(
              "Existing library has media in its current vault. Back up and relocate files explicitly before changing it.",
            );
          data.vault = vault;
        }
        this.saveSettings({ ...settings, ...data });
        return this.settings();
      }
      case "import.preview": {
        const paths = await this.collect(this.paths(data.paths));
        const tools = await this.tools();
        const result = [];
        for (const file of paths) {
          try {
            const info = await inspect(file, tools);
            result.push({
              path: file,
              ...info,
              duplicate: this.all<Track>("tracks").some(
                (t) => t.hash === info.hash,
              ),
            });
          } catch (e) {
            result.push({ path: file, error: message(e) });
          }
        }
        return result;
      }
      case "import.start": {
        const paths = await this.collect(this.paths(data.paths));
        this.requireVault();
        return this.enqueue("import", { paths });
      }
      case "tracks.favorite": {
        if (typeof data.value !== "boolean")
          throw new Error("Invalid favorite");
        for (const id of ids(data.ids)) {
          const track = this.get<Track>("tracks", id);
          this.save("tracks", { ...track, favorite: data.value });
        }
        return this.snapshot();
      }
      case "tracks.edit":
        return this.edit(
          ids(data.ids),
          this.metadata(data.changes),
          data.locks === undefined ? undefined : this.locks(data.locks),
          undefined,
          "user",
          undefined,
          data.addLocks === undefined ? undefined : this.locks(data.addLocks),
        );
      case "tracks.undo": {
        for (const id of ids(data.ids)) {
          const track = this.get<Track>("tracks", id);
          const revisions = this.all<{
            id: string;
            trackId: string;
            track: Track;
          }>("revisions").filter((r) => r.trackId === id);
          const previous = revisions.at(-1);
          if (!previous) throw new Error("No saved metadata revision to undo");
          if (!existsSync(previous.track.path))
            throw new Error("Previous audio revision is missing");
          this.save("tracks", {
            ...previous.track,
            revision: track.revision + 1,
          });
          this.db.prepare("DELETE FROM revisions WHERE id=?").run(previous.id);
        }
        return this.snapshot();
      }
      case "artwork.preview": {
        const generated = await artwork(
          text(data.path, 4000),
          path.join(this.dataDir, "artwork-previews"),
          600,
          500000,
          data.padding !== false,
        );
        try {
          return {
            preview:
              "data:image/jpeg;base64," +
              (await readFile(generated)).toString("base64"),
          };
        } finally {
          await rm(generated, { force: true });
        }
      }
      case "tracks.artwork": {
        const image = text(data.path, 4000);
        const selected = ids(data.ids);
        const generated = await artwork(
          image,
          path.join(this.requireVault(), "artwork"),
          600,
          500000,
          data.padding !== false,
        );
        const original = await confined(
          this.requireVault(),
          `artwork/original-${randomUUID()}${path.extname(image).toLowerCase()}`,
        );
        await copyFile(image, original);
        return this.edit(selected, {}, undefined, generated, "user", original);
      }
      case "tracks.relink": {
        const track = this.get<Track>("tracks", data.id);
        const file = await realpath(text(data.path, 4000));
        const info = await inspect(file, await this.tools());
        if (info.hash !== track.hash)
          throw new Error(
            "Relink requires the exact recorded content hash; import a different recording separately",
          );
        const dest = await this.archiveCopy(file, track.id, path.extname(file));
        this.save("tracks", { ...track, path: dest, missing: false });
        return this.snapshot();
      }
      case "playlists.create": {
        const playlist: Playlist = {
          id: randomUUID(),
          name: text(data.name, 200),
          description: text(data.description || "", 20000),
          revision: 1,
          entries: [],
          sourceUrl: null,
          snapshotAt: null,
          followSourceOrder: true,
        };
        for (const id of ids(data.trackIds || []))
          playlist.entries.push(this.occurrence(this.get<Track>("tracks", id)));
        this.save("playlists", playlist);
        return playlist;
      }
      case "playlists.update": {
        const playlist = this.get<Playlist>("playlists", data.id);
        if (data.name !== undefined) playlist.name = text(data.name, 200);
        if (data.description !== undefined)
          playlist.description = text(data.description, 20000);
        if (data.followSourceOrder !== undefined) {
          if (typeof data.followSourceOrder !== "boolean")
            throw new Error("Invalid source order");
          playlist.followSourceOrder = data.followSourceOrder;
        }
        playlist.revision++;
        this.save("playlists", playlist);
        return playlist;
      }
      case "playlists.add": {
        const playlist = this.get<Playlist>("playlists", data.id);
        for (const id of ids(data.trackIds))
          playlist.entries.push(this.occurrence(this.get<Track>("tracks", id)));
        playlist.revision++;
        this.save("playlists", playlist);
        return playlist;
      }
      case "playlists.reorder": {
        const playlist = this.get<Playlist>("playlists", data.id);
        const order = ids(data.occurrenceIds);
        if (
          new Set(order).size !== order.length ||
          order.length !== playlist.entries.length ||
          order.some((id) => !playlist.entries.some((e) => e.id === id))
        )
          throw new Error("Reorder must contain each occurrence exactly once");
        playlist.entries = order.map((id) =>
          playlist.entries.find((e) => e.id === id)!,
        );
        playlist.followSourceOrder = false;
        playlist.revision++;
        this.save("playlists", playlist);
        return playlist;
      }
      case "playlists.remove": {
        const playlist = this.get<Playlist>("playlists", data.id);
        const remove = ids(data.occurrenceIds);
        playlist.entries = playlist.entries.filter(
          (e) => !remove.includes(e.id),
        );
        playlist.revision++;
        this.save("playlists", playlist);
        return playlist;
      }
      case "references.import": {
        const refs = parseReferences(
          text(data.text, 8 * 1024 * 1024),
          text(data.format, 30),
        );
        const playlist: Playlist = {
          id: randomUUID(),
          name: text(data.name || "Imported references", 200),
          description:
            "Offline reference snapshot; external paths are not imported or fetched automatically.",
          revision: 1,
          entries: refs.map((ref) => ({
            id: randomUUID(),
            trackId: this.findApproved(ref),
            reference: ref,
            manual: false,
            skipped: false,
          })),
          sourceUrl: data.sourceUrl ? text(data.sourceUrl, 2000) : null,
          snapshotAt: now(),
          followSourceOrder: true,
        };
        this.save("playlists", playlist);
        return playlist;
      }
      case "references.attach": {
        const playlist = this.get<Playlist>("playlists", data.playlistId),
          track = this.get<Track>("tracks", data.trackId);
        const occurrence = playlist.entries.find(
          (e) => e.id === data.occurrenceId,
        );
        if (!occurrence) throw new Error("Reference occurrence missing");
        occurrence.trackId = track.id;
        occurrence.skipped = false;
        occurrence.error = undefined;
        occurrence.reference.unavailable = false;
        playlist.revision++;
        this.save("playlists", playlist);
        this.save("cache", {
          id: `match:${referenceKey(occurrence.reference)}`,
          trackId: track.id,
        });
        return playlist;
      }
      case "references.skip": {
        const playlist = this.get<Playlist>("playlists", data.playlistId);
        const entry = playlist.entries.find((e) => e.id === data.occurrenceId);
        if (!entry) throw new Error("Occurrence missing");
        entry.skipped = data.skipped !== false;
        playlist.revision++;
        this.save("playlists", playlist);
        return playlist;
      }
      case "source.preview":
        return this.sourcePreview(text(data.url, 2000));
      case "source.search": {
        this.requireOnline();
        const query = text(data.query, 300);
        const tools = await this.tools();
        const result = JSON.parse(
          await run(tools["yt-dlp"], [
            ...this.ytArgs(tools),
            "--dump-single-json",
            "--flat-playlist",
            "--playlist-end",
            "5",
            "--",
            `ytsearch5:${query}`,
          ]),
        );
        return (result.entries || []).map((entry: any) => ({
          title: entry.title || "",
          channel: entry.channel || entry.uploader || "",
          duration: entry.duration || null,
          url: `https://www.youtube.com/watch?v=${entry.id}`,
          reason:
            "Search result only. Compare recording, version and duration before approving.",
        }));
      }
      case "source.acquire": {
        this.requireOnline();
        this.requireVault();
        return this.enqueue("download", {
          url: youtubeUrl(data.url),
          playlistId: data.playlistId ? text(data.playlistId, 100) : null,
          occurrenceId: data.occurrenceId ? text(data.occurrenceId, 100) : null,
        });
      }
      case "playlists.refreshPreview": {
        const playlist = this.get<Playlist>("playlists", data.id);
        if (!playlist.sourceUrl)
          throw new Error(
            "This offline/manual playlist has no live source; import a new reference snapshot",
          );
        const preview = await this.sourcePreview(playlist.sourceUrl);
        const diff = reconcile(playlist, preview.references, preview.complete);
        const token = randomUUID();
        this.save("previews", {
          id: token,
          playlistId: playlist.id,
          revision: playlist.revision,
          preview,
          entries: diff.entries,
        });
        return { ...diff, token, preview };
      }
      case "playlists.refreshApply": {
        const playlist = this.get<Playlist>("playlists", data.id);
        const token =
          typeof data.preview === "string"
            ? data.preview
            : object(data.preview).token;
        const saved = this.get<any>("previews", token);
        if (
          saved.playlistId !== playlist.id ||
          saved.revision !== playlist.revision
        )
          throw new Error("Playlist changed; refresh the preview");
        playlist.entries = saved.entries;
        playlist.revision++;
        playlist.snapshotAt = now();
        this.save("playlists", playlist);
        this.db.prepare("DELETE FROM previews WHERE id=?").run(saved.id);
        return playlist;
      }
      case "targets.create":
      case "targets.update":
        return this.target(action, data);
      case "export.preview":
        return this.exportPlan(data);
      case "export.prepare": {
        const plan = await this.exportPlan(data);
        if (plan.items.some((i) => i.action === "Blocked"))
          throw new Error(
            "Export has blocked items; resolve them before preparing",
          );
        return this.enqueue("export", {
          targetId: plan.targetId,
          playlistId: data.playlistId || null,
          trackIds: data.trackIds || [],
        });
      }
      case "export.confirm": {
        const target = this.get<Target>("targets", data.targetId);
        if (target.transport === "usb")
          throw new Error(
            "USB receipts are verified copies, not user confirmations",
          );
        const receipts = this.all<Receipt>("receipts").filter(
          (r) => r.targetId === target.id && r.batchId === data.batchId,
        );
        if (!receipts.length)
          throw new Error("No prepared batch for this target");
        for (const receipt of receipts) {
          if (receipt.playlistRevision.includes(":")) {
            const [playlistId, revision] = receipt.playlistRevision.split(":");
            if (
              this.get<Playlist>("playlists", playlistId).revision !==
              Number(revision)
            )
              throw new Error(
                "Playlist order changed; prepare a new batch before confirming",
              );
          }
          const track = this.get<Track>("tracks", receipt.trackId);
          if (
            track.revision !== receipt.trackRevision ||
            target.profile.revision !== receipt.profileRevision
          )
            throw new Error(
              "Batch is stale; prepare the current revisions first",
            );
          if (
            !existsSync(receipt.path) ||
            (await hashFile(receipt.path)) !== receipt.hash
          )
            throw new Error("Prepared file changed or is missing");
        }
        for (const receipt of receipts)
          this.save("receipts", {
            ...receipt,
            evidence: "user-confirmed",
            createdAt: now(),
          });
        return this.snapshot();
      }
      case "jobs.cancel": {
        const job = this.get<Job>("jobs", data.id);
        if (!["queued", "running"].includes(job.status))
          throw new Error("Job is not active");
        this.running.get(job.id)?.abort();
        this.save("jobs", {
          ...job,
          status: "cancelled",
          message: "Cancelled by you",
          updatedAt: now(),
        });
        return this.snapshot();
      }
      case "jobs.retry": {
        const job = this.get<Job>("jobs", data.id);
        if (
          job.payload.restored ||
          !["failed", "interrupted", "cancelled"].includes(job.status)
        )
          throw new Error(
            "Only failed, interrupted or cancelled jobs can be retried",
          );
        this.save("jobs", {
          ...job,
          status: "queued",
          message: "Waiting to retry",
          progress: 0,
          updatedAt: now(),
        });
        void this.pump();
        return this.snapshot();
      }
      case "mixes.parse": {
        const track = this.get<Track>("tracks", data.id);
        return track.source?.chapters?.length
          ? track.source.chapters
          : parseChapters(
              track.source?.description || track.metadata.comment,
              track.duration,
            );
      }
      case "mixes.split": {
        const track = this.get<Track>("tracks", data.id);
        validateChapters(data.chapters, track.duration);
        if (!data.chapters.length)
          throw new Error("Add at least one reviewed chapter");
        return this.enqueue("split", { id: track.id, chapters: data.chapters });
      }
      case "description.export": {
        const track = this.get<Track>("tracks", data.id);
        const dest = await confined(
          this.requireVault(),
          `descriptions/${track.id}.txt`,
        );
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(
          dest,
          track.source?.description || track.metadata.comment,
          { flag: "w" },
        );
        return { path: dest };
      }
      case "lookup.search":
        return this.lookup(this.get<Track>("tracks", data.id));
      case "lookup.artworkPreview": {
        this.requireOnline();
        const releaseId = text(data.releaseId, 100);
        if (
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
            releaseId,
          )
        )
          throw new Error("Choose a valid MusicBrainz release");
        const original = await fetchBounded(
          new URL(`https://coverartarchive.org/release/${releaseId}/front-500`),
          20 * 1024 * 1024,
          true,
        );
        if (!/^image\/(jpeg|png|webp)(?:;|$)/i.test(original.mime))
          throw new Error("Provider returned an unsupported image");
        const token = randomUUID(),
          directory = path.join(this.requireVault(), "artwork"),
          raw = path.join(directory, token + ".source");
        await mkdir(directory, { recursive: true });
        await writeFile(raw, original.bytes);
        try {
          const generated = await artwork(
            raw,
            directory,
            600,
            500000,
            data.padding !== false,
          );
          this.save("cache", {
            id: "cover:" + token,
            path: generated,
            original: raw,
            origin: `Cover Art Archive release ${releaseId}`,
            at: Date.now(),
          });
          return {
            token,
            preview:
              "data:image/jpeg;base64," +
              (await readFile(generated)).toString("base64"),
            origin: `Cover Art Archive release ${releaseId}`,
          };
        } catch (error) {
          await rm(raw, { force: true });
          throw error;
        }
      }
      case "lookup.artworkApply": {
        const cover = this.get<any>("cache", "cover:" + text(data.token, 100));
        if (Date.now() - cover.at > 86400000)
          throw new Error("Artwork preview expired; load it again");
        return this.edit(
          ids(data.ids),
          {},
          undefined,
          cover.path,
          "approved-lookup",
          cover.original,
        );
      }
      case "lookup.apply":
        return this.edit(
          [text(data.id, 100)],
          this.metadata(data.changes),
          undefined,
          undefined,
          "approved-lookup",
        );
      case "backup":
        return this.backup(text(data.path, 4000), data.includeMedia === true);
      case "restore":
        return this.restore(text(data.path, 4000));
      case "diagnostics": {
        const tools = await this.tools();
        return {
          node: process.versions.node,
          sqlite: process.versions.sqlite,
          tools,
          counts: {
            tracks: this.all("tracks").length,
            jobs: this.all("jobs").length,
          },
          database: "SQLite schema 1",
        };
      }
      default:
        throw new Error("Unknown TuneVault command");
    }
  }
  private requireVault(): string {
    const vault = this.settings().vault;
    if (!vault || !existsSync(vault))
      throw new Error("Choose an available vault folder in Settings first");
    return vault;
  }
  private requireOnline() {
    if (!this.settings().onlineAcknowledged)
      throw new Error(
        "Acknowledge authorized-use and third-party network access before online acquisition",
      );
  }
  private metadata(value: unknown): Partial<Metadata> {
    const changes = object(value);
    for (const key of Object.keys(changes)) {
      if (!fields.includes(key as MetadataField))
        throw new Error("Unknown metadata field");
      text(changes[key], key === "comment" ? 20000 : 2000);
    }
    for (const key of ["trackNumber", "trackTotal", "discNumber", "discTotal"])
      if (changes[key] && !/^\d{1,5}$/.test(changes[key]))
        throw new Error("Track and disc values must be nonnegative integers");
    return changes;
  }
  private locks(value: unknown): MetadataField[] {
    const locks = ids(value);
    if (locks.some((k) => !fields.includes(k as MetadataField)))
      throw new Error("Invalid metadata lock");
    return locks as MetadataField[];
  }
  private paths(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > 10000)
      throw new Error("Invalid selected files");
    return value.map((file) => text(file, 4000));
  }
  private async collect(input: string[]): Promise<string[]> {
    const files: string[] = [];
    const walk = async (file: string) => {
      if (files.length >= 10000)
        throw new Error("Select at most 10,000 media files per import");
      const info = await lstat(file);
      if (info.isSymbolicLink())
        throw new Error(
          "Symlinks are not imported; select the actual media folder",
        );
      if (info.isDirectory()) {
        for (const item of await readdir(file))
          await walk(path.join(file, item));
      } else if (/\.(mp3|m4a|aac|flac|wav|aiff|aif|ogg|opus)$/i.test(file))
        files.push(await realpath(file));
    };
    for (const file of input) await walk(text(file, 4000));
    if (!files.length) throw new Error("No supported audio files in selection");
    return [...new Set(files)];
  }
  private async archiveCopy(
    source: string,
    id: string,
    ext: string,
  ): Promise<string> {
    if (!/^\.[a-z0-9]{1,8}$/i.test(ext))
      throw new Error("Unsupported audio extension");
    const dest = await confined(
      this.requireVault(),
      `media/${id}${ext.toLowerCase()}`,
    );
    await mkdir(path.dirname(dest), { recursive: true });
    const temp = dest + "." + randomUUID() + ".partial";
    try {
      await copyFile(source, temp);
      if ((await hashFile(source)) !== (await hashFile(temp)))
        throw new Error("Import copy hash mismatch");
      await rename(temp, dest);
      return dest;
    } finally {
      await rm(temp, { force: true });
    }
  }
  private occurrence(track: Track): Occurrence {
    return {
      id: randomUUID(),
      trackId: track.id,
      reference: {
        title: track.metadata.title,
        artist: track.metadata.artist,
        album: track.metadata.album,
        duration: track.duration,
        sourceId: track.source?.id,
      },
      manual: true,
      skipped: false,
    };
  }
  private findApproved(ref: Reference): string | null {
    try {
      const match = this.get<any>("cache", `match:${referenceKey(ref)}`);
      if (this.all<Track>("tracks").some((t) => t.id === match.trackId))
        return match.trackId;
    } catch {
      /* An absent cache, missing media or disconnected destination remains explicit in the returned state. */
    }
    if (ref.sourceId)
      return (
        this.all<Track>("tracks").find((t) => t.source?.id === ref.sourceId)
          ?.id || null
      );
    return null;
  }
  private async edit(
    selected: string[],
    changes: Partial<Metadata>,
    locks?: MetadataField[],
    image?: string,
    origin = "user",
    imageOriginal?: string,
    addLocks?: MetadataField[],
  ): Promise<Snapshot> {
    if (!selected.length) throw new Error("Select tracks to edit");
    const tools = await this.tools();
    const staged: Track[] = [];
    const old: Track[] = [];
    for (const id of selected) {
      const track = this.get<Track>("tracks", id);
      if (!existsSync(track.path))
        throw new Error("Relink missing media before editing");
      const allowed = Object.fromEntries(
        Object.entries(changes).filter(
          ([key]) =>
            origin === "user" || !track.locks.includes(key as MetadataField),
        ),
      );
      const updated: Track = {
        ...track,
        metadata: { ...track.metadata, ...allowed },
        locks: addLocks
          ? [...new Set([...track.locks, ...addLocks])]
          : (locks ?? track.locks),
        origins: {
          ...track.origins,
          ...Object.fromEntries(Object.keys(allowed).map((k) => [k, origin])),
        },
        artwork: image ?? track.artwork,
        artworkOriginal: imageOriginal ?? track.artworkOriginal,
        revision: track.revision + 1,
      };
      const dest = await confined(
        this.requireVault(),
        `revisions/${track.id}/${updated.revision}-${randomUUID()}${path.extname(track.path)}`,
      );
      await mkdir(path.dirname(dest), { recursive: true });
      try {
        await writeMedia(updated, dest, tools);
        updated.path = dest;
        updated.hash = await hashFile(dest);
        updated.bytes = (await stat(dest)).size;
        staged.push(updated);
        old.push(track);
      } catch (e) {
        await rm(dest, { force: true });
        throw e;
      }
    }
    this.transaction(() => {
      for (let i = 0; i < staged.length; i++) {
        this.save("revisions", {
          id: randomUUID(),
          trackId: old[i].id,
          track: old[i],
        });
        this.save("tracks", staged[i]);
      }
    });
    return this.snapshot();
  }
  private enqueue(kind: Job["kind"], payload: Record<string, unknown>): Job {
    const job: Job = {
      id: randomUUID(),
      kind,
      status: "queued",
      progress: 0,
      message: "Waiting",
      payload,
      createdAt: now(),
      updatedAt: now(),
      attempts: 0,
    };
    this.save("jobs", job);
    void this.pump();
    return job;
  }
  private updateJob(id: string, changes: Partial<Job>) {
    if (this.closed) return;
    const job = this.get<Job>("jobs", id);
    if (job.status === "cancelled" && changes.status !== "cancelled") return;
    this.save("jobs", { ...job, ...changes, updatedAt: now() });
  }
  private async pump() {
    if (this.pumping || this.closed) return;
    this.pumping = true;
    try {
      for (;;) {
        const job = this.all<Job>("jobs").find((j) => j.status === "queued");
        if (!job || this.closed) break;
        const controller = new AbortController();
        this.running.set(job.id, controller);
        this.updateJob(job.id, {
          status: "running",
          message: "Working",
          attempts: job.attempts + 1,
        });
        try {
          if (job.kind === "import")
            await this.importJob(job, controller.signal);
          else if (job.kind === "download")
            await this.downloadJob(job, controller.signal);
          else if (job.kind === "export")
            await this.exportJob(job, controller.signal);
          else if (job.kind === "split")
            await this.splitJob(job, controller.signal);
          this.updateJob(job.id, {
            status: "completed",
            progress: 1,
            message: "Completed",
          });
        } catch (e) {
          this.updateJob(job.id, {
            status: controller.signal.aborted ? "cancelled" : "failed",
            message: message(e),
          });
        } finally {
          this.running.delete(job.id);
        }
      }
    } finally {
      this.pumping = false;
    }
  }
  private async importJob(job: Job, signal: AbortSignal) {
    const files = this.paths(job.payload.paths),
      tools = await this.tools();
    for (let i = 0; i < files.length; i++) {
      signal.throwIfAborted();
      const source = files[i];
      const info = await inspect(source, tools, signal);
      if (!this.all<Track>("tracks").some((t) => t.hash === info.hash)) {
        const id = randomUUID(),
          dest = await this.archiveCopy(source, id, path.extname(source));
        const image = await embeddedArtwork(
          dest,
          path.join(this.requireVault(), "artwork"),
          tools,
        );
        const track: Track = {
          ...info,
          id,
          path: dest,
          originalPath: source,
          revision: 1,
          artwork: image,
          favorite: false,
          missing: false,
          source: {
            provider: "local",
            id: info.hash,
            url: "",
            title: info.metadata.title,
            uploader: "",
            description: "",
            acquiredAt: now(),
            quality: ["flac", "alac", "pcm_s16le", "pcm_s24le"].includes(
              info.codec,
            )
              ? "Lossless source"
              : "Lossy source",
            chapters: [],
          },
        };
        this.save("tracks", track);
      }
      this.updateJob(job.id, {
        progress: (i + 1) / files.length,
        message: `Imported ${i + 1} of ${files.length}`,
      });
    }
  }
  private ytArgs(tools: ToolPaths): string[] {
    return [
      ...(this.cookieFile ? ["--cookies", this.cookieFile] : []),
      "--ignore-config",
      "--no-plugin-dirs",
      "--no-remote-components",
      "--no-js-runtimes",
      "--js-runtimes",
      `deno:${tools.deno}`,
      "--ffmpeg-location",
      path.dirname(tools.ffmpeg),
      "--no-warnings",
      "--no-colors",
      "--socket-timeout",
      "20",
      "--retries",
      "2",
      "--fragment-retries",
      "2",
    ];
  }
  private async sourcePreview(url: string): Promise<ProviderPreview> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Enter a valid HTTPS provider URL");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
      throw new Error("Use an HTTPS provider URL");
    if (["open.spotify.com", "music.apple.com"].includes(parsed.hostname))
      return {
        provider:
          parsed.hostname === "open.spotify.com" ? "spotify" : "apple-music",
        capability: "credentials-required",
        complete: false,
        name: "Playlist references",
        url,
        references: [],
        explanation:
          "Direct reading requires permitted provider credentials and a validated connector. Import a selected Spotify Download Your Data playlist JSON, Apple Music exported XML/text, CSV or M3U instead. No subscription audio is extracted.",
      };
    this.requireOnline();
    const canonical = youtubeUrl(url),
      tools = await this.tools();
    try {
      const raw = JSON.parse(
        await run(tools["yt-dlp"], [
          ...this.ytArgs(tools),
          "--dump-single-json",
          "--flat-playlist",
          "--skip-download",
          "--",
          canonical,
        ]),
      );
      const entries = raw.entries || [raw];
      if (entries.length > 10000)
        throw new Error("Playlist exceeds the 10,000 occurrence limit");
      const references = entries.map((entry: any): Reference => ({
        title: entry?.title || "Unavailable video",
        artist: entry?.artist || "",
        album: entry?.album || "",
        duration: Number.isFinite(entry?.duration) ? entry.duration : null,
        url:
          entry?.id && /^[\w-]{11}$/.test(entry.id)
            ? `https://www.youtube.com/watch?v=${entry.id}`
            : undefined,
        sourceId: entry?.id || undefined,
        unavailable:
          !entry?.id ||
          entry.availability === "private" ||
          entry.title === "[Private video]" ||
          entry.title === "[Deleted video]",
      }));
      const complete =
        raw.playlist_count === undefined ||
        Number(raw.playlist_count) === references.length;
      return {
        provider: "youtube",
        capability: complete ? "available" : "partial",
        complete,
        name: raw.title || "YouTube source",
        url: canonical,
        references,
        explanation: complete
          ? "Ordered reference snapshot. Only acquire media you are authorized to copy."
          : "Provider returned a partial snapshot; previous complete playlists will be preserved.",
      };
    } catch (e) {
      return {
        provider: "youtube",
        capability: "temporarily-failed",
        complete: false,
        name: "YouTube source",
        url: canonical,
        references: [],
        explanation: message(e),
      };
    }
  }
  private async downloadJob(job: Job, signal: AbortSignal) {
    const preview =
      (job.payload.sourceSnapshot as ProviderPreview) ||
      (await this.sourcePreview(String(job.payload.url)));
    if (!preview.complete) throw new Error(preview.explanation);
    if (job.payload.occurrenceId && preview.references.length !== 1)
      throw new Error("Choose one exact source URL for a playlist occurrence");
    job.payload.sourceSnapshot = preview;
    job.payload.failures = [];
    this.updateJob(job.id, { payload: job.payload });
    const tools = await this.tools();
    let playlist: Playlist | null =
      job.payload.generatedPlaylistId || job.payload.playlistId
        ? this.get<Playlist>(
            "playlists",
            job.payload.generatedPlaylistId || job.payload.playlistId,
          )
        : null;
    if (!playlist && preview.references.length > 1) {
      playlist = {
        id: randomUUID(),
        name: preview.name,
        description:
          "YouTube reference snapshot; unavailable occurrences remain visible.",
        revision: 1,
        sourceUrl: preview.url,
        snapshotAt: now(),
        followSourceOrder: true,
        entries: preview.references.map((ref) => ({
          id: randomUUID(),
          trackId: this.findApproved(ref),
          reference: ref,
          manual: false,
          skipped: false,
        })),
      };
      this.save("playlists", playlist);
      job.payload.generatedPlaylistId = playlist.id;
      this.updateJob(job.id, { payload: job.payload });
    }
    const destinationOccurrences: string[] = Array.isArray(
      job.payload.destinationOccurrences,
    )
      ? (job.payload.destinationOccurrences as string[])
      : [];
    if (
      playlist &&
      job.payload.playlistId &&
      !job.payload.occurrenceId &&
      !destinationOccurrences.length
    ) {
      for (const ref of preview.references) {
        const entry: Occurrence = {
          id: randomUUID(),
          trackId: this.findApproved(ref),
          reference: ref,
          manual: true,
          skipped: false,
        };
        playlist.entries.push(entry);
        destinationOccurrences.push(entry.id);
      }
      playlist.revision++;
      this.save("playlists", playlist);
    }
    job.payload.destinationOccurrences = destinationOccurrences;
    this.updateJob(job.id, { payload: job.payload });
    const stage = path.join(this.requireVault(), ".jobs", job.id);
    await mkdir(stage, { recursive: true });
    try {
      for (let i = 0; i < preview.references.length; i++) {
        signal.throwIfAborted();
        const ref = preview.references[i];
        if (ref.unavailable || !ref.url) continue;
        const occurrenceId = String(
          job.payload.occurrenceId ||
            destinationOccurrences[i] ||
            playlist?.entries[i]?.id ||
            "",
        );
        try {
          let track = this.all<Track>("tracks").find(
            (t) =>
              t.source?.provider === "youtube" && t.source.id === ref.sourceId,
          );
          if (!track) {
            const info = JSON.parse(
              await this.acquireRun(
                job,
                signal,
                tools["yt-dlp"],
                [
                  ...this.ytArgs(tools),
                  "--no-playlist",
                  "--dump-single-json",
                  "--skip-download",
                  "--",
                  youtubeUrl(ref.url),
                ],
                signal,
              ),
            );
            const prefix = path.join(stage, `source-${i}`);
            const output = await this.acquireRun(
              job,
              signal,
              tools["yt-dlp"],
              [
                ...this.ytArgs(tools),
                "--no-playlist",
                "--format",
                "bestaudio",
                "--extract-audio",
                "--audio-format",
                "best",
                "--newline",
                "--progress",
                "--progress-delta",
                "1",
                "--progress-template",
                'download:TVPROGRESS:{"downloaded":%(progress.downloaded_bytes)j,"total":%(progress.total_bytes_estimate)j}',
                "--print",
                "after_move:filepath",
                "--output",
                `${prefix}.%(ext)s`,
                "--",
                youtubeUrl(ref.url),
              ],
              signal,
            );
            const file = output.trim().split(/\r?\n/).at(-1) || "";
            const canonical = await realpath(stage),
              downloaded = await realpath(file);
            if (!downloaded.startsWith(canonical + path.sep))
              throw new Error("Downloader produced an unexpected output path");
            const inspected = await inspect(downloaded, tools, signal);
            const id = randomUUID(),
              dest = await this.archiveCopy(
                downloaded,
                id,
                path.extname(downloaded),
              );
            const metadata = {
              ...inspected.metadata,
              title:
                info.track ||
                info.title ||
                inspected.metadata.title ||
                "Unknown title",
              artist: info.artist || "",
              album: info.album || "",
              albumArtist: info.album_artist || "",
              date: info.release_date || "",
            };
            const chapters: Chapter[] = (info.chapters || []).map((c: any) => ({
              start: Number(c.start_time),
              title: String(c.title || "Chapter"),
            }));
            try {
              validateChapters(chapters, inspected.duration);
            } catch {
              chapters.length = 0;
            }
            const source: Source = {
              provider: "youtube",
              id: String(info.id),
              url: youtubeUrl(ref.url),
              title: String(info.title || ""),
              uploader: String(info.uploader || ""),
              description: String(info.description || "").slice(0, 200000),
              acquiredAt: now(),
              quality:
                "Lossy online source; FLAC conversion cannot restore lost information.",
              chapters,
            };
            track = {
              ...inspected,
              id,
              path: dest,
              originalPath: "",
              metadata,
              origins: {
                ...inspected.origins,
                title: info.track ? "structured-source" : "source-title",
                artist: info.artist ? "structured-source" : "unknown",
                album: info.album ? "structured-source" : "unknown",
              },
              revision: 1,
              favorite: false,
              missing: false,
              source,
            };
            this.save("tracks", track);
            const sidecar = await confined(
              this.requireVault(),
              `sources/${id}.json`,
            );
            await mkdir(path.dirname(sidecar), { recursive: true });
            await writeFile(sidecar, JSON.stringify(source, null, 2));
          }
          if (playlist) {
            playlist = this.get<Playlist>("playlists", playlist.id);
            const entry = job.payload.occurrenceId
              ? playlist.entries.find((e) => e.id === job.payload.occurrenceId)
              : destinationOccurrences[i]
                ? playlist.entries.find(
                    (e) => e.id === destinationOccurrences[i],
                  )
                : playlist.entries[i];
            if (entry) {
              entry.trackId = track.id;
              entry.error = undefined;
              entry.reference.unavailable = false;
              if (job.payload.occurrenceId)
                this.save("cache", {
                  id: `match:${referenceKey(entry.reference)}`,
                  trackId: track.id,
                });
            }
            playlist.revision++;
            this.save("playlists", playlist);
          }
          const completed = Array.isArray(job.payload.completedSources)
            ? (job.payload.completedSources as string[])
            : [];
          if (ref.sourceId && !completed.includes(ref.sourceId))
            completed.push(ref.sourceId);
          job.payload.completedSources = completed;
          this.updateJob(job.id, {
            payload: job.payload,
            progress: (i + 1) / preview.references.length,
            message: `Archived ${i + 1} of ${preview.references.length}`,
          });
        } catch (error) {
          if (signal.aborted) throw error;
          const failure = {
            occurrenceId,
            sourceId: ref.sourceId || "",
            title: ref.title,
            error: message(error),
          };
          (job.payload.failures as unknown[]).push(failure);
          if (playlist) {
            playlist = this.get<Playlist>("playlists", playlist.id);
            const entry = playlist.entries.find((e) => e.id === occurrenceId);
            if (entry) {
              entry.error = failure.error;
              this.save("playlists", playlist);
            }
          }
          this.updateJob(job.id, {
            payload: job.payload,
            message: `Failed: ${ref.title}. Continuing other occurrences.`,
            progress: (i + 1) / preview.references.length,
          });
        }
      }
      if ((job.payload.failures as unknown[]).length)
        throw new Error(
          `${(job.payload.failures as unknown[]).length} source occurrence(s) failed. Successful audio is retained; Retry processes failed sources only.`,
        );
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  }
  private async acquireRun(
    job: Job,
    signal: AbortSignal,
    executable: string,
    args: string[],
    _signal?: AbortSignal,
  ): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await run(executable, args, signal, (line) => {
          if (!line.startsWith("TVPROGRESS:")) return;
          try {
            const progress = JSON.parse(line.slice(11));
            if (Number.isFinite(progress.downloaded))
              this.updateJob(job.id, {
                message: `Acquiring audio: ${Math.round(progress.downloaded / 1024)} KB${Number.isFinite(progress.total) ? " / " + Math.round(progress.total / 1024) + " KB" : ""}`,
              });
          } catch {
            /* Ignore malformed progress without treating it as completed audio. */
          }
        });
      } catch (error) {
        if (
          signal.aborted ||
          attempt >= 2 ||
          !/429|rate.?limit|too many requests|503/i.test(message(error))
        )
          throw error;
        this.updateJob(job.id, {
          message: `Provider rate limited the request. Waiting before retry ${attempt + 1} of 2.`,
        });
        await delay([1000, 3000][attempt]);
        signal.throwIfAborted();
      }
    }
  }
  private target(action: string, data: Record<string, any>): Target {
    const previous =
      action === "targets.update" ? this.get<Target>("targets", data.id) : null;
    const name = text(data.name ?? previous?.name ?? "", 200);
    if (!name.trim()) throw new Error("Name this target");
    const transport = data.transport ?? previous?.transport ?? "folder";
    if (!["imazing", "usb", "folder", "mtp"].includes(transport))
      throw new Error("Unknown transfer route");
    const destination = text(
      data.destination ?? previous?.destination ?? "",
      4000,
    );
    if (!path.isAbsolute(destination) || !existsSync(destination))
      throw new Error("Choose an available destination folder");
    const patch = data.profile === undefined ? {} : object(data.profile);
    for (const key of Object.keys(patch))
      if (!Object.keys(defaultProfile).includes(key))
        throw new Error("Unknown profile field");
    const profile: Profile = {
      ...defaultProfile,
      ...previous?.profile,
      ...patch,
    };
    if (!["original", "mp3", "aac", "alac", "flac"].includes(profile.format))
      throw new Error("Unsupported output format");
    if (
      ![128, 160, 192, 256, 320].includes(profile.bitrate) ||
      ![44100, 48000].includes(profile.sampleRate) ||
      !Number.isInteger(profile.artworkSize) ||
      profile.artworkSize < 100 ||
      profile.artworkSize > 1200 ||
      !Number.isInteger(profile.artworkBytes) ||
      profile.artworkBytes < 10000 ||
      profile.artworkBytes > 2000000
    )
      throw new Error("Invalid profile limits");
    if (
      transport === "imazing" &&
      ["flac", "original"].includes(profile.format)
    )
      throw new Error(
        "iPod touch Music requires a compatible MP3, AAC or ALAC profile",
      );
    if (!["Baseline", "User-tested"].includes(profile.compatibility))
      throw new Error(
        "Hardware verification cannot be asserted by an untested preset",
      );
    text(profile.model, 200);
    text(profile.firmware, 200);
    if (
      profile.compatibility === "User-tested" &&
      (!profile.model || !profile.firmware)
    )
      throw new Error("Record model and firmware for a user-tested profile");
    if (typeof profile.legacyPlaylist !== "boolean")
      throw new Error("Invalid playlist setting");
    const outputChanged =
      previous &&
      (transport !== previous.transport ||
        destination !== previous.destination ||
        Object.keys(defaultProfile)
          .filter(
            (key) =>
              !["revision", "compatibility", "model", "firmware"].includes(key),
          )
          .some(
            (key) =>
              profile[key as keyof Profile] !==
              previous.profile[key as keyof Profile],
          ));
    profile.revision = previous
      ? previous.profile.revision + (outputChanged ? 1 : 0)
      : 1;
    const budget =
      data.budget === undefined ? (previous?.budget ?? null) : data.budget;
    if (budget !== null && (!Number.isSafeInteger(budget) || budget <= 0))
      throw new Error("Budget must be a positive number of bytes");
    const target: Target = {
      id: previous?.id || randomUUID(),
      name,
      transport,
      destination,
      volumeIdentity:
        data.destination !== undefined ? "" : previous?.volumeIdentity || "",
      budget,
      profile,
      playlistIds: previous?.playlistIds || [],
      connected: true,
    };
    this.save("targets", target);
    return target;
  }
  private selection(data: Record<string, any>): {
    entries: Occurrence[];
    playlistRevision: string;
  } {
    if (data.playlistId) {
      const playlist = this.get<Playlist>("playlists", data.playlistId);
      return {
        entries: playlist.entries,
        playlistRevision: `${playlist.id}:${playlist.revision}`,
      };
    }
    const tracks = data.trackIds?.length
      ? ids(data.trackIds).map((id) => this.get<Track>("tracks", id))
      : this.all<Track>("tracks");
    return {
      entries: tracks.map((t) => this.occurrence(t)),
      playlistRevision: createHash("sha256")
        .update(tracks.map((t) => t.id).join("\n"))
        .digest("hex"),
    };
  }
  private async exportPlan(data: Record<string, any>): Promise<ExportPlan> {
    const target = this.get<Target>("targets", data.targetId),
      selection = this.selection(data);
    const receipts = this.all<Receipt>("receipts").filter(
      (r) => r.targetId === target.id,
    );
    let availableBytes: number | null = null;
    try {
      const fs = await statfs(target.destination);
      availableBytes = Number(fs.bavail) * Number(fs.bsize);
    } catch {
      /* An absent cache, missing media or disconnected destination remains explicit in the returned state. */
    }
    const safetyReserve = 16 * 1024 * 1024;
    const items: ExportPlan["items"] = [],
      omissions: ExportPlan["omissions"] = [];
    let total = 0;
    for (let ordinal = 0; ordinal < selection.entries.length; ordinal++) {
      const entry = selection.entries[ordinal];
      let track: Track | null = null;
      if (entry.trackId)
        try {
          track = this.get<Track>("tracks", entry.trackId);
        } catch {
          /* An absent cache, missing media or disconnected destination remains explicit in the returned state. */
        }
      const missing =
        !track ||
        !existsSync(track.path) ||
        entry.skipped ||
        entry.reference.unavailable;
      const title = track?.metadata.title || entry.reference.title;
      if (!track || missing) {
        const reason = entry.skipped
          ? "Explicitly skipped"
          : !track
            ? "No approved recording"
            : "Media unavailable";
        items.push({
          occurrenceId: entry.id,
          trackId: track?.id || null,
          title,
          action: "Unavailable",
          reason,
          estimatedBytes: 0,
        });
        omissions.push({ ordinal: ordinal + 1, title, reason });
        continue;
      }
      const current = receipts.some(
        (r) =>
          r.trackId === track!.id &&
          r.trackRevision === track!.revision &&
          r.profileRevision === target.profile.revision &&
          r.playlistRevision === selection.playlistRevision &&
          existsSync(r.path),
      );
      const compatible =
        target.profile.format === "original" ||
        (target.profile.format === "mp3" && track.codec === "mp3") ||
        (target.profile.format === "aac" && track.codec === "aac") ||
        (target.profile.format === "alac" && track.codec === "alac") ||
        (target.profile.format === "flac" && track.codec === "flac");
      const estimatedBytes = compatible
        ? track.bytes
        : Math.ceil(
            track.duration *
              (target.profile.format === "mp3" ||
              target.profile.format === "aac"
                ? (target.profile.bitrate * 1000) / 8
                : track.sampleRate * 4),
          );
      total += current ? 0 : estimatedBytes;
      items.push({
        occurrenceId: entry.id,
        trackId: track.id,
        title,
        action:
          availableBytes === null
            ? "Blocked"
            : current
              ? "Already current"
              : receipts.some((r) => r.trackId === track!.id)
                ? "Update"
                : "Add",
        reason:
          availableBytes === null
            ? "Destination disconnected"
            : compatible
              ? "Reuse compatible audio without lossy re-encoding"
              : `Convert to ${target.profile.format.toUpperCase()}${["flac", "alac"].includes(target.profile.format) && track.source?.quality.includes("Lossy") ? " (lossy history preserved)" : ""}`,
        estimatedBytes,
      });
    }
    if (
      availableBytes !== null &&
      (total + safetyReserve > availableBytes ||
        (target.budget !== null && total > target.budget))
    )
      for (const item of items)
        if (item.action !== "Unavailable") {
          item.action = "Blocked";
          item.reason = "Estimated export exceeds free space or target budget";
        }
    return {
      targetId: target.id,
      items,
      occurrences: selection.entries.length,
      uniqueMedia: new Set(
        selection.entries
          .filter((e) => e.trackId && !e.skipped)
          .map((e) => e.trackId),
      ).size,
      estimatedBytes: total,
      availableBytes,
      safetyReserve,
      omissions,
      destination: target.destination,
      warning:
        target.transport === "imazing"
          ? "Prepared files do not prove an iPod transfer or playlist order. Transfer in iMazing, then confirm this batch."
          : target.transport === "mtp"
            ? "Direct MTP transfer unavailable on this OS. This prepares a folder for your external transfer app."
            : target.transport === "usb"
              ? "Only hashes of files copied to this explicitly selected mounted folder are verified; playback compatibility needs a physical test."
              : "Folder export does not prove receipt by a player.",
    };
  }
  private async exportJob(job: Job, signal: AbortSignal) {
    const data = job.payload,
      target = this.get<Target>("targets", data.targetId);
    if (this.activeTargets.has(target.id))
      throw new Error("This target already has an active writer");
    this.activeTargets.add(target.id);
    const batchId = job.id;
    const selected = this.selection(data);
    const stage = path.join(this.requireVault(), ".jobs", batchId);
    await mkdir(stage, { recursive: true });
    try {
      const plan = await this.exportPlan(data);
      if (plan.items.some((i) => i.action === "Blocked"))
        throw new Error("Destination disconnected or insufficient space");
      const tools = await this.tools();
      const receipts: Receipt[] = [],
        playlistLines = ["#EXTM3U"],
        files: { name: string; hash: string; bytes: number }[] = [];
      let total = 0;
      const destinationRoot = await realpath(target.destination);
      const targetRoot = await confined(
        destinationRoot,
        `TuneVault-${target.id}`,
      );
      await mkdir(targetRoot, { recursive: true });
      const marker = await confined(targetRoot, ".tunevault-volume-id");
      if (target.volumeIdentity) {
        let current = "";
        try {
          if ((await stat(marker)).size !== 36)
            throw new Error("Invalid target identity marker");
          current = await readFile(marker, "utf8");
        } catch {
          /* A missing marker on a reused path cannot identify the previously selected volume. */
        }
        if (current !== target.volumeIdentity)
          throw new Error(
            "Destination identity changed; reselect and review the target folder before exporting",
          );
      } else {
        if (existsSync(marker)) {
          if ((await stat(marker)).size !== 36)
            throw new Error("Invalid target identity marker");
          const existing = await readFile(marker, "utf8");
          if (!/^[a-f0-9-]{36}$/.test(existing))
            throw new Error("Invalid target identity marker");
          target.volumeIdentity = existing;
        } else {
          target.volumeIdentity = randomUUID();
          await writeFile(marker, target.volumeIdentity, { flag: "wx" });
        }
        this.save("targets", target);
      }
      const previousReceipts = this.all<Receipt>("receipts").filter(
        (r) => r.targetId === target.id,
      );
      const batchDirectory = await confined(targetRoot, batchId);
      const renditionCache = new Map<
        string,
        { path: string; hash: string; bytes: number }
      >();
      for (let i = 0; i < selected.entries.length; i++) {
        signal.throwIfAborted();
        const entry = selected.entries[i];
        const item = plan.items[i];
        if (item.action === "Unavailable") continue;
        const track = this.get<Track>("tracks", entry.trackId);
        const key = `${track.id}-${track.revision}-${target.profile.revision}`;
        let rendered = renditionCache.get(key);
        if (!rendered) {
          const cacheDir = path.join(
            this.requireVault(),
            "renditions",
            target.id,
          );
          await mkdir(cacheDir, { recursive: true });
          const cached = await confined(
            cacheDir,
            `${key}${extension(track, target.profile.format)}`,
          );
          const record = this.all<any>("cache").find(
            (c) => c.id === `rendition:${target.id}:${key}`,
          );
          if (
            record &&
            existsSync(cached) &&
            (await hashFile(cached)) === record.hash
          )
            rendered = {
              path: cached,
              hash: record.hash,
              bytes: (await stat(cached)).size,
            };
          else {
            const temp = path.join(
              stage,
              `${key}${extension(track, target.profile.format)}`,
            );
            let image = track.artwork;
            if (image)
              image = await artwork(
                image,
                stage,
                target.profile.artworkSize,
                target.profile.artworkBytes,
              );
            await writeMedia({ ...track, artwork: image }, temp, tools, {
              profile: target.profile,
              signal,
            });
            const hash = await hashFile(temp),
              bytes = (await stat(temp)).size;
            await rename(temp, cached);
            this.save("cache", { id: `rendition:${target.id}:${key}`, hash });
            rendered = { path: cached, hash, bytes };
          }
          renditionCache.set(key, rendered);
        }
        total += rendered.bytes;
        const free = await statfs(destinationRoot);
        if (target.budget !== null && total > target.budget)
          throw new Error(
            "Exact staged bytes exceed the selected content budget",
          );
        const name = `${String(i + 1).padStart(4, "0")} - ${safeName(track.metadata.artist ? `${track.metadata.artist} - ${track.metadata.title}` : track.metadata.title)}${extension(track, target.profile.format)}`;
        let dest = await confined(targetRoot, `${batchId}/${name}`);
        let exportedName = name;
        let reused = false;
        for (const previous of previousReceipts) {
          if (
            previous.trackId !== track.id ||
            previous.trackRevision !== track.revision ||
            previous.profileRevision !== target.profile.revision ||
            path.basename(previous.path) !== name ||
            previous.hash !== rendered.hash ||
            !existsSync(previous.path)
          )
            continue;
          const actual = await realpath(previous.path);
          if (!actual.startsWith((await realpath(targetRoot)) + path.sep))
            continue;
          if ((await hashFile(actual)) !== rendered.hash) continue;
          dest = actual;
          exportedName = path
            .relative(batchDirectory, dest)
            .split(path.sep)
            .join("/");
          reused = true;
          break;
        }
        if (!reused) {
          if (
            rendered.bytes + plan.safetyReserve >
            Number(free.bavail) * Number(free.bsize)
          )
            throw new Error("Destination has insufficient free space");
          await mkdir(path.dirname(dest), { recursive: true });
          const temporary = dest + ".partial";
          try {
            await copyFile(rendered.path, temporary);
            signal.throwIfAborted();
            if ((await hashFile(temporary)) !== rendered.hash)
              throw new Error("Destination copy failed hash verification");
            await rename(temporary, dest);
            if ((await hashFile(dest)) !== rendered.hash)
              throw new Error("Destination changed after copy");
          } finally {
            await rm(temporary, { force: true });
          }
        }
        playlistLines.push(
          `#EXTINF:${Math.round(track.duration)},${track.metadata.artist.replace(/[\r\n]/g, " ")} - ${track.metadata.title.replace(/[\r\n]/g, " ")}`,
          exportedName,
        );
        files.push({
          name: exportedName,
          hash: rendered.hash,
          bytes: rendered.bytes,
        });
        receipts.push({
          id: randomUUID(),
          targetId: target.id,
          batchId,
          trackId: track.id,
          trackRevision: track.revision,
          profileRevision: target.profile.revision,
          playlistRevision: selected.playlistRevision,
          hash: rendered.hash,
          path: dest,
          evidence:
            target.transport === "usb"
              ? "volume-verified"
              : target.transport === "imazing"
                ? "ready-locally"
                : "exported",
          createdAt: now(),
        });
        this.updateJob(job.id, {
          progress: (i + 1) / selected.entries.length,
          message: `Prepared ${i + 1} of ${selected.entries.length}`,
        });
      }
      const batchRoot = await confined(targetRoot, batchId);
      await mkdir(batchRoot, { recursive: true });
      signal.throwIfAborted();
      await writeFile(
        await confined(batchRoot, "playlist.m3u8.partial"),
        playlistLines.join("\n") + "\n",
        { encoding: "utf8" },
      );
      await rename(
        await confined(batchRoot, "playlist.m3u8.partial"),
        await confined(batchRoot, "playlist.m3u8"),
      );
      if (target.profile.legacyPlaylist)
        await writeFile(
          await confined(batchRoot, "playlist.m3u"),
          playlistLines.join("\r\n") + "\r\n",
          { encoding: "utf8" },
        );
      const manifest = {
        schema: 1,
        targetId: target.id,
        batchId,
        profile: target.profile,
        playlistRevision: selected.playlistRevision,
        files,
        omissions: plan.omissions,
        warning:
          plan.warning +
          " Incremental playlists may reference prior batch files; keep the entire TuneVault target folder together.",
        bytes: total,
        createdAt: now(),
      };
      await writeFile(
        await confined(batchRoot, "manifest.json.partial"),
        JSON.stringify(manifest, null, 2),
      );
      await rename(
        await confined(batchRoot, "manifest.json.partial"),
        await confined(batchRoot, "manifest.json"),
      );
      signal.throwIfAborted();
      this.transaction(() => {
        for (const receipt of receipts) this.save("receipts", receipt);
        const current = this.get<Job>("jobs", job.id);
        this.save("jobs", {
          ...current,
          payload: {
            ...current.payload,
            batchId,
            path: batchRoot,
            bytes: total,
            omissions: plan.omissions,
          },
        });
      });
    } finally {
      this.activeTargets.delete(target.id);
      await rm(stage, { recursive: true, force: true });
    }
  }
  private async splitJob(job: Job, signal: AbortSignal) {
    const master = this.get<Track>("tracks", job.payload.id),
      chapters = job.payload.chapters as Chapter[];
    validateChapters(chapters, master.duration);
    const tools = await this.tools();
    for (let i = 0; i < chapters.length; i++) {
      signal.throwIfAborted();
      const chapter = chapters[i],
        range: [number, number] = [
          chapter.start,
          chapters[i + 1]?.start ?? master.duration,
        ];
      const id = randomUUID(),
        dest = await confined(
          this.requireVault(),
          `segments/${id}${path.extname(master.path)}`,
        );
      await mkdir(path.dirname(dest), { recursive: true });
      const child = {
        ...master,
        id,
        metadata: { ...master.metadata, title: chapter.title },
        parentId: master.id,
        range,
      };
      await writeMedia(child, dest, tools, { range, signal });
      const info = await inspect(dest, tools);
      this.save("tracks", {
        ...child,
        ...info,
        path: dest,
        originalPath: master.path,
        revision: 1,
        source: master.source
          ? {
              ...master.source,
              quality:
                master.source.quality +
                " Segment uses codec-boundary stream copy; boundaries may vary.",
              chapters: [],
            }
          : null,
      });
      this.updateJob(job.id, { progress: (i + 1) / chapters.length });
    }
  }
  private async lookup(track: Track) {
    this.requireOnline();
    const query = [track.metadata.title, track.metadata.artist]
      .filter(Boolean)
      .join(" ");
    const key = "lookup:" + query;
    try {
      const cached = this.get<any>("cache", key);
      if (Date.now() - cached.at < 7 * 86400000) return cached.results;
    } catch {
      /* An absent cache, missing media or disconnected destination remains explicit in the returned state. */
    }
    this.lookupAt = Math.max(Date.now(), this.lookupAt + 1100);
    await delay(Math.max(0, this.lookupAt - Date.now()));
    const url = new URL("https://musicbrainz.org/ws/2/recording/");
    url.search = new URLSearchParams({
      query,
      fmt: "json",
      limit: "10",
    }).toString();
    const response = await fetchBounded(url, 2 * 1024 * 1024);
    const data = JSON.parse(response.bytes.toString("utf8"));
    const results = (data.recordings || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      artist: (r["artist-credit"] || []).map((a: any) => a.name).join("; "),
      album: r.releases?.[0]?.title || "",
      releases: (r.releases || []).map((release: any) => ({
        id: release.id,
        title: release.title,
        date: release.date || "",
        country: release.country || "",
      })),
      date: r.releases?.[0]?.date || "",
      reason:
        "MusicBrainz recording suggestion. Verify recording/version and choose fields; cover is not inferred.",
    }));
    this.save("cache", { id: key, at: Date.now(), results });
    return results;
  }
  private async backup(destination: string, includeMedia: boolean) {
    if (this.running.size)
      throw new Error("Wait for media jobs before backing up");
    const root = await realpath(destination),
      name = `TuneVault-backup-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const staging = await confined(root, name + ".partial"),
      folder = await confined(root, name);
    await mkdir(staging);
    const snapshot = await this.snapshot(),
      revisions = this.all<{ id: string; trackId: string; track: Track }>(
        "revisions",
      );
    const records = [...snapshot.tracks, ...revisions.map((r) => r.track)];
    const sourceFiles = [
      ...new Set(
        records.flatMap((t) => [
          t.path,
          ...(t.artwork ? [t.artwork] : []),
          ...(t.artworkOriginal ? [t.artworkOriginal] : []),
        ]),
      ),
    ];
    let bytes = 0;
    for (const file of sourceFiles) {
      try {
        bytes += (await stat(file)).size;
      } catch {
        if (includeMedia)
          throw new Error(
            "Full backup requires every media/metadata revision; relink missing files first",
          );
      }
    }
    const space = await statfs(root);
    if (
      includeMedia &&
      bytes + 16 * 1024 * 1024 > Number(space.bavail) * Number(space.bsize)
    )
      throw new Error("Insufficient backup space");
    try {
      if (includeMedia) {
        await mkdir(path.join(staging, "media"));
        const copied = new Map<string, string>();
        for (const track of records) {
          for (const field of ["path", "artwork", "artworkOriginal"] as const) {
            const file = track[field];
            if (!file) continue;
            let relative = copied.get(file);
            if (!relative) {
              const hash = await hashFile(file);
              relative = `media/${hash}${field === "path" ? path.extname(file) : ".jpg"}`;
              const target = await confined(staging, relative);
              await copyFile(file, target);
              if ((await hashFile(target)) !== hash)
                throw new Error("Backup copy hash mismatch");
              copied.set(file, relative);
            }
            track[field] = relative;
          }
        }
      }
      await writeFile(
        path.join(staging, "bundle.json"),
        JSON.stringify({
          schema: 1,
          kind: includeMedia ? "full-media" : "metadata-only",
          createdAt: now(),
          snapshot,
          revisions,
        }),
      );
      await rename(staging, folder);
      return {
        path: folder,
        kind: includeMedia ? "full-media" : "metadata-only",
        bytes: includeMedia ? bytes : 0,
      };
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      throw error;
    }
  }
  private async restore(source: string) {
    const root = await realpath(source);
    const file = await confined(root, "bundle.json");
    if ((await stat(file)).size > 100 * 1024 * 1024)
      throw new Error("Backup metadata exceeds 100 MB");
    const bundle = JSON.parse(await readFile(file, "utf8"));
    if (
      bundle.schema !== 1 ||
      !["full-media", "metadata-only"].includes(bundle.kind)
    )
      throw new Error("Unsupported backup schema");
    const snapshot = object(bundle.snapshot);
    for (const key of ["tracks", "playlists", "targets", "jobs", "receipts"])
      if (!Array.isArray(snapshot[key]) || snapshot[key].length > 100000)
        throw new Error("Corrupt backup index");
    if (!Array.isArray(bundle.revisions) || bundle.revisions.length > 100000)
      throw new Error("Invalid revision history");
    const revisionIds = new Set<string>();
    for (const revision of bundle.revisions) {
      text(revision.id, 100);
      text(revision.trackId, 100);
      if (revisionIds.has(revision.id))
        throw new Error("Duplicate revision identity");
      revisionIds.add(revision.id);
      object(revision.track);
    }
    const seen = new Set<string>();
    for (const track of snapshot.tracks) {
      text(track.id, 100);
      if (seen.has(track.id))
        throw new Error("Duplicate track identity in backup");
      seen.add(track.id);
    }
    for (const track of [
      ...snapshot.tracks,
      ...bundle.revisions.map((r: any) => r.track),
    ]) {
      text(track.id, 100);
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(track.id) ||
        !seen.has(track.id) ||
        !/^[a-f0-9]{64}$/.test(track.hash) ||
        !Number.isFinite(track.duration) ||
        track.duration <= 0 ||
        !Number.isSafeInteger(track.bytes) ||
        track.bytes <= 0
      )
        throw new Error("Invalid track in backup");
      this.metadata(track.metadata);
      this.locks(track.locks);
      if (!Number.isSafeInteger(track.revision) || track.revision < 1)
        throw new Error("Invalid metadata revision");
      if (bundle.kind === "full-media") {
        track.path = await confined(root, text(track.path, 4000));
        if (
          !existsSync(track.path) ||
          (await hashFile(track.path)) !== track.hash
        )
          throw new Error("Backup media is missing or corrupt");
        if (track.artwork)
          track.artwork = await confined(root, text(track.artwork, 4000));
        if (track.artworkOriginal)
          track.artworkOriginal = await confined(
            root,
            text(track.artworkOriginal, 4000),
          );
      } else {
        text(track.path, 4000);
        if (!path.isAbsolute(track.path))
          throw new Error(
            "Metadata-only backup media must use an existing absolute location",
          );
      }
    }
    for (const playlist of snapshot.playlists) {
      ids(playlist.entries.map((e: any) => e.id));
      if (playlist.entries.some((e: any) => e.trackId && !seen.has(e.trackId)))
        throw new Error("Playlist refers to an unknown track");
    }
    if (this.running.size)
      throw new Error("Wait for media jobs before restoring");
    const recovery = path.join(
      this.dataDir,
      `before-restore-${Date.now()}.json`,
    );
    await writeFile(recovery, JSON.stringify(await this.snapshot()));
    const restoredTracks: Track[] = snapshot.tracks;
    for (const track of [
      ...snapshot.tracks,
      ...bundle.revisions.map((r: any) => r.track),
    ]) {
      if (bundle.kind === "full-media") {
        const dest = await this.archiveCopy(
          track.path,
          track.id + "-restored-" + randomUUID(),
          path.extname(track.path),
        );
        track.path = dest;
        if (track.artwork)
          track.artwork = await artwork(
            track.artwork,
            path.join(this.requireVault(), "artwork"),
          );
        if (track.artworkOriginal) {
          const original = await confined(
            this.requireVault(),
            `artwork/restored-original-${randomUUID()}${path.extname(track.artworkOriginal)}`,
          );
          await copyFile(track.artworkOriginal, original);
          track.artworkOriginal = original;
        }
      }
    }
    this.transaction(() => {
      this.db.exec(
        "DELETE FROM playlist_occurrences; DELETE FROM receipt_links",
      );
      for (const table of [
        "receipts",
        "revisions",
        "playlists",
        "targets",
        "jobs",
        "tracks",
      ] as Table[])
        this.db.exec(`DELETE FROM ${table}`);
      for (const track of restoredTracks) this.save("tracks", track);
      for (const revision of bundle.revisions) {
        if (!seen.has(revision.trackId))
          throw new Error("Revision points to unknown track");
        this.save("revisions", revision);
      }
      for (const target of snapshot.targets) {
        target.destination = "";
        target.volumeIdentity = "";
        target.connected = false;
      }
      for (const table of ["playlists", "targets", "receipts"] as const)
        for (const record of snapshot[table]) {
          text(record.id, 100);
          this.save(table, record);
        }
      for (const job of snapshot.jobs)
        this.save("jobs", {
          ...job,
          status: "cancelled",
          payload: { restored: true },
          message:
            "Historical job restored; select its source again to run a new job",
        });
      const settings = this.settings();
      this.saveSettings({
        ...settings,
        appearance: ["system", "light", "dark"].includes(
          snapshot.settings?.appearance,
        )
          ? snapshot.settings.appearance
          : "system",
        accent: snapshot.settings?.accent === "orange" ? "orange" : "blue",
      });
    });
    return {
      restored: restoredTracks.length,
      recoveryBackup: recovery,
      missing: restoredTracks.filter((t) => !existsSync(t.path)).length,
    };
  }
}
function referenceKey(ref: Reference): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        ref.sourceId || ref.url || "",
        ref.title,
        ref.artist,
        ref.album,
        ref.duration,
      ]),
    )
    .digest("hex");
}
function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/\S+/g, "[provider URL]")
    .replace(
      /((?:cookie|authorization|token|password)\s*[:=]\s*)\S+/gi,
      "$1[redacted]",
    )
    .slice(0, 2000);
}
