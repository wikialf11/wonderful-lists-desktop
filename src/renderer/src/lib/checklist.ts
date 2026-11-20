export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: ChecklistItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as { id?: unknown; text?: unknown; done?: unknown };
    const text = typeof item.text === "string" ? item.text : "";
    if (!text.trim()) continue;
    let id = typeof item.id === "string" && item.id ? item.id : crypto.randomUUID();
    if (seen.has(id)) id = crypto.randomUUID();
    seen.add(id);
    items.push({ id, text, done: item.done === true });
  }
  return items;
}

export function checklistProgress(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const done = items.filter((item) => item.done).length;
  return Math.round((done / items.length) * 100);
}

export function newChecklistItem(text: string): ChecklistItem {
  return { id: crypto.randomUUID(), text: text.trim(), done: false };
}
