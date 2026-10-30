import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "../../shared/types";
import Settings, { settingsPanes, type SettingsPane } from "./Settings";
import { readLegal } from "./legal";
import { Icon, message, Modal, OperationErrorContext } from "./ui";

// The separate macOS Settings window. It shares the library's IPC, so its
// changes reach the main window through the same change notifications.
export default function SettingsWindow() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [pane, setPane] = useState<SettingsPane>("general"),
    [demo, setDemo] = useState(false),
    [error, setError] = useState(""),
    [legal, setLegal] = useState<{ title: string; text: string } | null>(null),
    [systemDark, setSystemDark] = useState(
      window.tunevault.bootAppearance?.systemDark ??
        matchMedia("(prefers-color-scheme: dark)").matches,
    );
  const refresh = useCallback(
    () =>
      window.tunevault
        .invoke("snapshot")
        .then(setSnapshot)
        .catch((e: unknown) => setError(message(e))),
    [],
  );
  useEffect(() => {
    void refresh();
    return window.tunevault.onChanged(() => void refresh());
  }, [refresh]);
  useEffect(() => window.tunevault.onSystemThemeChanged(setSystemDark), []);
  useEffect(
    () =>
      window.tunevault.onMenu?.((action) => {
        const [kind, detail] = action.split(":");
        if (kind === "settings" && settingsPanes.some(([id]) => id === detail))
          setPane(detail as SettingsPane);
      }),
    [],
  );
  const settings = snapshot?.settings;
  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.appearance =
      settings.appearance === "system"
        ? systemDark
          ? "dark"
          : "light"
        : settings.appearance;
    document.documentElement.dataset.accent = settings.accent;
  }, [settings?.appearance, settings?.accent, systemDark]);
  useEffect(() => {
    document.title =
      settingsPanes.find(([id]) => id === pane)?.[1] || "Settings";
  }, [pane]);
  const run = useCallback(async (action: string, input?: unknown) => {
    if (action !== "settings.update") setError("");
    try {
      if (action === "openLegal") {
        setLegal(await readLegal((input as { document: string }).document));
        return;
      }
      return await window.tunevault.invoke(action, input);
    } catch (e) {
      setError(message(e));
      throw e;
    }
  }, []);
  if (!settings) return null;
  return (
    <OperationErrorContext.Provider value={error}>
      <main className="settings-window">
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
        <Settings
          settings={settings}
          run={run}
          pane={pane}
          onPane={setPane}
          windowed
          onShowGuide={() =>
            void run("window.relay", { action: "welcome" }).catch(() => {})
          }
          demo={demo}
          setDemo={(value) => {
            setDemo(value);
            void run("window.relay", {
              action: value ? "demo:on" : "demo:off",
            }).catch(() => {});
          }}
        />
      </main>
      {legal && (
        <Modal title={legal.title} wide onClose={() => setLegal(null)}>
          <pre className="legal-text">{legal.text}</pre>
        </Modal>
      )}
    </OperationErrorContext.Provider>
  );
}
