import { z } from "zod";

export const advisorCitationSchema = z.object({
  kind: z.enum(["external", "haven", "community"]),
  label: z.string().min(1),
  url: z.string().url().optional(),
  // `excerpt`, not `quote`: it is only a quotation when attribution says so.
  excerpt: z.string().optional(),
  attribution: z.enum(["verbatim", "haven-summary"]).optional(),
  citationIndex: z.number().int().nonnegative()
});

export const advisorAnswerPayloadSchema = z.object({
  answer_markdown: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
  disclaimer: z.string().min(1),
  external_citations: z.array(advisorCitationSchema),
  haven_context_used: z.array(z.string()),
  community_context_used: z.array(z.string()),
  follow_up_questions: z.array(z.string()),
  refusal_or_escalation_reason: z.string().optional()
});

export const advisorAnswerJsonSchema = {
  name: "advisor_answer",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    // strict mode: every property must be in required.
    // Optional fields use ["string", "null"] so the model can return null.
    required: [
      "answer_markdown",
      "confidence",
      "disclaimer",
      "external_citations",
      "haven_context_used",
      "community_context_used",
      "follow_up_questions",
      "refusal_or_escalation_reason"
    ],
    properties: {
      answer_markdown: { type: "string" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      disclaimer: { type: "string" },
      external_citations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "label", "url", "excerpt", "attribution", "citationIndex"],
          properties: {
            kind: { type: "string", enum: ["external", "haven", "community"] },
            label: { type: "string" },
            url: { type: ["string", "null"] },
            excerpt: { type: ["string", "null"] },
            attribution: { type: ["string", "null"], enum: ["verbatim", "haven-summary", null] },
            citationIndex: { type: "integer", minimum: 0 }
          }
        }
      },
      haven_context_used: {
        type: "array",
        items: { type: "string" }
      },
      community_context_used: {
        type: "array",
        items: { type: "string" }
      },
      follow_up_questions: {
        type: "array",
        items: { type: "string" }
      },
      refusal_or_escalation_reason: { type: ["string", "null"] }
    }
  }
} as const;

export const createMessageSchema = z.object({
  content: z.string().trim().min(4).max(4000)
});

/**
 * How much of one earlier turn is carried.
 *
 * This was 4000, the same limit as the question the user types — and the Advisor's
 * own answers routinely run past 5000. So the moment it gave a long answer, the
 * *next* message in that thread failed validation outright and the user got
 * nothing back, under the message "Message content is required" even though their
 * content was fine. Every graded suite stayed green because they all ask one
 * question at a time; the failure only exists on turn two of a real conversation,
 * which is exactly where somebody says "I already tried that".
 *
 * Set with headroom over the longest answers seen (~5.5k), and enforced by
 * trimming rather than rejecting: an over-long earlier turn must never cost
 * somebody the answer to the question they just asked.
 */
const HISTORY_CONTENT_LIMIT = 16000;

export const advisorHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1)
    .max(HISTORY_CONTENT_LIMIT * 2)
    // Keeps the head: an answer leads with its conclusion, and the tail is
    // disclaimers the next turn re-derives anyway.
    .transform((text) => (text.length > HISTORY_CONTENT_LIMIT ? text.slice(0, HISTORY_CONTENT_LIMIT) : text))
});

export const advisorRespondSchema = z.object({
  content: z.string().trim().min(4).max(4000),
  history: z.array(advisorHistoryMessageSchema).max(12).optional().default([]),
  conversationId: z.string().uuid().optional()
});

export const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional()
});

export type AdvisorAnswerPayloadInput = z.infer<typeof advisorAnswerPayloadSchema>;
