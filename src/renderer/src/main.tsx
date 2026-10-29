import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

document.documentElement.dataset.nativeGlass = String(
  window.tunevault.nativeGlass === true,
);
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
    <App />
  </React.StrictMode>,
);
