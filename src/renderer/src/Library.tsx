import { useEffect, useMemo, useState } from "react";
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
  const allSelected =
    visible.length > 0 && visible.every((t) => selected.includes(t.id));
  const albums = useMemo(
    () => [...new Map(filtered.map((t) => [albumIdentity(t), t])).values()],
    [filtered],
  );
  if (!tracks.length)
    return (
      <Empty title="Your music starts here" icon="library">
        Import files you own, or add a source you are authorized to archive.
        <br />
        Original files stay untouched.
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
          <table className="track-table">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    aria-label="Select tracks on this page"
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [
                              ...new Set([
                                ...selected,
                                ...visible.map((t) => t.id),
                              ]),
                            ]
                          : selected.filter(
                              (id) => !visible.some((t) => t.id === id),
                            ),
                      )
                    }
                  />
                </th>
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
                  className={selected.includes(t.id) ? "selected" : ""}
                  onDoubleClick={() => inspect(t.id)}
                >
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label={`Select ${t.metadata.title}`}
                      checked={selected.includes(t.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, t.id]
                            : selected.filter((id) => id !== t.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="track-name"
                      onClick={() => inspect(t.id)}
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
          {selected.length ? ` · ${selected.length} selected` : ""}
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
