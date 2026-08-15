/**
 * The guardrail registry — every safety-critical line the Advisor is told to say,
 * in one reviewable place (CD-13.1).
 *
 * Before this file, all of it lived as string literals inside `service.ts`. That
 * had the same failure mode the conversation-design literature warns about when
 * prompts live inside flow-diagram boxes: the copy cannot be reviewed, diffed, or
 * signed off by the person who actually knows the domain. Here, an immigration
 * attorney can read and correct the Advisor's safety wording without opening a
 * 1,800-line service file, and a regression fixture can assert *which* guardrail
 * fired instead of substring-matching on English prose.
 *
 * Rules for this file:
 *
 * - Ids are stable. They are cited from traces, fixtures, and review notes; renaming
 *   one silently invalidates every assertion that referenced it.
 * - `text` is the whole of what the Advisor is told. Nothing safety-bearing may be
 *   appended at the call site.
 * - `repeat` decides whether an entry may fire more than once in a thread. Hard
 *   safety lines are `always`. Orientation and option menus are `once-per-thread`
 *   (CD-13.4) — the reason the Advisor used to restate the same five options on
 *   every turn of a layoff conversation.
 * - `lastReviewedBy` records who last checked the wording. `null` means it has
 *   never had domain review; the check script reports those as a standing gap
 *   rather than failing, because that is the honest current state.
 */

import type { TopicBucket } from "@/lib/advisor/topics";

export type GuardrailAudience =
  /** Injected into the model prompt; the user never sees this wording verbatim. */
  | "model"
  /** Appended to or substituted into the answer; the user reads this exact text. */
  | "user";

export type GuardrailRepeat = "always" | "once-per-thread";

export type GuardrailReviewer = "immigration-counsel" | "product" | null;

export interface GuardrailEntry {
  id: string;
  topic: TopicBucket | "cross-cutting";
  audience: GuardrailAudience;
  repeat: GuardrailRepeat;
  /** Why this exists. Read by reviewers, never sent to the model. */
  intent: string;
  lastReviewedBy: GuardrailReviewer;
  lastReviewedAt: string | null;
  text: string;
  /**
   * How to tell this entry was already delivered earlier in the thread.
   *
   * Only meaningful for `once-per-thread` entries. `audience: "user"` entries are
   * appended verbatim, so an exact text match is enough and this may be omitted.
   * `audience: "model"` entries never appear in the answer as written, so they need
   * a pattern that recognises the *effect* in the assistant's own words.
   */
  deliveredWhen?: RegExp;
}

const ENTRIES: GuardrailEntry[] = [
  // ---------------------------------------------------------------------------
  // Decision guardrails — injected into the prompt before generation.
  // ---------------------------------------------------------------------------
  {
    id: "GR_AC21_PORTABILITY",
    topic: "job-change",
    audience: "model",
    repeat: "always",
    intent: "Stop the Advisor implying an approved I-140 alone enables job portability.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "AC21/job portability: if no Form I-485 is filed or pending, say AC21 adjustment portability generally does not solve the job-change problem. An approved I-140 alone is not AC21 portability. Always mention the pending-I-485 180-day rule and same-or-similar occupational classification requirement, and say role differences and sponsorship strategy need attorney review."
  },
  {
    id: "GR_VISA_BULLETIN_FILING_CHART",
    topic: "visa-bulletin",
    audience: "model",
    repeat: "always",
    intent: "Never answer a filing-eligibility question from Final Action Dates alone.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Visa bulletin/I-485 filing: never give a hard yes/no from Final Action Dates alone. State that USCIS's monthly adjustment filing-chart page controls whether employment-based applicants must use Final Action Dates or may use Dates for Filing. User-stated dates override Haven profile dates; do not insert a Haven profile priority date unless the user explicitly asks you to use their Haven profile. Preferred wording: 'You may be able to file only if USCIS authorizes Dates for Filing for that month and your priority date is earlier than that cutoff, assuming all other eligibility requirements are met.' Avoid opening with 'you cannot file' when Dates for Filing may be usable."
  },
  {
    id: "GR_I485_TRAVEL",
    topic: "adjustment-of-status",
    audience: "model",
    repeat: "always",
    intent: "Separate pending advance parole from approved advance parole; state abandonment risk.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Pending I-485 travel: distinguish these in plain English: visa stamp = entry document for requesting admission at the border/airport; status = lawful classification while inside the U.S.; advance parole = travel/reentry document tied to the pending adjustment case. A pending I-131/AP request is not approved advance parole. Avoid absolute wording like 'you cannot travel'; say not to travel based only on pending advance parole and explain that travel depends on approved AP or another valid reentry strategy confirmed with counsel. Explicitly warn that departure without approved advance parole or another valid reentry basis can cause USCIS to treat the I-485 as abandoned. If H-1B status is valid but the visa stamp is expired, explain that H-1B reentry generally requires a valid visa stamp unless the person returns with approved advance parole or qualifies for a narrow exception such as automatic visa revalidation. List practical attorney-review options: wait for AP approval, evaluate H-1B consular stamping, or evaluate limited automatic visa revalidation only if the itinerary and facts qualify."
  },
  {
    // Split from the old single layoff guardrail. The hard safety rules fire on
    // every layoff turn; the option menu below fires once per thread (CD-13.4).
    id: "GR_LAYOFF_SAFETY_RULES",
    topic: "layoffs",
    audience: "model",
    repeat: "always",
    intent: "The non-negotiable layoff rules: stay/work separation, no unauthorized work, LCA is not protection.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "H-1B layoff/transfer: separate ability to remain in the U.S. from ability to work. Include these exact safety points in the answer: 'Do not work without authorization' and 'LCA preparation alone does not preserve status.' Do not suggest an unpaid role, volunteer role, or temporary position as a way to preserve H-1B status. Do not use last paycheck as the grace-period trigger unless the source and facts support it. Mention that the grace period is up to 60 days or until I-94/petition validity ends, whichever is shorter. For a new employer, preparation, LCA work, or documents sitting with the employer are not the same as a properly filed nonfrivolous H-1B petition. If the user gives dates, calculate the rough timeline and say what must be filed before day 60. Tell the user to confirm the exact deadline and filing strategy with immigration counsel immediately."
  },
  {
    id: "GR_LAYOFF_OPTION_MENU",
    topic: "layoffs",
    audience: "model",
    repeat: "once-per-thread",
    intent:
      "Lay out the fallback options once. Repeating the full menu on every turn is what made layoff threads read as boilerplate (CD-13.4).",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "In urgent grace-period cases, list concrete options without ranking them as legal strategy: immediate H-1B filing/receipt strategy, possible change of status such as B-2 if appropriate, departure planning and possible consular return if no timely filing is possible, premium processing or employer escalation if available, and immediate counsel review. Present them as options to raise with counsel, not as a recommendation.",
    // The model rewrites this in its own words, so recognise the menu by its shape:
    // an answer that reaches for at least three of the five routes has delivered it.
    deliveredWhen:
      /(change of status|b-2)[\s\S]*(depart|consular)[\s\S]*(premium processing|escalat)|(depart|consular)[\s\S]*(change of status|b-2)[\s\S]*(premium processing|escalat)/i
  },
  {
    id: "GR_OPT_WORK_AUTHORIZATION",
    topic: "student-status",
    audience: "model",
    repeat: "always",
    intent: "A pending OPT application is not work authorization.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "F-1 OPT/STEM OPT work authorization: a pending OPT application is not work authorization. Tell the user not to begin OPT work until the EAD/work authorization is valid, and suggest checking USCIS case status, contacting the DSO, and coordinating the start date/I-9 timing with the employer."
  },
  {
    id: "GR_CPT_DAY1",
    topic: "student-status",
    audience: "model",
    repeat: "always",
    intent: "Do not accept Day 1 CPT school marketing at face value.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "CPT/Day 1 CPT: do not accept '100% safe' school marketing. Explain that CPT must be DSO-authorized, documented on the Form I-20 before work begins, curricular/integral to the program, and tied to the course/program. Mention that 12 months or more of full-time CPT can affect post-completion OPT eligibility. Tell the user to verify SEVP certification/accreditation, course syllabus or credit requirement, employer-course nexus, I-20 employer/dates/full-time or part-time details, attendance/enrollment rules, and future visa risks with the DSO and immigration counsel before enrolling. Call out red flags such as guaranteed CPT from day one, minimal coursework, weak faculty involvement, or a program mainly structured to enable employment."
  },
  {
    id: "GR_CSPA_AGE_OUT",
    topic: "cspa",
    audience: "model",
    repeat: "always",
    intent: "Never compute a CSPA age from partial facts; flag urgency.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "CSPA/age-out: flag urgency when a child is close to 21 and say attorney review should happen immediately. Do not calculate a definitive CSPA age without full facts. Do not insert a specific priority date, I-140 date, or 180-day rule unless the user provided that fact in the question. Tell the user to ask counsel about the CSPA age formula, visa availability date, petition pending time, 'sought to acquire' within one year, extraordinary circumstances, adjustment vs consular processing, and filing timing. Suggest gathering I-140 approval, priority-date proof, birth/passport records, receipts, and any evidence of efforts to seek permanent residence."
  },
  {
    id: "GR_NIW_DENIAL",
    topic: "self-petition",
    audience: "model",
    repeat: "always",
    intent: "Refiling is not automatically the right strategy after an NIW denial.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "NIW denial/refiling: do not assume refiling is best. Tell the user to have counsel review the denial notice and all deadlines, compare refiling with motion/appeal options, and address the Dhanasar framework: substantial merit/national importance, well-positioned to advance the endeavor, and benefit of waiving the job offer/labor certification. Suggest concrete evidence to discuss: a narrower proposed endeavor, implementation plan, measurable objectives, expert letters, publications or citations showing field impact, funding/contracts, adoption by users or institutions, and records already submitted."
  },
  {
    id: "GR_UNAUTHORIZED_WORK",
    topic: "work-authorization",
    audience: "model",
    repeat: "always",
    intent: "Refuse to help conceal or misrepresent facts to USCIS.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Unauthorized work/misrepresentation safety: refuse any help hiding or misrepresenting facts to USCIS. Tell the user not to continue unauthorized work, preserve dates/pay records/messages, and speak with an immigration attorney immediately about truthful disclosure and possible immigration consequences. Do not draft misleading language."
  },

  // ---------------------------------------------------------------------------
  // Answer-repair fragments — appended to the answer when a check finds the model
  // omitted something mandatory. The user reads these words exactly as written.
  // ---------------------------------------------------------------------------
  {
    id: "FIX_GRACE_PERIOD_CAP",
    topic: "layoffs",
    audience: "user",
    repeat: "always",
    intent: "Correct an answer that treats the I-94 date as the grace-period endpoint.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "The grace period is capped at up to 60 days from the employment-termination date, or the end of I-94 or petition validity, whichever comes first — a later I-94 date does not extend it."
  },
  {
    id: "FIX_NO_UNAUTHORIZED_WORK",
    topic: "layoffs",
    audience: "user",
    repeat: "always",
    intent: "The single most consequential sentence in the product.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Do not work without authorization."
  },
  {
    id: "FIX_LCA_NOT_PROTECTION",
    topic: "layoffs",
    audience: "user",
    repeat: "always",
    intent: "LCA preparation is routinely mistaken for status protection.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "LCA preparation alone does not preserve status; the key event is a properly filed nonfrivolous H-1B petition."
  },
  {
    id: "FIX_FALLBACK_OPTIONS",
    topic: "layoffs",
    audience: "user",
    repeat: "once-per-thread",
    intent: "Name the options once when the answer offered none.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "If the new employer cannot file Form I-129 before day 60, ask counsel immediately about change of status, departure planning, possible consular return, premium processing or employer escalation, and receipt-notice timing."
  },
  {
    id: "FIX_PORTABILITY_TRIGGER",
    topic: "layoffs",
    audience: "user",
    repeat: "always",
    intent: "A receipt notice is evidence of filing, not the filing itself.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "For H-1B portability, the key event is a properly filed nonfrivolous H-1B petition while the worker remains in an authorized period; a receipt notice is useful evidence of filing, not a substitute for the filing itself."
  },
  {
    id: "FIX_IMMEDIATE_COUNSEL",
    topic: "layoffs",
    audience: "user",
    repeat: "always",
    intent: "Grace-period deadlines are fact-specific and time-critical.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Confirm the exact grace-period deadline and filing strategy with immigration counsel immediately."
  },
  {
    id: "FIX_CPT_I20",
    topic: "student-status",
    audience: "user",
    repeat: "always",
    intent: "CPT work before I-20 authorization is unauthorized work.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Do not start CPT work until DSO authorization is recorded on the Form I-20."
  },
  {
    id: "FIX_CPT_OPT_RISK",
    topic: "student-status",
    audience: "user",
    repeat: "always",
    intent: "Full-time CPT can cost post-completion OPT eligibility.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Ask the DSO how any full-time CPT would affect post-completion OPT, including the 12-month full-time CPT limit."
  },
  {
    id: "FIX_AP_DISTINCTION",
    topic: "adjustment-of-status",
    audience: "user",
    repeat: "always",
    intent: "Three concepts users routinely conflate.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Visa stamp means the entry document used to request admission; status means the lawful classification while inside the U.S.; advance parole is a separate travel/reentry document for a pending adjustment case."
  },
  {
    id: "FIX_PENDING_AP",
    topic: "adjustment-of-status",
    audience: "user",
    repeat: "always",
    intent: "Pending AP is not permission to travel.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Pending advance parole is not enough by itself for travel; do not travel based only on a pending I-131/AP application."
  },
  {
    id: "FIX_I485_ABANDONMENT",
    topic: "adjustment-of-status",
    audience: "user",
    repeat: "always",
    intent: "Departure without AP can abandon the adjustment application.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Leaving without approved advance parole or another valid reentry basis can cause USCIS to treat the I-485 as abandoned."
  },
  {
    id: "FIX_REENTRY_OPTIONS",
    topic: "adjustment-of-status",
    audience: "user",
    repeat: "once-per-thread",
    intent: "Name the three reentry routes once when the answer offered none.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "If travel is unavoidable, ask counsel about three options before departure: waiting for approved AP, obtaining a new H-1B visa stamp abroad, or using limited automatic visa revalidation only if the itinerary and facts qualify."
  },
  {
    id: "FIX_REENTRY_COUNSEL",
    topic: "adjustment-of-status",
    audience: "user",
    repeat: "always",
    intent: "Reentry risk is fact-specific.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Confirm the reentry strategy with immigration counsel before departure because CBP, consular processing, and abandonment risks are fact-specific."
  },
  {
    id: "FIX_NIW_NO_ASSUMPTION",
    topic: "self-petition",
    audience: "user",
    repeat: "always",
    intent: "Refiling is not the default answer.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Do not assume refiling is best."
  },
  {
    id: "FIX_NIW_DEADLINES",
    topic: "self-petition",
    audience: "user",
    repeat: "always",
    intent: "Motion and appeal windows are short and easy to miss.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Ask counsel to review the denial notice for motion, appeal, or refiling deadlines before choosing a strategy."
  },
  {
    id: "FIX_CSPA_NO_CALCULATION",
    topic: "cspa",
    audience: "user",
    repeat: "always",
    intent: "A CSPA age computed from partial facts is worse than none.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Do not calculate CSPA age from incomplete facts; ask counsel to calculate it using the full record."
  },
  {
    id: "FIX_CSPA_IMMEDIATE_REVIEW",
    topic: "cspa",
    audience: "user",
    repeat: "always",
    intent: "Age-out deadlines cannot be recovered once missed.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Because the child is close to 21, consult an immigration attorney immediately about CSPA, sought-to-acquire timing, and filing options."
  },
  {
    id: "FIX_GRACE_PERIOD_DATE_FREE",
    topic: "layoffs",
    audience: "user",
    repeat: "always",
    intent:
      "Replaces a model-asserted grace-period end date. Must never contain a date: an earlier version substituted an eval fixture's dates into real users' answers.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "The grace period runs up to 60 days from the employment-termination date, or until the I-94 or petition validity ends, whichever comes first. Confirm the exact termination date and the resulting deadline with immigration counsel before relying on it."
  },
  {
    id: "FIX_PORTABILITY_RECEIPT_NOTICE",
    topic: "layoffs",
    audience: "user",
    repeat: "always",
    intent: "Replaces a model claim that work cannot start until the receipt notice arrives.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "For H-1B portability, work authorization generally depends on the new employer properly filing a nonfrivolous H-1B petition while the worker remains in an authorized period; the receipt notice is useful evidence of that filing and should be reviewed with counsel."
  },
  {
    id: "FIX_NO_UNPAID_WORKAROUND",
    topic: "layoffs",
    audience: "user",
    repeat: "always",
    intent: "Replaces any suggestion that an unpaid or volunteer role preserves status.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "\n- **No unpaid-work workaround**: Do not rely on an unpaid role, volunteer role, or temporary position to preserve H-1B status without counsel confirming work authorization and status strategy."
  },
  {
    id: "FIX_AP_TRAVEL_HEDGE",
    topic: "adjustment-of-status",
    audience: "user",
    repeat: "always",
    intent: "Replaces absolute 'you cannot travel' wording (CD-10.x: avoid false certainty).",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Do not travel based only on the pending advance parole application. International travel while Form I-485 is pending is high-risk and depends on approved advance parole or another valid reentry strategy confirmed with counsel."
  },
  {
    id: "FIX_AP_TRAVEL_HEDGE_SHORT",
    topic: "adjustment-of-status",
    audience: "user",
    repeat: "always",
    intent: "Shorter variant of FIX_AP_TRAVEL_HEDGE for the narrower model phrasing.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Do not travel based only on a pending I-131/AP application while Form I-485 is pending."
  },

  // ---------------------------------------------------------------------------
  // Cross-cutting user-facing copy.
  // ---------------------------------------------------------------------------
  {
    id: "MSG_DISCLAIMER",
    topic: "cross-cutting",
    audience: "user",
    repeat: "always",
    intent: "Shown with every answer.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "Haven provides information, not legal advice. Check a qualified immigration attorney before making decisions."
  },
  {
    id: "MSG_MODERATION_REFUSAL",
    topic: "cross-cutting",
    audience: "user",
    repeat: "always",
    intent: "Declining a flagged message without shaming the user.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: "I can help with work visa and green card questions, but I can't continue with this message as written. Rephrase it as a factual immigration or Haven-product question and I'll answer from official sources."
  },
  {
    // The distress branch. Previously a self-harm disclosure received
    // MSG_MODERATION_REFUSAL — the same "rephrase it as a factual immigration
    // question" given to a spammer. The moderation API already returns the
    // category; only the routing was missing.
    //
    // This deliberately does not try to counsel anyone. Haven is not equipped to,
    // and pretending otherwise would keep someone in a chat window instead of on a
    // line with a person. Its whole job is to hand off to help outside Haven,
    // quickly and without shame, and to stay reachable afterwards.
    //
    // NEEDS QUALIFIED REVIEW before this ships. The resource numbers are correct
    // and stable; the wording is not clinician-written. The line about these
    // services being independent of USCIS matters most for this audience and is
    // the one most worth a second opinion — the fear that seeking help touches an
    // immigration case is real, common, and load-bearing here.
    id: "MSG_CRISIS_SUPPORT",
    topic: "cross-cutting",
    audience: "user",
    repeat: "always",
    intent:
      "Route a self-harm disclosure to real crisis support outside Haven, instead of the generic scope refusal (gate G2).",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: [
      "I'm reading something in your message that matters more than the immigration question, and it's outside what I can help with — not because it isn't important, but because you deserve a person rather than a chatbot for this.",
      "",
      "Please reach out to someone who can help right now:",
      "",
      "- **988 Suicide & Crisis Lifeline** — call or text **988**, free, 24/7, anywhere in the US. Spanish and ASL are available at [988lifeline.org](https://988lifeline.org).",
      "- **Crisis Text Line** — text **HOME** to **741741**, free, 24/7, in the US.",
      "- **Outside the US** — [findahelpline.com](https://findahelpline.com) lists free, confidential helplines by country.",
      "",
      "These services are independent of Haven and of USCIS. You do not need insurance, an immigration status, or a reason to call them.",
      "",
      "I'll still be here for the visa and green card questions whenever you want to come back to them."
    ].join("\n")
  },
  {
    // CD-13.2, first miss. The old behaviour was to assume h1b + adjustment-of-status
    // and answer with full confidence. This asks instead.
    id: "MSG_SCOPE_TRAVEL",
    topic: "adjustment-of-status",
    audience: "user",
    repeat: "always",
    intent:
      "Out of scope: travel with a pending case. Keeps the abandonment warning, which is the one thing the user must not learn later.",
    lastReviewedBy: "immigration-counsel",
    lastReviewedAt: null,
    text: [
      "I don't cover travel questions yet, and this is one I don't want to half-answer.",
      "",
      "The one thing worth knowing before you book anything: leaving the U.S. while an I-485 is pending, without approved advance parole or another valid basis to return, can cause USCIS to treat the application as abandoned. A pending advance parole request is not itself permission to travel.",
      "",
      "Talk to an immigration attorney before you travel, not after. If your trip is soon, treat that as urgent."
    ].join("\n")
  },
  {
    id: "MSG_SCOPE_STUDENT",
    topic: "student-status",
    audience: "user",
    repeat: "always",
    intent:
      "Out of scope: F-1 OPT/CPT. Keeps the two rules a student can break before anyone tells them it was a mistake.",
    lastReviewedBy: "immigration-counsel",
    lastReviewedAt: null,
    text: [
      "I don't cover F-1, OPT, or CPT questions yet.",
      "",
      "Two things worth knowing while you find someone who does: a pending OPT application is not permission to work — work generally requires the EAD in hand and the start date reached — and CPT must be authorized by your DSO and appear on your Form I-20 before you begin.",
      "",
      "Your DSO is the fastest first call, and an immigration attorney for anything involving a program that promises work from day one."
    ].join("\n")
  },
  {
    id: "MSG_SCOPE_JOB_CHANGE",
    topic: "job-change",
    audience: "user",
    repeat: "always",
    intent: "Out of scope: AC21 portability. Names the precondition people most often assume they have met.",
    lastReviewedBy: "immigration-counsel",
    lastReviewedAt: null,
    text: [
      "I don't cover AC21 job-portability questions yet.",
      "",
      "The thing most worth checking with counsel first: AC21 adjustment portability generally depends on having an I-485 that has been pending 180 days or more, and on the new role being in the same or a similar occupational classification. An approved I-140 on its own is usually not enough.",
      "",
      "Get an immigration attorney to look at your dates before you accept an offer."
    ].join("\n")
  },
  {
    id: "MSG_SCOPE_CSPA",
    topic: "cspa",
    audience: "user",
    repeat: "always",
    intent:
      "Out of scope: CSPA age-out. The only redirect where the deadline can pass while the person is still looking for help, so it says so first.",
    lastReviewedBy: "immigration-counsel",
    lastReviewedAt: null,
    text: [
      "I don't cover Child Status Protection Act questions yet — and this is the one I least want to guess at, because the deadline can pass while you are still working out what to do.",
      "",
      "Please contact an immigration attorney this week rather than when the birthday is closer. CSPA age depends on facts I cannot verify, and the calculation is not something to take from a chatbot.",
      "",
      "Worth gathering before that call: your priority date, the date the I-140 was filed and approved, and the date the category became current."
    ].join("\n")
  },
  {
    id: "MSG_SCOPE_SELF_PETITION",
    topic: "self-petition",
    audience: "user",
    repeat: "always",
    intent: "Out of scope: NIW and self-petitions. Names the deadline, because motion and appeal windows are short.",
    lastReviewedBy: "immigration-counsel",
    lastReviewedAt: null,
    text: [
      "I don't cover NIW or self-petition questions yet.",
      "",
      "If you are asking because something was denied, the deadlines matter more than the strategy: motion and appeal windows are short and start running from the notice, so read the denial notice for its specific deadline before deciding anything.",
      "",
      "An immigration attorney should see the actual notice — refiling is not automatically the right move."
    ].join("\n")
  },
  {
    id: "MSG_SCOPE_PERM",
    topic: "perm",
    audience: "user",
    repeat: "always",
    intent: "Out of scope: PERM. The lowest-urgency redirect, and deliberately the shortest.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: [
      "I don't cover PERM or labor certification questions yet.",
      "",
      "PERM is filed and managed by your employer, so your company's immigration team or the attorney handling your case will have the current status and timeline. They are the right first stop for this one."
    ].join("\n")
  },
  {
    id: "MSG_SCOPE_UNAUTHORIZED_WORK",
    topic: "work-authorization",
    audience: "user",
    repeat: "always",
    intent:
      "Out of scope as a topic, but the refusal to help conceal is a safety floor and survives the narrowing. Being out of scope must never read as being unwilling to say 'stop'.",
    lastReviewedBy: "immigration-counsel",
    lastReviewedAt: null,
    text: [
      "I don't cover work-authorization history questions yet, and I won't help present the facts in a way that hides anything from USCIS — that makes things considerably worse than the original problem.",
      "",
      "What is safe to do now: stop any work that is not authorized, preserve your records rather than deleting or amending them, and speak to an immigration attorney about truthful disclosure and what the actual consequences are.",
      "",
      "This is worth a real consultation. It is one of the few things where the response genuinely changes the outcome."
    ].join("\n")
  },
  {
    id: "MSG_DATA_DISCLOSURE_CLOSING",
    topic: "haven-product",
    audience: "user",
    repeat: "always",
    intent:
      "Close the 'what do you know about me?' answer with the policy half: where the data came from, when it gets used, and how to change it. The factual half is composed from the live snapshot in service.ts; this is the part that is pure copy and most needs review.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: [
      "All of it came from you — what you entered in your Haven profile, plus anything you told me in an earlier conversation.",
      "",
      "I only bring these details into an answer when your question turns on them. Asking a general question about the rules will not pull your dates into the reply.",
      "",
      "You can change or clear any of it from your Haven profile."
    ].join("\n")
  },
  {
    id: "MSG_DATA_DISCLOSURE_EMPTY",
    topic: "haven-product",
    audience: "user",
    repeat: "always",
    intent:
      "The same question when the profile is empty. Says so plainly rather than returning a bare heading with nothing under it.",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: [
      "Nothing yet — your Haven profile is empty and we have not spoken before.",
      "",
      "That means my answers will be general. Filling in your visa type, priority date, and category in your Haven profile is what lets me answer for your situation rather than in the abstract."
    ].join("\n")
  },
  {
    id: "MSG_CLARIFY_UNRECOGNIZED",
    topic: "cross-cutting",
    audience: "user",
    repeat: "always",
    intent: "Ask rather than guess when nothing in the question classified (CD-12.3).",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: [
      "I want to make sure I answer the right question rather than guess at it.",
      "",
      "Which of these is closest to what you're asking about?",
      "",
      "- **Your current status** — H-1B, F-1/OPT, or a change of status",
      "- **A job change or job loss** — transfers, portability, or a grace period",
      "- **Your green card process** — PERM, I-140, priority dates, or I-485",
      "- **Travel or documents** — advance parole, visa stamps, or reentry",
      "- **Haven itself** — your timeline, profile, or documents",
      "",
      "Or just tell me what happened in your own words — the dates and your current visa are the most useful details."
    ].join("\n")
  },
  {
    // CD-13.2, second consecutive miss. Stop guessing, change tack, name a destination.
    id: "MSG_ESCALATE_AFTER_MISSES",
    topic: "cross-cutting",
    audience: "user",
    repeat: "always",
    intent:
      "The exit. A user who has been misunderstood twice should not have to hunt for the way out (gate G6, CD-12.9).",
    lastReviewedBy: null,
    lastReviewedAt: null,
    text: [
      "I've asked twice and I'm still not confident I understand your situation well enough to answer safely — so I'd rather point you somewhere useful than guess again.",
      "",
      "- **Talk to an immigration attorney** — [browse immigration lawyers](/lawyers). Worth doing now if anything in your situation is time-sensitive.",
      "- **Ask people in the same situation** — [the Haven community](/community) sees questions like yours daily.",
      "- **Read the official guidance** — [Haven's source library](/resources) links the USCIS and eCFR pages directly.",
      "",
      "If you'd like to try me once more, the most useful things to include are your current visa, the relevant dates, and what decision you're trying to make."
    ].join("\n")
  }
];

const BY_ID = new Map<string, GuardrailEntry>(ENTRIES.map((entry) => [entry.id, entry]));

/** Every registered entry, for review tooling and the coverage check. */
export function allGuardrails(): readonly GuardrailEntry[] {
  return ENTRIES;
}

export function getGuardrail(id: string): GuardrailEntry {
  const entry = BY_ID.get(id);
  if (!entry) {
    // Throwing beats returning empty text: a typo'd id must not silently remove a
    // safety line from an answer.
    throw new Error(`Unknown guardrail id: ${id}`);
  }
  return entry;
}

export function guardrailText(id: string): string {
  return getGuardrail(id).text;
}

/**
 * Resolve a list of ids to their text, dropping `once-per-thread` entries whose
 * text has already been delivered in this thread (CD-13.4).
 *
 * `alreadyDelivered` is the set of ids the thread has already seen — see
 * `thread-state.ts`. Entries marked `always` are never dropped.
 */
export function resolveGuardrails(ids: string[], alreadyDelivered: ReadonlySet<string>) {
  const fired: string[] = [];
  const suppressed: string[] = [];

  for (const id of ids) {
    const entry = getGuardrail(id);
    if (entry.repeat === "once-per-thread" && alreadyDelivered.has(id)) {
      suppressed.push(id);
      continue;
    }
    fired.push(id);
  }

  return {
    fired,
    suppressed,
    texts: fired.map((id) => guardrailText(id))
  };
}
