import { contextBridge, ipcRenderer } from "electron";

function readArg(prefix: string): string {
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

const appVersion = decodeURIComponent(readArg("--app-version=")) || "0.0.0";
const platform = readArg("--app-platform=") || process.platform;

const api = {
  appVersion,
  platform,
  getInfo: () => ipcRenderer.invoke("app:info") as Promise<{
    version: string;
    platform: string;
    isDev: boolean;
  }>,
  openExternal: (url: string) =>
    ipcRenderer.invoke("app:open-external", url) as Promise<{ ok: boolean }>,
  localDb: {
    query: (query: unknown) => ipcRenderer.invoke("localdb:query", query) as Promise<unknown>,
    rpc: (name: string, args?: unknown) =>
      ipcRenderer.invoke("localdb:rpc", name, args) as Promise<unknown>,
  },
  localFiles: {
    save: (path: string, data: ArrayBuffer) =>
      ipcRenderer.invoke("localfiles:save", path, data) as Promise<{ ok: boolean; error?: string }>,
    url: (path: string) => ipcRenderer.invoke("localfiles:url", path) as Promise<string>,
    open: (path: string) =>
      ipcRenderer.invoke("localfiles:open", path) as Promise<{ ok: boolean; error?: string }>,
  },
  confirm: (message: string) => ipcRenderer.sendSync("dialog:confirm", message) as boolean,
  openDataFolder: () =>
    ipcRenderer.invoke("data:open-folder") as Promise<{ ok: boolean; error?: string }>,
  exportBackup: () =>
    ipcRenderer.invoke("backup:export") as Promise<
      { ok: true; path: string } | { ok: false; error: string }
    >,
  testNotification: () =>
    ipcRenderer.invoke("notifications:test") as Promise<{ ok: boolean; supported?: boolean; permission?: string }>,
  onReminder: (callback: (payload: { title: string; body: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { title: string; body: string }) => callback(payload);
    ipcRenderer.on("reminder:due", listener);
    return () => {
      ipcRenderer.removeListener("reminder:due", listener);
    };
  },
  onLocalDbChange: (callback: (payload: { table: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { table: string }) => callback(payload);
    ipcRenderer.on("localdb:changed", listener);
    return () => {
      ipcRenderer.removeListener("localdb:changed", listener);
    };
  },
  onDeepLink: (callback: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on("deep-link", listener);
    return () => {
      ipcRenderer.removeListener("deep-link", listener);
    };
  },
};

contextBridge.exposeInMainWorld("desktop", api);

export type DesktopApi = typeof api;
