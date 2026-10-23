/**
 * Advisor safety boundaries: profile fallback, router ordering, streamed text.
 *
 * Run with: npm run check:safety-boundary  (from apps/haven)
 *
 * Deterministic. No OpenAI, Supabase or Langfuse: the keys are cleared before the
 * service loads, moderation and the intent router are stubs, and generation takes
 * the built-in fallback path.
 *
 * 1. **No demo data in production.** A failed profile load gives an empty,
 *    explicitly "unavailable" context — never the demo persona — and the answer
 *    says the profile was unavailable, with a professional-review line when the
 *    question is deadline-sensitive.
 * 2. **Safety and scope before the router.** Blocked, pattern-declined, and
 *    self-knowledge messages never call the intent router. Eligible messages call
 *    it exactly once (the unused duplicate "shadow" call is gone).
 * 3. **Nothing unreviewed on screen.** For high-risk answers, streamed text is
 *    held until each unit has been through the same correction pass the final
 *    answer gets, and what the client ends up showing equals the saved answer.
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

const failures: string[] = [];
let passed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const repo = await import("@/lib/repositories/case-compass");
  const svc = await import("@/lib/advisor/service");
  const { guardrailText } = await import("@/lib/advisor/guardrail-registry");
  const { ReviewedStream, StreamView, lastSafeBoundary } = await import("@/lib/advisor/stream-review");
  const { havenSnapshot } = await import("@/lib/repositories/mock-data");

  const demo = havenSnapshot.profile;
  const demoLeaks = [demo.fullName, demo.employerName, demo.priorityDate].filter(Boolean) as string[];

  // --- 1. Profile fallback ---------------------------------------------------

  {
    const silent = () => {};
    const failed = await repo.loadSnapshotWithSource({
      hasSupabase: true,
      loadProfile: async () => {
        throw new Error("supabase down");
      },
      allowMock: true,
      onError: silent
    });
    check("profile load failure -> unavailable", failed.contextSource === "unavailable", failed.contextSource);
    const serialized = JSON.stringify(failed.snapshot);
    for (const leak of demoLeaks) {
      check(`profile load failure carries no demo value "${leak}"`, !serialized.includes(leak));
    }

    const loaded = await repo.loadSnapshotWithSource({
      hasSupabase: true,
      loadProfile: async () => havenSnapshot,
      onError: silent
    });
    check("profile load success -> profile", loaded.contextSource === "profile", loaded.contextSource);

    const prodNoEnv = await repo.loadSnapshotWithSource({ hasSupabase: false, allowMock: false });
    check("production without Supabase -> unavailable, not mock", prodNoEnv.contextSource === "unavailable");

    const devNoEnv = await repo.loadSnapshotWithSource({ hasSupabase: false, allowMock: true });
    check("local development without Supabase -> mock", devNoEnv.contextSource === "mock");

    check("mock blocked in production", !repo.mockDataAllowed({ NODE_ENV: "production" }));
    check("mock allowed in development", repo.mockDataAllowed({ NODE_ENV: "development" }));
    check("mock allowed when NODE_ENV unset (tests, scripts)", repo.mockDataAllowed({}));
    check(
      "mock allowed in production only with explicit opt-in",
      repo.mockDataAllowed({ NODE_ENV: "production", HAVEN_ALLOW_MOCK_DATA: "true" })
    );

    const context = svc.buildAdvisorContext(repo.unavailableSnapshot(), "unavailable");
    check(
      "unavailable context has only the unavailable line",
      context.profileSummary.length === 1 && context.profileSummary[0] === svc.PROFILE_UNAVAILABLE_PROMPT_LINE,
      JSON.stringify(context.profileSummary)
    );
    check(
      "unavailable context has no timeline, signals or grace-period lines",
      context.timelineSummary.length === 0 &&
        context.derivedSignalsSummary.length === 0 &&
        context.gracePeriodSummary.length === 0
    );

    const layoffNotice = svc.buildProfileUnavailableNotice({
      contextSource: "unavailable",
      query: "I was laid off last week, what happens to my H-1B?",
      topics: ["h1b", "layoffs"]
    });
    check(
      "layoff question: notice + professional review",
      Boolean(layoffNotice?.includes(guardrailText("MSG_PROFILE_UNAVAILABLE"))) &&
        Boolean(layoffNotice?.includes(guardrailText("MSG_PROFILE_UNAVAILABLE_REVIEW")))
    );
    check(
      "no notice when the real profile loaded",
      svc.buildProfileUnavailableNotice({ contextSource: "profile", query: "I was laid off", topics: ["layoffs"] }) === null
    );
    check(
      "no notice when personalisation does not matter",
      svc.buildProfileUnavailableNotice({ contextSource: "unavailable", query: "How does Haven work?", topics: ["haven-product"] }) === null
    );
  }

  // --- 1b. Pages and the database loader in production -----------------------

  {
    const fallback = await import("@/lib/repositories/fallback-data");
    const previous = process.env.NODE_ENV;
    const setNodeEnv = (value: string | undefined) => {
      (process.env as Record<string, string | undefined>).NODE_ENV = value;
    };

    setNodeEnv("production");
    try {
      const base = JSON.stringify(fallback.baseSnapshot());
      for (const leak of demoLeaks) {
        check(`production page fallback has no demo value "${leak}"`, !base.includes(leak));
      }
      check("production page fallback is marked unavailable", fallback.isProfileUnavailable(fallback.baseSnapshot().profile));

      const fresh = fallback.emptyProfileSnapshot({ id: "user-123", email: "new@example.com" });
      check("signed-in user with no profile keeps their own id", fresh.profile.id === "user-123" && fresh.profile.email === "new@example.com");
      check("signed-in user with no profile is not 'unavailable'", !fallback.isProfileUnavailable(fresh.profile));
      const freshJson = JSON.stringify(fresh);
      for (const leak of demoLeaks) {
        check(`signed-in user with no profile gets no demo value "${leak}"`, !freshJson.includes(leak));
      }
    } finally {
      setNodeEnv(previous);
    }
    check("development page fallback still uses the demo persona", fallback.baseSnapshot().profile.fullName === demo.fullName);

    // Suggested questions never echo a blank or failed profile, and still classify.
    const blankPrompts = svc.buildSuggestedPrompts(
      { profile: repo.unavailableSnapshot().profile },
      { familiarity: "first-visit", priorConversations: 0, lastTitle: null, lastActiveAt: null }
    );
    check(
      "suggested questions for a blank profile have no placeholders",
      blankPrompts.every((prompt) => !/Not sure|\+\s+path|my\s+\+/.test(prompt)),
      JSON.stringify(blankPrompts)
    );
    for (const prompt of blankPrompts) {
      check(`suggested question classifies: "${prompt}"`, svc.routeAdvisorQuestion({ content: prompt }).currentMatched);
    }

    // Sample emails shown on an empty inbox page never reach the model.
    const noAlias = { ...havenSnapshot, emailAlias: null };
    check(
      "no Haven email address: no email evidence for the model",
      svc.buildAdvisorContext(noAlias, "profile").emailEvidenceSummary.length === 0
    );
    const withAlias = { ...havenSnapshot, emailAlias: "user@in.haven.test" };
    check(
      "Haven email address set: real inbox is used",
      svc.buildAdvisorContext(withAlias, "profile").emailEvidenceSummary.length > 0
    );

    // Blank fields read as "not on file", not as empty values.
    const blankProfile = fallback.emptyProfileSnapshot({ id: "user-123" });
    const blankLines = svc.buildAdvisorContext(
      { ...blankProfile, profile: { ...repo.unavailableSnapshot().profile, id: "user-123" } },
      "profile"
    ).profileSummary;
    check(
      "blank profile fields render as 'not on file'",
      blankLines.includes("Visa type: not on file") && !blankLines.some((line) => /: $/.test(line)),
      JSON.stringify(blankLines)
    );
  }

  // --- Harness for the full stream -------------------------------------------

  type StreamEvent = Awaited<ReturnType<ReturnType<typeof svc.streamAdvisorResponse>["next"]>>["value"];

  async function run(
    question: string,
    options: {
      flagged?: boolean;
      contextSource?: "profile" | "unavailable" | "mock";
      chatClient?: import("@/lib/advisor/service").AdvisorStreamDeps["chatClient"];
    } = {}
  ) {
    let routerCalls = 0;
    const events: StreamEvent[] = [];
    let shown = "";
    const shownHistory: string[] = [];

    const contextSource = options.contextSource ?? "mock";
    const deps = {
      loadSnapshot: async () => ({
        snapshot: contextSource === "unavailable" ? repo.unavailableSnapshot() : havenSnapshot,
        contextSource
      }),
      moderate: async () =>
        options.flagged
          ? { flagged: true, categories: ["harassment"], distress: false }
          : { flagged: false, categories: [], distress: false },
      classifyIntent: (async () => {
        routerCalls += 1;
        return null;
      }) as typeof import("@/lib/advisor/intent-router").classifyIntent,
      ...(options.chatClient !== undefined ? { chatClient: options.chatClient } : {})
    };

    for await (const event of svc.streamAdvisorResponse({ content: question, history: [] }, deps)) {
      events.push(event);
      if (event.type === "delta") shown += event.text;
      if (event.type === "replace") shown = event.text;
      shownHistory.push(shown);
    }

    const done = events.find((event) => event?.type === "done") as
      | Extract<NonNullable<StreamEvent>, { type: "done" }>
      | undefined;
    return { routerCalls, events, shown, shownHistory, done };
  }

  // --- 2. Router ordering ----------------------------------------------------

  {
    const blocked = await run("You are useless and I will hurt someone", { flagged: true });
    check("moderation-blocked message: router not called", blocked.routerCalls === 0, `calls=${blocked.routerCalls}`);
    check(
      "moderation-blocked message: refusal delivered",
      blocked.done?.assistantMessage.content === guardrailText("MSG_MODERATION_REFUSAL")
    );

    const declined: Array<[string, string]> = [
      ["Can I travel to India with a pending I-485?", "travel"],
      ["Can I use AC21 to change jobs with an approved I-140?", "job-change"],
      ["My daughter turns 21 in four months, what happens to her green card?", "cspa"],
      ["I worked without authorization for two months, what do I do?", "work-authorization"]
    ];
    for (const [question, area] of declined) {
      const result = await run(question);
      check(`out-of-scope (${area}): router not called`, result.routerCalls === 0, `calls=${result.routerCalls}`);
      check(
        `out-of-scope (${area}): redirected`,
        Boolean(result.done?.assistantMessage.answerPayload?.refusal_or_escalation_reason?.startsWith("Out of scope")),
        result.done?.assistantMessage.answerPayload?.refusal_or_escalation_reason ?? "no done event"
      );
    }

    const selfKnowledge = await run("What do you know about me?");
    check("self-knowledge question: router not called", selfKnowledge.routerCalls === 0, `calls=${selfKnowledge.routerCalls}`);

    const inScope = await run("I was laid off last week, what happens to my H-1B?");
    check("in-scope question: router called exactly once", inScope.routerCalls === 1, `calls=${inScope.routerCalls}`);

    const unrecognised = await run("hmm ok so what about the thing we discussed");
    check("unrecognised question: router still called (rescue)", unrecognised.routerCalls === 1, `calls=${unrecognised.routerCalls}`);
  }

  // --- 1 (end to end). Production failure path -------------------------------

  {
    const result = await run("I was laid off last week, what happens to my H-1B?", { contextSource: "unavailable" });
    const answer = result.done?.assistantMessage.answerPayload?.answer_markdown ?? "";
    check(
      "unavailable profile: answer opens with the notice",
      answer.startsWith(guardrailText("MSG_PROFILE_UNAVAILABLE")),
      answer.slice(0, 120)
    );
    check(
      "unavailable profile: deadline question recommends professional review",
      answer.includes(guardrailText("MSG_PROFILE_UNAVAILABLE_REVIEW"))
    );
    check(
      "unavailable profile: model instruction never shown to the user",
      !answer.includes(svc.PROFILE_UNAVAILABLE_PROMPT_LINE) &&
        !(result.done?.assistantMessage.answerPayload?.haven_context_used ?? []).includes(svc.PROFILE_UNAVAILABLE_PROMPT_LINE)
    );
    for (const leak of demoLeaks) {
      check(`unavailable profile: answer has no demo value "${leak}"`, !answer.includes(leak));
    }
    check("unavailable profile: screen matches the saved answer", result.shown === answer);

    const disclosure = await run("What do you know about me?", { contextSource: "unavailable" });
    check(
      "unavailable profile: 'what do you know about me' says it could not load",
      disclosure.done?.assistantMessage.content === guardrailText("MSG_PROFILE_UNAVAILABLE_DISCLOSURE")
    );
  }

  // --- 3. Streaming boundary -------------------------------------------------

  {
    const question = "I was laid off last week, what happens to my H-1B?";
    const topics = svc.routeAdvisorQuestion({ content: question }).topics;
    check("layoff question needs streamed review", svc.highRiskReviewApplies(question, topics));

    const review = (text: string) => svc.normalizeHighRiskAnswer(question, topics, text, null);
    const unsafe = [/\d+\s+days?\s+left/i, /Temporary unpaid position/i, /\d+ days\s*\nleft/i];
    const modelText = [
      "I'm sorry this happened, and here is what matters first.",
      "You have about 45 days left in your grace period, so act quickly.",
      "- **Temporary unpaid position**: you could volunteer at a startup while you look.",
      "There are 30 days",
      "left in the grace period for you to find a sponsor.",
      "Talk to an immigration attorney this week.",
      ""
    ].join("\n");

    for (const chunkSize of [1, 3, 7, 40]) {
      const reviewed = new ReviewedStream(review, true);
      const view = new StreamView();
      let everUnsafe = false;
      for (let i = 0; i < modelText.length; i += chunkSize) {
        view.append(reviewed.push(modelText.slice(i, i + chunkSize)));
        if (unsafe.some((pattern) => pattern.test(view.text))) everUnsafe = true;
      }
      const final = review(reviewed.rawText);
      view.syncTo(final);
      check(`chunk ${chunkSize}: no uncorrected sentence ever on screen`, !everUnsafe);
      check(`chunk ${chunkSize}: final screen equals reviewed answer`, view.text === final);
      check(`chunk ${chunkSize}: corrections applied`, !unsafe.some((pattern) => pattern.test(final)));
    }

    // Something is released before the end, so review does not mean "wait for
    // the whole answer".
    {
      const reviewed = new ReviewedStream(review, true);
      const firstRelease = reviewed.push("I'm sorry this happened.\nNext, ");
      check("reviewed stream releases complete sentences early", firstRelease === "I'm sorry this happened.", JSON.stringify(firstRelease));
    }

    // Low-risk answers are not held back at all.
    {
      const lowRiskQuestion = "What is an H-1B specialty occupation?";
      const lowTopics = svc.routeAdvisorQuestion({ content: lowRiskQuestion }).topics;
      check("low-risk question streams without review", !svc.highRiskReviewApplies(lowRiskQuestion, lowTopics));
      const passthrough = new ReviewedStream((text) => text, false);
      check("pass-through releases immediately", passthrough.push("A specialty occ") === "A specialty occ");
    }

    check("boundary excludes the trailing line break", lastSafeBoundary("One.\nTwo") === 4);
    check("no boundary without a full stop and line break", lastSafeBoundary("One two three\n") === 0);

    const view = new StreamView();
    view.append("abc");
    const replaced = view.syncTo("xyz");
    check("view sends replace when shown text changed", replaced?.type === "replace" && replaced.text === "xyz");
    const tail = view.syncTo("xyz!");
    check("view sends only the missing tail", tail?.type === "delta" && tail.text === "!");
  }

  // --- 4. Declined part of an in-scope question --------------------------------
  //
  // A layoff question that names PERM is answered with a one-line PERM aside on
  // top (scope.ts, ASIDE_ON_STRONG_IN_SCOPE). The aside has to survive every way
  // the answer can be produced — a normal stream, a writer that fails mid-way,
  // and no writer at all — and the writer must be told to leave PERM out.

  {
    const aside = guardrailText("MSG_SCOPE_PERM_ASIDE");
    const question =
      "I was laid off today. My old employer had started PERM but it's still pending. Should I keep looking for jobs or switch to H-4?";

    let promptSeen = "";
    const stubWriter = {
      chat: {
        completions: {
          create: async (args: { messages: Array<{ role: string; content: string }> }) => {
            promptSeen = args.messages.map((message) => message.content).join("\n");
            return (async function* () {
              for (const text of ["You can keep looking while a new employer files.\n", "Switching to H-4 is the other path.\n"]) {
                yield { choices: [{ delta: { content: text } }] };
              }
            })();
          }
        }
      }
    } as unknown as NonNullable<import("@/lib/advisor/service").AdvisorStreamDeps["chatClient"]>;

    const failingWriter = {
      chat: {
        completions: {
          create: async () =>
            (async function* () {
              yield { choices: [{ delta: { content: "A partial sentence.\n" } }] };
              throw new Error("stream dropped");
            })()
        }
      }
    } as unknown as NonNullable<import("@/lib/advisor/service").AdvisorStreamDeps["chatClient"]>;

    const paths: Array<[string, import("@/lib/advisor/service").AdvisorStreamDeps["chatClient"]]> = [
      ["writer succeeds", stubWriter],
      ["writer fails mid-stream", failingWriter],
      ["no writer", null]
    ];

    for (const [label, chatClient] of paths) {
      const result = await run(question, { chatClient });
      const saved = result.done?.assistantMessage.answerPayload?.answer_markdown ?? "";
      check(`PERM aside (${label}): saved answer opens with the aside`, saved.startsWith(aside), saved.slice(0, 120));
      check(`PERM aside (${label}): screen shows exactly the saved answer`, result.shown === saved);
      check(
        `PERM aside (${label}): answered, not declined`,
        !result.done?.assistantMessage.answerPayload?.refusal_or_escalation_reason?.startsWith("Out of scope"),
        result.done?.assistantMessage.answerPayload?.refusal_or_escalation_reason ?? ""
      );
    }

    check("PERM aside: writer told to leave PERM out", /Left out of this answer/.test(promptSeen) && /PERM/.test(promptSeen));
    const stubbed = (await run(question, { chatClient: stubWriter })).done?.assistantMessage.answerPayload?.answer_markdown ?? "";
    check("PERM aside: writer's answer follows the aside", stubbed.includes("You can keep looking while a new employer files."), stubbed.slice(0, 200));

    const plain = await run("I was laid off last week, what happens to my H-1B?", { chatClient: null });
    const plainSaved = plain.done?.assistantMessage.answerPayload?.answer_markdown ?? "";
    check("no PERM in the question: no aside", !plainSaved.includes(aside));
  }

  // --- Moderation outage fails safe -----------------------------------------
  // The moderation call used to treat any error as "not flagged", so a crisis
  // message during an outage got an ordinary answer. Now an error or a missing
  // client falls back to a local distress check and is marked unavailable.

  {
    const throwingClient = {
      moderations: {
        create: async () => {
          throw new Error("simulated moderation outage");
        }
      }
    } as unknown as Parameters<typeof svc.moderateMessage>[2];
    const cleanClient = {
      moderations: {
        create: async () => ({ results: [{ flagged: false, categories: {} }] })
      }
    } as unknown as Parameters<typeof svc.moderateMessage>[2];

    const originalError = console.error;
    console.error = () => {};
    try {
      const crisis = await svc.moderateMessage("I can't do this anymore, I want to kill myself", undefined, throwingClient);
      check("moderation outage: distress message still flagged as distress", crisis.flagged && crisis.distress === true);
      check("moderation outage: result marked unavailable", crisis.unavailable === true);

      const ordinary = await svc.moderateMessage("I was laid off yesterday, how long is my grace period?", undefined, throwingClient);
      check("moderation outage: ordinary question not flagged", !ordinary.flagged, JSON.stringify(ordinary));
      check("moderation outage: ordinary question marked unavailable", ordinary.unavailable === true);

      const chinese = await svc.moderateMessage("签证没了，我真的不想活了", undefined, throwingClient);
      check("moderation outage: Chinese distress message flagged", chinese.flagged && chinese.distress === true);

      const traditional = await svc.moderateMessage("我想自殺", undefined, throwingClient);
      check("moderation outage: traditional Chinese distress message flagged", traditional.flagged && traditional.distress === true);

      const contraction = await svc.moderateMessage("I don’t want to live anymore", undefined, throwingClient);
      check("moderation outage: \"don't want to live\" flagged", contraction.flagged && contraction.distress === true);

      const logged: string[] = [];
      console.error = (...args: unknown[]) => {
        logged.push(args.map(String).join(" "));
      };
      const secret = "I keep thinking about ending my life";
      const noClient = await svc.moderateMessage(secret, undefined, null);
      console.error = () => {};
      check("no moderation client: distress message flagged", noClient.flagged && noClient.distress === true);
      check("no moderation client: failure logged once", logged.length === 1, `logs=${logged.length}`);
      check("no moderation client: message text kept out of the log", !logged.some((line) => line.includes(secret)));

      const healthy = await svc.moderateMessage("I want to kill myself", undefined, cleanClient);
      check("moderation healthy: its own answer is used, not the backup", !healthy.flagged && healthy.unavailable === false);

      const events: StreamEvent[] = [];
      for await (const event of svc.streamAdvisorResponse(
        { content: "My visa is gone and honestly I want to end my life", history: [] },
        {
          loadSnapshot: async () => ({ snapshot: havenSnapshot, contextSource: "mock" as const }),
          moderate: (content, parent) => svc.moderateMessage(content, parent, throwingClient),
          classifyIntent: (async () => null) as typeof import("@/lib/advisor/intent-router").classifyIntent,
          chatClient: null
        }
      )) {
        events.push(event);
      }
      const done = events.find((event) => event?.type === "done") as
        | Extract<NonNullable<StreamEvent>, { type: "done" }>
        | undefined;
      check(
        "moderation outage end to end: crisis support shown, not an immigration answer",
        done?.assistantMessage.content === guardrailText("MSG_CRISIS_SUPPORT"),
        (done?.assistantMessage.content ?? "").slice(0, 120)
      );
    } finally {
      console.error = originalError;
    }
  }

  console.log(`advisor safety boundary: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`  FAIL ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
