/**
 * A small in-memory stand-in for the Supabase query builder, for checks that
 * exercise the messaging and chat-sharing code without a network or keys.
 *
 * Supports what that code uses: select (with a `firms(name)` join), eq, not
 * is-null, in, gte, order, limit, maybeSingle, single, insert, update and
 * upsert, plus the unique rules from migration 0050 that the code relies on.
 */

export type Row = Record<string, any>;

const UNIQUE: Record<string, (a: Row, b: Row) => boolean> = {
  firm_conversations: (a, b) => a.firm_id === b.firm_id && a.firm_client_id === b.firm_client_id,
  firm_messages: (a, b) => a.source === "onboarding" && b.source === "onboarding" && a.conversation_id === b.conversation_id,
  advisor_firm_visibility_acks: (a, b) => a.user_id === b.user_id && a.firm_id === b.firm_id
};

export function memoryDb(tables: Record<string, Row[]>, clock: () => string = () => new Date().toISOString()) {
  let seq = 0;
  const log: { table: string; op: string; columns?: string }[] = [];

  const withJoins = (table: string, columns: string, row: Row) => {
    const out = { ...row };
    if (table === "firm_clients" && /firms\(name\)/.test(columns)) {
      out.firms = (tables.firms ?? []).find((f) => f.id === row.firm_id) ?? null;
    }
    return out;
  };

  return {
    tables,
    log,
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let mode: "select" | "insert" | "update" | "upsert" = "select";
      let columns = "*";
      let pending: Row | Row[] | null = null;
      let upsertOptions: { ignoreDuplicates?: boolean } = {};
      let orderBy: { column: string; ascending: boolean } | null = null;
      let limitTo: number | null = null;
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every((f) => f(row)));

      const run = (): { data: any; error: any } => {
        if (mode === "insert" || mode === "upsert") {
          const items = Array.isArray(pending) ? pending : [pending!];
          const inserted: Row[] = [];
          for (const item of items) {
            const row: Row = { id: item.id ?? `${table}-${++seq}`, created_at: item.created_at ?? clock(), ...item };
            const clash = UNIQUE[table] && rows().find((r) => UNIQUE[table](r, row));
            if (clash) {
              if (mode === "upsert" && upsertOptions.ignoreDuplicates) continue;
              if (mode === "upsert") {
                Object.assign(clash, item);
                inserted.push(clash);
                continue;
              }
              return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
            }
            if (table === "firm_messages" && !(String(row.body ?? "").trim().length >= 1 && String(row.body).trim().length <= 5000)) {
              return { data: null, error: { code: "23514", message: "check constraint" } };
            }
            rows().push(row);
            inserted.push(row);
          }
          log.push({ table, op: mode });
          return { data: inserted, error: null };
        }
        if (mode === "update") {
          const hit = matching();
          hit.forEach((row) => Object.assign(row, pending));
          log.push({ table, op: "update" });
          return { data: hit, error: null };
        }
        log.push({ table, op: "select", columns });
        let out = matching().map((row) => withJoins(table, columns, row));
        if (orderBy) {
          const { column, ascending } = orderBy;
          out = [...out].sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (ascending ? 1 : -1));
        }
        if (limitTo !== null) out = out.slice(0, limitTo);
        return { data: out, error: null };
      };

      const chain: any = {
        select: (cols = "*") => {
          columns = cols;
          return chain;
        },
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return chain;
        },
        not: (column: string, operator: string, value: unknown) => {
          if (operator !== "is" || value !== null) throw new Error("stub supports not(col, 'is', null) only");
          filters.push((row) => row[column] !== null && row[column] !== undefined);
          return chain;
        },
        is: (column: string, value: unknown) => {
          filters.push((row) => (row[column] ?? null) === value);
          return chain;
        },
        in: (column: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]));
          return chain;
        },
        gte: (column: string, value: string) => {
          filters.push((row) => row[column] >= value);
          return chain;
        },
        order: (column: string, options?: { ascending?: boolean }) => {
          orderBy = { column, ascending: options?.ascending !== false };
          return chain;
        },
        limit: (n: number) => {
          limitTo = n;
          return chain;
        },
        insert: (row: Row | Row[]) => {
          mode = "insert";
          pending = row;
          return chain;
        },
        upsert: (row: Row | Row[], options: { ignoreDuplicates?: boolean } = {}) => {
          mode = "upsert";
          pending = row;
          upsertOptions = options;
          return chain;
        },
        update: (patch: Row) => {
          mode = "update";
          pending = patch;
          return chain;
        },
        async maybeSingle() {
          const { data, error } = run();
          return { data: error ? null : (data?.[0] ?? null), error };
        },
        async single() {
          const { data, error } = run();
          if (error) return { data: null, error };
          return data?.[0] ? { data: data[0], error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } };
        },
        then(resolve: (value: { data: any; error: any }) => unknown, reject?: (reason: unknown) => unknown) {
          try {
            return Promise.resolve(resolve(run()));
          } catch (error) {
            return reject ? Promise.resolve(reject(error)) : Promise.reject(error);
          }
        }
      };
      return chain;
    }
  };
}
