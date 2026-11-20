export type TaskFile = {
  id: string;
  path: string;
  name: string;
  contentType: string;
  size: number;
};

export function parseTaskFiles(value: unknown): TaskFile[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const files: TaskFile[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as { id?: unknown; path?: unknown; name?: unknown; contentType?: unknown; size?: unknown };
    if (typeof item.path !== "string" || !item.path) continue;
    let id = typeof item.id === "string" && item.id ? item.id : crypto.randomUUID();
    if (seen.has(id)) id = crypto.randomUUID();
    seen.add(id);
    files.push({
      id,
      path: item.path,
      name: typeof item.name === "string" && item.name ? item.name : item.path.split("/").pop() || "archivo",
      contentType: typeof item.contentType === "string" ? item.contentType : "application/octet-stream",
      size: typeof item.size === "number" && Number.isFinite(item.size) ? item.size : 0,
    });
  }
  return files;
}

export function formatTaskFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function safeTaskFileName(name: string): string {
  const clean = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-");
  const dot = name.lastIndexOf(".");
  const hasExt = dot > 0 && dot < name.length - 1 && name.length - dot <= 12;
  const base = clean(hasExt ? name.slice(0, dot) : name).slice(0, 70) || "archivo";
  const ext = hasExt ? clean(name.slice(dot)).toLowerCase() : "";
  return `${base}${ext}`;
}
