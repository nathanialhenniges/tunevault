import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import SettingsWindow from "./SettingsWindow";
import "./styles.css";

// Only the library window has Liquid Glass; the Settings window is opaque.
document.documentElement.dataset.nativeGlass = String(
  window.tunevault.nativeGlass === true && location.hash !== "#settings",
);
// Platform-specific sizing (Fluent on Windows) and window-chrome spacing.
document.documentElement.dataset.platform = window.tunevault.platform;
const boot = window.tunevault.bootAppearance;
if (boot) {
  document.documentElement.dataset.appearance =
    boot.appearance === "system"
      ? (boot.systemDark ?? matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light"
      : boot.appearance;
  document.documentElement.dataset.accent = boot.accent;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.hash === "#settings" ? <SettingsWindow /> : <App />}
  </React.StrictMode>,
);
