import { useEffect, useMemo, useRef, useState } from "react";
import type { Playlist, Receipt, Target, Track } from "../../shared/types";
import { duration, Empty, Icon } from "./ui";
import {
  albumIdentity,
  compareAlbumTracks,
  needsPreparation,
  targetState,
} from "./library-state";

export function Artwork({
  track,
  large = false,
}: {
  track: Track;
  large?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const src =
    track.demo || track.artwork?.startsWith("data:")
      ? track.artwork
      : track.artwork
        ? `tunevault-art://track/${encodeURIComponent(track.id)}?revision=${track.revision}`
        : null;
  useEffect(() => setBroken(false), [src]);
  return (
    <span
      className={`artwork ${large ? "large" : ""}`}
      aria-label={
        broken ? "Artwork unavailable" : !src ? "No artwork" : undefined
      }
    >
      {src && !broken ? (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <Icon name="music" size={large ? 28 : 17} />
      )}
    </span>
  );
}

export default function Library({
  tracks,
  selected,
  setSelected,
  inspect,
  target,
  receipts,
  playlists,
  filter,
  search,
  view,
  onFavorite,
  sort,
  setSort,
  onAddMusic,
  hasVault,
  inspecting = false,
}: {
  tracks: Track[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  inspect: (id: string) => void;
  target?: Target;
  receipts: Receipt[];
  playlists: Playlist[];
  filter: string;
  search: string;
  view: "tracks" | "albums";
  onFavorite: (track: Track) => void;
  sort: string;
  setSort: (v: string) => void;
  onAddMusic: () => void;
  hasVault: boolean;
  inspecting?: boolean;
}) {
  const [page, setPage] = useState(0);
  const [album, setAlbum] = useState<string | null>(null);
  const filtered = useMemo(
    () =>
      tracks
        .filter((t) => {
          const state =
            filter === "changed"
              ? targetState(t, target, receipts, playlists)
              : "";
          return (
            (!search ||
              `${t.metadata.title} ${t.metadata.artist} ${t.metadata.album}`
                .toLocaleLowerCase()
                .includes(search.toLocaleLowerCase())) &&
            (filter === "all" ||
              (filter === "favorites" && t.favorite) ||
              (filter === "review" &&
                (!t.metadata.artist || !t.metadata.title)) ||
              (filter === "artwork" && !t.artwork) ||
              (filter === "missing" && t.missing) ||
              (filter === "ready" &&
                needsPreparation(t, target, receipts, playlists)) ||
              (filter === "changed" && state === "Changed since transfer")) &&
            (!album || albumIdentity(t) === album)
          );
        })
        .sort((a, b) => {
          if (sort === "duration") return a.duration - b.duration;
          if (sort === "album")
            return (
              albumIdentity(a).localeCompare(albumIdentity(b)) ||
              compareAlbumTracks(a, b)
            );
          return (a.metadata[sort as "title" | "artist"] || "").localeCompare(
            b.metadata[sort as "title" | "artist"] || "",
          );
        }),
    [tracks, search, filter, sort, target, receipts, playlists, album],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 100));
  const actualPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(actualPage * 100, actualPage * 100 + 100);
  // Native list selection: click, Shift-click ranges, Cmd/Ctrl-click
  // toggles, arrow keys move, and details follow the selection when open.
  const anchor = useRef<string | null>(null);
  const cursor = useRef<string | null>(null);
  function choose(id: string, extend: boolean, toggle: boolean) {
    const ids = filtered.map((t) => t.id);
    let next: string[];
    if (extend && anchor.current && ids.includes(anchor.current)) {
      const [from, to] = [ids.indexOf(anchor.current), ids.indexOf(id)].sort(
        (a, b) => a - b,
      );
      next = ids.slice(from, to + 1);
    } else if (toggle) {
      next = selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id];
      anchor.current = id;
    } else {
      next = [id];
      anchor.current = id;
    }
    cursor.current = id;
    setSelected(next);
    if (inspecting && next.length === 1) inspect(next[0]);
    const index = ids.indexOf(id);
    if (index >= 0 && Math.floor(index / 100) !== actualPage)
      setPage(Math.floor(index / 100));
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-track-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  }
  function onListKey(e: React.KeyboardEvent) {
    const ids = filtered.map((t) => t.id);
    if (!ids.length) return;
    const current = cursor.current ?? selected.at(-1) ?? null;
    const at = current ? ids.indexOf(current) : -1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const next = Math.min(
        ids.length - 1,
        Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)),
      );
      choose(ids[at < 0 ? 0 : next], e.shiftKey, false);
    } else if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
      setSelected(ids);
    } else if (e.key === "Enter" && current) {
      inspect(current);
    } else if (e.key === "Escape") {
      setSelected([]);
    } else return;
    e.preventDefault();
  }
  const albums = useMemo(
    () => [...new Map(filtered.map((t) => [albumIdentity(t), t])).values()],
    [filtered],
  );
  if (!tracks.length)
    return (
      <Empty title="Your music starts here" icon="library">
        Add music you own or are licensed to keep. Your original files stay
        untouched.
        <div className="library-empty-actions">
          <button className="primary" onClick={onAddMusic}>
            Add music…
          </button>
        </div>
        <p className="small muted">
          {hasVault
            ? "Or drop files or folders anywhere in the window."
            : "Choose your library folder first, then bring in your music."}
        </p>
      </Empty>
    );
  return (
    <>
      {album && (
        <div className="album-heading">
          <button onClick={() => setAlbum(null)}>← All albums</button>
          <h2>
            {tracks.find((t) => albumIdentity(t) === album)?.metadata.album ||
              "Unknown album"}
          </h2>
        </div>
      )}
      {view === "albums" && !album ? (
        <div className="album-grid">
          {albums.map((t) => (
            <button
              key={albumIdentity(t)}
              className="album-card"
              onClick={() => {
                setAlbum(albumIdentity(t));
                setSort("album");
                setPage(0);
              }}
            >
              <Artwork track={t} large />
              <strong>{t.metadata.album || "Unknown album"}</strong>
              <span>
                {t.metadata.albumArtist ||
                  t.metadata.artist ||
                  "Unknown artist"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="table-scroll">
          <table
            className="track-table"
            role="grid"
            aria-label="Tracks"
            aria-multiselectable="true"
            tabIndex={0}
            onKeyDown={onListKey}
          >
            <thead>
              <tr>
                <th scope="col">
                  <button
                    className="column-sort"
                    onClick={() =>
                      setSort(sort === "artist" ? "title" : "artist")
                    }
                  >
                    Title / artist{" "}
                    {sort === "title" ? "↓" : sort === "artist" ? "↑" : ""}
                  </button>
                </th>
                <th scope="col" className="album-column">
                  <button
                    className="column-sort"
                    onClick={() => setSort("album")}
                  >
                    Album {sort === "album" ? "↓" : ""}
                  </button>
                </th>
                <th scope="col" className="time-column">
                  <button
                    className="column-sort"
                    onClick={() => setSort("duration")}
                  >
                    Time
                  </button>
                </th>
                <th scope="col" className="readiness-column">
                  Review
                </th>
                <th scope="col" className="target-column">
                  Target export
                </th>
                <th scope="col" className="favorite-column">
                  <span className="sr-only">Favorite</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr
                  key={t.id}
                  data-track-id={t.id}
                  className={selected.includes(t.id) ? "selected" : ""}
                  aria-selected={selected.includes(t.id)}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest(".favorite")) return;
                    choose(t.id, e.shiftKey, e.metaKey || e.ctrlKey);
                  }}
                  onDoubleClick={() => inspect(t.id)}
                >
                  <td>
                    <button
                      className="track-name"
                      tabIndex={-1}
                      onDoubleClick={() => inspect(t.id)}
                    >
                      <Artwork track={t} />
                      <span>
                        <strong>
                          {t.metadata.title || "Untitled recording"}
                        </strong>
                        <small>
                          {t.metadata.artist || "Artist needs review"}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td className="album-column muted">
                    {t.metadata.album || "—"}
                  </td>
                  <td className="time-column tabular">
                    {duration(t.duration)}
                  </td>
                  <td
                    className={`readiness-column ${!t.metadata.artist || !t.metadata.title ? "warning" : "muted"}`}
                  >
                    {!t.metadata.artist || !t.metadata.title
                      ? "Needs tags"
                      : "—"}
                  </td>
                  <td className="target-column small">
                    {targetState(t, target, receipts, playlists)}
                  </td>
                  <td className="favorite-column">
                    <button
                      className={`icon-button quiet favorite ${t.favorite ? "is-favorite" : ""}`}
                      aria-label={`${t.favorite ? "Remove" : "Add"} favorite: ${t.metadata.title}`}
                      aria-pressed={t.favorite}
                      disabled={t.demo}
                      onClick={() => onFavorite(t)}
                    >
                      <Icon name="star" size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <Empty title="No matching tracks">
              Try a different search or saved filter.
            </Empty>
          )}
        </div>
      )}
      <div className="pagination">
        <span>
          {filtered.length.toLocaleString()} track
          {filtered.length === 1 ? "" : "s"}
        </span>
        {filtered.length > 100 && (
          <div className="button-row">
            <button
              disabled={!actualPage}
              onClick={() => setPage(actualPage - 1)}
            >
              Previous
            </button>
            <span>
              Page {actualPage + 1} of {pageCount}
            </span>
            <button
              disabled={actualPage + 1 === pageCount}
              onClick={() => setPage(actualPage + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
