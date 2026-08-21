/**
 * When a community story should lead the answer, and when it should not.
 *
 * The product's whole claim is that it has something a general chatbot does not:
 * two hundred people who have already been through this. But "always lead with a
 * story" is wrong in a way that costs somebody their status. Asked "how long is my
 * grace period", the answer is sixty days, and a story that opens "I got about
 * three months" is misinformation dressed as evidence — the person who acts on it
 * loses the thing this product exists to protect.
 *
 * So the question is not *is this story good*. It is: **does the answer to this
 * question live in the regulations, or in what happened to people?**
 *
 *   - **Rules.** "What is the deadline?" "Does a pending I-539 authorise work?"
 *     There is a correct answer and it is written down. A story cannot improve it
 *     and can contradict it. Rules lead; a story may follow as colour.
 *   - **Experience.** "What did people do when their employer refused?" "Did
 *     anyone find a sponsor inside sixty days?" "Was the B-2 bridge worth it?"
 *     No regulation answers these. The only honest evidence is what happened to
 *     people, and reciting rules at them is the padding that makes Haven read like
 *     a worse ChatGPT.
 *   - **Mixed.** Most real questions. "I was just laid off, what do I do first?"
 *     has a floor — do not work without authorisation — and above that floor the
 *     useful part is what somebody actually did on day one. The floor goes first,
 *     then the story.
 *
 * HOW THE KIND IS DECIDED, WITHOUT ASKING A MODEL
 *
 * The signal was already being computed. `requiredPointsForAnswer` returns the
 * statements the regulations oblige this answer to make. If it returns nothing,
 * there is no rule floor and a story can lead outright. If it returns something,
 * that something goes first and the story goes directly under it. Reusing it means
 * there is one definition of "the rules have something mandatory to say here"
 * rather than two that drift — which is the failure this codebase produces most.
 *
 * No model call, for the reason the summariser taught the expensive way: asked to
 * judge the same twenty-four posts three times, a model changed its mind about
 * eight of them. A story that leads on Tuesday and hides on Wednesday, for the
 * same question, is not a feature anybody can reason about.
 */

import type { CommunityAdviceSummary } from "@/types/domain";

/** Where the answer to a question actually lives. */
export type EvidenceKind = "rules" | "mixed" | "experience";

/**
 * Asking outright what happened to people.
 *
 * These phrasings are the clearest signal in the product that somebody wants
 * evidence rather than instruction — and they are exactly the questions the old
 * ordering answered with a regulation and buried the stories under.
 */
const ASKS_FOR_EXPERIENCE =
  /\b(what (do|did|does) (people|others|anyone|everyone|most people)|has anyone|have you seen|anyone else|did anyone|what happened (to|when)|what do others|in practice|in the real world|actually (do|did|work|happen)|really (take|happen|work)|worth it|success rate|any luck|how (long|often) did it actually|other people'?s? experience|similar situation)\b/i;

/**
 * Asking what to do, without naming a rule.
 *
 * Open-ended and situational. Nobody asks "what should I do?" wanting a citation;
 * they want to know what a person in their position does next, which is what a
 * story is.
 */
const ASKS_WHAT_TO_DO =
  /\b(what (should|do) i do|what are my options|what now|what next|where do i (start|begin)|how do i handle|i don'?t know what to do|help me (figure|work) out|what would you do)\b/i;

/**
 * Asking about a rule, where a definite answer exists and a story can contradict
 * it.
 *
 * Checked last and used to veto, because being wrong in this direction is the
 * expensive one: leading with an anecdote on "how many days do I have" is how
 * somebody miscounts a deadline.
 */
const ASKS_ABOUT_A_RULE =
  /\b(is it (legal|allowed|permitted)|am i (allowed|eligible|permitted)|does .{0,30}(count|qualify|authorise|authorize)|what is the (rule|deadline|limit|requirement)|how many days|how long is (the|my) (grace|period)|do i need to|can i legally|is that (required|mandatory)|what does the (law|regulation|rule) say)\b/i;

export function classifyEvidenceKind(question: string, requiredPointCount: number): EvidenceKind {
  const asksExperience = ASKS_FOR_EXPERIENCE.test(question);
  const asksWhatToDo = ASKS_WHAT_TO_DO.test(question);

  // An explicit request for what people did outranks a rule phrasing appearing in
  // the same sentence — "is it worth it, and is it even allowed?" is someone
  // asking both, and the part no regulation answers is the part only Haven has.
  if (!asksExperience && ASKS_ABOUT_A_RULE.test(question)) return "rules";
  if (!asksExperience && !asksWhatToDo) return "rules";

  // The rules have something mandatory to say, so it goes first. The story goes
  // directly under it, not at the bottom.
  return requiredPointCount > 0 ? "mixed" : "experience";
}

/**
 * How close a story has to be before it is allowed to lead.
 *
 * Leading with a loose match is worse than not leading with one: it tells somebody
 * "here is a person like you" when the person is not like them, and the whole
 * value of the story is the likeness. Below the bar the story still appears in the
 * answer — it just does not get to open it.
 *
 * Two independent routes over the bar, because they catch different things.
 * Similarity catches a story about the same *situation*; the profile score catches
 * one about the same *person*. Either alone is enough; requiring both would reject
 * a perfect account of this exact predicament from somebody on a different visa.
 */
const MIN_SIMILARITY_TO_LEAD = 0.55;
const MIN_PROFILE_SCORE_TO_LEAD = 3;

export interface StoryLeadDecision {
  /** The story that should open the answer, or null. */
  story: CommunityAdviceSummary | null;
  kind: EvidenceKind;
  /** Why, in one line, for the trace and for reading a bad answer back later. */
  reason: string;
}

/**
 * Decide whether a story opens this answer.
 *
 * `profileScore` is the existing re-ranking score, passed in rather than
 * recomputed so there is one scorer.
 */
export function decideStoryLead(input: {
  question: string;
  requiredPointCount: number;
  stories: readonly CommunityAdviceSummary[];
  profileScore: (story: CommunityAdviceSummary) => number;
}): StoryLeadDecision {
  const kind = classifyEvidenceKind(input.question, input.requiredPointCount);

  if (kind === "rules") {
    return { story: null, kind, reason: "The regulations answer this; a story cannot improve it and could contradict it." };
  }

  if (input.stories.length === 0) {
    return { story: null, kind, reason: "No community stories were retrieved for this question." };
  }

  const ranked = [...input.stories]
    .map((story) => ({
      story,
      similarity: story.similarity ?? 0,
      profile: input.profileScore(story)
    }))
    .sort((left, right) => right.similarity + right.profile / 10 - (left.similarity + left.profile / 10));

  const best = ranked[0];
  const closeEnough = best.similarity >= MIN_SIMILARITY_TO_LEAD || best.profile >= MIN_PROFILE_SCORE_TO_LEAD;

  if (!closeEnough) {
    return {
      story: null,
      kind,
      reason: `Closest story was not close enough to lead (similarity ${best.similarity.toFixed(2)}, profile match ${best.profile}).`
    };
  }

  return {
    story: best.story,
    kind,
    reason: `"${best.story.title}" leads (similarity ${best.similarity.toFixed(2)}, profile match ${best.profile}).`
  };
}

/**
 * Turn the decision into instructions.
 *
 * Says where the story goes rather than restating the story, because the story
 * itself is already in the prompt — and because a block the model is told to
 * reproduce is a block it reproduces verbatim, which is how Haven's internal
 * bulletin record ended up printed in somebody's answer.
 */
export function renderStoryLeadForPrompt(decision: StoryLeadDecision): string[] {
  if (!decision.story) {
    if (decision.kind === "rules") {
      return [
        "This question has an answer in the regulations, so answer it from them. If a community story genuinely adds something, it goes after the answer and never in place of it — and never let one imply a rule is different from what the sources say."
      ];
    }
    return [
      "No community story is close enough to this person's situation to open the answer. Do not stretch one to fit. Answer directly and keep it short — padding with general rules to fill the space is what makes this read like every other chatbot."
    ];
  }

  const lead = [
    `Open with the story titled "${decision.story.title}". Not a mention of it — the account itself: what their situation was, what they actually did, in what order, and how it turned out.`,
    "Then say what it means for this person: what carries across to them, what does not, and what is different about their facts. That comparison is the answer, and it is the part no other chatbot can write.",
    "Say once, in your own words, that it is one person's experience rather than a rule. Do not hedge every sentence."
  ];

  if (decision.kind === "mixed") {
    return [
      "There is one thing the regulations require you to say before anything else — it is in the decision guardrails above. Say that first, in a sentence or two.",
      ...lead
    ];
  }

  return [
    "Nothing in the regulations answers this question, so do not open with rules. What people actually did is the answer.",
    ...lead
  ];
}
