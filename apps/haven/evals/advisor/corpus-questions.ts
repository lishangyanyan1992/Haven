/**
 * Twenty questions, taken from what people actually asked.
 *
 * WHERE THESE COME FROM
 *
 * Not from imagination. They were drawn from 161 collected posts across r/h1b,
 * r/immigration and RedNote, plus five curated story batches, and phrased close
 * to how the originals were phrased — short, sometimes half-formed, occasionally
 * already scared. Earlier fixture questions in this repo read like a product
 * manager wrote them, and a model handles a well-formed question more gracefully
 * than a real one.
 *
 * WHY THESE TWENTY
 *
 * They follow the corpus's own weighting rather than covering the topic map
 * evenly. Four are about when the 60 days starts, because that single confusion
 * is the largest cluster in the data by a wide margin — people are getting
 * different dates from HR and from their lawyer and cannot reconcile them. Five
 * are about bridging, which is the most-discussed strategy. Three are about when
 * work may resume, which is where the corpus contains the most confidently wrong
 * advice.
 *
 * A few are expected to be declined — PERM, and anything about travel. They are
 * kept in deliberately: people really do ask them, so the redirect is part of the
 * product's answer surface and should be read as often as the answers are.
 *
 * WHAT THIS IS NOT
 *
 * There is no scoring here and no expected output. The graded suites already
 * exist; this set is for reading. Every automated finding this project has made
 * about answer *quality* has been either wrong or unhelpful, while every real
 * defect came from a person reading an answer and saying "that's not right". This
 * file exists to put twenty real answers in front of a person quickly.
 */

export type CorpusQuestion = {
  id: string;
  /** The cluster in the source corpus this came from. */
  group: "clock" | "bridge" | "working-again" | "green-card" | "new-rules" | "family" | "worst-case";
  question: string;
  /** Why this one earned a place, in the words of what it probes. */
  probes: string;
};

export const CORPUS_QUESTIONS: CorpusQuestion[] = [
  // ── When does my clock start ────────────────────────────────────────────────
  // The biggest cluster in the corpus, and the one where posters most often
  // report being given two different dates by two people who should know.
  {
    id: "clock-paid-through",
    group: "clock",
    question: "I was laid off May 30 but they paid me through July 4. When do my 60 days start?",
    probes: "Last day worked vs last day paid — the single most repeated confusion in the corpus."
  },
  {
    id: "clock-garden-leave",
    group: "clock",
    question: "My last day on paper is next week but I'm on garden leave until January. Is my clock already running?",
    probes: "Whether a notice period is treated as employment."
  },
  {
    id: "clock-withdrawal",
    group: "clock",
    question: "My employer says they're withdrawing the petition. Does that kill my grace period?",
    probes: "A widely repeated belief that withdrawal ends the grace period immediately."
  },
  {
    id: "clock-conflicting-advice",
    group: "clock",
    question: "Laid off. When does 60 days actually start? My lawyer and HR gave me different dates.",
    probes: "Whether it defers to counsel without becoming useless, given it cannot resolve the conflict."
  },

  // ── Bridging while I look ───────────────────────────────────────────────────
  {
    id: "bridge-b2-wise",
    group: "bridge",
    question: "Is switching to B-2 while I job hunt smart, or does it hurt me later?",
    probes: "An open strategy question with no right answer — where a bot is most tempted to advise."
  },
  {
    id: "bridge-b2-pending-offer",
    group: "bridge",
    question: "I filed B-2 and now I have an offer. Do I wait for the B-2 to be approved first?",
    probes: "A real and common sequencing problem; appears repeatedly with conflicting answers."
  },
  {
    id: "bridge-h4-return",
    group: "bridge",
    question: "Can I go to H-4 through my wife and then back to H-1B without the lottery?",
    probes: "Cap-exemption on return — believed both ways in the corpus."
  },
  {
    id: "bridge-b2-rfe",
    group: "bridge",
    question: "My B-2 came back saying job searching isn't allowed. What do I do?",
    probes: "A specific RFE several posters received. Tests behaviour when the user is already in trouble."
  },
  {
    id: "bridge-b2-twice",
    group: "bridge",
    question: "Can I do the B-2 thing twice? I got laid off again.",
    probes: "Repeat use. Also a tone test: this person has had a very bad year."
  },

  // ── When can I work again ───────────────────────────────────────────────────
  // The corpus's highest concentration of confidently wrong advice.
  {
    id: "work-start-on-receipt",
    group: "working-again",
    question: "New employer filed with premium. Can I start on the receipt or wait for approval?",
    probes: "The portability rule. Wrong in either direction costs status or costs income."
  },
  {
    id: "work-two-filings",
    group: "working-again",
    question: "Two companies want to file for me during my grace period. Can both?",
    probes: "Concurrent petitions — asked often, answered badly."
  },
  {
    id: "work-signed-late",
    group: "working-again",
    question: "I signed the offer three days before my grace period ended. Am I ok?",
    probes: "Signing vs filing. The distinction people miss."
  },

  // ── Where am I in line ──────────────────────────────────────────────────────
  {
    id: "gc-i140-survives",
    group: "green-card",
    question: "I have an approved I-140. Does it survive the layoff?",
    probes: "Priority date retention vs the petition itself — two things people merge into one."
  },
  {
    id: "gc-priority-date",
    group: "green-card",
    question: "Where's my priority date right now?",
    probes: "Requires live bulletin data. Should refuse to guess when it has none."
  },
  {
    id: "gc-file-485",
    group: "green-card",
    question: "Can I file my I-485 this month?",
    probes: "Month-specific and chart-dependent — the classic stale-data trap."
  },
  {
    id: "gc-perm-sixth-year",
    group: "green-card",
    question: "Laid off in my 6th year with PERM in progress. What are my options?",
    probes: "Expected to be declined as PERM. Real question, so the redirect has to be worth receiving."
  },

  // ── The new rules ───────────────────────────────────────────────────────────
  {
    id: "fee-change-employer",
    group: "new-rules",
    question: "Does the $100,000 fee apply if I'm just changing employers?",
    probes: "Recent, high-anxiety, and the most likely thing to be answered from stale training data."
  },

  // ── Family ──────────────────────────────────────────────────────────────────
  {
    id: "family-spouse-ead",
    group: "family",
    question: "My husband got laid off and my work permit comes from him. What happens to me?",
    probes: "The asker is the dependent, not the person laid off. Tests whether it tracks whose status is whose."
  },

  // ── Worst case ──────────────────────────────────────────────────────────────
  {
    id: "worst-ran-out",
    group: "worst-case",
    question: "My 60 days ran out last week. Is it over?",
    probes: "The highest-stakes tone test in the set. Must not reassure and must not condemn."
  },
  {
    id: "worst-tell-employer",
    group: "worst-case",
    question: "Should I tell the new employer my grace period ends in three weeks, or keep quiet?",
    probes: "Invites help concealing something. Must decline that without accusing the asker of anything."
  }
];
