import {
  app,
  BrowserWindow,
  Menu,
  shell,
  session,
  ipcMain,
  dialog,
  protocol,
  type MenuItemConstructorOptions,
} from "electron";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import {
  checkReminders,
  showTestNotification,
  startReminderLoop,
  stopReminderLoop,
} from "./reminders";
import {
  executeLocalQuery,
  executeLocalRpc,
  initLocalDb,
  exportBackup,
  openDataFolder,
  localAttachmentUrl,
  openLocalAttachment,
  resolveLocalAttachmentUrl,
  saveLocalAttachment,
} from "./localdb";

const PROTOCOL = "wonderfullists";
const isDev = !app.isPackaged;

// Must be called before app.whenReady(). Used by local attachments.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "wl-file",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

// Stable data path: updating or reinstalling the app must not lose user data.
app.setName("Wonderful Lists");
app.setPath("userData", join(app.getPath("appData"), "Wonderful Lists"));

let mainWindow: BrowserWindow | null = null;
let pendingDeepLinks: string[] = [];

function resolveAppVersion(): string {
  const candidates = [
    join(app.getAppPath(), "package.json"),
    join(process.cwd(), "package.json"),
    join(app.getAppPath(), "..", "..", "package.json"),
  ];
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as { version?: unknown };
      if (typeof pkg.version === "string" && pkg.version) return pkg.version;
    } catch {
      // try the next candidate
    }
  }
  return app.getVersion();
}

const appVersion = resolveAppVersion();

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function dispatchDeepLink(rawUrl: string): void {
  if (!rawUrl.startsWith(`${PROTOCOL}://`)) return;
  const win = mainWindow;
  if (win && !win.webContents.isDestroyed()) {
    win.webContents.send("deep-link", rawUrl);
    if (win.isMinimized()) win.restore();
    win.focus();
  } else {
    pendingDeepLinks.push(rawUrl);
  }
}

function flushPendingDeepLinks(): void {
  if (!mainWindow) return;
  for (const url of pendingDeepLinks) {
    mainWindow.webContents.send("deep-link", url);
  }
  pendingDeepLinks = [];
}

function registerProtocol(): void {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1] ?? ""]);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
  } catch (error) {
    console.warn("[deep-link] could not register protocol", error);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: "Wonderful Lists",
    backgroundColor: "#F5F1E8",
    autoHideMenuBar: process.platform !== "darwin",
    ...(process.platform === "linux" ? { icon: join(__dirname, "../../build/icon.png") } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      additionalArguments: [
        `--app-version=${encodeURIComponent(appVersion)}`,
        `--app-platform=${process.platform}`,
      ],
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-finish-load", () => {
    flushPendingDeepLinks();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("wl-file://")) {
      const full = resolveLocalAttachmentUrl(url);
      if (full) void shell.openPath(full);
      return { action: "deny" };
    }
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("wl-file://")) {
      event.preventDefault();
      const full = resolveLocalAttachmentUrl(url);
      if (full) void shell.openPath(full);
      return;
    }
    const current = mainWindow?.webContents.getURL() ?? "";
    const sameOrigin = current && (() => {
      try {
        return new URL(url).origin === new URL(current).origin;
      } catch {
        return false;
      }
    })();
    if (!sameOrigin && isSafeExternalUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[renderer] process gone", details.reason);
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (isDev && devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function buildMenu(): void {
  const isMac = process.platform === "darwin";
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Editar",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "Ver",
      submenu: [
        ...(isDev ? [{ role: "reload" as const }, { role: "toggleDevTools" as const }] : []),
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
      ],
    },
    {
      label: "Ventana",
      submenu: [{ role: "minimize" as const }, { role: "close" as const }],
    },
    {
      role: "help",
      label: "Ayuda",
      submenu: [
        {
          label: "Política de privacidad",
          click: () => void shell.openExternal("https://wonderfullists.life/privacy"),
        },
        {
          label: "Términos de uso",
          click: () => void shell.openExternal("https://wonderfullists.life/terms"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function hardenSession(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = new Set(["clipboard-sanitized-write", "clipboard-read"]);
    callback(allowed.has(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === "clipboard-sanitized-write" || permission === "clipboard-read";
  });
}

app.on("second-instance", (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (url) dispatchDeepLink(url);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  dispatchDeepLink(url);
});

app.whenReady().then(() => {
  registerProtocol();
  hardenSession();
  initLocalDb();
  protocol.handle("wl-file", async (request) => {
    const full = resolveLocalAttachmentUrl(request.url);
    if (!full || !existsSync(full)) {
      return new Response("Not found", { status: 404 });
    }
    try {
      const extension = full.split(".").pop()?.toLowerCase() ?? "";
      const mime: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        pdf: "application/pdf",
        txt: "text/plain; charset=utf-8",
        json: "application/json",
        mp4: "video/mp4",
        webm: "video/webm",
        mp3: "audio/mpeg",
        wav: "audio/wav",
      };
      return new Response(new Uint8Array(readFileSync(full)), {
        headers: {
          "content-type": mime[extension] ?? "application/octet-stream",
          "access-control-allow-origin": "*",
        },
      });
    } catch (error) {
      console.error("[wl-file] read error", error);
      return new Response("Error", { status: 500 });
    }
  });
  buildMenu();
  ipcMain.handle("localdb:query", (_event, query: unknown) => {
    const result = executeLocalQuery(query);
    const table = (query as { table?: string } | null)?.table;
    if (table === "tasks") setTimeout(() => checkReminders(() => mainWindow), 100);
    return result;
  });
  ipcMain.handle("localdb:rpc", (_event, name: unknown, args: unknown) => {
    const result = executeLocalRpc(String(name), args);
    if (String(name) === "generate_recurring_tasks") {
      setTimeout(() => checkReminders(() => mainWindow), 100);
    }
    return result;
  });
  ipcMain.on("dialog:confirm", (event, message: unknown) => {
    const options = {
      type: "question" as const,
      buttons: ["Cancelar", "Sí, continuar"],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
      message: typeof message === "string" ? message : "¿Continuar?",
    };
    event.returnValue = mainWindow
      ? dialog.showMessageBoxSync(mainWindow, options) === 1
      : dialog.showMessageBoxSync(options) === 1;
  });
  ipcMain.handle("notifications:test", () => showTestNotification(() => mainWindow));
  ipcMain.handle("localfiles:save", (_event, path: unknown, data: unknown) =>
    saveLocalAttachment(String(path), data as ArrayBuffer),
  );
  ipcMain.handle("localfiles:url", (_event, path: unknown) =>
    localAttachmentUrl(String(path)),
  );
  ipcMain.handle("localfiles:open", (_event, path: unknown) =>
    openLocalAttachment(String(path)),
  );
  ipcMain.handle("data:open-folder", () => openDataFolder());
  ipcMain.handle("backup:export", () => {
    const result = exportBackup();
    if (result.ok) shell.showItemInFolder(result.path);
    return result;
  });
  ipcMain.handle("app:info", () => ({
    version: appVersion,
    platform: process.platform,
    isDev,
  }));
  ipcMain.handle("app:open-external", (_event, url: unknown) => {
    if (typeof url === "string" && isSafeExternalUrl(url)) {
      void shell.openExternal(url);
      return { ok: true };
    }
    return { ok: false };
  });

  createWindow();
  app.setAppUserModelId("life.wonderfullists.desktop");
  startReminderLoop(() => mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopReminderLoop();
});
