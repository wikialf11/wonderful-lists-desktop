/**
 * A small, deliberately local subset of the Supabase JS API.
 *
 * The existing UI was written against `supabase.from(...).select(...)`, so this
 * adapter keeps those call sites unchanged while every query is executed by
 * SQLite in the Electron main process. There is no network and no auth server.
 */

export const LOCAL_USER = {
  id: "local-user",
  email: "local@wonderful.local",
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date(0).toISOString(),
  app_metadata: { provider: "local", providers: ["local"] },
  user_metadata: { email: "local@wonderful.local" },
} as const;

const LOCAL_SESSION = {
  access_token: "local",
  refresh_token: "local",
  token_type: "bearer",
  expires_in: 3600 * 24 * 365,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
  user: LOCAL_USER,
};

type LocalResult = { data: any; error: { message: string } | null };

type FilterPayload =
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "ilike"; column: string; value: unknown }
  | { op: "in"; column: string; value: unknown[] }
  | { op: "is"; column: string; value: null | boolean }
  | { op: "not"; column: string; value: { operator: string; value: unknown } };

type OrderPayload = { column: string; ascending?: boolean };

function fail(message: string): LocalResult {
  return { data: null, error: { message } };
}

class LocalQuery implements PromiseLike<LocalResult> {
  private state = {
    table: "",
    action: "select" as "select" | "insert" | "update" | "delete" | "upsert",
    columns: undefined as string | undefined,
    values: undefined as Record<string, unknown> | Record<string, unknown>[] | undefined,
    filters: [] as FilterPayload[],
    orders: [] as OrderPayload[],
    limit: undefined as number | undefined,
    mode: undefined as "single" | "maybeSingle" | undefined,
  };

  constructor(table: string) {
    this.state.table = table;
  }

  select(columns = "*") {
    this.state.columns = columns;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.state.action = "insert";
    this.state.values = values;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.state.action = "update";
    this.state.values = values;
    return this;
  }

  upsert(values: Record<string, unknown>) {
    this.state.action = "upsert";
    this.state.values = values;
    return this;
  }

  delete() {
    this.state.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.state.filters.push({ op: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.state.filters.push({ op: "neq", column, value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.state.filters.push({ op: "gt", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.state.filters.push({ op: "gte", column, value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.state.filters.push({ op: "lt", column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.state.filters.push({ op: "lte", column, value });
    return this;
  }

  ilike(column: string, value: unknown) {
    this.state.filters.push({ op: "ilike", column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.state.filters.push({ op: "in", column, value: values });
    return this;
  }

  is(column: string, value: null | boolean) {
    this.state.filters.push({ op: "is", column, value });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.state.filters.push({ op: "not", column, value: { operator, value } });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.state.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.state.limit = count;
    return this;
  }

  single() {
    this.state.mode = "single";
    return this;
  }

  maybeSingle() {
    this.state.mode = "maybeSingle";
    return this;
  }

  async run(): Promise<LocalResult> {
    if (!window.desktop?.localDb) return fail("Base de datos local no disponible");
    try {
      const result = (await window.desktop.localDb.query(this.state)) as LocalResult;
      return result ?? fail("Sin respuesta de la base de datos");
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  then<TResult1 = LocalResult, TResult2 = never>(
    onfulfilled?: ((value: LocalResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

type Channel = {
  on: (event: string, filter: unknown, callback: () => void) => Channel;
  subscribe: () => Channel;
  unsubscribe: () => Channel;
};

function createChannel(): Channel {
  const callbacks: Array<() => void> = [];
  let off: (() => void) | null = null;

  const channel: Channel = {
    on(_event, _filter, callback) {
      if (typeof callback === "function") callbacks.push(callback);
      return channel;
    },
    subscribe() {
      if (!off && window.desktop?.onLocalDbChange) {
        off = window.desktop.onLocalDbChange(() => {
          for (const callback of callbacks) callback();
        });
      }
      return channel;
    },
    unsubscribe() {
      off?.();
      off = null;
      return channel;
    },
  };

  return channel;
}

const localFiles = {
  async save(path: string, file: File) {
    if (!window.desktop?.localFiles) return fail("Almacenamiento local no disponible");
    try {
      const buffer = await file.arrayBuffer();
      const result = await window.desktop.localFiles.save(path, buffer);
      if (!result.ok) return fail(result.error ?? "No se pudo guardar el archivo");
      return { data: { path }, error: null } as LocalResult;
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  },
  async url(path: string) {
    if (!window.desktop?.localFiles) return "";
    return window.desktop.localFiles.url(path);
  },
};

export function createLocalClient() {
  return {
    from(table: string) {
      return new LocalQuery(table);
    },
    async rpc(name: string, args?: unknown): Promise<LocalResult> {
      if (!window.desktop?.localDb) return fail("Base de datos local no disponible");
      try {
        return (await window.desktop.localDb.rpc(name, args)) as LocalResult;
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },
    channel(_name: string) {
      return createChannel();
    },
    removeChannel(channel: Channel) {
      channel.unsubscribe();
      return Promise.resolve("ok");
    },
    auth: {
      async getUser() {
        return { data: { user: LOCAL_USER }, error: null };
      },
      async getSession() {
        return { data: { session: LOCAL_SESSION }, error: null };
      },
      onAuthStateChange(callback: (event: string, session: typeof LOCAL_SESSION) => void) {
        setTimeout(() => callback("SIGNED_IN", LOCAL_SESSION), 0);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signOut() {
        return { error: null };
      },
      async updateUser() {
        return { data: { user: LOCAL_USER }, error: null };
      },
      async exchangeCodeForSession() {
        return { data: { session: LOCAL_SESSION }, error: null };
      },
      async verifyOtp() {
        return { data: { session: LOCAL_SESSION }, error: null };
      },
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: File) {
            return localFiles.save(`${bucket}/${path}`, file);
          },
          async createSignedUrl(path: string) {
            const url = await localFiles.url(`${bucket}/${path}`);
            return url
              ? { data: { signedUrl: url }, error: null }
              : fail("No se pudo crear la URL local");
          },
          async remove(paths: string | string[]) {
            void paths;
            return { data: null, error: null };
          },
        };
      },
    },
  };
}
