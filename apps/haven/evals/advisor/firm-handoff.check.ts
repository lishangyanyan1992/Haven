/**
 * A firm's client is sent back to their firm (specs/advisor-attorney-handoff).
 *
 * attorney-handoff.check.ts tests the block on its own. This one runs the whole
 * answer — the firm lookup, the prompt, the stream, the saved payload — with a
 * stubbed writer, so it proves the firm actually reaches the handoff and the
 * answer the person sees, not just that the builder can produce it.
 *
 * Deterministic: no network, no keys, no model.
 *
 * Run: npm run check:firm-handoff
 */

export {};

for (const key of [
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LANGFUSE_SECRET_KEY",
  "LANGFUSE_PUBLIC_KEY",
  "ADVISOR_TEST_PERSONA"
]) {
  delete process.env[key];
}

async function main() {
  const svc = await import("@/lib/advisor/service");
  const { advisorAnswerPayloadSchema } = await import("@/lib/advisor/schema");
  const { tellsFirmClientToShopForCounsel } = await import("@/lib/advisor/attorney-handoff");
  const { havenSnapshot } = await import("@/lib/repositories/mock-data");
  type FirmLink = import("@/lib/firms/advisor-link").AdvisorFirmLink;
  type Deps = import("@/lib/advisor/service").AdvisorStreamDeps;

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const QUESTION = "I was laid off last week on my H-1B. What should I do before my grace period runs out?";
  const ANSWER = "You have up to 60 days. You should speak to an immigration attorney this week about which filing fits your dates.\n";

  async function run(firm: FirmLink | (() => Promise<FirmLink>), question = QUESTION) {
    let prompt = "";
    let lookups = 0;
    const writer = {
      chat: {
        completions: {
          create: async (args: { messages: Array<{ content: string }> }) => {
            prompt = args.messages.map((message) => message.content).join("\n");
            return (async function* () {
              yield { choices: [{ delta: { content: ANSWER } }] };
            })();
          }
        }
      }
    } as unknown as NonNullable<Deps["chatClient"]>;

    const deps: Deps = {
      loadSnapshot: async () => ({ snapshot: havenSnapshot, contextSource: "mock" as const }),
      moderate: async () => ({ flagged: false, categories: [], distress: false }),
      classifyIntent: (async () => null) as Deps["classifyIntent"],
      chatClient: writer,
      loadFirmLink: async () => {
        lookups += 1;
        return typeof firm === "function" ? firm() : firm;
      }
    };

    let shown = "";
    let done: any = null;
    for await (const event of svc.streamAdvisorResponse({ content: question, history: [] }, deps)) {
      if (event.type === "delta") shown += event.text;
      if (event.type === "replace") shown = event.text;
      if (event.type === "done") done = event;
    }
    const payload = done?.assistantMessage?.answerPayload;
    return { prompt, lookups, shown, payload, saved: payload?.answer_markdown ?? "" };
  }

  const firm = (stage: "new_lead" | "consultation_scheduled" | "contract_signed" | "archived"): FirmLink => ({
    kind: "firm",
    firmId: "firm-1",
    firmName: "Rivera Immigration Law",
    firmClientId: "fc-1",
    pipelineStatus: stage
  });

  // ------------------------------------------------------------ a firm client
  for (const stage of ["new_lead", "consultation_scheduled", "archived", "contract_signed"] as const) {
    const result = await run(firm(stage));
    const signed = stage === "contract_signed";
    check(`${stage}: the firm is looked up once`, result.lookups === 1, `lookups=${result.lookups}`);
    check(`${stage}: saved answer names the firm`, result.saved.includes("Rivera Immigration Law"), result.saved.slice(-600));
    check(`${stage}: no directory in the saved answer`, !result.saved.includes("/lawyers") && !/not a referral/i.test(result.saved), result.saved.slice(-600));
    check(`${stage}: the screen shows exactly the saved answer`, result.shown === result.saved);
    check(
      `${stage}: wording matches the stage`,
      signed ? result.saved.includes("your lawyer at Rivera Immigration Law") : result.saved.includes("the firm that invited you, Rivera Immigration Law") && !/your (lawyer|attorney) at/i.test(result.saved),
      result.saved.slice(-600)
    );
    check(
      `${stage}: payload carries the contact offer`,
      result.payload?.firm_contact_offer?.firmName === "Rivera Immigration Law" && (result.payload?.firm_contact_offer?.questions.length ?? 0) >= 3,
      JSON.stringify(result.payload?.firm_contact_offer)
    );
    check(`${stage}: payload matches the payload schema`, advisorAnswerPayloadSchema.safeParse(result.payload).success);
    check(`${stage}: the prompt tells the model whose client this is`, /Their law firm/.test(result.prompt) && result.prompt.includes("Rivera Immigration Law"), "no firm block in the prompt");
    check(
      `${stage}: the prompt forbids shopping for another attorney and sets the stage wording`,
      /Never tell them to find, hire, retain, compare or shop for an attorney/.test(result.prompt) &&
        (signed ? /your lawyer at Rivera Immigration Law/.test(result.prompt) : /Never call it their lawyer or attorney/.test(result.prompt)),
      result.prompt.split("\n").filter((line) => /Rivera/.test(line)).join("\n")
    );
    check(`${stage}: the prompt says to defer to the firm on conflicts`, /Never say the firm is wrong/.test(result.prompt));
  }

  // ------------------------------------------------------------- no firm
  const none = await run({ kind: "none" });
  check("no firm: today's directory handoff", none.saved.includes("/lawyers?focus=H-1B") || /boutique/.test(none.saved), none.saved.slice(-600));
  check("no firm: no contact offer", none.payload?.firm_contact_offer === undefined, JSON.stringify(none.payload?.firm_contact_offer));
  check("no firm: no firm block in the prompt", !/Their law firm/.test(none.prompt));

  // ------------------------------------------------------------- unknown
  const unknown = await run({ kind: "unknown" });
  check("unknown: no directory", !unknown.saved.includes("/lawyers") && !/boutique|not a referral/i.test(unknown.saved), unknown.saved.slice(-600));
  check("unknown: no contact offer", unknown.payload?.firm_contact_offer === undefined);
  check("unknown: still dates and questions", /Take with you:/.test(unknown.saved) && /Worth asking:/.test(unknown.saved), unknown.saved.slice(-600));

  // A lookup that throws must not take the answer down. The real lookup never
  // throws (it returns unknown), but the seam is guarded the same way.
  const thrown = await run(async () => {
    throw new Error("lookup exploded");
  }).catch((error: Error) => ({ error }));
  check("a throwing lookup does not crash the answer", !("error" in thrown), "error" in thrown ? String(thrown.error) : "");

  // ------------------------------------------- the fixed replies, no model call
  //
  // A declined topic is answered from a fixed text that says "talk to an
  // immigration attorney". For a firm's client it must end at their firm.
  const TRAVEL = "Can I travel to India next month with a pending I-485?";
  const declinedLead = await run(firm("new_lead"), TRAVEL);
  check("declined topic, firm lead: still declined", /don't cover travel/i.test(declinedLead.saved), declinedLead.saved);
  check(
    "declined topic, firm lead: names the firm with the lead wording",
    declinedLead.saved.includes("Take this to the firm that invited you, Rivera Immigration Law."),
    declinedLead.saved
  );
  check("declined topic, firm lead: screen shows exactly the saved reply", declinedLead.shown === declinedLead.saved);
  const declinedSigned = await run(firm("contract_signed"), TRAVEL);
  check(
    "declined topic, signed client: your lawyer at the firm",
    declinedSigned.saved.includes("Take this to your lawyer at Rivera Immigration Law."),
    declinedSigned.saved
  );
  const declinedNone = await run({ kind: "none" }, TRAVEL);
  check("declined topic, no firm: reply unchanged", !/Rivera|Take this to/.test(declinedNone.saved) && /don't cover travel/i.test(declinedNone.saved), declinedNone.saved);
  const declinedUnknown = await run({ kind: "unknown" }, TRAVEL);
  check("declined topic, unknown firm: reply unchanged", declinedUnknown.saved === declinedNone.saved, declinedUnknown.saved);

  // ----------------------------------------------- stored answers stay valid
  const legacy = {
    answer_markdown: "An older answer.",
    confidence: "low",
    disclaimer: "Not legal advice.",
    external_citations: [],
    haven_context_used: [],
    community_context_used: [],
    follow_up_questions: []
  };
  check("an answer saved before this change still parses", advisorAnswerPayloadSchema.safeParse(legacy).success);

  // ------------------------------------------- telling a client to shop around
  const shopping = [
    "You should find an immigration attorney who handles H-1B transfers.",
    "It may be worth hiring a lawyer for this.",
    "Consider looking for another firm if they cannot see you this week.",
    "Shop around before you pay a retainer.",
    "Retain an immigration lawyer before the 60 days run out."
  ];
  for (const text of shopping) check(`flags: "${text}"`, tellsFirmClientToShopForCounsel(text));
  const fine = [
    "Talk to the firm that invited you, Rivera Immigration Law, this week.",
    "Your lawyer at Rivera Immigration Law can confirm the filing date.",
    "An attorney should confirm the exact dates."
  ];
  for (const text of fine) check(`does not flag: "${text}"`, !tellsFirmClientToShopForCounsel(text));

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
