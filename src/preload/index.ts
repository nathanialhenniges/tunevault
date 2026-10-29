import { contextBridge, ipcRenderer, webUtils } from "electron";
const boot = ipcRenderer.sendSync("tunevault:appearance");
ipcRenderer.on("tunevault:materials", (_event, active: boolean) => {
  if (document.documentElement)
    document.documentElement.dataset.nativeGlass = String(active);
});
const invoke = (action: string, input?: unknown) =>
  ipcRenderer.invoke("tunevault:command", action, input);
const onChanged = (callback: () => void) => {
  const listener = () => callback();
  ipcRenderer.on("tunevault:changed", listener);
  return () => ipcRenderer.removeListener("tunevault:changed", listener);
};
contextBridge.exposeInMainWorld("tunevault", {
  runtimeSecurity: {
    sandboxed: process.sandboxed,
    contextIsolated: process.contextIsolated,
  },
  nativeGlass: boot.nativeGlass,
  bootAppearance: boot,
  onSystemThemeChanged: (callback: (dark: boolean) => void) => {
    const listener = (_event: unknown, dark: boolean) => callback(dark);
    ipcRenderer.on("tunevault:system-theme", listener);
    return () => ipcRenderer.removeListener("tunevault:system-theme", listener);
  },
  invoke,
  command: invoke,
  onChanged,
  onChange: onChanged,
  onMenu: (callback: (action: string) => void) => {
    const listener = (_event: unknown, action: string) => callback(action);
    ipcRenderer.on("tunevault:menu", listener);
    return () => ipcRenderer.removeListener("tunevault:menu", listener);
  },
  chooseFiles: () => invoke("chooseImport"),
  chooseFolder: () => invoke("chooseTargetFolder"),
  reveal: (path: string) => invoke("reveal", { path }),
  openExternal: (url: string) => invoke("openExternal", { url }),
  filePath: (file: File) => webUtils.getPathForFile(file),
  droppedPaths: async (files: File[]) => {
    const paths = files
      .map((file) => webUtils.getPathForFile(file))
      .filter(Boolean);
    await ipcRenderer.invoke("tunevault:drop", paths);
    return paths;
  },
});
