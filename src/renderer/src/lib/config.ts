const desktop = typeof window !== "undefined" ? window.desktop : undefined;

export const appVersion = desktop?.appVersion ?? "0.0.0";
export const platform = desktop?.platform ?? "web";
export const isDesktop = Boolean(desktop);

export function openExternal(url: string): void {
  if (desktop) {
    void desktop.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
