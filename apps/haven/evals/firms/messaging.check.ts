/**
 * Client and lawyer messaging (specs/client-lawyer-messaging).
 *
 * The promises a mistake would break quietly:
 *   - one firm never reads or writes another firm's conversation;
 *   - the setup message is sent once per firm, and never when left blank;
 *   - messages are 1 to 5,000 characters;
 *   - alert emails never carry message text, go to the right people, and
 *     come at most once per 15 minutes unless the recipient has read since;
 *   - unread markers clear for the whole firm when one lawyer reads;
 *   - sending never changes a client's stage or urgency.
 *
 * Runs against an in-memory database. No network, no keys.
 *
 * Run: npm run check:messaging
 */

import { memoryDb, type Row } from "./memory-db";

export {};

const FIRM_A = "a0000000-0000-4000-8000-00000000000a";
const FIRM_B = "b0000000-0000-4000-8000-00000000000b";
const USER = "c0000000-0000-4000-8000-0000000000c1";
const OTHER_USER = "c0000000-0000-4000-8000-0000000000c2";

async function main() {
  const { sendClientMessage, sendOnboardingMessages, listClientConversations, markClientConversationRead } = await import(
    "@/lib/firms/client-messages"
  );
  const { getFirmConversation, sendFirmMessage, markFirmConversationRead, firmClientsWithUnreadMessages } = await import(
    "@/lib/firms/firm-messages"
  );
  const { lawyerAlertEmail, clientAlertEmail } = await import("@/lib/firms/message-alerts");
  const { shouldSendAlert, cleanMessageBody } = await import("@/lib/firms/message-core");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  let clock = new Date("2026-11-02T15:00:00.000Z");
  const at = (minutes: number) => new Date(clock.getTime() + minutes * 60_000);
  const setup = () => {
    const tables: Record<string, Row[]> = {
      firms: [
        { id: FIRM_A, name: "Acme Immigration Law" },
        { id: FIRM_B, name: "Baker Visa Partners" }
      ],
      firm_members: [
        { firm_id: FIRM_A, user_id: "lawyer-a1", email: "a1@acme.example" },
        { firm_id: FIRM_A, user_id: "lawyer-a2", email: "a2@acme.example" },
        { firm_id: FIRM_B, user_id: "lawyer-b1", email: "b1@baker.example" }
      ],
      firm_clients: [
        {
          id: "fc-a",
          firm_id: FIRM_A,
          user_id: USER,
          normalized_email: "priya@example.com",
          joined_at: "2026-10-01T00:00:00Z",
          pipeline_status: "new_lead",
          shared_answers: { fullName: "Priya Raman", jobEnded: "yes" }
        },
        {
          id: "fc-b",
          firm_id: FIRM_B,
          user_id: USER,
          normalized_email: "priya@example.com",
          joined_at: "2026-10-05T00:00:00Z",
          pipeline_status: "consult_scheduled",
          shared_answers: { fullName: "Priya Raman" }
        },
        {
          id: "fc-x",
          firm_id: FIRM_A,
          user_id: OTHER_USER,
          normalized_email: "sam@example.com",
          joined_at: "2026-10-01T00:00:00Z",
          pipeline_status: "new_lead",
          shared_answers: {}
        }
      ],
      firm_conversations: [],
      firm_messages: []
    };
    return memoryDb(tables, () => clock.toISOString());
  };
  const mail = () => {
    const sent: { to: string; subject: string; text: string }[] = [];
    return { sent, send: async (m: { to: string; subject: string; text: string }) => void sent.push(m) };
  };

  // ---------------------------------------------------------------- limits
  check("blank message rejected", !cleanMessageBody("   ").ok);
  check("5,001 characters rejected", !cleanMessageBody("x".repeat(5001)).ok);
  check("5,000 characters accepted", cleanMessageBody("x".repeat(5000)).ok);
  {
    const db = setup();
    const result = await sendClientMessage(USER, { firmId: FIRM_A, body: "  " }, db);
    check("an empty send saves nothing", result.status === "invalid" && db.tables.firm_messages.length === 0, JSON.stringify(result));
  }

  // ---------------------------------------------------------------- isolation
  {
    const db = setup();
    const stagesBefore = JSON.stringify(db.tables.firm_clients);
    const box = mail();
    const sent = await sendClientMessage(USER, { firmId: FIRM_A, body: "Can I start a new job before my transfer is approved?" }, db, { send: box.send, now: clock });
    check("client message sent", sent.status === "sent", JSON.stringify(sent));

    const seenByA = await getFirmConversation(FIRM_A, "fc-a", db);
    check("Firm A sees the message", seenByA?.messages.length === 1 && seenByA.messages[0].senderName === "Priya Raman", JSON.stringify(seenByA));
    const seenByB = await getFirmConversation(FIRM_B, "fc-a", db);
    check("Firm B cannot open Firm A's client", seenByB === null, JSON.stringify(seenByB));
    const ownB = await getFirmConversation(FIRM_B, "fc-b", db);
    check("Firm B's own conversation with the same person is empty", ownB?.messages.length === 0, JSON.stringify(ownB));

    const crossWrite = await sendFirmMessage(FIRM_B, { firmClientId: "fc-a", lawyerUserId: "lawyer-b1", lawyerName: "B", firmName: "Baker", body: "hi" }, db, { send: box.send });
    check("Firm B cannot write to Firm A's client", crossWrite.status === "not_found", JSON.stringify(crossWrite));

    const wrongFirm = await sendClientMessage(OTHER_USER, { firmId: FIRM_B, body: "hello" }, db, { send: box.send });
    check("a client can't write to a firm they haven't joined", wrongFirm.status === "not_found", JSON.stringify(wrongFirm));

    check(
      "alerts go only to Firm A's lawyers",
      JSON.stringify(box.sent.map((m) => m.to).sort()) === JSON.stringify(["a1@acme.example", "a2@acme.example"]),
      JSON.stringify(box.sent.map((m) => m.to))
    );
    check(
      "alert emails never include the message",
      box.sent.every((m) => !m.text.includes("new job") && !m.subject.includes("new job")),
      box.sent[0]?.text ?? ""
    );
    check("alert names the client and links to the conversation", box.sent.every((m) => m.subject.includes("Priya Raman") && m.text.includes("/firm/clients/fc-a#messages")));
    check("sending changes no stage or urgency input", JSON.stringify(db.tables.firm_clients) === stagesBefore);
  }

  // ---------------------------------------------------------------- unread + throttle
  {
    clock = new Date("2026-11-02T15:00:00.000Z");
    const db = setup();
    const box = mail();
    for (let i = 0; i < 4; i += 1) {
      clock = at(i === 0 ? 0 : 1);
      await sendClientMessage(USER, { firmId: FIRM_A, body: `message ${i}` }, db, { send: box.send, now: clock });
    }
    const toA1 = box.sent.filter((m) => m.to === "a1@acme.example").length;
    check("four messages in five minutes send one email per lawyer", toA1 === 1 && box.sent.length === 2, `sent ${box.sent.length}`);

    const unread = await firmClientsWithUnreadMessages(FIRM_A, db);
    check("leads list marks the client unread", unread.has("fc-a") && !unread.has("fc-x"), JSON.stringify([...unread]));
    check("the other firm sees no unread marker", !(await firmClientsWithUnreadMessages(FIRM_B, db)).has("fc-a"));

    clock = at(1);
    await markFirmConversationRead(FIRM_A, "fc-a", db, clock);
    check("one lawyer reading clears the marker for the firm", !(await firmClientsWithUnreadMessages(FIRM_A, db)).has("fc-a"));

    clock = at(3);
    await sendClientMessage(USER, { firmId: FIRM_A, body: "one more thing" }, db, { send: box.send, now: clock });
    check(
      "a new message after the lawyer read alerts again",
      box.sent.filter((m) => m.to === "a1@acme.example").length === 2,
      `a1 got ${box.sent.filter((m) => m.to === "a1@acme.example").length}`
    );

    clock = at(20);
    const box2 = mail();
    await sendClientMessage(USER, { firmId: FIRM_A, body: "later" }, db, { send: box2.send, now: clock });
    check("after 15 minutes an unread conversation alerts again", box2.sent.length === 2, `sent ${box2.sent.length}`);
  }

  check("throttle: never alerted", shouldSendAlert({ lastAlertedAt: null, lastReadAt: null, now: new Date() }));
  check(
    "throttle: within 15 minutes, unread",
    !shouldSendAlert({ lastAlertedAt: "2026-11-02T15:00:00Z", lastReadAt: null, now: new Date("2026-11-02T15:10:00Z") })
  );

  // ---------------------------------------------------------------- lawyer reply
  {
    clock = new Date("2026-11-03T09:00:00.000Z");
    const db = setup();
    const box = mail();
    await sendClientMessage(USER, { firmId: FIRM_A, body: "question" }, db, { send: async () => undefined, now: clock });
    clock = at(5);
    const reply = await sendFirmMessage(
      FIRM_A,
      { firmClientId: "fc-a", lawyerUserId: "lawyer-a1", lawyerName: "Dana Ortiz", firmName: "Acme Immigration Law", body: "Yes, once the petition is filed you can start." },
      db,
      { send: box.send, now: clock }
    );
    check("lawyer reply sent", reply.status === "sent", JSON.stringify(reply));
    check("client is emailed", box.sent.length === 1 && box.sent[0].to === "priya@example.com", JSON.stringify(box.sent));
    check("client email has no reply text", !box.sent[0].text.includes("petition") && box.sent[0].subject.includes("Acme Immigration Law"));
    check("client email links to their messages", box.sent[0].text.includes("/dashboard#messages"));

    const conversations = await listClientConversations(USER, db);
    const withA = conversations.find((c) => c.firmId === FIRM_A);
    check("client sees one conversation per firm", conversations.length === 2, `${conversations.length}`);
    check(
      "client sees the reply with the lawyer's name",
      withA?.messages.at(-1)?.senderName === "Dana Ortiz" && withA.messages.at(-1)?.senderRole === "lawyer",
      JSON.stringify(withA?.messages)
    );
    check("client has an unread reply", withA?.hasUnread === true);
    await markClientConversationRead(USER, FIRM_A, db, at(6));
    const afterRead = (await listClientConversations(USER, db)).find((c) => c.firmId === FIRM_A);
    check("opening clears the client's unread marker", afterRead?.hasUnread === false);
  }

  // ---------------------------------------------------------------- onboarding box
  {
    clock = new Date("2026-11-04T09:00:00.000Z");
    const db = setup();
    const box = mail();
    const blank = await sendOnboardingMessages(USER, "   ", db, { send: box.send });
    check("blank setup box sends nothing", blank.length === 0 && db.tables.firm_messages.length === 0);

    const first = await sendOnboardingMessages(USER, "Can I travel while my I-485 is pending?", db, { send: box.send, now: clock });
    check("setup message goes to each firm", first.length === 2 && first.every((r) => r.status === "sent"), JSON.stringify(first));
    check(
      "setup messages are marked as sent during setup",
      db.tables.firm_messages.length === 2 && db.tables.firm_messages.every((m) => m.source === "onboarding")
    );
    const again = await sendOnboardingMessages(USER, "edited text", db, { send: box.send, now: at(1) });
    check(
      "finishing setup again sends nothing new",
      again.every((r) => r.status === "already_sent") && db.tables.firm_messages.length === 2,
      JSON.stringify(again)
    );
  }

  // ---------------------------------------------------------------- email builders take no message text
  const lawyerEmail = lawyerAlertEmail({ clientName: "Priya", firmClientId: "fc-a" });
  const clientEmail = clientAlertEmail({ firmName: "Acme" });
  check("email builders say email has no message", lawyerEmail.text.includes("doesn't include messages") && clientEmail.text.includes("doesn't include messages"));

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

void main();
