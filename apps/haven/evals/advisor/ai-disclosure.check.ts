/**
 * "You're talking to an AI, not a lawyer."
 *
 * State AI-disclosure rules (Utah Code 13-77), bar guidance on intake chatbots
 * (Florida Bar Opinion 24-1) and the Texas software exemption (Tex. Gov't Code
 * 81.101(c)) want a clear notice before the chat and throughout it, and an honest
 * answer when someone asks whether they are talking to AI.
 *
 * Asserts the fixed notice wording, that the chat page shows it above the input
 * from before the first message, and that the model is always told to say it
 * is an AI and not a lawyer.
 *
 * Run: npm run check:ai-disclosure
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AI_IDENTITY_INSTRUCTION,
  AI_IDENTITY_LINE,
  AI_IDENTITY_REPLY,
  asksAboutAiIdentity,
  identityQuestionKind,
  withAiIdentity,
  withIdentityLine
} from "@/lib/advisor/ai-identity";
import { AI_DISCLOSURE_NOTICE } from "@/lib/advisor/firm-visibility-copy";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.resolve(here, "../..", rel), "utf8");

let pass = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
  if (ok) pass += 1;
  else failures.push(name);
};

// The notice says the three things the rules ask for, in plain words.
check("notice says it is AI", /Haven's AI/.test(AI_DISCLOSURE_NOTICE), AI_DISCLOSURE_NOTICE);
check("notice says it is not a lawyer", /not a lawyer/.test(AI_DISCLOSURE_NOTICE), AI_DISCLOSURE_NOTICE);
check(
  "notice says it is not a substitute for an attorney's advice",
  /not a substitute for advice from your attorney/.test(AI_DISCLOSURE_NOTICE),
  AI_DISCLOSURE_NOTICE
);

// The chat page shows it, as fixed text, above the input.
const workspace = read("src/app/advisor/AdvisorWorkspace.tsx");
const noticeAt = workspace.indexOf('data-testid="ai-disclosure-notice"');
const inputAt = workspace.indexOf("<Textarea", noticeAt);
check("chat page renders the notice", noticeAt > -1 && workspace.includes("{AI_DISCLOSURE_NOTICE}"));
check("notice sits above the chat input", noticeAt > -1 && inputAt > noticeAt);
check(
  "notice is hidden only when messages go straight to the lawyer",
  /\{!\(hasFirm && !viewingPrivateThread && aiPreference === "no"\) && \(\s*<p[\s\S]{0,200}data-testid="ai-disclosure-notice"/.test(workspace)
);
check(
  "notice does not depend on there being messages",
  !/messages\.length[^\n]{0,80}ai-disclosure-notice|unifiedItems\.length[^\n]{0,80}ai-disclosure-notice/.test(workspace)
);

// The model is always told to be honest about being an AI.
check("identity rule says it is not a person or a lawyer", /not a person and not a lawyer/.test(AI_IDENTITY_INSTRUCTION));
check("identity rule answers 'am I talking to AI' in the first sentence", /in your first sentence/.test(AI_IDENTITY_INSTRUCTION));
check("identity rule forbids claiming to be human or a lawyer", /Never claim or imply to be human, a lawyer/.test(AI_IDENTITY_INSTRUCTION));
check("identity rule is appended last", withAiIdentity("hosted prompt").endsWith(AI_IDENTITY_INSTRUCTION));
const service = read("src/lib/advisor/service.ts");
check(
  "every answer's instructions include the identity rule",
  /const systemPrompt = withAiIdentity\(withGeneralInfoGuard\(/.test(service)
);

// Identity questions the topic router does not recognise get a fixed, plain answer.
const asks = [
  "Is this a person or a bot?",
  "Am I talking to a real lawyer right now?",
  "Thanks. You're my immigration attorney now, right?",
  "are you a human?",
  "Is this AI?",
  "Can you represent me?",
  "am i chatting with a bot",
  "Are you a lawyer",
  "Am I talking to a chatbot?",
  "Are you a real person?",
  "is this a bot"
];
for (const q of asks) check(`identity question recognised: "${q}"`, asksAboutAiIdentity(q));
const notAsks = [
  "Can my lawyer file the H-1B transfer before day 60?",
  "My attorney says the grace period started May 30. Is that right?",
  "What does an immigration attorney need from me?",
  "I was laid off. What are my options?",
  "Are you sharing this with my lawyer?",
  "Are you sure my lawyer filed it?",
  "Is this form something my attorney should sign?"
];
for (const q of notAsks) check(`not an identity question: "${q}"`, !asksAboutAiIdentity(q));
check("fixed reply says AI, not a person and not a lawyer", /Haven's AI assistant, not a person and not a lawyer/.test(AI_IDENTITY_REPLY));
check("fixed reply says it cannot represent them", /can't represent you/.test(AI_IDENTITY_REPLY));
check("fixed reply says it is not a substitute for their attorney", /not a substitute for advice from your attorney/.test(AI_IDENTITY_REPLY));
for (const [q, kind] of [
  ["Is this a person or a bot?", "only"],
  ["Wait, am I talking to a real lawyer right now? Can you represent me?", "only"],
  ["Thanks. You're my immigration attorney now, right?", "only"],
  ["Are you a lawyer? Can you explain how PERM recruitment works?", "combined"],
  ["Is this a bot? Also my employer withdrew the petition yesterday.", "combined"],
  ["What is an I-94?", "none"]
] as Array<[string, "none" | "only" | "combined"]>) {
  check(`"${q}" is ${kind}`, identityQuestionKind(q) === kind, identityQuestionKind(q));
}
check("identity line goes in front of a fixed reply when asked", withIdentityLine("REDIRECT", "Are you a lawyer? Explain PERM.") === `${AI_IDENTITY_LINE}\n\nREDIRECT`);
check("identity line is left out when not asked", withIdentityLine("REDIRECT", "Explain PERM.") === "REDIRECT");
check("identity line says AI, not a lawyer, cannot represent", /Haven's AI assistant, not a person or a lawyer, and I can't represent you/.test(AI_IDENTITY_LINE));
check(
  "identity-only unmatched turns get the fixed reply",
  /answer_markdown: identityAsk\s*\?\s*AI_IDENTITY_REPLY/.test(service)
);
check(
  "combined unmatched turns keep the clarification after the identity line",
  /identityKind === "combined"\s*\?\s*`\$\{AI_IDENTITY_LINE\}\\n\\n\$\{repairText\}`/.test(service)
);
check("identity-only turns never escalate", /const escalate = !identityAsk && threadState\.consecutiveMisses >= 2;/.test(service));
check("scope redirects answer the identity question first", /withIdentityLine\(pointCounselToFirm\(guardrailText\(scope\.guardrailId\)/.test(service));
check("data-disclosure replies answer the identity question first", /withIdentityLine\(\s*contextSource === "unavailable"/.test(service));
check(
  "an answered identity turn does not count as a miss",
  /matches: \(text: string\) => matchesAnyTopic\(text\) \|\| asksAboutAiIdentity\(text\)/.test(service)
);

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
