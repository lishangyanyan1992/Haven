import { z } from "zod";

export const advisorCitationSchema = z.object({
  kind: z.enum(["external", "haven", "community"]),
  label: z.string().min(1),
  url: z.string().url().optional(),
  quote: z.string().optional(),
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
    required: [
      "answer_markdown",
      "confidence",
      "disclaimer",
      "external_citations",
      "haven_context_used",
      "community_context_used",
      "follow_up_questions"
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
          required: ["kind", "label", "citationIndex"],
          properties: {
            kind: { type: "string", enum: ["external", "haven", "community"] },
            label: { type: "string" },
            url: { type: "string" },
            quote: { type: "string" },
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
      refusal_or_escalation_reason: { type: "string" }
    }
  }
} as const;

export const createMessageSchema = z.object({
  content: z.string().trim().min(4).max(4000)
});

export const advisorHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000)
});

export const advisorRespondSchema = z.object({
  content: z.string().trim().min(4).max(4000),
  history: z.array(advisorHistoryMessageSchema).max(12).optional().default([])
});

export const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional()
});

export type AdvisorAnswerPayloadInput = z.infer<typeof advisorAnswerPayloadSchema>;
