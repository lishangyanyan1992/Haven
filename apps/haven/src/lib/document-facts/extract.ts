/**
 * Reads the fixed list of details (catalog.ts) from a document's transcribed
 * pages. Text only: the pages were already read once, so no image is resent.
 *
 * The model finds each value and the page and exact text it came from. Code
 * then checks the format; anything that fails the check, or that the model
 * was unsure of, is kept as "Haven wasn't sure" and never filled in.
 */

import type OpenAI from "openai";
import { z } from "zod";

import { DOCUMENT_READER_MODEL, openaiClient } from "@/lib/document-context/read";
import { factSetFor, type FactFormat, type FactSet } from "@/lib/document-facts/catalog";
import { standardVisaValue } from "@/lib/visas";

export type ExtractedFact = {
  key: string;
  /** Normalized value, or null when nothing usable was read. */
  value: string | null;
  /** What was printed, as read. */
  rawText: string | null;
  page: number | null;
  confident: boolean;
};

export type ExtractionResult = { set: FactSet | null; facts: ExtractedFact[] };

// ── Normalizing ──────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
};

function isoIfReal(y: number, m: number, d: number): string | null {
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}

/** US notices print MM/DD/YYYY; passports print "13 JUN 2032". */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return isoIfReal(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return isoIfReal(+m[3], +m[1], +m[2]);
  // Month names: the first three letters decide ("Jun", "June", "JUNE", "Sept").
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3})[A-Za-z]*\.?[\s-]+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return isoIfReal(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  m = s.match(/^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()]) return isoIfReal(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  return null;
}

/** Scans often read the letters I, O, S, B in the three-letter prefix (IOE, SRC…) as 1, 0, 5, 8. */
const PREFIX_FIXES: Record<string, string> = { "1": "I", "0": "O", "5": "S", "8": "B" };

export function normalizeReceipt(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[\s-]/g, "");
  if (s.length !== 13) return null;
  const fixed = s.slice(0, 3).replace(/[1058]/g, (c) => PREFIX_FIXES[c]) + s.slice(3);
  return /^[A-Z]{3}\d{10}$/.test(fixed) ? fixed : null;
}

/** Class codes (E21), section numbers (203(b)(2)) and plain names (EB-2). */
export function normalizeCategory(raw: string): "EB-1" | "EB-2" | "EB-3" | null {
  const s = raw.toUpperCase().replace(/\s/g, "");
  if (/^E1[1-3]$|EB-?1\b|203\(B\)\(1\)/.test(s)) return "EB-1";
  if (/^E2[1-6]$|EB-?2\b|203\(B\)\(2\)/.test(s)) return "EB-2";
  if (/^E3[1-6]$|^EW[3-8]$|EB-?3\b|203\(B\)\(3\)/.test(s)) return "EB-3";
  return null;
}

/** Only classes the profile's visa type can hold. Others are shown, not filled. */
/** A class of admission as printed (F1, B2, L1A, H1B) as the standard visa value, or null. */
export function normalizeVisaClass(raw: string): string | null {
  return standardVisaValue(raw);
}

function normalizeName(raw: string): string | null {
  const s = raw.replace(/\s+/g, " ").trim();
  return s.length >= 2 && s.length <= 120 ? s : null;
}

function normalizeCountry(raw: string): string | null {
  const s = raw.replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 60 || /\d/.test(s)) return null;
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (["of", "and", "the"].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function normalizeValue(format: FactFormat, raw: string): string | null {
  switch (format) {
    case "date":
      return normalizeDate(raw);
    case "receipt":
      return normalizeReceipt(raw);
    case "category":
      return normalizeCategory(raw);
    case "visa_class":
      return normalizeVisaClass(raw);
    case "name":
      return normalizeName(raw);
    case "country":
      return normalizeCountry(raw);
  }
}

// ── Model call ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You read one immigration document's text and find a short list of details in it.

For each requested detail, copy the value exactly as printed (raw_text) and give the page it is on. Do not guess, calculate, or fill in a value that is not printed. If a detail is not on the document, set found to false and leave raw_text empty. Set sure to false if the text is unclear, garbled, or could be a different field.`;

const responseSchema = z.object({
  facts: z.array(
    z.object({ key: z.string(), found: z.boolean(), raw_text: z.string(), page: z.number().int(), sure: z.boolean() })
  )
});

function jsonSchema(keys: string[]) {
  return {
    name: "document_details",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["facts"],
      properties: {
        facts: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "found", "raw_text", "page", "sure"],
            properties: {
              key: { type: "string", enum: keys },
              found: { type: "boolean" },
              raw_text: { type: "string" },
              page: { type: "integer" },
              sure: { type: "boolean" }
            }
          }
        }
      }
    }
  } as const;
}

/** The minimum of the OpenAI client this uses, so checks can pass a stub. */
export type ExtractorClient = Pick<OpenAI, "responses">;

export async function extractDocumentFacts(
  input: { documentKind: string; pages: Array<{ page: number; text: string }> },
  client?: ExtractorClient | null
): Promise<ExtractionResult> {
  const text = input.pages.map((p) => p.text).join("\n");
  const set = factSetFor(input.documentKind, text);
  if (!set || !text.trim()) return { set, facts: [] };

  const openai = client ?? openaiClient();
  if (!openai) throw new Error("Document reading is not available right now.");

  const request = set.facts.map((f) => `- ${f.key}: ${f.label}. ${f.hint}`).join("\n");
  const pagesText = input.pages.map((p) => `=== Page ${p.page} ===\n${p.text}`).join("\n\n");
  const response = await (openai.responses.create as Function)({
    model: DOCUMENT_READER_MODEL,
    input: [
      { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
      {
        role: "user",
        content: [{ type: "input_text", text: `Document: ${set.documentName}\n\nFind these details:\n${request}\n\n${pagesText}` }]
      }
    ],
    text: { format: { type: "json_schema", ...jsonSchema(set.facts.map((f) => f.key)) } }
  });

  const parsed = responseSchema.safeParse(JSON.parse((response as { output_text?: string }).output_text ?? "{}"));
  if (!parsed.success) throw new Error("The details reply was not in the expected shape.");

  const pageNumbers = new Set(input.pages.map((p) => p.page));
  const facts: ExtractedFact[] = [];
  for (const spec of set.facts) {
    // Only keys from the list are kept, once each, whatever the model sends.
    const found = parsed.data.facts.find((f) => f.key === spec.key && f.found && f.raw_text.trim());
    if (!found) continue;
    let value = normalizeValue(spec.format, found.raw_text);
    // A real class the profile can't hold (F1, L1, B2…) is kept as read; it is shown, not filled.
    if (value === null && spec.format === "visa_class") {
      const cleaned = found.raw_text.toUpperCase().replace(/[\s-]/g, "");
      if (/^[A-Z]{1,2}\d{0,2}[A-Z]?$/.test(cleaned)) value = cleaned;
    }
    const page = pageNumbers.has(found.page) ? found.page : null;
    facts.push({
      key: spec.key,
      value,
      rawText: found.raw_text.trim().slice(0, 300),
      page,
      confident: found.sure && value !== null && page !== null
    });
  }
  return { set, facts };
}
