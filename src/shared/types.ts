export type MetadataField =
  | "title"
  | "artist"
  | "album"
  | "albumArtist"
  | "trackNumber"
  | "trackTotal"
  | "discNumber"
  | "discTotal"
  | "date"
  | "genre"
  | "composer"
  | "comment"
  | "isrc"
  | "musicbrainzId";
export type Metadata = Record<MetadataField, string>;
export interface Track {
  id: string;
  hash: string;
  path: string;
  originalPath: string;
  metadata: Metadata;
  locks: MetadataField[];
  origins: Partial<Record<MetadataField, string>>;
  revision: number;
  artwork: string | null;
  artworkOriginal?: string;
  artworkOrigin?: string;
  favorite: boolean;
  missing: boolean;
  codec: string;
  container: string;
  duration: number;
  bitrate: number;
  sampleRate: number;
  bytes: number;
  source: Source | null;
  parentId?: string;
  range?: [number, number];
  demo?: boolean;
}
export interface Source {
  provider: "youtube" | "local";
  id: string;
  url: string;
  title: string;
  uploader: string;
  description: string;
  acquiredAt: string;
  quality: string;
  chapters: Chapter[];
}
export interface Chapter {
  start: number;
  title: string;
}
export interface Reference {
  title: string;
  artist: string;
  album: string;
  duration: number | null;
  url?: string;
  sourceId?: string;
  unavailable?: boolean;
}
export interface Occurrence {
  id: string;
  trackId: string | null;
  reference: Reference;
  manual: boolean;
  skipped: boolean;
  error?: string;
}
export interface Playlist {
  id: string;
  name: string;
  description: string;
  revision: number;
  entries: Occurrence[];
  sourceUrl: string | null;
  snapshotAt: string | null;
  followSourceOrder: boolean;
}
export type Transport = "imazing" | "usb" | "folder" | "mtp";
export type Format = "original" | "mp3" | "aac" | "alac" | "flac";
export interface Profile {
  format: Format;
  bitrate: number;
  sampleRate: number;
  artworkSize: number;
  artworkBytes: number;
  revision: number;
  compatibility: "Baseline" | "User-tested";
  model: string;
  firmware: string;
  legacyPlaylist: boolean;
  testResults?: string;
  mp3TagVersion?: 3 | 4;
  filenameLimit?: number;
  pathLimit?: number;
  playlistEncoding?: "utf8";
  playlistNewline?: "LF" | "CRLF";
  orderTags?: boolean;
}
export interface Target {
  id: string;
  name: string;
  transport: Transport;
  destination: string;
  volumeIdentity: string;
  budget: number | null;
  profile: Profile;
  playlistIds: string[];
  connected: boolean;
  lastCapacity?: { totalBytes: number; freeBytes: number; observedAt: string };
}
export interface Job {
  id: string;
  kind: "import" | "download" | "export" | "split";
  status:
    "queued" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
  progress: number;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  attempts: number;
}
export type ReceiptEvidence =
  "ready-locally" | "exported" | "user-confirmed" | "volume-verified";
export interface Receipt {
  id: string;
  targetId: string;
  batchId: string;
  trackId: string;
  trackRevision: number;
  profileRevision: number;
  playlistRevision: string;
  hash: string;
  path: string;
  evidence: ReceiptEvidence;
  createdAt: string;
  confirmsReceiptId?: string;
}
export interface Settings {
  vault: string;
  appearance: "system" | "light" | "dark";
  accent: "blue" | "orange";
  autoUpdates: boolean;
  onlineAcknowledged: boolean;
  disclaimerAccepted: boolean;
  onboarded: boolean;
  selection: string[];
  view: "tracks" | "albums";
  filter: string;
}
export interface Snapshot {
  tracks: Track[];
  library: Track[];
  playlists: Playlist[];
  targets: Target[];
  jobs: Job[];
  receipts: Receipt[];
  settings: Settings;
}
export interface ExportItem {
  occurrenceId: string;
  trackId: string | null;
  title: string;
  action:
    | "Add"
    | "Update"
    | "Retag"
    | "Reorder-only"
    | "Already current"
    | "Unavailable"
    | "Blocked";
  reason: string;
  estimatedBytes: number;
}
export interface ExportPlan {
  targetId: string;
  items: ExportItem[];
  occurrences: number;
  uniqueMedia: number;
  estimatedBytes: number;
  availableBytes: number | null;
  knownBytes: number;
  budget: number | null;
  safetyReserve: number;
  omissions: { ordinal: number; title: string; reason: string }[];
  destination: string;
  warning: string;
}
export interface ProviderPreview {
  provider: string;
  capability:
    | "available"
    | "credentials-required"
    | "partial"
    | "unsupported"
    | "temporarily-failed";
  complete: boolean;
  name: string;
  url: string;
  references: Reference[];
  explanation: string;
}
export interface TuneVaultApi {
  command(action: string, input?: unknown): Promise<any>;
  chooseFiles(): Promise<string[]>;
  chooseFolder(): Promise<string | null>;
  reveal(path: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  filePath(file: File): string;
  onChange(callback: () => void): () => void;
}
