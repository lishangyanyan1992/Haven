/**
 * Chat + the user's documents, against the real model.
 *
 * Run with: npm run check:document-advisor  (from apps/haven)
 * Needs OPENAI_API_KEY (read from .env.local). Runs without Supabase, as the
 * DOCUMENT_TEST_PERSONAS in src/lib/repositories/test-personas.ts.
 *
 * Two promises from the spec:
 *   - a passage from the user's documents is used, and the answer names the
 *     document it came from;
 *   - a question that names no topic is answered, not met with the topic menu,
 *     when the user's documents answer it;
 *   - without documents, the answer does not come up with that date.
 * Exits non-zero on any failure.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadEnvValue(key: string) {
  for (const file of [path.join(appRoot, ".env.local"), path.join(appRoot, "../../.env.local")]) {
    if (!fs.existsSync(file)) continue;
    const line = fs.readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const openaiKey = process.env.OPENAI_API_KEY ?? loadEnvValue("OPENAI_API_KEY");
if (!openaiKey) {
  console.log("OPENAI_API_KEY not set; skipping.");
  process.exit(1);
}
// No database, no tracing: this runs as a persona only.
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_PUBLIC_KEY"]) {
  delete process.env[key];
}
process.env.OPENAI_API_KEY = openaiKey;
process.env.ADVISOR_TRACE_TAG = "document-context-check";

const QUESTION = "I am on H-1B and still employed. Until what date am I allowed to stay in the US on my current H-1B status?";
const SEPT_30_2027 = /(sept(ember)?\.? 30,? 2027|30 sept(ember)? 2027|09\/30\/2027|2027-09-30)/i;

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}`, detail ?? "");
  }
}

async function ask(personaId: string, question = QUESTION) {
  process.env.ADVISOR_TEST_PERSONA = personaId;
  const { streamAdvisorResponse } = await import("../../src/lib/advisor/service");
  let text = "";
  let done: any = null;
  for await (const event of streamAdvisorResponse({ content: question, history: [] })) {
    if (event.type === "delta") text += event.text;
    else if (event.type === "done") done = event;
    else if (event.type === "error") throw new Error(event.message);
  }
  return (done?.assistantMessage?.answerPayload?.answer_markdown as string | undefined) ?? text;
}

console.log("I-94 in the user's documents");
const withDoc = await ask("doc-i94");
check("uses the date from the document", SEPT_30_2027.test(withDoc), withDoc.slice(0, 600));
// The model often writes a non-breaking hyphen (U+2011) in form numbers.
check("names the document", /I[-\u2010\u2011\u2013]?94/i.test(withDoc), withDoc.slice(0, 600));

console.log("Vague question the documents answer");
// Names no topic, so without documents it gets the "which of these did you
// mean?" menu. With an I-94 on file that menu is the wrong reply.
const vague = await ask("doc-i94", "Until what date am I allowed to stay in the US on my current status?");
check("answers instead of asking which topic", !/Which of these is closest/i.test(vague), vague.slice(0, 300));
check("uses the date from the document", SEPT_30_2027.test(vague), vague.slice(0, 600));

console.log("No documents");
const without = await ask("doc-none");
check("does not come up with that date", !SEPT_30_2027.test(without), without.slice(0, 600));

if (failures > 0) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nAll chat document checks passed");
