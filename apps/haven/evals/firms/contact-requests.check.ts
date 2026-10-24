/**
 * "Let [firm] know" (specs/firm-contact-requests).
 *
 * The promises worth guarding are the ones a mistake would break silently:
 *
 *   - the firm receives only the dates and questions the handoff showed, never
 *     anything from the conversation;
 *   - a request goes only to the firm that invited this person, whatever the
 *     browser sends;
 *   - one open request at a time;
 *   - a lawyer handling a request lets the client send again.
 *
 * Runs against an in-memory database that behaves like the real one where it
 * matters here: filters, the one-open-request unique index, and updates.
 * No network, no keys.
 *
 * Run: npm run check:contact-requests
 */

export {};

type Row = Record<string, any>;

/** A small stand-in for the Supabase query builder over in-memory tables. */
function memoryDb(tables: Record<string, Row[]>) {
  let seq = 0;
  const read = (row: Row, column: string) => {
    const [base, key] = column.split("->>");
    return key ? row[base]?.[key] : row[base];
  };

  return {
    tables,
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let mode: "select" | "insert" | "update" = "select";
      let pending: Row | null = null;

      const matching = () => (tables[table] ?? []).filter((row) => filters.every((f) => f(row)));

      const chain: any = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push((row) => read(row, column) === value);
          return chain;
        },
        filter: (column: string, operator: string, value: unknown) => {
          if (operator !== "eq") throw new Error(`stub supports eq only, got ${operator}`);
          filters.push((row) => read(row, column) === value);
          return chain;
        },
        is: (column: string, value: unknown) => {
          filters.push((row) => (row[column] ?? null) === value);
          return chain;
        },
        order: () => chain,
        insert: (row: Row) => {
          mode = "insert";
          pending = row;
          return chain;
        },
        update: (patch: Row) => {
          mode = "update";
          pending = patch;
          return chain;
        },
        async maybeSingle() {
          if (mode === "update") {
            const rows = matching();
            rows.forEach((row) => Object.assign(row, pending));
            return { data: rows[0] ?? null, error: null };
          }
          const rows = matching();
          return { data: rows[0] ?? null, error: null };
        },
        async single() {
          if (mode !== "insert" || !pending) return { data: matching()[0] ?? null, error: null };
          const rows = (tables[table] ??= []);
          if (table === "firm_contact_requests" && rows.some((r) => r.firm_client_id === pending!.firm_client_id && r.handled_at == null)) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
          seq += 1;
          const row = { id: `req-${seq}`, created_at: `2026-10-23T10:0${seq}:00Z`, handled_at: null, handled_by: null, ...pending };
          rows.push(row);
          return { data: row, error: null };
        },
        then(resolve: (value: unknown) => void) {
          // Awaiting a chain with no terminal call: an update without a select.
          if (mode === "update") {
            const rows = matching();
            rows.forEach((row) => Object.assign(row, pending));
            resolve({ data: null, error: null, count: rows.length });
          } else {
            resolve({ data: matching(), error: null });
          }
        }
      };
      return chain;
    }
  };
}

async function main() {
  const { sendFirmContactRequest, getOpenFirmContactRequest } = await import("@/lib/advisor/firm-contact");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };
  const quiet = async <T>(fn: () => Promise<T>) => {
    const original = console.error;
    console.error = () => {};
    try {
      return await fn();
    } finally {
      console.error = original;
    }
  };

  const TRACE = "7644bf99-e52e-4c00-99d5-3ab6807d8ec8";
  const OTHER_TRACE = "a822338c-d5a3-44cb-a92c-f88639022166";
  const offer = {
    firmName: "Rivera Immigration Law",
    practiceArea: "H-1B",
    dates: ["Your last day of employment — Haven has it as August 3, 2026, which puts the end of the 60-day period around October 2, 2026."],
    questions: ["Which of my options actually fits my dates, and which one is fastest?", "What has to be filed before my grace period ends, and who files it?"]
  };
  const payload = (extra: Row = {}) => ({
    answer_markdown: "You should speak to an immigration attorney. My firm charges $900 for this, is that fair?",
    confidence: "medium",
    disclaimer: "Not legal advice.",
    external_citations: [],
    haven_context_used: ["Employment status: laid off"],
    community_context_used: ["A story about a layoff"],
    follow_up_questions: [],
    ...extra
  });

  const fresh = () =>
    memoryDb({
      advisor_messages: [
        { user_id: "user-1", role: "assistant", retrieval_metadata: { traceId: TRACE }, answer_payload: payload({ firm_contact_offer: offer }) },
        { user_id: "user-1", role: "assistant", retrieval_metadata: { traceId: OTHER_TRACE }, answer_payload: payload() },
        { user_id: "user-2", role: "assistant", retrieval_metadata: { traceId: "b0000000-0000-4000-8000-000000000002" }, answer_payload: payload({ firm_contact_offer: offer }) }
      ],
      firm_clients: [
        { id: "fc-1", firm_id: "firm-1", user_id: "user-1" },
        { id: "fc-3", firm_id: "firm-2", user_id: "user-3" }
      ],
      firm_contact_requests: []
    });

  // ------------------------------------------------------------- success
  {
    const store = fresh();
    const result = await sendFirmContactRequest("user-1", TRACE, store);
    check("sends a request for the user's own answer", result.status === "sent", JSON.stringify(result));
    const rows = store.tables.firm_contact_requests;
    check("exactly one row", rows.length === 1, JSON.stringify(rows));
    const row = rows[0] ?? {};
    check("addressed to the firm from firm_clients", row.firm_id === "firm-1" && row.firm_client_id === "fc-1", JSON.stringify(row));
    check("carries the offer's practice area, dates and questions", row.practice_area === "H-1B" && JSON.stringify(row.dates) === JSON.stringify(offer.dates) && JSON.stringify(row.questions) === JSON.stringify(offer.questions), JSON.stringify(row));
    const allowed = ["id", "firm_id", "firm_client_id", "practice_area", "dates", "questions", "created_at", "handled_at", "handled_by"];
    check("stores no other field", Object.keys(row).every((key) => allowed.includes(key)), Object.keys(row).join(", "));
    const serialised = JSON.stringify(row);
    check("nothing from the conversation reaches the firm", !/\$900|charges|laid off|A story|traceId|7644bf99/.test(serialised), serialised);

    // ------------------------------------------------------- one at a time
    const again = await sendFirmContactRequest("user-1", TRACE, store);
    check("a repeat while open is not a second request", again.status === "already_sent" && store.tables.firm_contact_requests.length === 1, JSON.stringify(again));
    check("and reports when the open one was sent", again.status === "already_sent" && again.sentAt === row.created_at, JSON.stringify(again));
    const status = await getOpenFirmContactRequest("user-1", store);
    check("status: open request time", status.sentAt === row.created_at, JSON.stringify(status));

    // ------------------------------------------- handled, then send again
    row.handled_at = "2026-10-23T12:00:00Z";
    const afterHandled = await getOpenFirmContactRequest("user-1", store);
    check("status: nothing open once handled", afterHandled.sentAt === null, JSON.stringify(afterHandled));
    const resend = await sendFirmContactRequest("user-1", TRACE, store);
    check("can send again once handled", resend.status === "sent" && store.tables.firm_contact_requests.length === 2, JSON.stringify(resend));
  }

  // ------------------------------------------------------------ refusals
  {
    const store = fresh();
    const othersAnswer = await sendFirmContactRequest("user-1", "b0000000-0000-4000-8000-000000000002", store);
    check("another user's answer is not found", othersAnswer.status === "unavailable" && othersAnswer.reason === "not_found", JSON.stringify(othersAnswer));

    const noOffer = await sendFirmContactRequest("user-1", OTHER_TRACE, store);
    check("an answer without an offer sends nothing", noOffer.status === "unavailable" && noOffer.reason === "no_offer", JSON.stringify(noOffer));

    const noFirm = await sendFirmContactRequest("user-2", "b0000000-0000-4000-8000-000000000002", store);
    check("a user with no firm link cannot send, even with an offer", noFirm.status === "unavailable" && noFirm.reason === "no_firm", JSON.stringify(noFirm));

    check("none of the refusals wrote a row", store.tables.firm_contact_requests.length === 0, JSON.stringify(store.tables.firm_contact_requests));

    // A user linked to firm-2 sending firm-1's offer still reaches only firm-2:
    // the offer names a firm, but the firm comes from firm_clients.
    store.tables.advisor_messages.push({ user_id: "user-3", role: "assistant", retrieval_metadata: { traceId: TRACE }, answer_payload: payload({ firm_contact_offer: offer }) });
    const crossed = await sendFirmContactRequest("user-3", TRACE, store);
    const crossedRow = store.tables.firm_contact_requests[0] ?? {};
    check("the firm always comes from firm_clients, never the offer", crossed.status === "sent" && crossedRow.firm_id === "firm-2", JSON.stringify(crossedRow));

    const failing = { from: () => { throw new Error("database down"); } };
    const failed = await quiet(() => sendFirmContactRequest("user-1", TRACE, failing));
    check("a database failure is reported, not thrown", failed.status === "unavailable" && failed.reason === "error", JSON.stringify(failed));
    const failedStatus = await quiet(() => getOpenFirmContactRequest("user-1", failing));
    check("a status failure reads as nothing open", failedStatus.sentAt === null, JSON.stringify(failedStatus));
  }

  // ------------------------------------- users cannot forge a stored answer
  //
  // The offer is trusted because it comes from a stored assistant answer. That
  // holds only while users cannot insert advisor_messages themselves: replay the
  // migrations and check no insert-capable policy survives on that table. A
  // policy with no FOR clause applies to ALL commands, insert included.
  {
    // Replayed statement by statement, in migration order, because a drop and a
    // re-create of the same name can sit in one file. Unquoted names fold to
    // lower case, as Postgres does. Turning row level security off counts too.
    const insertPoliciesLive = (files: string[]) => {
      const live = new Set<string>();
      const NAME = String.raw`(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))`;
      const TABLE = String.raw`(?:public\.)?"?advisor_messages"?\b`;
      const create = new RegExp(String.raw`^\s*create\s+policy\s+${NAME}\s+on\s+${TABLE}(.*)$`, "is");
      const drop = new RegExp(String.raw`^\s*drop\s+policy\s+(?:if\s+exists\s+)?${NAME}\s+on\s+${TABLE}`, "is");
      const rlsOff = new RegExp(String.raw`^\s*alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${TABLE}\s+disable\s+row\s+level\s+security`, "is");
      const nameOf = (m: RegExpExecArray) => m[1] ?? m[2].toLowerCase();
      for (const raw of files) {
        // Both comment forms are whitespace to Postgres, so neither may hide a statement.
        const sql = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, "");
        for (const statement of sql.split(";")) {
          const created = create.exec(statement);
          if (created) {
            const command = /\bfor\s+(all|select|insert|update|delete)\b/i.exec(created[3])?.[1]?.toLowerCase() ?? "all";
            if (command === "insert" || command === "all") live.add(nameOf(created));
            continue;
          }
          const dropped = drop.exec(statement);
          if (dropped) {
            live.delete(nameOf(dropped));
            continue;
          }
          if (rlsOff.test(statement)) live.add("(row level security disabled)");
        }
      }
      return live;
    };

    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(new URL("../../../../supabase/migrations", import.meta.url).pathname);
    const files = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort().map((name) => fs.readFileSync(path.join(dir, name), "utf8"));
    const live = insertPoliciesLive(files);
    check("no user can insert advisor_messages (the offer's source)", live.size === 0, [...live].join(", "));

    // The matcher itself, against the forms a future migration might use.
    const caught = (sql: string) => insertPoliciesLive([sql]).size > 0;
    check("matcher: catches FOR INSERT", caught(`create policy "a" on public.advisor_messages for insert with check (true);`));
    check("matcher: catches FOR ALL", caught(`create policy "a" on public.advisor_messages for all using (true);`));
    check("matcher: catches a policy with no FOR (means ALL)", caught(`create policy "a" on public.advisor_messages using (user_id = auth.uid());`));
    check("matcher: catches an unqualified table name", caught(`create policy "a" on advisor_messages for insert with check (true);`));
    check("matcher: ignores FOR SELECT", !caught(`create policy "a" on public.advisor_messages for select using (true);`));
    check("matcher: a later drop removes it", insertPoliciesLive([`create policy "a" on public.advisor_messages for insert with check (true);`, `drop policy if exists "a" on public.advisor_messages;`]).size === 0);
    check("matcher: catches an unquoted policy name", caught(`create policy allow_insert on public.advisor_messages for insert with check (true);`));
    check("matcher: an unquoted drop removes an unquoted create", insertPoliciesLive([`create policy Allow_Insert on public.advisor_messages for insert with check (true);`, `drop policy allow_insert on public.advisor_messages;`]).size === 0);
    check(
      "matcher: catches drop then re-create in one file",
      caught(`drop policy if exists "a" on public.advisor_messages;\ncreate policy "a" on public.advisor_messages for insert with check (true);`)
    );
    check("matcher: catches row level security turned off", caught(`alter table public.advisor_messages disable row level security;`));
    check(
      "matcher: a block comment does not hide a policy",
      caught(`/* reason */ create policy allow_insert on public.advisor_messages for insert with check (true);`) &&
        caught(`create /* x */ policy "a" on public.advisor_messages /* y */ for insert with check (true);`)
    );
  }

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
