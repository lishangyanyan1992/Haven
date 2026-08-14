/**
 * Advisor lab — an interactive prompt bench for the Haven Advisor.
 *
 * WHAT THIS IS
 *
 * The real Advisor pipeline, driven from a terminal, with the system prompt in an
 * editable file and every routing decision printed next to the answer. It imports
 * `streamAdvisorResponse` rather than reimplementing it, so what you test here is
 * what production runs — the same classifier, the same guardrail selection, the
 * same retrieval, the same post-generation safety addendum.
 *
 * That import is the whole design. A lab that reimplemented the pipeline would
 * agree with production on the day it was written and drift silently after, and a
 * prompt validated against a drifted copy is worse than one nobody tested.
 *
 * WHY IT RUNS DETACHED FROM PRODUCTION
 *
 * Supabase credentials are cleared before the service is imported, which puts the
 * pipeline in its existing mock-identity path. Consequences, all deliberate:
 *
 *   - No `advisor_threads` row is written, so testing does not appear in product
 *     usage data.
 *   - The five-conversations-per-24h allowance does not apply, so you can ask two
 *     hundred questions in an afternoon.
 *   - Nothing you type here can reach a real user's data.
 *
 * The one thing lost is the real profile, and `pull-profile.ts` restores it from a
 * file. Env is cleared *before* the dynamic import because `@/lib/env` computes
 * `hasSupabaseEnv` at module load; clearing it afterwards would do nothing.
 *
 * Langfuse is off unless you pass --trace. A hundred prompt experiments would
 * otherwise bury real production traces in the same project.
 *
 * Usage (from the repo root):
 *   npm run advisor:lab
 *   npm run advisor:lab -- --trace     keep Langfuse tracing on
 *
 * Commands inside the session:
 *   /prompt    show the prompt currently in effect
 *   /new       start a fresh thread (clears history)
 *   /profile   show the profile the answers are being built from
 *   /quit
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

export {};

const ROOT = process.cwd();
const PROMPT_FILE = path.join(ROOT, "tools/advisor-lab/prompt.local.md");
const PROFILE_FILE = path.join(ROOT, "tools/advisor-lab/profile.local.json");

const DIM = "[2m";
const BOLD = "[1m";
const RESET = "[0m";
const CYAN = "[36m";
const YELLOW = "[33m";

function loadEnvFile() {
  const file = path.join(ROOT, "apps/haven/.env.local");
  let raw = "";
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    console.error(`Could not read ${file}. Run this from the repo root.`);
    process.exit(1);
  }

  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    process.env[key] = value.trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const keepTracing = process.argv.includes("--trace");

  loadEnvFile();

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is missing from apps/haven/.env.local.");
    process.exit(1);
  }

  // Order matters: this must happen before the service is imported.
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keepTracing) {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
  }

  // Seed the editable prompt from the in-code prompt on first run, so there is
  // always something concrete to edit rather than an empty file.
  if (!existsSync(PROMPT_FILE)) {
    const { STREAMING_SYSTEM_PROMPT } = await import("@/lib/advisor/service");
    writeFileSync(PROMPT_FILE, STREAMING_SYSTEM_PROMPT);
    console.log(`${DIM}Seeded ${path.relative(ROOT, PROMPT_FILE)} from the in-code prompt.${RESET}`);
  }
  process.env.ADVISOR_SYSTEM_PROMPT_FILE = PROMPT_FILE;

  const hasRealProfile = existsSync(PROFILE_FILE);
  if (hasRealProfile) process.env.HAVEN_SNAPSHOT_FILE = PROFILE_FILE;

  const { streamAdvisorResponse, routeAdvisorQuestion } = await import("@/lib/advisor/service");
  const { getSnapshot } = await import("@/lib/repositories/case-compass");
  const snapshot = await getSnapshot();
  const profile = snapshot.profile;

  console.log(`\n${BOLD}Advisor lab${RESET}`);
  console.log(`${DIM}prompt   ${path.relative(ROOT, PROMPT_FILE)} (edit it; the next question picks it up)`);
  console.log(`profile  ${hasRealProfile ? path.relative(ROOT, PROFILE_FILE) : "mock persona — run pull-profile.ts for your real one"}`);
  console.log(`writes   none · quota none · langfuse ${keepTracing ? "on" : "off"}${RESET}`);
  console.log(`${DIM}/prompt  /new  /profile  /quit${RESET}\n`);

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Resolves to null when stdin ends rather than rejecting. Piping input into the
  // lab — which is how it gets smoke-tested — closes stdin after the last line,
  // and `rl.question` on a closed interface throws "readline was closed". That
  // turned a clean run into a non-zero exit and an error the run had not earned.
  let closed = false;
  rl.on("close", () => {
    closed = true;
  });
  const ask = (q: string) =>
    new Promise<string | null>((resolve) => {
      if (closed) return resolve(null);
      try {
        rl.question(q, resolve);
      } catch {
        resolve(null);
      }
    });

  for (;;) {
    const line = await ask(`${CYAN}you ${RESET}`);
    if (line === null) break;
    const input = line.trim();
    if (!input) continue;

    if (input === "/quit" || input === "/exit") break;
    if (input === "/new") {
      history.length = 0;
      console.log(`${DIM}history cleared${RESET}\n`);
      continue;
    }
    if (input === "/prompt") {
      console.log(`\n${readFileSync(PROMPT_FILE, "utf8")}\n`);
      continue;
    }
    if (input === "/profile") {
      console.log(`\n${JSON.stringify(profile, null, 2)}\n`);
      continue;
    }

    // Printed before the answer, because the routing decision is what most
    // prompt bugs actually are. An answer that reads fine but shows
    // `resolution=unmatched` or the wrong topics was built from the wrong
    // sources, and you cannot see that in the prose. Calls the same exported
    // function the service calls, so this is a report, not a second opinion.
    const preview = routeAdvisorQuestion({
      content: input,
      history,
      i485Filed: Boolean(profile.i485Filed)
    });
    console.log(
      `${DIM}         → ${preview.resolution ?? "?"} · topics ${preview.topics.join(", ") || "none"}` +
        ` · guardrails ${preview.guardrailIds.join(", ") || "none"}${RESET}`
    );

    const startedAt = Date.now();
    let answer = "";
    let printedHeader = false;

    try {
      // The client sends [...history, newMessage], and the service normalises
      // that at its boundary. Matching the client's shape exactly means the lab
      // exercises the same normalisation path a real request does.
      for await (const event of streamAdvisorResponse({
        content: input,
        history: [...history, { role: "user" as const, content: input }]
      })) {
        if (event.type === "delta") {
          if (!printedHeader) {
            process.stdout.write(`\n${BOLD}advisor${RESET}  `);
            printedHeader = true;
          }
          process.stdout.write(event.text);
          answer += event.text;
        }

        if (event.type === "error") {
          console.log(`\n${YELLOW}error${RESET}  ${event.message}\n`);
        }

        if (event.type === "done") {
          const payload = event.assistantMessage.answerPayload;
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
          console.log("\n");

          if (payload) {
            // The addendum staples required safety language onto answers that
            // omitted it. Every marker below is the prompt having failed to
            // produce that language on its own — the single most useful signal
            // when judging a prompt edit, and invisible in the answer text.
            const patched = /safety note:|strategy note:/i.test(payload.answer_markdown);
            const citations = payload.external_citations ?? [];

            console.log(
              `${DIM}${elapsed}s · confidence ${payload.confidence} · ${citations.length} citation(s)` +
                `${patched ? ` · ${RESET}${YELLOW}SAFETY ADDENDUM FIRED${DIM}` : ""}${RESET}`
            );
            if (patched) {
              console.log(
                `${DIM}         ^ the prompt did not produce required safety language on its own${RESET}`
              );
            }
            for (const citation of citations.slice(0, 6)) {
              const c = citation as { label?: string; title?: string; url?: string };
              console.log(`${DIM}         ${c.label ?? c.title ?? "source"} — ${c.url ?? ""}${RESET}`);
            }
            if (payload.refusal_or_escalation_reason) {
              console.log(`${DIM}         reason: ${payload.refusal_or_escalation_reason}${RESET}`);
            }
            if (payload.follow_up_questions?.length) {
              console.log(`${DIM}         follow-ups: ${payload.follow_up_questions.join(" · ")}${RESET}`);
            }
          }
          console.log("");
        }
      }
    } catch (error) {
      console.log(`\n${YELLOW}threw${RESET}  ${(error as Error).message}\n`);
      continue;
    }

    if (answer) {
      history.push({ role: "user", content: input });
      history.push({ role: "assistant", content: answer });
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
