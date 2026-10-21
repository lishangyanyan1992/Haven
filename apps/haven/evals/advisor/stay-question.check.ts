/**
 * Regression check: "how long can I stay?" must be answered, not met with the
 * topic menu.
 *
 * Found testing live on 2026-10-21. "Until what date am I allowed to stay in the
 * US on my current status?" matched no topic and got "Which of these is closest
 * to what you're asking about?". The follow-up, "My current status. How long can
 * I stay in the US on it?", also matched nothing, and the second miss handed the
 * user off to an attorney. It is the stay question in its plainest form.
 */

export {};

type Case = { name: string; content: string; visaType?: string; wantMatched: boolean; wantTopic?: string };

const CASES: Case[] = [
  { name: "the 2026-10-21 question", content: "Until what date am I allowed to stay in the US on my current status?", wantMatched: true, wantTopic: "h1b" },
  { name: "the 2026-10-21 follow-up", content: "My current status. How long can I stay in the US on it?", wantMatched: true, wantTopic: "h1b" },
  { name: "how long may I remain", content: "How long may I remain here?", wantMatched: true },
  { name: "when does my status end", content: "When does my status expire?", wantMatched: true },
  { name: "authorized stay", content: "What is my authorized stay?", wantMatched: true },
  { name: "by what date must I leave", content: "By what date do I have to leave on my status?", wantMatched: true },
  {
    name: "a student's stay question also brings the student topic",
    content: "How long can I stay in the US?",
    visaType: "F-1",
    wantMatched: true,
    wantTopic: "student-status"
  },
  // Must still fall through to the menu: nothing here says what they are asking.
  { name: "small talk is still unmatched", content: "Thanks, that helps.", wantMatched: false },
  { name: "a vague worry is still unmatched", content: "I'm worried about everything.", wantMatched: false }
];

async function main() {
  const { routeAdvisorQuestion } = await import("@/lib/advisor/service");
  let pass = 0;
  const failures: string[] = [];

  for (const testCase of CASES) {
    const route = routeAdvisorQuestion({ content: testCase.content, visaType: testCase.visaType ?? "H-1B" });
    const ok =
      route.currentMatched === testCase.wantMatched &&
      (testCase.wantTopic == null || route.topics.includes(testCase.wantTopic as never));
    console.log(`${ok ? "PASS" : "FAIL"}  ${testCase.name}  [${route.resolution}: ${route.topics.join(", ")}]`);
    if (ok) pass += 1;
    else failures.push(testCase.name);
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
