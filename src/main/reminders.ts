import { BrowserWindow, Notification, systemPreferences } from "electron";
import { getDueReminders, markReminderSent } from "./localdb";

let timer: NodeJS.Timeout | null = null;
let checking = false;

function permissionStatus(): string | undefined {
  if (process.platform !== "darwin") return undefined;
  try {
    const settings = (systemPreferences as unknown as {
      getNotificationSettings?: () => { authorizationStatus?: string };
    }).getNotificationSettings?.();
    return settings?.authorizationStatus;
  } catch {
    return undefined;
  }
}

function show(title: string, body: string, getWindow: () => BrowserWindow | null): void {
  // Always show an in-app notification. This works even when macOS/Windows
  // block native notifications (unsigned builds, permission denied, etc.).
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("reminder:due", { title, body });
  }

  if (!Notification.isSupported()) {
    console.warn("[reminders] native notifications not supported; using in-app banner");
    return;
  }

  const notification = new Notification({ title, body, silent: false });
  notification.on("click", () => {
    const window = getWindow();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });
  notification.show();
}

/** Fire every reminder whose time has arrived. Returns how many were handled. */
export function checkReminders(getWindow: () => BrowserWindow | null): number {
  if (checking) return 0;
  checking = true;
  try {
    const now = new Date().toISOString();
    const due = getDueReminders(now);
    for (const task of due) {
      show(
        task.list_name ? `Wonderful Lists · ${task.list_name}` : "Wonderful Lists",
        task.name,
        getWindow,
      );
      markReminderSent(task.id, now);
    }
    return due.length;
  } catch (error) {
    console.error("[reminders] check failed", error);
    return 0;
  } finally {
    checking = false;
  }
}

export function startReminderLoop(getWindow: () => BrowserWindow | null): void {
  if (timer) clearInterval(timer);
  checkReminders(getWindow);
  timer = setInterval(() => checkReminders(getWindow), 30_000);
}

export function stopReminderLoop(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export function showTestNotification(getWindow: () => BrowserWindow | null): {
  ok: boolean;
  supported: boolean;
  permission?: string;
} {
  show(
    "Wonderful Lists",
    "Las notificaciones funcionan. Así te avisaremos de tus recordatorios.",
    getWindow,
  );
  return {
    ok: true,
    supported: Notification.isSupported(),
    ...(permissionStatus() ? { permission: permissionStatus() } : {}),
  };
}
