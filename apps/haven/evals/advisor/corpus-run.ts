/**
 * Ask the twenty corpus questions as each of the three laid-off personas, and
 * print the answers to read.
 *
 * NOT A TEST. Nothing here passes or fails. The graded suites already exist and
 * they check behaviour — did it decline, did it name the deadline, did it accuse
 * anyone. This runs so a person can read sixty real answers and notice the things
 * no assertion was written for, which is where every genuine defect in this
 * project has actually come from.
 *
 * ONE PROCESS PER PERSONA
 *
 * `getSnapshot` is wrapped in React's `cache()`, so the first persona's snapshot
 * would be handed to the second and third inside a single process. That failure
 * is silent and produces three sets of answers that look plausible and are all
 * for the same person — which is precisely the bug the personas were built to
 * remove. Each persona therefore gets its own child process, where the
 * memoisation cannot reach across.
 *
 * Usage:
 *   npm run advisor:corpus                    all personas, all questions
 *   npm run advisor:corpus -- --persona day-5
 *   npm run advisor:corpus -- --group clock
 *   npm run advisor:corpus -- --out answers.md
 *
 * Needs real credentials. Source them first, and unset Supabase so the personas
 * are used rather than a real account:
 *
 *   set -a; source .env.local; set +a
 *   unset NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
 *
 * The unset matters. With Supabase present this runs as whoever is logged in and
 * the personas are ignored — the answers would look fine and mean something else.
 */

process.env.ADVISOR_TRACE_TAG ??= "eval,corpus";

import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

/** The child: one persona, every selected question, printed as it goes. */
async function runOnePersona(personaId: string, groupFilter?: string) {
  const { CORPUS_QUESTIONS } = await import("./corpus-questions");
  const { resolveTestPersona } = await import("@/lib/repositories/test-personas");
  const svc = await import("@/lib/advisor/service");

  const persona = resolveTestPersona(personaId);
  if (!persona) {
    console.error(`Unknown persona "${personaId}".`);
    process.exit(1);
  }

  const questions = groupFilter ? CORPUS_QUESTIONS.filter((q) => q.group === groupFilter) : CORPUS_QUESTIONS;

  console.log(`\n\n# ${persona.snapshot.profile.fullName} — ${personaId}\n`);
  console.log(`> ${persona.situation}\n`);
  console.log(`_Watching for:_ ${persona.tests}\n`);

  for (const item of questions) {
    let answer = "";
    let traceId: string | null = null;
    const started = Date.now();

    try {
      for await (const event of svc.streamAdvisorResponse({
        content: item.question,
        history: [{ role: "user" as const, content: item.question }]
      })) {
        if (event.type === "delta") answer += event.text;
        if (event.type === "done") traceId = (event as { traceId?: string }).traceId ?? null;
      }
    } catch (error) {
      answer = `ERROR: ${(error as Error)?.message ?? error}`;
    }

    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n---\n`);
    console.log(`## ${item.id}\n`);
    console.log(`**Q.** ${item.question}\n`);
    console.log(`${answer.trim()}\n`);
    console.log(`<sub>${seconds}s · probes: ${item.probes}${traceId ? ` · trace ${traceId}` : ""}</sub>\n`);
  }
}

/** The parent: fan out to one child per persona and stream their output through. */
async function runAll() {
  const { testPersonaIds } = await import("@/lib/repositories/test-personas");

  const only = arg("persona");
  const group = arg("group");
  const out = arg("out");
  const personas = only ? [only] : testPersonaIds();

  let transcript = `# Advisor — twenty corpus questions\n\nRun ${new Date().toISOString()}\n`;

  for (const personaId of personas) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "npx",
        ["tsx", "--tsconfig", "tsconfig.json", SELF, "--child", personaId, ...(group ? ["--group", group] : [])],
        { env: { ...process.env, ADVISOR_TEST_PERSONA: personaId }, stdio: ["inherit", "pipe", "inherit"] }
      );

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        process.stdout.write(text);
        transcript += text;
      });
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`persona ${personaId} exited ${code}`))));
    });
  }

  if (out) {
    fs.writeFileSync(out, transcript);
    console.log(`\nWritten to ${out}`);
  }
}

const childPersona = arg("child");
(childPersona ? runOnePersona(childPersona, arg("group")) : runAll()).catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
