import { useCallback, useEffect, useRef, useState } from "react";
import {
  CURRENT_DISCLAIMER_VERSION,
  type Snapshot,
  type Track,
} from "../../shared/types";
import Library from "./Library";
import Inspector, { BatchEditor } from "./Inspector";
import AddDialog from "./AddDialog";
import Devices, { ExportDialog, TargetSetup } from "./Devices";
import Playlists from "./Playlists";
import Settings, { type SettingsPane } from "./Settings";
import About from "./About";
import { demoTracks } from "./fixtures";
import { Empty, Icon, message, Modal, OperationErrorContext } from "./ui";
import blueLogo from "./assets/branding/tunevault-wolf-concept.png";
import orangeLogo from "./assets/branding/tunevault-wolf-orange.png";
import {
  ContextTip,
  Disclaimer,
  Onboarding,
  Splash,
  type AddInput,
} from "./Welcome";

const empty: Snapshot = {
  tracks: [],
  library: [],
  playlists: [],
  targets: [],
  jobs: [],
  receipts: [],
  settings: {
    vault: "",
    appearance: window.tunevault.bootAppearance?.appearance || "system",
    accent: window.tunevault.bootAppearance?.accent || "blue",
    autoUpdates: true,
    onlineAcknowledged: false,
    disclaimerAccepted: true,
    disclaimerVersion: CURRENT_DISCLAIMER_VERSION,
    tipsSeen: [],
    onboarded: true,
    selection: [],
    view: "tracks",
    filter: "all",
  },
};
const views = [
  ["library", "Library"],
  ["playlists", "Playlists"],
  ["devices", "Devices & exports"],
  ["activity", "Activity"],
] as const;
const filters = [
  ["all", "All tracks"],
  ["favorites", "Favorites"],
  ["review", "Needs review"],
  ["artwork", "Missing artwork"],
  ["missing", "Missing file"],
  ["ready", "Ready for target"],
  ["changed", "Changed since transfer"],
];

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty),
    [view, setView] = useState("library"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [trackView, setTrackView] = useState<"tracks" | "albums">("tracks"),
    [selected, setSelected] = useState<string[]>([]),
    [inspected, setInspected] = useState<string | null>(null),
    [targetId, setTargetId] = useState(""),
    [playlistId, setPlaylistId] = useState(""),
    [modal, setModal] = useState<
      "add" | "target" | "export" | "batch" | "add-playlist" | null
    >(null),
    [exportPlaylist, setExportPlaylist] = useState<string | undefined>(),
    [exportTargetContent, setExportTargetContent] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Opening local library…"),
    [demo, setDemo] = useState(false),
    [sort, setSort] = useState("title"),
    [artist, setArtist] = useState(""),
    [legal, setLegal] = useState<{ title: string; text: string } | null>(null),
    [playlistChoice, setPlaylistChoice] = useState(""),
    [loading, setLoading] = useState(true),
    [guide, setGuide] = useState(false),
    [setupDismissed, setSetupDismissed] = useState(false),
    [addInput, setAddInput] = useState<AddInput | null>(null),
    [pendingPaths, setPendingPaths] = useState<string[]>([]),
    [tip, setTip] = useState<"import" | "playlist" | "target" | null>(null),
    [settingsPane, setSettingsPane] = useState<SettingsPane>("general"),
    [releaseStatus, setReleaseStatus] = useState<{
      status: string;
      version?: string;
    } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null),
    initialized = useRef(false),
    tipOffered = useRef(false),
    runRef = useRef<(action: string, input?: unknown) => Promise<any>>(null);
  const consentAccepted =
    snapshot.settings.disclaimerAccepted &&
    snapshot.settings.disclaimerVersion >= CURRENT_DISCLAIMER_VERSION;
  const setupOpen =
    !demo &&
    (guide ||
      (!setupDismissed &&
        (!snapshot.settings.onboarded || !snapshot.settings.vault)));
  const refresh = useCallback(async () => {
    const value = await window.tunevault.invoke("snapshot");
    setSnapshot(value);
    if (!initialized.current) {
      setSelected(value.settings.selection || []);
      setTrackView(value.settings.view || "tracks");
      setFilter(value.settings.filter || "all");
      initialized.current = true;
    }
    setLoading(false);
    setStatus("Library saved locally");
    return value as Snapshot;
  }, []);
  useEffect(() => {
    refresh().catch((e) => {
      setError(message(e));
      setLoading(false);
    });
    const unsubscribe = window.tunevault.onChanged(() =>
      refresh().catch((e) => setError(message(e))),
    );
    return unsubscribe;
  }, [refresh]);
  useEffect(() => {
    const refreshRelease = () => {
      window.tunevault
        .invoke("updates.status")
        .then(setReleaseStatus)
        .catch(() => {});
    };
    refreshRelease();
    return window.tunevault.onChanged(refreshRelease);
  }, []);
  useEffect(() => {
    if (
      !snapshot.jobs.some(
        (j) => j.status === "running" || j.status === "queued",
      )
    )
      return;
    const timer = setInterval(() => refresh().catch(() => {}), 1000);
    return () => clearInterval(timer);
  }, [snapshot.jobs, refresh]);
  useEffect(
    () =>
      window.tunevault.onMenu?.((action) => {
        // Menu actions: "settings[:pane]", "about", "welcome", "legal:<document>".
        const [kind, detail] = action.split(":");
        if ((loading || !consentAccepted) && kind !== "legal") return;
        if (kind === "import") startAdd();
        if (kind === "settings") {
          if (detail) setSettingsPane(detail as SettingsPane);
          setView("settings");
        }
        if (kind === "about") setView("about");
        if (kind === "welcome") setGuide(true);
        if (kind === "legal")
          runRef.current?.("openLegal", { document: detail }).catch(() => {});
      }),
    [loading, consentAccepted, snapshot.settings.vault],
  );
  const [systemDark, setSystemDark] = useState(
    window.tunevault.bootAppearance?.systemDark ??
      matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => window.tunevault.onSystemThemeChanged(setSystemDark), []);
  useEffect(() => {
    document.documentElement.dataset.appearance =
      snapshot.settings.appearance === "system"
        ? systemDark
          ? "dark"
          : "light"
        : snapshot.settings.appearance;
    document.documentElement.dataset.accent = snapshot.settings.accent;
  }, [snapshot.settings.appearance, snapshot.settings.accent, systemDark]);
  const run = useCallback(
    async (action: string, input?: unknown): Promise<any> => {
      if (action !== "settings.update") setError("");
      try {
        if (action === "openLegal") {
          const kind = (input as { document: string }).document;
          const names: Record<string, string> = {
            terms: "terms-of-use",
            privacy: "privacy-policy",
            "third-party": "third-party-notices",
            install: "install-update",
            license: "license",
          };
          const result = await window.tunevault.invoke("legal.read", {
            name: names[kind] || kind,
          });
          setLegal({
            title:
              {
                terms: "Terms of use",
                privacy: "Privacy policy",
                "third-party": "Third-party notices",
                install: "Install & update help",
                license: "License",
              }[kind] || kind,
            text:
              typeof result === "string"
                ? result
                : result.text || result.content || "",
          });
          return;
        }
        const result = await window.tunevault.invoke(action, input);
        if (
          !action.startsWith("choose") &&
          ![
            "app.info",
            "diagnostics",
            "credentials.status",
            "diagnostics.preview",
            "diagnostics.export",
            "defaultFolder",
            "vault.status",
            "references.readFile",
            "updates.status",
            "updates.check",
            "updates.download",
            "updates.install",
            "openExternal",
            "reveal",
            "source.search",
            "lookup.search",
            "lookup.cancel",
            "lookup.artworkPreview",
            "artwork.preview",
            "artwork.placeholderPreview",
            "mixes.parse",
            "import.preview",
            "source.preview",
            "export.preview",
            "playlists.refreshPreview",
          ].includes(action)
        ) {
          const updated = await refresh();
          if (action === "restore") {
            const validIds = new Set(updated.tracks.map((track) => track.id));
            setSelected(
              updated.settings.selection.filter((id) => validIds.has(id)),
            );
            setTrackView(updated.settings.view);
            setFilter(updated.settings.filter);
            setArtist("");
            setInspected(null);
          }
          setStatus("Changes saved locally");
        }
        return result;
      } catch (e) {
        if (message(e) !== "Metadata request cancelled") setError(message(e));
        throw e;
      }
    },
    [refresh],
  );
  runRef.current = run;
  function chooseSelection(ids: string[]) {
    setSelected(ids);
    if (!demo) void run("settings.update", { selection: ids }).catch(() => {});
  }
  function chooseFilter(value: string) {
    setFilter(value);
    if (!demo) void run("settings.update", { filter: value }).catch(() => {});
  }
  function chooseTrackView(value: "tracks" | "albums") {
    setTrackView(value);
    if (!demo) void run("settings.update", { view: value }).catch(() => {});
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (loading || !consentAccepted) return;
      if (
        e.key === "Escape" &&
        !document.querySelector(
          'dialog[open],[role="dialog"][aria-modal="true"]',
        )
      )
        setInspected(null);
      if (e.metaKey || e.ctrlKey) {
        if (
          e.key.toLowerCase() === "f" &&
          !document.querySelector(
            'dialog[open],[role="dialog"][aria-modal="true"]',
          )
        ) {
          e.preventDefault();
          setView("library");
          requestAnimationFrame(() => searchRef.current?.focus());
        }
        if (e.key.toLowerCase() === "o") {
          e.preventDefault();
          startAdd();
        }
        if (
          e.key.toLowerCase() === "i" &&
          !document.querySelector(
            'dialog[open],[role="dialog"][aria-modal="true"]',
          )
        ) {
          e.preventDefault();
          if (selected[0]) setInspected(selected[0]);
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [selected, loading, consentAccepted, snapshot.settings.vault]);
  const tracks = demo ? demoTracks : snapshot.tracks;
  const current = tracks.find((t) => t.id === inspected);
  const target =
    snapshot.targets.find((t) => t.id === targetId) || snapshot.targets[0];
  const activeJobs = snapshot.jobs.filter(
    (j) => j.status === "queued" || j.status === "running",
  );
  useEffect(() => {
    if (
      loading ||
      !consentAccepted ||
      setupOpen ||
      modal ||
      legal ||
      inspected ||
      demo ||
      tipOffered.current ||
      activeJobs.length
    )
      return;
    const candidates = [
      {
        id: "import" as const,
        active: view === "library" && snapshot.tracks.length > 0,
        anchor: ".track-table thead input",
      },
      {
        id: "playlist" as const,
        active: view === "playlists" && snapshot.playlists.length > 0,
        anchor: ".playlist-table thead th",
      },
      {
        id: "target" as const,
        active: view === "devices" && snapshot.targets.length > 0,
        anchor: '[data-help-anchor="target"]',
      },
    ];
    const next = candidates.find(
      (candidate) =>
        candidate.active &&
        !snapshot.settings.tipsSeen.includes(candidate.id) &&
        document.querySelector(candidate.anchor),
    );
    if (!next) return;
    tipOffered.current = true;
    setTip(next.id);
    void run("settings.update", {
      tipsSeen: [...snapshot.settings.tipsSeen, next.id],
    }).catch(() => {});
  }, [
    loading,
    consentAccepted,
    setupOpen,
    modal,
    legal,
    inspected,
    demo,
    view,
    snapshot.tracks.length,
    snapshot.playlists.length,
    snapshot.targets.length,
    snapshot.settings.tipsSeen,
    activeJobs.length,
    run,
  ]);
  function startAdd(input?: AddInput) {
    if (!snapshot.settings.vault) {
      if (input?.kind === "files") setPendingPaths(input.paths);
      setSetupDismissed(false);
      setGuide(true);
      return;
    }
    setAddInput(input || null);
    setModal("add");
  }
  function finishSetup() {
    setGuide(false);
    setSetupDismissed(true);
    if (snapshot.settings.vault && !snapshot.settings.onboarded)
      void run("settings.update", { onboarded: true }).catch(() => {});
    requestAnimationFrame(() => {
      if (
        document.activeElement &&
        document.activeElement !== document.body &&
        document.activeElement.isConnected
      )
        return;
      const heading = document.querySelector<HTMLElement>(".main-content h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    });
  }
  function prepare(playlistId?: string, targetContent = false) {
    if (demo) {
      setError(
        "Design fixtures contain no audio. Switch to your real library to prepare files.",
      );
      return;
    }
    setExportPlaylist(playlistId);
    setExportTargetContent(targetContent);
    setModal("export");
  }
  async function drop(e: React.DragEvent) {
    e.preventDefault();
    if (demo) return;
    const paths = await window.tunevault.droppedPaths(
      Array.from(e.dataTransfer.files),
    );
    if (!paths.length) return;
    try {
      startAdd({ kind: "files", paths });
    } catch {
      setStatus("File import failed; see the library error");
    }
  }
  const guardedRun = useCallback(
    async (action: string, input?: unknown) => {
      try {
        return await run(action, input);
      } catch {
        return undefined;
      }
    },
    [run],
  );
  const logo = snapshot.settings.accent === "orange" ? orangeLogo : blueLogo;
  const legalModal = legal && (
    <Modal title={legal.title} wide onClose={() => setLegal(null)}>
      <pre className="legal-text">{legal.text}</pre>
    </Modal>
  );
  if (loading) return <Splash logo={logo} status={status} />;
  if (!consentAccepted)
    return (
      <OperationErrorContext.Provider value={error}>
        <Disclaimer logo={logo} run={run} />
        {legalModal}
      </OperationErrorContext.Provider>
    );
  return (
    <OperationErrorContext.Provider value={error}>
      <div
        className={`app-shell ${current ? "has-inspector" : ""}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDrop={drop}
      >
        <nav className="sidebar" aria-label="Main navigation">
          <div className="brand">
            <img src={logo} alt="" />
            <span>TuneVault</span>
          </div>
          <div className="sidebar-group-label">Collection</div>
          {views.map(([id, label]) => (
            <button
              key={id}
              aria-label={label}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={() => setView(id)}
            >
              <Icon
                name={
                  id === "playlists"
                    ? "playlist"
                    : id === "devices"
                      ? "device"
                      : id
                }
              />
              <span>{label}</span>
              {id === "library" && (
                <small>{tracks.length.toLocaleString()}</small>
              )}
              {id === "activity" && activeJobs.length > 0 && (
                <small>{activeJobs.length}</small>
              )}
            </button>
          ))}
          {snapshot.playlists.length > 0 && (
            <>
              <div className="sidebar-group-label saved-label">Playlists</div>
              <div className="saved-filters sidebar-items">
                {snapshot.playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    className={
                      view === "playlists" &&
                      (playlistId || snapshot.playlists[0]?.id) === playlist.id
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setPlaylistId(playlist.id);
                      setView("playlists");
                    }}
                  >
                    <Icon name="playlist" size={15} />
                    <span>{playlist.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {snapshot.targets.length > 0 && (
            <>
              <div className="sidebar-group-label saved-label">Devices</div>
              <div className="saved-filters sidebar-items">
                {snapshot.targets.map((item) => (
                  <button
                    key={item.id}
                    className={
                      view === "devices" && target?.id === item.id
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setTargetId(item.id);
                      setView("devices");
                    }}
                  >
                    <Icon name="device" size={15} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="sidebar-group-label saved-label">Saved filters</div>
          <div className="saved-filters">
            {filters.map(([value, label]) => (
              <button
                key={value}
                className={
                  view === "library" && filter === value ? "active" : ""
                }
                onClick={() => {
                  setView("library");
                  chooseFilter(value);
                }}
              >
                <span className="filter-dot" />
                {label}
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <button
              aria-label="Settings"
              className={`nav-item ${view === "settings" ? "active" : ""}`}
              onClick={() => setView("settings")}
              aria-current={view === "settings" ? "page" : undefined}
            >
              <Icon name="settings" />
              <span>Settings</span>
            </button>
          </div>
        </nav>
        <main className="main-content" id="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <Icon name="warning" size={17} />
              <span>{error}</span>
              <button
                className="icon-button quiet"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          )}
          {releaseStatus &&
            [
              "available",
              "ready-for-manual-replacement",
              "ready-to-install",
            ].includes(releaseStatus.status) &&
            view !== "settings" && (
              <div className="notice" role="status">
                <span>
                  {releaseStatus.status === "available"
                    ? "Authenticated update available"
                    : "Verified update ready"}
                  {releaseStatus.version ? ` · ${releaseStatus.version}` : ""}
                </span>{" "}
                <button
                  onClick={() => {
                    setSettingsPane("updates");
                    setView("settings");
                  }}
                >
                  Review update…
                </button>
              </div>
            )}
          {demo && (
            <div className="demo-banner">
              <span>
                Design fixtures · fictional artwork · no audio or transfers
              </span>
              <button
                onClick={() => {
                  setDemo(false);
                  setInspected(null);
                  setSelected([]);
                }}
              >
                Return to real library
              </button>
            </div>
          )}
          {view === "library" && (
            <>
              <div className="page-head">
                <div>
                  <h1>Library</h1>
                  <p>
                    {tracks.length.toLocaleString()} track
                    {tracks.length === 1 ? "" : "s"}
                    {tracks.filter(
                      (t) => !t.metadata.title || !t.metadata.artist,
                    ).length
                      ? ` · ${tracks.filter((t) => !t.metadata.title || !t.metadata.artist).length} need tags`
                      : ""}
                  </p>
                </div>
                <div className="button-row">
                  <button disabled={demo} onClick={() => startAdd()}>
                    <Icon name="plus" size={16} />
                    Add music…
                  </button>
                  <button
                    className="primary"
                    onClick={() => prepare()}
                    disabled={!tracks.length || demo}
                  >
                    <Icon name="export" size={16} />
                    Prepare export…
                  </button>
                </div>
              </div>
              {(tracks.length > 0 || demo) && (
                <>
                  <div className="library-tools">
                    <label className="search-box">
                      <Icon name="search" size={16} />
                      <input
                        ref={searchRef}
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search title, artist or album"
                        aria-label="Search library"
                      />
                      <kbd>
                        {window.tunevault.platform === "darwin"
                          ? "⌘ F"
                          : "Ctrl F"}
                      </kbd>
                    </label>
                    <select
                      aria-label="Filter by artist"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                    >
                      <option value="">All artists</option>
                      {[
                        ...new Set(
                          tracks.map((t) => t.metadata.artist).filter(Boolean),
                        ),
                      ]
                        .sort()
                        .map((value) => (
                          <option value={value} key={value}>
                            {value}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="library-subbar">
                    <div className="segmented" aria-label="Library display">
                      <button
                        className={trackView === "tracks" ? "selected" : ""}
                        aria-pressed={trackView === "tracks"}
                        onClick={() => chooseTrackView("tracks")}
                      >
                        <Icon name="playlist" size={15} />
                        Tracks
                      </button>
                      <button
                        className={trackView === "albums" ? "selected" : ""}
                        aria-pressed={trackView === "albums"}
                        onClick={() => chooseTrackView("albums")}
                      >
                        <Icon name="albums" size={15} />
                        Albums
                      </button>
                    </div>
                    <label className="target-select">
                      Export target
                      <select
                        value={target?.id || ""}
                        onChange={(e) => setTargetId(e.target.value)}
                      >
                        <option value="" disabled>
                          No target
                        </option>
                        {snapshot.targets.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}
              {loading ? (
                <Empty title="Opening your library…">
                  Reading the local index.
                </Empty>
              ) : (
                <Library
                  tracks={
                    artist
                      ? tracks.filter((t) => t.metadata.artist === artist)
                      : tracks
                  }
                  selected={selected}
                  setSelected={chooseSelection}
                  inspect={setInspected}
                  target={target}
                  receipts={snapshot.receipts}
                  playlists={snapshot.playlists}
                  filter={filter}
                  search={search}
                  view={trackView}
                  sort={sort}
                  setSort={setSort}
                  onAddMusic={() => startAdd()}
                  hasVault={!!snapshot.settings.vault}
                  onFavorite={(t: Track) =>
                    guardedRun("tracks.favorite", {
                      ids: [t.id],
                      value: !t.favorite,
                    })
                  }
                />
              )}
              {selected.length > 0 && (
                <div className="selection-bar">
                  <span>{selected.length} selected</span>
                  <div className="button-row">
                    <button
                      className="quiet"
                      disabled={!selected.length}
                      onClick={() => setInspected(selected[0])}
                    >
                      <Icon name="panel" size={16} />
                      Show details
                    </button>
                    <button
                      disabled={!selected.length || demo}
                      onClick={() => setModal("batch")}
                    >
                      Edit tags…
                    </button>
                    <button
                      disabled={
                        !selected.length || demo || !snapshot.playlists.length
                      }
                      onClick={() => {
                        setPlaylistChoice(snapshot.playlists[0]?.id || "");
                        setModal("add-playlist");
                      }}
                    >
                      Add to playlist…
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {view === "playlists" && (
            <Playlists
              snapshot={snapshot}
              run={run}
              inspect={setInspected}
              prepare={prepare}
              playlistId={playlistId}
              setPlaylistId={setPlaylistId}
            />
          )}
          {view === "devices" && (
            <Devices
              snapshot={snapshot}
              targetId={targetId}
              setTargetId={setTargetId}
              run={run}
              openSetup={() => setModal("target")}
              prepare={() => prepare(undefined, true)}
            />
          )}
          {view === "activity" && (
            <>
              <div className="page-head">
                <div>
                  <h1>Activity</h1>
                  <p>
                    Imports, downloads and exports. Failed jobs can be retried.
                  </p>
                </div>
                <button onClick={() => startAdd()}>Add music…</button>
              </div>
              {!snapshot.jobs.length ? (
                <Empty icon="activity" title="No jobs yet">
                  Import files or prepare an export to see its progress here.
                </Empty>
              ) : (
                <div className="activity-list">
                  {[...snapshot.jobs].reverse().map((job) => (
                    <article className="job" key={job.id}>
                      <span className="job-icon">
                        <Icon
                          name={
                            job.kind === "export"
                              ? "export"
                              : job.kind === "import"
                                ? "folder"
                                : "music"
                          }
                        />
                      </span>
                      <div className="job-main">
                        <strong>
                          {job.payload.compatibilityTest === true
                            ? "Synthetic compatibility test"
                            : job.kind[0].toUpperCase() +
                              job.kind.slice(1)}{" "}
                          <span
                            className={
                              job.status === "failed" ? "warning" : "muted"
                            }
                          >
                            · {job.status}
                          </span>
                        </strong>
                        <p>{job.message || "Waiting to start"}</p>
                        {Array.isArray(job.payload.failures) &&
                          job.payload.failures.length > 0 && (
                            <details>
                              <summary>
                                {job.payload.failures.length} input failures
                              </summary>
                              <ul className="file-list">
                                {job.payload.failures.map(
                                  (failure: any, index: number) => (
                                    <li key={index}>
                                      {failure.title ||
                                        failure.path?.split(/[\\/]/).pop() ||
                                        `Entry ${failure.ordinal || index + 1}`}{" "}
                                      — {failure.error || "Processing failed"}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </details>
                          )}
                        {job.status === "running" && (
                          <progress
                            max={1}
                            value={
                              job.progress > 1
                                ? job.progress / 100
                                : job.progress
                            }
                            aria-label={`${job.kind} progress`}
                          />
                        )}
                        <span className="small muted">
                          {new Date(job.createdAt).toLocaleString()} · attempt{" "}
                          {job.attempts}
                        </span>
                      </div>
                      <div className="button-row">
                        {["running", "queued"].includes(job.status) && (
                          <button
                            onClick={() =>
                              guardedRun("jobs.cancel", { id: job.id })
                            }
                          >
                            Cancel
                          </button>
                        )}
                        {["failed", "cancelled", "interrupted"].includes(
                          job.status,
                        ) && (
                          <button
                            onClick={() =>
                              guardedRun("jobs.retry", { id: job.id })
                            }
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {view === "settings" && (
            <Settings
              settings={snapshot.settings}
              run={run}
              pane={settingsPane}
              onPane={setSettingsPane}
              onShowGuide={() => setGuide(true)}
              demo={demo}
              setDemo={(value) => {
                setDemo(value);
                setSelected([]);
                setInspected(null);
                if (value) setView("library");
              }}
            />
          )}
          {view === "about" && <About run={run} logo={logo} />}
        </main>
        {current && (
          <Inspector
            key={current.id}
            track={current}
            onClose={() => setInspected(null)}
            run={run}
            onlineAcknowledged={snapshot.settings.onlineAcknowledged}
          />
        )}
        <footer className="status-bar">
          <span className="status-message" role="status" aria-live="polite">
            <i />
            {activeJobs.length
              ? `${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"}`
              : status}
          </span>
        </footer>
        {modal === "add" && (
          <AddDialog
            settings={snapshot.settings}
            run={run}
            initial={addInput}
            onComplete={(kind) => {
              finishSetup();
              setPendingPaths([]);
              setView(kind === "references" ? "playlists" : "activity");
            }}
            onClose={() => {
              setModal(null);
              setAddInput(null);
            }}
          />
        )}
        {modal === "target" && (
          <TargetSetup run={run} onClose={() => setModal(null)} />
        )}
        {modal === "export" && (
          <ExportDialog
            snapshot={snapshot}
            targetId={target?.id || ""}
            trackIds={
              exportTargetContent
                ? undefined
                : selected.length
                  ? selected
                  : snapshot.tracks.map((t) => t.id)
            }
            playlistId={exportPlaylist}
            run={run}
            onClose={() => setModal(null)}
          />
        )}
        {modal === "batch" && selected.length > 0 && (
          <BatchEditor
            tracks={snapshot.tracks.filter((t) => selected.includes(t.id))}
            run={run}
            onClose={() => setModal(null)}
          />
        )}
        {modal === "add-playlist" && (
          <Modal
            title="Add selected tracks to playlist"
            onClose={() => setModal(null)}
            actions={
              <button
                className="primary"
                disabled={!playlistChoice}
                onClick={async () => {
                  await run("playlists.add", {
                    id: playlistChoice,
                    trackIds: selected,
                  });
                  setModal(null);
                }}
              >
                Add {selected.length} occurrences
              </button>
            }
          >
            <label className="field">
              Playlist
              <select
                value={playlistChoice}
                onChange={(e) => setPlaylistChoice(e.target.value)}
              >
                {snapshot.playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="small muted">
              Tracks already present are added as new occurrences. Existing
              order stays intact.
            </p>
          </Modal>
        )}
        {legalModal}
        {setupOpen && (
          <Onboarding
            settings={snapshot.settings}
            logo={logo}
            run={run}
            pendingPaths={pendingPaths}
            onAdd={startAdd}
            onFinish={finishSetup}
          />
        )}
        {tip &&
          !setupOpen &&
          !modal &&
          !legal &&
          !inspected &&
          ((tip === "import" && view === "library") ||
            (tip === "playlist" && view === "playlists") ||
            (tip === "target" && view === "devices")) && (
            <ContextTip
              id={`tip-${tip}`}
              anchor={
                tip === "import"
                  ? ".track-table thead input"
                  : tip === "playlist"
                    ? ".playlist-table thead th"
                    : '[data-help-anchor="target"]'
              }
              onDismiss={() => setTip(null)}
            >
              {tip === "import"
                ? "Select tracks to edit tags in Details."
                : tip === "playlist"
                  ? "Drag rows to reorder."
                  : "Prepare export lists every copy and conversion first."}
            </ContextTip>
          )}
      </div>
    </OperationErrorContext.Provider>
  );
}
