/**
 * Attributes for the options the Advisor offers after a job loss (CD-13.3).
 *
 * The Advisor lists five fallback options in an urgent grace-period answer. The
 * predictable next turn is "which one is fastest?" or "what does that cost?" — and
 * until now there was nothing behind those options at all, so the model answered
 * from parametric memory and produced numbers no source supports. In a decision
 * with a 60-day fuse, an invented filing fee or processing time is a real harm.
 *
 * The fix is not to invent the attributes here — that would be the same failure with
 * a nicer file name. Each attribute is either:
 *
 *   - **sourced**: supported by a document in `trustedKnowledgeDocuments`, cited by slug; or
 *   - **unsourced**: explicitly recorded as unknown, with the reason.
 *
 * Unsourced attributes are injected into the prompt as explicit do-not-state
 * instructions, so the gap produces a hedge instead of a hallucination. The check
 * script prints the unsourced set as a standing knowledge-corpus gap — which is
 * currently large, because `trustedKnowledgeDocuments` contains zero documents in
 * the `layoffs` topic (its one layoffs entry is a community summary, not an
 * official source).
 */

export interface OptionAttribute {
  /** What the attribute answers, in the user's words. */
  question: string;
  /** Present when a trusted document supports an answer. */
  sourced: {
    /** `slug` from `trustedKnowledgeDocuments`. */
    documentSlug: string;
    /** What that document actually supports — not a paraphrase that goes further. */
    statement: string;
  } | null;
  /** Present when nothing in the corpus supports an answer. */
  unsourced: {
    reason: string;
  } | null;
}

export interface LayoffOption {
  id: string;
  label: string;
  /** One line the Advisor may state without qualification. */
  summary: string;
  attributes: OptionAttribute[];
}

export const LAYOFF_OPTIONS: LayoffOption[] = [
  {
    id: "OPT_NEW_EMPLOYER_FILING",
    label: "A new employer files an H-1B petition",
    summary:
      "A new employer properly files a nonfrivolous H-1B petition while you are still in an authorized period.",
    attributes: [
      {
        question: "What actually has to happen for me to start work?",
        sourced: {
          documentSlug: "ecfr-214-2-h1b-portability",
          statement:
            "8 CFR 214.2 conditions new employment on a nonfrivolous H-1B petition having been filed, or on the requested start date, whichever is later — and the petition must be filed before the authorized period of stay expires."
        },
        unsourced: null
      },
      {
        question: "Is an LCA or a prepared petition enough?",
        sourced: {
          documentSlug: "ecfr-214-2-h1b-portability",
          statement: "An LCA or a petition in preparation is not the same as a filed portability petition."
        },
        unsourced: null
      },
      {
        question: "How long does it take?",
        sourced: null,
        unsourced: {
          reason:
            "No USCIS processing-time document is in the corpus, and posture varies by service center and premium election."
        }
      },
      {
        question: "What does it cost me?",
        sourced: null,
        unsourced: {
          reason: "Filing fees are employer-borne and fee schedules change; no fee document is in the corpus."
        }
      }
    ]
  },
  {
    id: "OPT_CHANGE_OF_STATUS",
    label: "Change of status (for example to B-2)",
    summary: "Filing to change to another nonimmigrant status before the grace period ends.",
    attributes: [
      {
        question: "Is this a real option?",
        sourced: {
          documentSlug: "uscis-nonimmigrant-worker-termination-options",
          statement:
            "USCIS lists change of status among the options available when no timely employer petition is possible."
        },
        unsourced: null
      },
      {
        question: "Can I work on it?",
        sourced: {
          documentSlug: "ecfr-214-1-grace-period",
          statement: "Work is not authorized unless separately authorized."
        },
        unsourced: null
      },
      {
        question: "How likely is it to be approved, and how long does it take?",
        sourced: null,
        unsourced: {
          reason: "Discretionary and fact-specific; the corpus has no approval-rate or timing data."
        }
      }
    ]
  },
  {
    id: "OPT_DEPARTURE_AND_RETURN",
    label: "Departure planning and possible consular return",
    summary: "Leaving before the grace period ends and returning later on a new petition and visa stamp.",
    attributes: [
      {
        question: "Is this a recognized option?",
        sourced: {
          documentSlug: "uscis-nonimmigrant-worker-termination-options",
          statement: "USCIS lists departure from the United States among the options following termination."
        },
        unsourced: null
      },
      {
        question: "How long until I could come back?",
        sourced: null,
        unsourced: {
          reason: "Depends on consular appointment availability and petition timing; no source in the corpus."
        }
      }
    ]
  },
  {
    id: "OPT_PREMIUM_PROCESSING",
    label: "Premium processing or employer escalation",
    summary: "Asking the employer whether the petition can be filed with premium processing.",
    attributes: [
      {
        question: "What does premium processing cost and guarantee?",
        sourced: null,
        unsourced: {
          reason:
            "The premium-processing fee and service-window commitment are not in the corpus, and the fee has changed repeatedly. The Advisor must not state either."
        }
      },
      {
        question: "Does it change my deadline?",
        sourced: {
          documentSlug: "ecfr-214-1-grace-period",
          statement:
            "The grace period runs up to 60 days or to the end of the authorized validity period, whichever is shorter — processing speed does not extend it."
        },
        unsourced: null
      }
    ]
  },
  {
    id: "OPT_COUNSEL_REVIEW",
    label: "Immediate counsel review",
    summary: "Having an immigration attorney review the exact dates and filing strategy now.",
    attributes: [
      {
        question: "Why is this urgent rather than optional?",
        sourced: {
          documentSlug: "ecfr-214-1-grace-period",
          statement:
            "DHS may shorten or eliminate the 60-day period as a matter of discretion, so the period cannot be treated as a guaranteed full 60 days."
        },
        unsourced: null
      },
      {
        question: "What does it cost?",
        sourced: null,
        unsourced: { reason: "Attorney fees vary; Haven holds no fee data." }
      }
    ]
  }
];

/**
 * Render the option attributes for the prompt.
 *
 * Sourced statements are given as facts the Advisor may state. Unsourced ones are
 * given as explicit prohibitions, because the failure being prevented is the model
 * filling the gap on its own.
 */
export function renderLayoffOptionsForPrompt(): string {
  const lines: string[] = [
    "Attributes for the fallback options. State the supported facts when the user asks about an option. For anything listed as unsupported, say plainly that you do not have a reliable figure and that counsel or the employer can confirm it — never estimate."
  ];

  for (const option of LAYOFF_OPTIONS) {
    lines.push("", `${option.label}: ${option.summary}`);
    for (const attribute of option.attributes) {
      if (attribute.sourced) {
        lines.push(`  - Supported (${attribute.sourced.documentSlug}): ${attribute.sourced.statement}`);
      } else if (attribute.unsourced) {
        lines.push(`  - Do NOT state (${attribute.question}): ${attribute.unsourced.reason}`);
      }
    }
  }

  return lines.join("\n");
}

/** Attributes with no supporting document — the knowledge-corpus gap, for reporting. */
export function unsourcedAttributes() {
  return LAYOFF_OPTIONS.flatMap((option) =>
    option.attributes
      .filter((attribute) => !attribute.sourced)
      .map((attribute) => ({ optionId: option.id, question: attribute.question, reason: attribute.unsourced?.reason ?? "" }))
  );
}
