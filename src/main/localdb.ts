import { app, BrowserWindow, shell } from "electron";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

/**
 * Local, single-user storage. The whole app runs on the user's machine:
 * SQLite lives in `userData/wonderful-lists.db` and attachments in
 * `userData/attachments`. No network, no accounts, no Supabase.
 */

// Electron 45 bundles Node 24, which exposes the built-in SQLite module.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      all: (...params: unknown[]) => Record<string, unknown>[];
      get: (...params: unknown[]) => Record<string, unknown> | undefined;
      run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
    };
    close: () => void;
  };
};

export const LOCAL_USER_ID = "local-user";
export const LOCAL_USER_EMAIL = "local@wonderful.local";

type TableMeta = {
  columns: string[];
  json: string[];
  bool: string[];
  defaults: Record<string, unknown>;
};

const TABLES: Record<string, TableMeta> = {
  lists: {
    columns: [
      "id", "owner_id", "name", "description", "bg_color", "ink_color", "position",
      "members_can_edit", "is_open", "locked", "created_at", "updated_at",
    ],
    json: [],
    bool: ["members_can_edit", "is_open", "locked"],
    defaults: {
      owner_id: LOCAL_USER_ID,
      description: null,
      bg_color: "#ffffff",
      ink_color: "#000000",
      position: 0,
      members_can_edit: false,
      is_open: false,
      locked: false,
    },
  },
  tasks: {
    columns: [
      "id", "list_id", "user_id", "name", "description", "due_date", "created_at", "updated_at",
      "recurrence_days", "recurrence_interval_days", "recurrence_anchor_date", "recurrence_parent_id",
      "assigned_to_email", "completable", "edit_locked", "link", "rating_enabled", "folder_id",
      "completed_at", "reminder_at", "reminder_sent_at", "checklist", "task_files", "table_data",
    ],
    json: ["recurrence_days", "checklist", "task_files", "table_data"],
    bool: ["completable", "edit_locked", "rating_enabled"],
    defaults: {
      user_id: LOCAL_USER_ID,
      description: null,
      due_date: null,
      recurrence_days: [],
      recurrence_interval_days: 0,
      recurrence_anchor_date: null,
      recurrence_parent_id: null,
      assigned_to_email: null,
      completable: false,
      edit_locked: false,
      link: null,
      rating_enabled: false,
      folder_id: null,
      completed_at: null,
      reminder_at: null,
      reminder_sent_at: null,
      checklist: [],
      task_files: [],
      table_data: null,
    },
  },
  task_folders: {
    columns: [
      "id", "list_id", "user_id", "parent_folder_id", "name", "position", "allowed_emails",
      "created_at", "updated_at",
    ],
    json: ["allowed_emails"],
    bool: [],
    defaults: {
      user_id: LOCAL_USER_ID,
      parent_folder_id: null,
      name: "",
      position: 0,
      allowed_emails: [],
    },
  },
  custom_fields: {
    columns: [
      "id", "user_id", "name", "description", "field_type", "icon", "validation", "options",
      "widgets", "locked", "is_official", "is_public", "is_node_graph", "graph_definition",
      "hidden_by_default", "ai_complexity", "ai_prompt", "created_at", "updated_at",
    ],
    json: ["validation", "options", "widgets", "graph_definition"],
    bool: ["locked", "is_official", "is_public", "is_node_graph", "hidden_by_default"],
    defaults: {
      user_id: LOCAL_USER_ID,
      description: null,
      icon: null,
      validation: null,
      options: null,
      widgets: [],
      locked: false,
      is_official: false,
      is_public: false,
      is_node_graph: false,
      graph_definition: null,
      hidden_by_default: false,
      ai_complexity: 0,
      ai_prompt: null,
    },
  },
  task_custom_field_values: {
    columns: ["id", "list_id", "task_id", "custom_field_id", "value", "created_at", "updated_at"],
    json: ["value"],
    bool: [],
    defaults: { value: null },
  },
  task_comments: {
    columns: [
      "id", "task_id", "list_id", "custom_field_id", "parent_id", "author_id",
      "author_email", "body", "created_at",
    ],
    json: [],
    bool: [],
    defaults: {
      parent_id: null,
      author_id: LOCAL_USER_ID,
      author_email: LOCAL_USER_EMAIL,
      body: "",
    },
  },
  node_blueprints: {
    columns: [
      "id", "author_id", "name", "description", "icon", "category", "tags", "graph_definition",
      "is_public", "install_count", "version", "created_at", "updated_at",
    ],
    json: ["tags", "graph_definition"],
    bool: ["is_public"],
    defaults: {
      author_id: LOCAL_USER_ID,
      description: null,
      icon: null,
      category: null,
      tags: [],
      graph_definition: {},
      is_public: false,
      install_count: 0,
      version: 1,
    },
  },
};

const TABLE_ORDER = [
  "lists", "tasks", "task_folders", "custom_fields", "task_custom_field_values", "task_comments", "node_blueprints",
];

type Filter = { op: string; column: string; value?: unknown };
type Order = { column: string; ascending?: boolean };
type LocalQuery = {
  table: string;
  action?: "select" | "insert" | "update" | "delete" | "upsert";
  columns?: string;
  values?: Record<string, unknown> | Record<string, unknown>[];
  filters?: Filter[];
  orders?: Order[];
  limit?: number;
  mode?: "single" | "maybeSingle";
};
type LocalResult = { data: unknown; error: { message: string } | null };

let db: InstanceType<typeof DatabaseSync> | null = null;

const nowIso = () => new Date().toISOString();
const isJson = (table: string, column: string) => TABLES[table]?.json.includes(column) ?? false;
const isBool = (table: string, column: string) => TABLES[table]?.bool.includes(column) ?? false;

function dbFile(): string {
  return join(app.getPath("userData"), "wonderful-lists.db");
}

export function attachmentsDir(): string {
  const dir = join(app.getPath("userData"), "attachments");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function dedupeRecurringInstances(): number {
  const database = getDb();
  const count = (): number => {
    const row = database
      .prepare("SELECT COUNT(*) AS n FROM tasks WHERE recurrence_parent_id IS NOT NULL")
      .get() as { n?: number } | undefined;
    return Number(row?.n ?? 0);
  };
  const before = count();
  database.exec(`
    DELETE FROM tasks
     WHERE recurrence_parent_id IS NOT NULL
       AND rowid NOT IN (
         SELECT MIN(rowid)
           FROM tasks
          WHERE recurrence_parent_id IS NOT NULL
          GROUP BY recurrence_parent_id, due_date
       )
  `);
  return before - count();
}

function createSchema(database: NonNullable<typeof db>): void {
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");

  database.exec(`
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT '${LOCAL_USER_ID}',
      name TEXT NOT NULL,
      description TEXT,
      bg_color TEXT NOT NULL DEFAULT '#ffffff',
      ink_color TEXT NOT NULL DEFAULT '#000000',
      position INTEGER NOT NULL DEFAULT 0,
      members_can_edit INTEGER NOT NULL DEFAULT 0,
      is_open INTEGER NOT NULL DEFAULT 0,
      locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '${LOCAL_USER_ID}',
      name TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      recurrence_days TEXT NOT NULL DEFAULT '[]',
      recurrence_interval_days INTEGER NOT NULL DEFAULT 0,
      recurrence_anchor_date TEXT,
      recurrence_parent_id TEXT,
      assigned_to_email TEXT,
      completable INTEGER NOT NULL DEFAULT 0,
      edit_locked INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      rating_enabled INTEGER NOT NULL DEFAULT 0,
      folder_id TEXT,
      completed_at TEXT,
      reminder_at TEXT,
      reminder_sent_at TEXT,
      checklist TEXT NOT NULL DEFAULT '[]',
      task_files TEXT NOT NULL DEFAULT '[]',
      table_data TEXT
    );

    CREATE TABLE IF NOT EXISTS task_folders (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '${LOCAL_USER_ID}',
      parent_folder_id TEXT,
      name TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      allowed_emails TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '${LOCAL_USER_ID}',
      name TEXT NOT NULL,
      description TEXT,
      field_type TEXT NOT NULL,
      icon TEXT,
      validation TEXT,
      options TEXT,
      widgets TEXT NOT NULL DEFAULT '[]',
      locked INTEGER NOT NULL DEFAULT 0,
      is_official INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 0,
      is_node_graph INTEGER NOT NULL DEFAULT 0,
      graph_definition TEXT,
      hidden_by_default INTEGER NOT NULL DEFAULT 0,
      ai_complexity INTEGER NOT NULL DEFAULT 0,
      ai_prompt TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_custom_field_values (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      custom_field_id TEXT NOT NULL,
      value TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      list_id TEXT NOT NULL,
      custom_field_id TEXT NOT NULL,
      parent_id TEXT,
      author_id TEXT NOT NULL DEFAULT '${LOCAL_USER_ID}',
      author_email TEXT,
      body TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS node_blueprints (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL DEFAULT '${LOCAL_USER_ID}',
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      category TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      graph_definition TEXT NOT NULL DEFAULT '{}',
      is_public INTEGER NOT NULL DEFAULT 0,
      install_count INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(list_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(recurrence_parent_id);
    CREATE INDEX IF NOT EXISTS idx_folders_list ON task_folders(list_id);
    CREATE INDEX IF NOT EXISTS idx_tcfv_task ON task_custom_field_values(task_id);
    CREATE INDEX IF NOT EXISTS idx_tcfv_field ON task_custom_field_values(custom_field_id);
  `);

  // Existing databases get the reminder columns without losing data.
  const taskColumns = database.prepare("PRAGMA table_info(tasks)").all() as Array<{ name?: string }>;
  if (!taskColumns.some((column) => column.name === "reminder_at")) {
    database.exec("ALTER TABLE tasks ADD COLUMN reminder_at TEXT");
  }
  if (!taskColumns.some((column) => column.name === "reminder_sent_at")) {
    database.exec("ALTER TABLE tasks ADD COLUMN reminder_sent_at TEXT");
  }
  if (!taskColumns.some((column) => column.name === "checklist")) {
    database.exec("ALTER TABLE tasks ADD COLUMN checklist TEXT NOT NULL DEFAULT '[]'");
  }
  if (!taskColumns.some((column) => column.name === "task_files")) {
    database.exec("ALTER TABLE tasks ADD COLUMN task_files TEXT NOT NULL DEFAULT '[]'");
  }
  if (!taskColumns.some((column) => column.name === "table_data")) {
    database.exec("ALTER TABLE tasks ADD COLUMN table_data TEXT");
  }

  // Older builds could create the same recurring instance several times per day.
  dedupeRecurringInstances();
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurring_unique
      ON tasks(recurrence_parent_id, due_date)
      WHERE recurrence_parent_id IS NOT NULL;
  `);

  const existing = database.prepare("SELECT COUNT(*) AS n FROM lists").get() as { n: number };
  if (!existing || Number(existing.n) === 0) {
    const now = nowIso();
    database.prepare(
      "INSERT INTO lists (id, owner_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(randomUUID(), LOCAL_USER_ID, "Mi lista", 0, now, now);
  }
}

function migrateLegacyData(): void {
  const current = app.getPath("userData");
  const appData = app.getPath("appData");
  const legacyDirs = [
    join(appData, "wonderful-lists-desktop"),
    join(appData, "wonderful-lists"),
    join(appData, "Wonderful Lists Desktop"),
  ];
  const currentDb = join(current, "wonderful-lists.db");
  if (existsSync(currentDb)) return;

  for (const legacy of legacyDirs) {
    const legacyDb = join(legacy, "wonderful-lists.db");
    if (!existsSync(legacyDb)) continue;
    try {
      mkdirSync(current, { recursive: true });
      // VACUUM INTO produces a consistent copy including the SQLite WAL.
      const source = new DatabaseSync(legacyDb);
      try {
        source.exec(`VACUUM INTO '${currentDb.replaceAll("'", "''")}'`);
      } finally {
        source.close();
      }
      for (const name of ["attachments"]) {
        const path = join(legacy, name);
        if (existsSync(path)) {
          cpSync(path, join(current, name), { recursive: true });
        }
      }
      console.log("[localdb] migrated data from", legacy);
      return;
    } catch (error) {
      console.error("[localdb] legacy migration failed", error);
    }
  }
}

function backupDatabase(database: NonNullable<typeof db>): void {
  try {
    const dir = join(app.getPath("userData"), "backups");
    mkdirSync(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const destination = join(dir, `wonderful-lists-${day}.db`);
    if (!existsSync(destination)) {
      database.exec(`VACUUM INTO '${destination.replaceAll("'", "''")}'`);
    }
    const files = readdirSync(dir)
      .filter((name) => name.endsWith(".db"))
      .sort();
    while (files.length > 7) {
      const oldest = files.shift();
      if (oldest) unlinkSync(join(dir, oldest));
    }
  } catch (error) {
    console.error("[localdb] backup failed", error);
  }
}

export function openDataFolder(): Promise<{ ok: boolean; error?: string }> {
  return shell.openPath(app.getPath("userData")).then((error) => ({
    ok: !error,
    ...(error ? { error } : {}),
  }));
}

export function exportBackup():
  | { ok: true; path: string }
  | { ok: false; error: string } {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const destination = join(app.getPath("downloads"), `Wonderful-Lists-Backup-${stamp}`);
    mkdirSync(destination, { recursive: true });
    const database = getDb();
    const dbDestination = join(destination, "wonderful-lists.db");
    database.exec(`VACUUM INTO '${dbDestination.replaceAll("'", "''")}'`);
    cpSync(attachmentsDir(), join(destination, "attachments"), { recursive: true });
    return { ok: true, path: destination };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function initLocalDb(): void {
  if (db) return;
  migrateLegacyData();
  mkdirSync(app.getPath("userData"), { recursive: true });
  db = new DatabaseSync(dbFile());
  createSchema(db);
  backupDatabase(db);
}

function getDb(): NonNullable<typeof db> {
  if (!db) initLocalDb();
  if (!db) throw new Error("Local database not initialised");
  return db;
}

function hydrate(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const meta = TABLES[table];
  if (!meta) return row;
  const out: Record<string, unknown> = { ...row };
  for (const column of meta.json) {
    const value = out[column];
    if (typeof value === "string") {
      try {
        out[column] = JSON.parse(value);
      } catch {
        out[column] = null;
      }
    }
  }
  for (const column of meta.bool) {
    out[column] = Boolean(out[column]);
  }
  return out;
}

function encode(table: string, column: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (isJson(table, column)) return value === null ? null : JSON.stringify(value);
  if (isBool(table, column)) return value ? 1 : 0;
  return value;
}

function assertTable(table: string): TableMeta {
  const meta = TABLES[table];
  if (!meta) throw new Error(`Tabla local desconocida: ${table}`);
  return meta;
}

function assertColumn(table: string, column: string): void {
  const meta = assertTable(table);
  if (!meta.columns.includes(column)) throw new Error(`Columna desconocida ${table}.${column}`);
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const RELATION_TABLE: Record<string, string> = {
  node_blueprints: "node_blueprints",
  custom_fields: "custom_fields",
  lists: "lists",
  tasks: "tasks",
  task_folders: "task_folders",
};

const RELATION_FK: Record<string, string> = {
  node_blueprints: "blueprint_id",
  custom_fields: "custom_field_id",
  lists: "list_id",
  tasks: "task_id",
  task_folders: "parent_folder_id",
};

type SelectPart =
  | { kind: "star" }
  | { kind: "column"; column: string }
  | { kind: "relation"; alias: string; fk: string; columns: SelectPart[] };

function parseSelect(input: string): SelectPart[] {
  return splitTopLevel(input).map((part) => {
    if (part === "*") return { kind: "star" };

    const explicit = part.match(/^([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)\s*\((.*)\)$/);
    if (explicit) {
      return {
        kind: "relation",
        alias: explicit[1] as string,
        fk: explicit[2] as string,
        columns: parseSelect(explicit[3] as string),
      };
    }

    const implicit = part.match(/^([a-zA-Z0-9_]+)\s*\((.*)\)$/);
    if (implicit) {
      const table = implicit[1] as string;
      return {
        kind: "relation",
        alias: table,
        fk: RELATION_FK[table] ?? `${table.replace(/s$/, "")}_id`,
        columns: parseSelect(implicit[2] as string),
      };
    }

    return { kind: "column", column: part };
  });
}

function project(
  table: string,
  row: Record<string, unknown>,
  ast: SelectPart[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const database = getDb();
  const hydrated = hydrate(table, row);

  for (const part of ast) {
    if (part.kind === "star") {
      Object.assign(out, hydrated);
      continue;
    }
    if (part.kind === "column") {
      out[part.column] = hydrated[part.column] ?? null;
      continue;
    }

    const relationTable = RELATION_TABLE[part.alias] ?? part.alias;
    const meta = TABLES[relationTable];
    if (!meta) {
      out[part.alias] = null;
      continue;
    }
    const fkValue = row[part.fk];
    if (!fkValue) {
      out[part.alias] = null;
      continue;
    }
    const related = database
      .prepare(`SELECT * FROM ${relationTable} WHERE id = ? LIMIT 1`)
      .get(fkValue) as Record<string, unknown> | undefined;
    out[part.alias] = related ? project(relationTable, related, part.columns) : null;
  }

  return out;
}

function buildWhere(table: string, filters: Filter[]): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const filter of filters) {
    assertColumn(table, filter.column);
    const col = filter.column;
    let op = filter.op;
    let value = filter.value;

    if (op === "is") {
      if (value === null) {
        clauses.push(`${col} IS NULL`);
      } else {
        clauses.push(`${col} = ?`);
        params.push(encode(table, col, value));
      }
      continue;
    }

    if (op === "not") {
      // Supabase uses .not(column, "is", null) or .not(column, "eq", value)
      const innerOp = String((filter as unknown as { operator?: string }).operator ?? "");
      void innerOp;
      // The renderer sends the inner operator in `value` for supported cases.
      const payload = filter.value as { operator?: string; value?: unknown } | undefined;
      const inner = payload?.operator ?? "is";
      const innerValue = payload?.value ?? null;
      if (inner === "is" && innerValue === null) {
        clauses.push(`${col} IS NOT NULL`);
      } else if (inner === "eq") {
        clauses.push(`${col} <> ?`);
        params.push(encode(table, col, innerValue));
      } else {
        clauses.push(`${col} IS NOT NULL`);
      }
      continue;
    }

    if (op === "in") {
      const list = Array.isArray(value) ? value : [];
      if (list.length === 0) {
        clauses.push("1 = 0");
      } else {
        clauses.push(`${col} IN (${list.map(() => "?").join(",")})`);
        for (const item of list) params.push(encode(table, col, item));
      }
      continue;
    }

    const sqlOp =
      op === "eq" ? "=" :
      op === "neq" ? "<>" :
      op === "gt" ? ">" :
      op === "gte" ? ">=" :
      op === "lt" ? "<" :
      op === "lte" ? "<=" :
      op === "ilike" ? "LIKE" :
      null;
    if (!sqlOp) continue;

    if (op === "ilike") {
      clauses.push(`LOWER(${col}) LIKE LOWER(?)`);
      params.push(value);
    } else {
      clauses.push(`${col} ${sqlOp} ?`);
      params.push(encode(table, col, value));
    }
    void value;
  }

  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function buildOrder(table: string, orders: Order[]): string {
  if (!orders.length) return "";
  const parts = orders.map((order) => {
    assertColumn(table, order.column);
    return `${order.column} ${order.ascending === false ? "DESC" : "ASC"}`;
  });
  return ` ORDER BY ${parts.join(", ")}`;
}

function prepareRow(table: string, input: Record<string, unknown>): Record<string, unknown> {
  const meta = assertTable(table);
  const row: Record<string, unknown> = {};
  const now = nowIso();

  for (const [key, value] of Object.entries(meta.defaults)) {
    row[key] = value;
  }
  if (meta.columns.includes("id") && !input["id"]) row["id"] = randomUUID();
  if (meta.columns.includes("created_at") && !input["created_at"]) row["created_at"] = now;
  if (meta.columns.includes("updated_at") && !input["updated_at"]) row["updated_at"] = now;

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (!meta.columns.includes(key)) continue;
    row[key] = value;
  }
  return row;
}

function insertRow(table: string, input: Record<string, unknown>): Record<string, unknown> {
  const database = getDb();
  const meta = assertTable(table);
  const row = prepareRow(table, input);
  const columns = Object.keys(row).filter((column) => meta.columns.includes(column));
  const placeholders = columns.map(() => "?").join(", ");
  const values = columns.map((column) => encode(table, column, row[column]));
  database
    .prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`)
    .run(...values);
  return hydrate(table, row);
}

function readRows(table: string, where: string, params: unknown[], order: string, limit?: number) {
  const database = getDb();
  const sql = `SELECT * FROM ${table} ${where}${order}${limit ? ` LIMIT ${Number(limit)}` : ""}`;
  return database.prepare(sql).all(...params) as Record<string, unknown>[];
}

function resultFor(table: string, rows: Record<string, unknown>[], query: LocalQuery): LocalResult {
  const ast = parseSelect(query.columns ?? "*");
  const projected = rows.map((row) => project(table, row, ast));
  if (query.mode === "single") {
    if (projected.length !== 1) {
      return { data: null, error: { message: "Se esperaba una fila y llegaron " + projected.length } };
    }
    return { data: projected[0], error: null };
  }
  if (query.mode === "maybeSingle") {
    return { data: projected[0] ?? null, error: null };
  }
  return { data: projected, error: null };
}

function notify(table: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("localdb:changed", { table });
  }
}

export function executeLocalQuery(raw: unknown): LocalResult {
  try {
    const query = raw as LocalQuery;
    const meta = assertTable(query.table);
    const action = query.action ?? "select";
    const filters = query.filters ?? [];
    const orders = query.orders ?? [];
    const where = buildWhere(query.table, filters);
    const order = buildOrder(query.table, orders);

    if (action === "select") {
      const rows = readRows(query.table, where.sql, where.params, order, query.limit);
      return resultFor(query.table, rows, query);
    }

    if (action === "insert") {
      const inputs = Array.isArray(query.values) ? query.values : [query.values ?? {}];
      const rows = inputs.map((input) => {
        const row = insertRow(query.table, input as Record<string, unknown>);
        return readRows(query.table, "WHERE id = ?", [row["id"]], "").pop() ?? row;
      });
      notify(query.table);
      if (!query.columns) return { data: null, error: null };
      return resultFor(query.table, rows, query);
    }

    if (action === "update") {
      const input = (query.values ?? {}) as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [];
      for (const [column, value] of Object.entries(input)) {
        if (!meta.columns.includes(column) || column === "id") continue;
        sets.push(`${column} = ?`);
        params.push(encode(query.table, column, value));
      }
      if (meta.columns.includes("updated_at")) {
        sets.push("updated_at = ?");
        params.push(nowIso());
      }
      if (!sets.length) return { data: null, error: { message: "Nada que actualizar" } };
      const database = getDb();
      database
        .prepare(`UPDATE ${query.table} SET ${sets.join(", ")} ${where.sql}`)
        .run(...params, ...where.params);
      notify(query.table);
      if (!query.columns) return { data: null, error: null };
      const rows = readRows(query.table, where.sql, where.params, order, query.limit);
      return resultFor(query.table, rows, query);
    }

    if (action === "delete") {
      const database = getDb();
      const existing = readRows(query.table, where.sql, where.params, "");
      database.prepare(`DELETE FROM ${query.table} ${where.sql}`).run(...where.params);
      notify(query.table);
      if (!query.columns) return { data: null, error: null };
      return resultFor(query.table, existing, query);
    }

    if (action === "upsert") {
      const input = (query.values ?? {}) as Record<string, unknown>;
      const row = prepareRow(query.table, input);
      const id = row["id"];
      const existing = readRows(query.table, "WHERE id = ?", [id], "").pop();
      if (existing) {
        const sets: string[] = [];
        const params: unknown[] = [];
        for (const [column, value] of Object.entries(row)) {
          if (column === "id" || !meta.columns.includes(column)) continue;
          sets.push(`${column} = ?`);
          params.push(encode(query.table, column, value));
        }
        getDb().prepare(`UPDATE ${query.table} SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
      } else {
        insertRow(query.table, row);
      }
      notify(query.table);
      const saved = readRows(query.table, "WHERE id = ?", [id], "").pop() ?? row;
      if (!query.columns) return { data: null, error: null };
      return resultFor(query.table, [saved], query);
    }

    return { data: null, error: { message: `Acción no soportada: ${action}` } };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
  }
}

function recurringTodayUtc(): { date: Date; dow: number; start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { date: start, dow: start.getUTCDay(), start: start.toISOString(), end: end.toISOString() };
}

export type DueReminder = {
  id: string;
  name: string;
  reminder_at: string;
  list_name: string | null;
};

export function getDueReminders(now: string): DueReminder[] {
  const database = getDb();
  return database
    .prepare(`
      SELECT t.id, t.name, t.reminder_at, l.name AS list_name
        FROM tasks t
        LEFT JOIN lists l ON l.id = t.list_id
       WHERE t.reminder_at IS NOT NULL
         AND t.reminder_sent_at IS NULL
         AND t.completed_at IS NULL
         AND t.reminder_at <= ?
       ORDER BY t.reminder_at ASC
       LIMIT 20
    `)
    .all(now) as DueReminder[];
}

export function markReminderSent(id: string, at: string): void {
  getDb()
    .prepare("UPDATE tasks SET reminder_sent_at = ?, updated_at = ? WHERE id = ?")
    .run(at, at, id);
}

export function executeLocalRpc(name: string, args: unknown): LocalResult {
  try {
    if (name === "generate_recurring_tasks") {
      const database = getDb();
      const { date, dow, end } = recurringTodayUtc();
      dedupeRecurringInstances();
      const templates = database
        .prepare("SELECT * FROM tasks WHERE recurrence_parent_id IS NULL")
        .all()
        .map((row) => hydrate("tasks", row));
      let created = 0;

      for (const raw of templates) {
        const days = Array.isArray(raw["recurrence_days"]) ? (raw["recurrence_days"] as number[]) : [];
        const interval = Number(raw["recurrence_interval_days"] ?? 0);
        const anchor = typeof raw["recurrence_anchor_date"] === "string" ? raw["recurrence_anchor_date"] : null;
        let qualifies = days.includes(dow);
        if (!qualifies && interval > 0 && anchor) {
          const anchorDate = new Date(`${anchor}T00:00:00Z`);
          const diff = Math.round((date.getTime() - anchorDate.getTime()) / 86400000);
          qualifies = diff >= 0 && diff % interval === 0;
        }
        if (!qualifies) continue;

        // The instance date is deterministic: end of today for all-day
        // templates, or today at the template's time for time-only templates.
        let due = end;
        if (typeof raw["due_date"] === "string") {
          const dueTemplate = new Date(raw["due_date"]);
          if (dueTemplate.getUTCFullYear() === 1970) {
            const withTime = new Date(Date.UTC(
              date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
              dueTemplate.getUTCHours(), dueTemplate.getUTCMinutes(), 0,
            ));
            due = withTime.toISOString();
          }
        }

        // Exact match: the old range check missed all-day instances because
        // they were stored at the next midnight, so every run added another.
        const existing = database
          .prepare("SELECT id FROM tasks WHERE recurrence_parent_id = ? AND due_date = ? LIMIT 1")
          .get(raw["id"], due);
        if (existing) continue;

        try {
          const checklist = Array.isArray(raw["checklist"])
            ? (raw["checklist"] as Array<Record<string, unknown>>).map((item) => ({
                ...item,
                id: randomUUID(),
                done: false,
              }))
            : [];
          insertRow("tasks", {
            ...raw,
            id: undefined,
            created_at: undefined,
            updated_at: undefined,
            due_date: due,
            recurrence_parent_id: raw["id"],
            recurrence_days: [],
            recurrence_interval_days: 0,
            completed_at: null,
            reminder_at: null,
            reminder_sent_at: null,
            checklist,
          });
          created += 1;
        } catch {
          // Unique index safety net: another run already created this instance.
        }
      }
      if (created) notify("tasks");
      return { data: created, error: null };
    }

    if (name === "get_user_email") {
      return { data: LOCAL_USER_EMAIL, error: null };
    }
    if (name === "has_premium_access") {
      return { data: true, error: null };
    }
    if (name === "get_trial_ends_at") {
      return { data: null, error: null };
    }
    if (name === "get_list_members_with_emails") {
      return {
        data: [{ user_id: LOCAL_USER_ID, email: LOCAL_USER_EMAIL, is_owner: true }],
        error: null,
      };
    }

    void args;
    return { data: null, error: { message: `RPC local no implementada: ${name}` } };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
  }
}

function safeAttachmentPath(relativePath: string): string | null {
  const root = attachmentsDir();
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((part) => part === ".." || part === "")) return null;
  const full = resolve(root, normalized);
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

export function saveLocalAttachment(
  relativePath: string,
  data: ArrayBuffer | Uint8Array,
): { ok: true } | { ok: false; error: string } {
  const full = safeAttachmentPath(relativePath);
  if (!full) return { ok: false, error: "Ruta de adjunto no válida" };
  try {
    mkdirSync(dirname(full), { recursive: true });
    const buffer = data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(new Uint8Array(data));
    writeFileSync(full, buffer);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function localAttachmentUrl(relativePath: string): string {
  const encoded = relativePath
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `wl-file://local/${encoded}`;
}

export function resolveLocalAttachmentUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "wl-file:") return null;
    const relative = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
    return safeAttachmentPath(relative);
  } catch {
    return null;
  }
}

export async function openLocalAttachment(relativePath: string): Promise<{ ok: boolean; error?: string }> {
  const full = safeAttachmentPath(relativePath);
  if (!full) return { ok: false, error: "Ruta no válida" };
  if (!existsSync(full)) return { ok: false, error: "El archivo no existe" };
  const error = await shell.openPath(full);
  return error ? { ok: false, error } : { ok: true };
}

export function localDbPath(): string {
  return dbFile();
}

export { TABLE_ORDER };
