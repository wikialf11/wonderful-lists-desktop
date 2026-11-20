export type TaskTable = {
  columns: string[];
  rows: string[][];
};

export function emptyTaskTable(): TaskTable {
  return {
    columns: ["Columna 1", "Columna 2"],
    rows: [
      ["", ""],
      ["", ""],
    ],
  };
}

export function parseTaskTable(value: unknown): TaskTable | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { columns?: unknown; rows?: unknown };
  if (!Array.isArray(raw.columns)) return null;
  const columns = raw.columns.map((column, index) =>
    typeof column === "string" && column.trim() ? column : `Columna ${index + 1}`,
  );
  if (columns.length === 0) return null;
  const rows = Array.isArray(raw.rows)
    ? raw.rows
        .filter((row): row is unknown[] => Array.isArray(row))
        .map((row) => columns.map((_, index) => (typeof row[index] === "string" ? (row[index] as string) : "")))
    : [];
  return { columns, rows };
}

export function hasTableContent(table: TaskTable | null): boolean {
  if (!table) return false;
  return table.columns.length > 0 && table.rows.some((row) => row.some((cell) => cell.trim() !== ""));
}
