/**
 * A firm seeing its client's AI chats (specs/advisor-chat-firm-visibility).
 *
 * The promises a mistake would break quietly:
 *   - nothing is shared until the client has been told and agreed;
 *   - a chat started before that stays private, even if continued later;
 *   - a second firm sees only chats started after its own notice;
 *   - a firm the client left sees nothing;
 *   - lawyers get what the client saw, never internal fields;
 *   - a lawyer can reply only to an answer their firm can see, and a deleted
 *     chat leaves the reply without its quote;
 *   - the "AI can make mistakes" label comes from the page, on every answer,
 *     never from the model;
 *   - the send endpoint refuses a firm client who hasn't seen the notice.
 *
 * Runs against an in-memory database. No network, no keys.
 *
 * Run: npm run check:chat-visibility
 */

import { memoryDb, type Row } from "../firms/memory-db";

export {};

const FIRM_A = "a0000000-0000-4000-8000-00000000000a";
const FIRM_B = "b0000000-0000-4000-8000-00000000000b";
const USER = "c0000000-0000-4000-8000-0000000000c1";
const LONER = "c0000000-0000-4000-8000-0000000000c9";

async function main() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { getChatVisibility, acknowledgeChatVisibility, isThreadVisibleToFirm, visibilityNoticeText, visibilityLineText, AI_ANSWER_LABEL_FIRM, AI_ANSWER_LABEL_NO_FIRM } =
    await import("@/lib/advisor/firm-visibility");
  const { listSharedChatsForFirm, isAiAnswerVisibleToFirm } = await import("@/lib/firms/shared-chats");
  const { sendFirmMessage, getFirmConversation } = await import("@/lib/firms/firm-messages");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // ---- the rule
  check("thread after acknowledgement is visible", isThreadVisibleToFirm("2026-11-02T10:00:00Z", "2026-11-02T09:00:00Z"));
  check("thread at the acknowledgement is visible", isThreadVisibleToFirm("2026-11-02T09:00:00Z", "2026-11-02T09:00:00Z"));
  check("thread before acknowledgement is hidden", !isThreadVisibleToFirm("2026-09-02T10:00:00Z", "2026-11-02T09:00:00Z"));
  check("no acknowledgement, nothing visible", !isThreadVisibleToFirm("2026-11-02T10:00:00Z", null));

  // ---- wording
  check(
    "notice says the lawyer sees questions and the AI answers first",
    visibilityNoticeText(["Acme"]) ===
      "Questions you ask here go to your lawyer at Acme. Haven's AI answers first, and your lawyer may follow up to confirm or add to it."
  );
  check("line names both firms", visibilityLineText(["Acme", "Baker"]) === "Your lawyer at Acme and Baker sees these questions. Haven's AI answers first.");
  check("firm client label", AI_ANSWER_LABEL_FIRM === "AI can make mistakes. Your lawyer may reach out to confirm this.");
  check("no-firm label", AI_ANSWER_LABEL_NO_FIRM === "AI can make mistakes. Check important decisions with an immigration lawyer.");

  // ---- data
  let now = "2026-11-02T09:00:00.000Z";
  const tables: Record<string, Row[]> = {
    firms: [
      { id: FIRM_A, name: "Acme Immigration Law" },
      { id: FIRM_B, name: "Baker Visa Partners" }
    ],
    firm_members: [],
    firm_clients: [{ id: "fc-a", firm_id: FIRM_A, user_id: USER, normalized_email: "p@example.com", joined_at: "2026-08-01T00:00:00Z", shared_answers: {} }],
    advisor_firm_visibility_acks: [],
    advisor_threads: [
      { id: "t-old", user_id: USER, title: "September question", created_at: "2026-09-10T12:00:00.000Z" }
    ],
    advisor_messages: [
      { id: "m-old-q", thread_id: "t-old", user_id: USER, role: "user", content: "old private question", created_at: "2026-09-10T12:00:00.000Z" },
      {
        id: "m-old-a",
        thread_id: "t-old",
        user_id: USER,
        role: "assistant",
        content: "old private answer",
        answer_payload: { answer_markdown: "old private answer" },
        retrieval_metadata: { traceId: "secret-trace" },
        created_at: "2026-09-10T12:00:01.000Z"
      }
    ],
    firm_conversations: [],
    firm_messages: []
  };
  const db = memoryDb(tables, () => now);

  const loner = await getChatVisibility(LONER, db);
  check("person without a firm: no notice, nothing shared", loner.firms.length === 0 && !loner.needsNotice);

  const before = await getChatVisibility(USER, db);
  check("firm client must see the notice first", before.needsNotice && before.firms[0]?.firmName === "Acme Immigration Law", JSON.stringify(before));
  check("nothing shared before agreeing", (await listSharedChatsForFirm(FIRM_A, "fc-a", db)).length === 0);

  now = "2026-11-02T09:00:00.000Z";
  const acked = await acknowledgeChatVisibility(USER, db, new Date(now));
  check("agreeing records the time for the firm", !acked.needsNotice && acked.firms[0]?.acknowledgedAt === now, JSON.stringify(acked));
  await acknowledgeChatVisibility(USER, db, new Date("2026-12-01T00:00:00Z"));
  check("agreeing again keeps the first time", tables.advisor_firm_visibility_acks.length === 1 && tables.advisor_firm_visibility_acks[0].acknowledged_at === now);

  // The September chat continues after agreeing: still private.
  tables.advisor_messages.push({ id: "m-old-q2", thread_id: "t-old", user_id: USER, role: "user", content: "follow up in November", created_at: "2026-11-02T10:00:00.000Z" });
  // A new chat after agreeing.
  tables.advisor_threads.push({ id: "t-new", user_id: USER, title: "Job change", created_at: "2026-11-02T11:00:00.000Z" });
  tables.advisor_messages.push(
    { id: "m-new-q", thread_id: "t-new", user_id: USER, role: "user", content: "Can I change jobs?", created_at: "2026-11-02T11:00:00.000Z" },
    {
      id: "m-new-a",
      thread_id: "t-new",
      user_id: USER,
      role: "assistant",
      content: "raw",
      answer_payload: { answer_markdown: "Usually yes, after the transfer is filed." },
      retrieval_metadata: { traceId: "secret-trace-2" },
      created_at: "2026-11-02T11:00:01.000Z"
    },
    { id: "m-sys", thread_id: "t-new", user_id: USER, role: "system", content: "internal note", created_at: "2026-11-02T11:00:02.000Z" }
  );

  db.log.length = 0;
  const shared = await listSharedChatsForFirm(FIRM_A, "fc-a", db);
  check("firm sees only the chat started after agreeing", shared.map((c) => c.id).join(",") === "t-new", JSON.stringify(shared.map((c) => c.id)));
  check(
    "lawyer sees the question and the answer the client saw",
    shared[0]?.messages.map((m) => m.text).join(" | ") === "Can I change jobs? | Usually yes, after the transfer is filed.",
    JSON.stringify(shared[0]?.messages)
  );
  check(
    "no internal fields are read",
    db.log.filter((l) => l.table === "advisor_messages").every((l) => !/retrieval_metadata/.test(l.columns ?? "")),
    JSON.stringify(db.log)
  );
  check("the continued September chat stays private", !JSON.stringify(shared).includes("follow up in November"));
  check("other firms see nothing", (await listSharedChatsForFirm(FIRM_B, "fc-a", db)).length === 0);

  // ---- second firm
  tables.firm_clients.push({ id: "fc-b", firm_id: FIRM_B, user_id: USER, normalized_email: "p@example.com", joined_at: "2026-11-03T00:00:00Z", shared_answers: {} });
  const withB = await getChatVisibility(USER, db);
  check("joining a second firm shows the notice again", withB.needsNotice && withB.firms.length === 2);
  check("the new firm sees nothing before its notice", (await listSharedChatsForFirm(FIRM_B, "fc-b", db)).length === 0);
  now = "2026-11-03T09:00:00.000Z";
  await acknowledgeChatVisibility(USER, db, new Date(now));
  check(
    "the first firm keeps its original time",
    tables.advisor_firm_visibility_acks.find((a) => a.firm_id === FIRM_A)?.acknowledged_at === "2026-11-02T09:00:00.000Z"
  );
  tables.advisor_threads.push({ id: "t-later", user_id: USER, title: "Travel", created_at: "2026-11-04T09:00:00.000Z" });
  tables.advisor_messages.push({ id: "m-later-q", thread_id: "t-later", user_id: USER, role: "user", content: "travel?", created_at: "2026-11-04T09:00:00.000Z" });
  check(
    "the second firm sees only chats after its own notice",
    (await listSharedChatsForFirm(FIRM_B, "fc-b", db)).map((c) => c.id).join(",") === "t-later"
  );
  check(
    "the first firm sees both newer chats",
    (await listSharedChatsForFirm(FIRM_A, "fc-a", db)).map((c) => c.id).sort().join(",") === "t-later,t-new"
  );

  // ---- replying to an answer
  check("firm can reply to a visible answer", await isAiAnswerVisibleToFirm(FIRM_A, "fc-a", "m-new-a", db));
  check("not to an answer in an older private chat", !(await isAiAnswerVisibleToFirm(FIRM_A, "fc-a", "m-old-a", db)));
  check("not to the client's own question", !(await isAiAnswerVisibleToFirm(FIRM_A, "fc-a", "m-new-q", db)));
  check("not to an answer only another firm can see", !(await isAiAnswerVisibleToFirm(FIRM_B, "fc-b", "m-new-a", db)));

  const hiddenReply = await sendFirmMessage(
    FIRM_A,
    { firmClientId: "fc-a", lawyerUserId: "l", lawyerName: "Dana", firmName: "Acme", body: "re", aiAnswerId: "m-old-a" },
    db,
    { send: async () => undefined }
  );
  check("a reply to a private answer is refused", hiddenReply.status === "not_found", JSON.stringify(hiddenReply));

  const reply = await sendFirmMessage(
    FIRM_A,
    { firmClientId: "fc-a", lawyerUserId: "l", lawyerName: "Dana", firmName: "Acme", body: "This isn't right for your case, let's talk Tuesday", aiAnswerId: "m-new-a" },
    db,
    { send: async () => undefined }
  );
  check("a reply to a visible answer is sent", reply.status === "sent", JSON.stringify(reply));
  const conversation = await getFirmConversation(FIRM_A, "fc-a", db);
  const quoted = conversation?.messages.at(-1)?.aiAnswerQuote;
  check(
    "the reply quotes the answer and links to its chat",
    Boolean(quoted && "excerpt" in quoted && quoted.excerpt.startsWith("Usually yes") && quoted.chatId === "t-new"),
    JSON.stringify(quoted)
  );

  // The client deletes the chat: rows go, the foreign key empties the link.
  tables.advisor_messages = tables.advisor_messages.filter((m) => m.thread_id !== "t-new");
  tables.advisor_threads = tables.advisor_threads.filter((t) => t.id !== "t-new");
  for (const m of tables.firm_messages) if (m.advisor_message_id === "m-new-a") m.advisor_message_id = null;
  const afterDelete = await getFirmConversation(FIRM_A, "fc-a", db);
  const deletedQuote = afterDelete?.messages.at(-1)?.aiAnswerQuote;
  check("a deleted chat leaves the reply without its quote", Boolean(deletedQuote && "deleted" in deletedQuote), JSON.stringify(deletedQuote));
  check("the deleted chat is gone from the firm's view", !(await listSharedChatsForFirm(FIRM_A, "fc-a", db)).some((c) => c.id === "t-new"));

  // ---- leaving a firm
  tables.firm_clients = tables.firm_clients.filter((r) => r.id !== "fc-b");
  check("a firm the client left sees nothing", (await listSharedChatsForFirm(FIRM_B, "fc-b", db)).length === 0);

  // ---- rejoining: the old agreement no longer counts
  tables.advisor_threads.push({ id: "t-away", user_id: USER, title: "While away", created_at: "2026-11-10T09:00:00.000Z" });
  tables.advisor_messages.push({ id: "m-away", thread_id: "t-away", user_id: USER, role: "user", content: "asked while not linked to Baker", created_at: "2026-11-10T09:00:00.000Z" });
  tables.firm_clients.push({ id: "fc-b2", firm_id: FIRM_B, user_id: USER, normalized_email: "p@example.com", joined_at: "2026-11-12T00:00:00.000Z", shared_answers: {} });
  const rejoined = await getChatVisibility(USER, db);
  check("rejoining a firm shows the notice again", rejoined.needsNotice && rejoined.firms.find((f) => f.firmName === "Baker Visa Partners")?.acknowledgedAt === null, JSON.stringify(rejoined));
  check("the old agreement exposes nothing after rejoining", (await listSharedChatsForFirm(FIRM_B, "fc-b2", db)).length === 0);
  now = "2026-11-12T10:00:00.000Z";
  await acknowledgeChatVisibility(USER, db, new Date(now));
  check(
    "agreeing again replaces the old agreement",
    tables.advisor_firm_visibility_acks.filter((a) => a.firm_id === FIRM_B).map((a) => a.acknowledged_at).join() === now
  );
  check(
    "chats from while the client was away stay hidden",
    !(await listSharedChatsForFirm(FIRM_B, "fc-b2", db)).some((c) => c.id === "t-away")
  );
  check(
    "the other firm's agreement is untouched",
    tables.advisor_firm_visibility_acks.find((a) => a.firm_id === FIRM_A)?.acknowledged_at === "2026-11-02T09:00:00.000Z"
  );

  // ---- the code that shows and gates
  const root = path.resolve(new URL("../../", import.meta.url).pathname);
  const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
  const workspace = read("src/app/advisor/AdvisorWorkspace.tsx");
  const cards = [...workspace.matchAll(/<AdvisorAnswerCard\b([\s\S]*?)\/>/g)];
  check(
    "every answer card on the chat screen gets the label",
    cards.length >= 2 && cards.every((c) => /aiLabel=\{answerLabel\}/.test(c[1])),
    `${cards.length} cards`
  );
  check("the answer card renders the label whenever the answer is finished", /\{!isPending && \(\s*<p[^>]*data-testid="ai-answer-label"[^>]*>\s*\{aiLabel\}/.test(workspace));
  check("the lawyer's view shows the label", read("src/app/firm/clients/[id]/SharedChatsPanel.tsx").includes("{AI_ANSWER_LABEL_FIRM}"));
  const advisorSources = ["src/lib/advisor/service.ts", "src/lib/advisor/guardrail-registry.ts"].map(read).join("\n");
  check("the label is not in the model's instructions", !/AI can make mistakes/.test(advisorSources));

  const route = read("src/app/api/advisor/respond/route.ts");
  const gate = route.indexOf("getChatVisibility(user.id)");
  const stream = route.indexOf("streamAdvisorResponse(body)");
  check("the send endpoint checks the notice before answering", gate > 0 && stream > gate && /needs_notice/.test(route.slice(gate, stream)));
  check("the send endpoint fails closed when it can't check", /status: 503/.test(route.slice(gate, stream)));

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

void main();
