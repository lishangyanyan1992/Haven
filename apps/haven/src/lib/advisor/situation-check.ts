/**
 * What Haven is assuming about this person, said out loud before it advises them.
 *
 * The rule, from Yanyan on 2026-08-21: *never recommend anything without knowing
 * their current situation, and do not assume.* The answer that prompted it was a
 * seven-point action plan resting on a profile the user had not looked at in
 * months, a bulletin 142 days old, and a category nobody had confirmed. Every
 * number in it was real. None of it had been checked with the person it was about.
 *
 * The failure is specific to a product that already holds data. A general chatbot
 * has to ask, because it knows nothing. Haven knows a priority date, an employment
 * status, a category — and so it quietly skips the asking, and inherits whatever
 * was true the last time anybody edited the profile. Confidently advising the
 * wrong person is worse than admitting you do not know which person you have.
 *
 * Two moves, and which one fires depends only on whether the fact is there:
 *
 * - **Missing** → ask for it, and do not recommend until it arrives. Not a menu
 *   and not an interrogation: the one or two facts the answer actually turns on.
 * - **Held** → state it back in the answer, plainly, so a wrong one gets corrected
 *   in the next message instead of silently shaping months of advice.
 *
 * What this is not: a form. Nothing here blocks an explanation of how something
 * works, and nothing gates the crisis paths. It gates *recommendations* — the
 * sentences that tell somebody to do a thing.
 */

import type { TopicBucket } from "@/lib/advisor/topics";

/**
 * A fact some recommendation depends on.
 *
 * `label` is how the fact is named to the user, in their words rather than the
 * product's. `ask` is the question when it is missing — one question, phrased so
 * a one-line answer completes it.
 */
interface RequiredFact {
  id: string;
  label: string;
  ask: string;
  /** Whether the profile holds it. */
  held: (context: SituationInputs) => string | null;
}

export interface SituationInputs {
  visaType?: string | null;
  layoffDate?: string | null;
  priorityDate?: string | null;
  preferenceCategory?: string | null;
  countryOfBirth?: string | null;
}

/**
 * Values that mean "nobody has chosen one yet".
 *
 * A profile field is not missing when it holds a placeholder — it is worse than
 * missing, because it reads as an answer. `preferenceCategory: "unknown"` would
 * otherwise pass as a confirmed category and be built on.
 */
const PLACEHOLDERS = new Set(["", "unknown", "none", "n/a", "not_sure", "not-sure", "other", "undecided"]);

function stated(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  return PLACEHOLDERS.has(trimmed.toLowerCase()) ? null : trimmed;
}

const FACTS: Record<string, RequiredFact> = {
  status: {
    id: "status",
    label: "your current status",
    ask: "What status are you on right now — H-1B, F-1/OPT, something else?",
    held: (c) => stated(c.visaType)
  },
  lastDay: {
    id: "lastDay",
    label: "your last day of employment",
    ask: "What was your last day of employment? Everything after a job ends is counted from that date, so it changes the whole answer.",
    held: (c) => stated(c.layoffDate)
  },
  priorityDate: {
    id: "priorityDate",
    label: "your priority date",
    ask: "What is your priority date?",
    held: (c) => stated(c.priorityDate)
  },
  category: {
    id: "category",
    label: "your green card category",
    ask: "Which category are you in — EB-1, EB-2, EB-3?",
    held: (c) => stated(c.preferenceCategory)
  },
  country: {
    id: "country",
    label: "your country of birth",
    // Chargeability, not citizenship — and the difference decides the queue, so
    // the question says which one it means.
    ask: "What is your country of birth? The green card queue runs on birth country, not citizenship.",
    held: (c) => stated(c.countryOfBirth)
  }
};

/**
 * Which facts a recommendation on this topic actually turns on.
 *
 * Deliberately short lists. Every fact added here is a question somebody has to
 * answer before they get help, and a gate that asks for five things is a form —
 * which people abandon, on a day they most need not to.
 */
const REQUIRED_BY_TOPIC: Partial<Record<TopicBucket, string[]>> = {
  layoffs: ["status", "lastDay"],
  "job-change": ["status"],
  h1b: ["status"],
  "visa-bulletin": ["priorityDate", "category", "country"],
  "adjustment-of-status": ["priorityDate", "category", "country"],
  perm: ["status"],
  "student-status": ["status"],
  "self-petition": ["status"]
};

export interface SituationCheck {
  /** Facts the answer will rely on, with what Haven currently holds. */
  known: Array<{ label: string; value: string }>;
  /** Facts that are missing and that a recommendation would need. */
  missing: Array<{ label: string; ask: string }>;
}

export function checkSituation(topics: readonly TopicBucket[], inputs: SituationInputs): SituationCheck {
  const ids = new Set<string>();
  for (const topic of topics) {
    for (const id of REQUIRED_BY_TOPIC[topic] ?? []) ids.add(id);
  }

  const known: SituationCheck["known"] = [];
  const missing: SituationCheck["missing"] = [];

  for (const id of ids) {
    const fact = FACTS[id];
    if (!fact) continue;
    const value = fact.held(inputs);
    if (value) known.push({ label: fact.label, value });
    else missing.push({ label: fact.label, ask: fact.ask });
  }

  return { known, missing };
}

/**
 * Render the check for the prompt.
 *
 * Both halves are instructions about *behaviour*, not text to reproduce — the
 * bulletin block taught that lesson the expensive way, by being pasted into an
 * answer as a labelled data sheet with the reader referred to in the third person.
 *
 * The cap on how many missing facts get asked for is the difference between a
 * conversation and a form. Two is enough to be honest about what is unknown and
 * few enough that somebody frightened and skimming will actually answer.
 */
const MAX_ASKS = 2;

export function renderSituationForPrompt(check: SituationCheck, isFirstTurn: boolean): string[] {
  const lines: string[] = [];

  if (check.known.length > 0) {
    lines.push(
      `Your answer will rest on these, and Haven has them on file: ${check.known
        .map((fact) => `${fact.label} (${fact.value})`)
        .join(", ")}.`,
      "Say what you are relying on, in one short sentence in your own words, and invite them to correct it. A profile is whatever they last typed into it, which may be months old — the point is that a wrong fact gets fixed in their next message instead of quietly shaping every answer after this one.",
      "Put that sentence AFTER your direct answer, never before it. Opening with what you are assuming makes somebody read a paragraph of bookkeeping before they find out what happens to them, and the app shows the opening lines first — so a confirmation placed first becomes the only thing they see."
    );
  }

  if (check.missing.length > 0) {
    const asks = check.missing.slice(0, MAX_ASKS);
    lines.push(
      `Haven does not hold ${check.missing.map((fact) => fact.label).join(", ")}, and a recommendation here depends on ${check.missing.length === 1 ? "it" : "them"}.`,
      `Ask for ${asks.length === 1 ? "it" : "these"}, in your own words: ${asks.map((fact) => fact.ask).join(" ")}`,
      "Until they answer, explain how the rules work and what each option would turn on — but do not tell them what to do. A recommendation built on a fact you guessed is the failure this instruction exists to prevent, and it is invisible to them because it will sound just as confident as a correct one.",
      "Ask at the end, after the explanation, as a plain question. Do not open with it and do not make them answer before you have been useful."
    );
  }

  if (isFirstTurn && lines.length > 0) {
    lines.push(
      "This is the first message in a new conversation, so nothing has been confirmed yet in it. Treat everything on file as reported rather than verified."
    );
  }

  return lines;
}
