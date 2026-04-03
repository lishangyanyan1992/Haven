import OpenAI from "openai";
import { z } from "zod";

import { env } from "@/lib/env";
import type { EmailSourceType } from "@/types/domain";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedField {
  label: string;
  value: string;
  confidence: "high" | "medium" | "low";
}

export interface EmailExtractionResult {
  sourceType: EmailSourceType;
  fields: ExtractedField[];
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const emailExtractionSchema = z.object({
  source_type: z.enum([
    "i797_notice",
    "uscis_receipt",
    "attorney_update",
    "rfe_notice",
    "employer_hr",
    "priority_date_update",
  ]),
  fields: z.array(
    z.object({
      label: z.string().min(1),
      value: z.string().min(1),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),
});

// ── JSON Schema for structured output ────────────────────────────────────────

const emailExtractionJsonSchema = {
  name: "email_extraction",
  strict: true,
  schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["source_type", "fields"],
    properties: {
      source_type: {
        type: "string",
        enum: [
          "i797_notice",
          "uscis_receipt",
          "attorney_update",
          "rfe_notice",
          "employer_hr",
          "priority_date_update",
        ],
      },
      fields: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "value", "confidence"],
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
      },
    },
  },
};

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an immigration document extraction assistant for Haven, a US employment-based immigration tracking app.

Read the email and extract structured immigration case data from it.

## Source type — pick exactly one
- "i797_notice": USCIS Form I-797 approval notices, receipt notices, transfer notices, or any official USCIS action notice on a petition or application
- "uscis_receipt": General USCIS receipts, filing confirmations, or acknowledgment emails that are not I-797 notices
- "attorney_update": Messages from immigration attorneys, law firms, or paralegals providing case updates, instructions, or advice
- "rfe_notice": USCIS Request for Evidence (RFE) or Notice of Intent to Deny (NOID)
- "employer_hr": Communications from employer HR, People Ops, or immigration coordinators about sponsorship, documents needed, or case status
- "priority_date_update": Visa bulletin updates, USCIS filing chart announcements, or notifications about priority date movement

## Fields to extract
For each piece of data found, produce one entry:
- label: short human-readable name (use the common labels below when they apply)
- value: exact value as it appears in the email, cleaned of surrounding whitespace
- confidence: "high" if explicit and unambiguous; "medium" if inferred or partially visible; "low" if guessed

## Common field labels (use these exact strings)
- "Receipt Number"           e.g. "EAC2112345678"
- "Priority Date"            e.g. "January 01, 2019"
- "Approval Date"            date the petition or application was approved
- "Notice Date"              date printed on the notice
- "Case Type"                e.g. "Form I-140", "Form I-485"
- "Preference Category"      e.g. "EB-2", "EB-3"
- "Beneficiary Name"         full name of the immigrant beneficiary
- "Petitioner / Employer"    sponsoring employer or petitioner name
- "USCIS Office"             service center or field office
- "Valid From"               start date for approvals with validity period
- "Valid Through"            end date for approvals with validity period
- "RFE Response Due"         deadline to respond to an RFE
- "Attorney Name"            attorney or law firm contact name
- "Filing Date"              date the petition or application was filed

Only extract fields that are explicitly present or very strongly implied. Do not invent values.
If the email has no extractable immigration data, return an empty fields array.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOpenAIClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function getChatModel(): string {
  return env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
}

function buildFallback(subject: string): EmailExtractionResult {
  return {
    sourceType: "attorney_update",
    fields: subject.trim()
      ? [{ label: "Subject", value: subject.trim(), confidence: "low" }]
      : [],
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function extractEmailFields(input: {
  subject: string;
  body: string;
  sender: string;
}): Promise<EmailExtractionResult> {
  const client = getOpenAIClient();
  if (!client) return buildFallback(input.subject);

  const userMessage = [
    `From: ${input.sender}`,
    `Subject: ${input.subject}`,
    ``,
    input.body.slice(0, 8000).trim(), // cap to avoid token blowout
  ].join("\n");

  try {
    const response = await (client.responses.create as Function)({
      model: getChatModel(),
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: SYSTEM_PROMPT }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userMessage }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...emailExtractionJsonSchema,
        },
      },
    });

    const parsed = emailExtractionSchema.safeParse(
      JSON.parse((response as { output_text?: string }).output_text ?? "{}")
    );

    if (parsed.success) {
      return {
        sourceType: parsed.data.source_type as EmailSourceType,
        fields: parsed.data.fields,
      };
    }
  } catch {
    // fall through to fallback
  }

  return buildFallback(input.subject);
}
