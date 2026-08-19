/**
 * Turn community posts into the summaries the Advisor's semantic search reads.
 *
 * WHY THIS EXISTS
 *
 * `retrieveCommunityAdvice` has a proper vector path: embed the question, match it
 * against `community_advice_summaries`, filter by topic, re-rank by how well each
 * story's tags fit the asker's profile. It has never run in production. The table
 * has zero rows and nothing in the codebase writes to it, so every request fell
 * through to the text-overlap fallback — which treats "60-day" and "day 60" as
 * unrelated strings, the exact failure the semantic layer was built to avoid.
 *
 * The service reports the empty table to Sentry once per process, so this has been
 * quietly logged for some time.
 *
 * WHAT A SUMMARY IS FOR
 *
 * It is matched against a *question*, not against another story. So the summary is
 * written as the situation a person was in and what happened, in the vocabulary
 * somebody in that situation would use — not as a headline. A post titled "Finally
 * some good news!!" is useless to match on; "laid off on H-1B, filed B-2 inside the
 * 60 days, later transferred to a new employer after an RFE" is what someone in
 * that position is actually asking about.
 *
 * WHAT GETS REJECTED, AND WHY THE MODEL DOES NOT DECIDE IT
 *
 * Not every post is evidence. A question with no outcome teaches nobody anything —
 * and worse, it is the *closest* possible vector match to somebody asking that same
 * question, so it outranks the stories that contain answers and takes one of the
 * three slots an answer has. The filter is load-bearing, not tidiness.
 *
 * It used to be a verdict: the model was asked "is this usable?" and its boolean was
 * taken. Measured over 24 posts run three times each, that verdict flipped on 8 of
 * them — a third of the corpus decided by a coin toss. The first full run rejected
 * 78 posts, of which a second pass accepted 40.
 *
 * So the model is now asked only what it can read off the page — did this person
 * report something that already happened, did they complete a concrete step, are
 * they asking for contacts rather than describing a situation — and the rule is
 * applied in code. Same posts, same model, same three runs: 2 flips instead of 8.
 *
 * It is also less trigger-happy. "Signed Job Offer Days Before H1B Grace Period
 * Ended" was rejected on all three verdict runs and accepted on all three fact runs,
 * correctly: the person describes what they actually did.
 *
 * This is the same move as the grace-period arithmetic — ask the model for what it
 * observes, and keep the decision somewhere it can be read and asserted.
 *
 * TAGS ARE NOT DECORATION
 *
 * `scoreProfileMatch` re-ranks on them, and it matches loosely on visa type,
 * preference category, country of birth and the asker's stated concerns. So tags
 * are emitted in exactly those shapes when the story states them, and omitted when
 * it does not — an invented "India" on a story that never mentions a country would
 * promote it for the wrong people.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/build-community-summaries.ts [--limit N] [--force] [--dry-run] [--retry-skipped]
 *
 * Needs OPENAI_API_KEY and the Supabase service role key:
 *   set -a; source .env.local; set +a
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import OpenAI from "openai";

import { TOPIC_BUCKETS } from "@/lib/advisor/topics";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const SUMMARY_MODEL = process.env.OPENAI_ADVISOR_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-5-mini";

/** Concurrency. Low enough to stay well inside rate limits on a few hundred posts. */
const BATCH = 4;

/**
 * Posts already judged to hold no transferable experience.
 *
 * Kept on disk because a rejected post writes no row, so nothing in the database
 * records that it was considered. Without this the daily run re-judges all of
 * them every night — 78 model calls to reach the same conclusion, growing with
 * the corpus — and a question with no outcome does not acquire one later, since
 * these are imported snapshots rather than live threads.
 *
 * `--retry-skipped` clears it, for when the rubric in the prompt changes and the
 * old judgements are worth revisiting.
 */
const SKIP_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "community-summaries-skipped.json");

type SkipRecord = { id: string; title: string; why: string; at: string };

function readSkipList(): SkipRecord[] {
  try {
    return JSON.parse(fs.readFileSync(SKIP_FILE, "utf8")) as SkipRecord[];
  } catch {
    return [];
  }
}

function writeSkipList(records: SkipRecord[]) {
  fs.writeFileSync(SKIP_FILE, `${JSON.stringify(records, null, 2)}\n`);
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index !== -1 ? args[index + 1] : undefined;
};

const SYSTEM_PROMPT = [
  "You condense real immigration community posts into retrieval summaries for a US employment-based immigration assistant.",
  "The summary will be matched against a *question* somebody types while in trouble. Write the situation and the outcome in the words that person would use, not as a headline.",
  "",
  "summary: two to four sentences. State the person's status, what happened to them, what they did, and how it turned out. If there is no outcome yet, say what is still pending. Never add facts the post does not contain, and never give advice.",
  // The topic is a hard filter in the RPC, not a label. Two identical
  // "laid off -> B-2 -> new H-1B" stories came back as `layoffs` and `job-change`
  // in the first trial run, which would have made half the bridge stories
  // invisible to every layoff question. So the two easily-confused buckets are
  // defined here, in the product's own terms rather than the model's.
  "topic: the single bucket this best belongs to. It is used as a hard filter, so consistency matters more than nuance.",
  "  layoffs — anything following a job loss, including bridge status: B-2, H-4, F-1, the 240-day rule, grace-period timing, and transferring to a new employer after being let go. Somebody switching to H-4 while they job hunt is a LAYOFF story, not a job-change story.",
  "  job-change — AC21 portability specifically: moving employers with an I-485 pending 180 days or more, and same-or-similar occupational classification. Not simply having changed jobs.",
  "tags: short factual labels drawn only from what the post states — visa type (H1B, F1, H4, B2), preference category (EB-2, EB-3), country of birth, and the concern it speaks to (layoffs, gc_timeline, job_change, visa_expiry). Omit anything the post does not say. An invented country or category promotes this story for the wrong readers.",
  "legalCaveat: one sentence naming what is specific to this person's facts and should not be generalised — the actual reason their outcome may not transfer.",
  "",
  // Observations, not a verdict. See the note at the top of the file.
  "reportedOutcome: what has ALREADY happened to this person, in a few words — an approval, a denial, an RFE they answered, a start date they reached, a departure they made. Empty string when nothing has resolved yet.",
  "actionsTaken: concrete steps this person has ALREADY completed, a few words each. 'Filed I-539 to B-2' counts. 'Thinking about filing', 'my lawyer suggested', and anything they are still deciding do not. Empty when they have only asked questions.",
  "isRequestForContacts: true when the post is asking for attorney recommendations, job referrals or leads rather than describing a situation.",
].join("\n");

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reportedOutcome", "actionsTaken", "isRequestForContacts", "summary", "topic", "tags", "legalCaveat"],
  properties: {
    reportedOutcome: { type: "string" },
    actionsTaken: { type: "array", items: { type: "string" } },
    isRequestForContacts: { type: "boolean" },
    summary: { type: "string" },
    topic: { type: "string", enum: [...TOPIC_BUCKETS] },
    tags: { type: "array", items: { type: "string" } },
    legalCaveat: { type: "string" }
  }
} as const;

type Summary = {
  reportedOutcome: string;
  actionsTaken: string[];
  isRequestForContacts: boolean;
  summary: string;
  topic: string;
  tags: string[];
  legalCaveat: string;
};

type Post = { id: string; title: string; body: string; tags: string[]; space_id: string };

async function rest(path: string, init?: RequestInit) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Does this post hold experience somebody else can use?
 *
 * Generous in one direction on purpose: an unresolved situation still counts if the
 * person actually did something, because "I filed B-2 on day 58 and I am waiting" is
 * real information to somebody on day 55. What is excluded is the post containing
 * only a question, and the one asking for contacts.
 */
function holdsExperience(summary: Summary): { usable: boolean; why: string } {
  if (summary.isRequestForContacts) {
    return { usable: false, why: "asking for referrals or attorney recommendations, not describing a situation" };
  }

  const outcome = summary.reportedOutcome.trim();
  const actions = (summary.actionsTaken ?? []).filter((action) => action.trim().length > 0);

  if (outcome.length === 0 && actions.length === 0) {
    return { usable: false, why: "a question only — nothing has happened yet and no step has been taken" };
  }

  return { usable: true, why: "" };
}

/**
 * What actually gets embedded.
 *
 * The title is included because community titles often carry the status pair
 * ("H1B -> B2 -> H1B") that the body only implies, and the tags because a question
 * naming a visa type should reach stories about it. Everything here is text the
 * question might rhyme with; nothing is metadata.
 */
function embeddingText(post: Post, summary: Summary) {
  return [post.title, summary.summary, summary.tags.join(", ")].filter(Boolean).join("\n");
}

async function summarise(openai: OpenAI, post: Post): Promise<Summary | null> {
  const response = await openai.chat.completions.create({
    model: SUMMARY_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Title: ${post.title}\nExisting tags: ${(post.tags ?? []).join(", ") || "none"}\n\n${post.body.slice(0, 6000)}`
      }
    ],
    response_format: { type: "json_schema", json_schema: { name: "advice_summary", strict: true, schema: SCHEMA } }
  } as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

  const raw = response.choices[0]?.message?.content;
  return raw ? (JSON.parse(raw) as Summary) : null;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase env missing. set -a; source .env.local; set +a");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing.");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const limit = Number(value("limit") ?? 0);
  const force = flag("force");
  const dryRun = flag("dry-run");

  const posts: Post[] = await rest(`community_posts?select=id,title,body,tags,space_id&order=created_at.asc`);
  const existing: Array<{ source_post_id: string | null }> = await rest(
    `community_advice_summaries?select=source_post_id`
  );
  const done = new Set(existing.map((row) => row.source_post_id).filter(Boolean) as string[]);

  const retrySkipped = flag("retry-skipped");
  const skipList = retrySkipped ? [] : readSkipList();
  const skipIds = new Set(skipList.map((record) => record.id));

  const queue = posts
    .filter((post) => force || (!done.has(post.id) && !skipIds.has(post.id)))
    .slice(0, limit > 0 ? limit : undefined);

  console.log(
    `${posts.length} posts, ${done.size} already summarised, ${skipIds.size} previously skipped, ${queue.length} to do`
  );
  console.log(`summary model: ${SUMMARY_MODEL}   embedding model: ${EMBEDDING_MODEL}`);
  if (dryRun) console.log("DRY RUN — nothing will be written\n");

  let written = 0;
  const skipped: Array<{ id: string; title: string; why: string }> = [];
  const failed: Array<{ title: string; why: string }> = [];

  for (let index = 0; index < queue.length; index += BATCH) {
    const slice = queue.slice(index, index + BATCH);
    await Promise.all(
      slice.map(async (post) => {
        try {
          const summary = await summarise(openai, post);
          if (!summary) {
            failed.push({ title: post.title, why: "no content returned" });
            return;
          }

          const verdict = holdsExperience(summary);
          if (!verdict.usable) {
            skipped.push({ id: post.id, title: post.title, why: verdict.why });
            return;
          }

          const embeddingResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: embeddingText(post, summary)
          });
          const embedding = embeddingResponse.data[0]?.embedding;
          if (!embedding) {
            failed.push({ title: post.title, why: "no embedding returned" });
            return;
          }

          if (!dryRun) {
            await rest("community_advice_summaries", {
              method: "POST",
              headers: { Prefer: "resolution=merge-duplicates" },
              body: JSON.stringify({
                source_post_id: post.id,
                space_id: post.space_id,
                title: post.title,
                topic: summary.topic,
                summary: summary.summary,
                legal_caveat: summary.legalCaveat,
                tags: summary.tags,
                // Every post here was already reviewed on the way into the
                // community. Re-queueing them for moderation would leave the
                // table populated and the search still finding nothing.
                moderation_status: "approved",
                embedding: `[${embedding.map((n) => Number(n).toFixed(8)).join(",")}]`
              })
            });
          }

          written += 1;
          console.log(`  ok   ${summary.topic.padEnd(20)} ${post.title.slice(0, 62)}`);
        } catch (error) {
          failed.push({ title: post.title, why: (error as Error)?.message?.slice(0, 120) ?? "unknown" });
        }
      })
    );
  }

  if (!dryRun && skipped.length > 0) {
    const at = new Date().toISOString();
    writeSkipList([...skipList, ...skipped.map((item) => ({ ...item, at }))]);
  }

  console.log(`\n${written} written, ${skipped.length} skipped as not usable, ${failed.length} failed`);
  if (skipped.length > 0) {
    console.log("\nSkipped:");
    for (const item of skipped) console.log(`  - ${item.title.slice(0, 58)} — ${item.why}`);
  }
  if (failed.length > 0) {
    console.log("\nFailed:");
    for (const item of failed) console.log(`  - ${item.title.slice(0, 58)} — ${item.why}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
