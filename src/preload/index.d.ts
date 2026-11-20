export type DesktopApi = {
  appVersion: string;
  platform: string;
  getInfo: () => Promise<{ version: string; platform: string; isDev: boolean }>;
  openExternal: (url: string) => Promise<{ ok: boolean }>;
  localDb: {
    query: (query: unknown) => Promise<unknown>;
    rpc: (name: string, args?: unknown) => Promise<unknown>;
  };
  localFiles: {
    save: (path: string, data: ArrayBuffer) => Promise<{ ok: boolean; error?: string }>;
    url: (path: string) => Promise<string>;
    open: (path: string) => Promise<{ ok: boolean; error?: string }>;
  };
  confirm: (message: string) => boolean;
  openDataFolder: () => Promise<{ ok: boolean; error?: string }>;
  exportBackup: () => Promise<{ ok: true; path: string } | { ok: false; error: string }>;
  testNotification: () => Promise<{ ok: boolean; supported?: boolean; permission?: string }>;
  onReminder: (callback: (payload: { title: string; body: string }) => void) => () => void;
  onLocalDbChange: (callback: (payload: { table: string }) => void) => () => void;
  onDeepLink: (callback: (url: string) => void) => () => void;
};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

export {};
