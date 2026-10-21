/**
 * Turns one document into searchable passages, each tagged with its page.
 * Network-only, no database, so the eval check can run it against fixtures
 * (evals/documents/extraction.check.ts).
 *
 * Reading is plain transcription: the model copies each page's text. Scans and
 * phone photos have no text layer, so one model path handles PDFs and images
 * alike; plain-text uploads skip the model. Nothing is interpreted here — the
 * Advisor reads the passages at answer time, with its guardrails, and cites the
 * page so the user can check the original.
 */

import OpenAI from "openai";
import { z } from "zod";

import { env } from "@/lib/env";
import { ADVISOR_DEFAULT_EMBEDDING_MODEL, ADVISOR_DEFAULT_MODEL } from "@/lib/advisor/model-pin";

export const DOCUMENT_READER_MODEL = ADVISOR_DEFAULT_MODEL;
/** Same model as the Advisor's knowledge search, so both live in one vector space. */
export const DOCUMENT_EMBEDDING_MODEL = env.OPENAI_EMBEDDING_MODEL ?? ADVISOR_DEFAULT_EMBEDDING_MODEL;

/** Longer than any form Haven cares about; past this it is a whole petition binder. */
export const MAX_PAGES_PER_DOCUMENT = 30;
/** Per user, per UTC day. Roughly one petition packet plus a few notices. */
export const DAILY_PAGE_CAP = 60;

/** Passage size. Small enough that one passage is about one thing on the page. */
const CHUNK_CHARS = 800;
const CHUNK_OVERLAP = 150;

export interface DocumentInput {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface Passage {
  page: number;
  chunkIndex: number;
  content: string;
}

export type ReadResult =
  /** `pages`: how many pages the model actually read, which can exceed countPages. */
  | { ok: true; passages: Passage[]; model: string; pages: number }
  | { ok: false; reason: string; pages?: number };

// ── Before calling the model ──────────────────────────────────────────────────

function baseMime(mimeType: string) {
  return mimeType.split(";")[0].trim().toLowerCase();
}

/** Formats the model can read directly. */
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** What the vault accepts for reading. Word and HEIC are refused at upload. */
export const READABLE_MIME_TYPES = new Set(["application/pdf", "text/plain", ...IMAGE_TYPES]);

export function isReadableMimeType(mimeType: string) {
  return READABLE_MIME_TYPES.has(baseMime(mimeType));
}

/**
 * Pages in the document, without a PDF library: page objects are written as
 * `/Type /Page`, and the page tree root as `/Type /Pages ... /Count N`. Either
 * can be hidden inside a compressed object stream, so this can undercount. It
 * is used only for the daily cap and the page limit, never to throw away pages
 * the model actually read.
 */
export function countPages(input: DocumentInput): number {
  const mime = baseMime(input.mimeType);
  if (mime === "application/pdf") {
    const raw = input.bytes.toString("latin1");
    const objects = raw.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
    // Only a page-tree node's /Count counts pages; bookmarks (outlines) use
    // /Count too, for their entries. Each PDF object ends with `endobj`, so read
    // /Count only from objects that are themselves /Type /Pages — whatever else
    // (inherited resources, nested dictionaries) sits between the two keys.
    // The root node has the largest count.
    const counts = raw
      .split(/\bendobj\b/)
      .filter((object) => /\/Type\s*\/Pages\b/.test(object))
      .map((object) => Number(object.match(/\/Count\s+(\d+)/)?.[1] ?? 0));
    return Math.max(1, objects, ...counts);
  }
  if (mime === "text/plain") {
    return Math.max(1, Math.ceil(input.bytes.toString("utf8").length / 3000));
  }
  return 1;
}

/** Why a document cannot be read at all, in words for the user. Null if it can. */
export function unreadableReason(input: DocumentInput): string | null {
  const mime = baseMime(input.mimeType);
  if (mime === "application/pdf") {
    if (input.bytes.toString("latin1").includes("/Encrypt")) {
      return "This PDF is password-protected. Save a copy without the password and upload that.";
    }
    if (countPages(input) > MAX_PAGES_PER_DOCUMENT) {
      return `This file has more than ${MAX_PAGES_PER_DOCUMENT} pages. Upload the notice or page you need on its own.`;
    }
    return null;
  }
  if (IMAGE_TYPES.has(mime) || mime === "text/plain") return null;
  if (mime === "image/heic" || mime === "image/heif") {
    return "Haven can't read iPhone HEIC photos. Save it as a JPG or PDF and upload that.";
  }
  if (mime.includes("word")) {
    return "Haven can't read Word files. Save it as a PDF and upload that.";
  }
  return "Haven can't read this file type.";
}

// ── Transcription ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You transcribe one document for the person it belongs to, so it can be searched later.

Copy the text of every page exactly as printed, including labels, numbers, dates and names. Keep each label next to its value on the same line (for example "Priority Date: 06/14/2022"). Do not summarise, translate, correct, or add anything that is not printed. Skip only purely decorative text such as repeated watermarks.

Return one entry per page, numbered from 1.

Set readable to false if the document is blank, illegible, or you cannot see its contents. Set is_immigration_document to false if it is not an immigration, travel, employment-authorization, or employment document; in that case return no pages.`;

const responseSchema = z.object({
  readable: z.boolean(),
  is_immigration_document: z.boolean(),
  pages: z.array(z.object({ page: z.number().int(), text: z.string() }))
});

const responseJsonSchema = {
  name: "document_transcription",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["readable", "is_immigration_document", "pages"],
    properties: {
      readable: { type: "boolean" },
      is_immigration_document: { type: "boolean" },
      pages: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["page", "text"],
          properties: { page: { type: "integer" }, text: { type: "string" } }
        }
      }
    }
  }
} as const;

function documentContent(input: DocumentInput) {
  const mime = baseMime(input.mimeType);
  const base64 = input.bytes.toString("base64");
  if (mime === "application/pdf") {
    return { type: "input_file", filename: input.fileName || "document.pdf", file_data: `data:application/pdf;base64,${base64}` };
  }
  return { type: "input_image", image_url: `data:${mime};base64,${base64}`, detail: "high" };
}

async function transcribe(input: DocumentInput, openai: OpenAI) {
  const response = await (openai.responses.create as Function)({
    model: DOCUMENT_READER_MODEL,
    input: [
      { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
      { role: "user", content: [documentContent(input)] }
    ],
    text: { format: { type: "json_schema", ...responseJsonSchema } }
  });
  return responseSchema.safeParse(JSON.parse((response as { output_text?: string }).output_text ?? "{}"));
}

// ── Passages ──────────────────────────────────────────────────────────────────

/**
 * Split one page into passages of about CHUNK_CHARS, breaking at line ends so a
 * label is not separated from its value, with some overlap so a fact sitting
 * on a boundary is whole in at least one passage.
 */
export function splitPage(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;

  // A line longer than a passage (a paragraph with no line breaks) is cut into
  // passage-sized pieces first, so nothing past the first piece is lost.
  const pieces = lines.flatMap((line) => {
    if (line.length <= CHUNK_CHARS) return [line];
    const out: string[] = [];
    for (let i = 0; i < line.length; i += CHUNK_CHARS - CHUNK_OVERLAP) out.push(line.slice(i, i + CHUNK_CHARS));
    return out;
  });

  for (const line of pieces) {
    if (length + line.length > CHUNK_CHARS && current.length > 0) {
      chunks.push(current.join("\n"));
      // Carry the tail forward as overlap.
      const carry: string[] = [];
      let carried = 0;
      for (let i = current.length - 1; i >= 0 && carried < CHUNK_OVERLAP; i -= 1) {
        carry.unshift(current[i]);
        carried += current[i].length;
      }
      current = carry;
      length = carried;
    }
    current.push(line);
    length += line.length;
  }
  if (current.length > 0) chunks.push(current.join("\n"));
  return chunks;
}

export function toPassages(pages: Array<{ page: number; text: string }>): Passage[] {
  const passages: Passage[] = [];
  for (const { page, text } of pages) {
    for (const content of splitPage(text)) {
      passages.push({ page, chunkIndex: passages.length, content });
    }
  }
  return passages;
}

/** Plain text has no pages; treat each ~3000 characters as one, matching countPages. */
function textPages(text: string) {
  const pages: Array<{ page: number; text: string }> = [];
  for (let i = 0; i < Math.max(1, text.length); i += 3000) {
    pages.push({ page: pages.length + 1, text: text.slice(i, i + 3000) });
  }
  return pages;
}

export function openaiClient() {
  return env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
}

export async function readDocument(input: DocumentInput, client?: OpenAI): Promise<ReadResult> {
  const reason = unreadableReason(input);
  if (reason) return { ok: false, reason };

  const mime = baseMime(input.mimeType);
  if (mime === "text/plain") {
    const pages = textPages(input.bytes.toString("utf8"));
    const passages = toPassages(pages);
    return passages.length > 0
      ? { ok: true, passages, model: "plain-text", pages: pages.length }
      : { ok: false, reason: "This file is empty." };
  }

  const openai = client ?? openaiClient();
  if (!openai) return { ok: false, reason: "Document reading is not available right now." };

  const parsed = await transcribe(input, openai);
  if (!parsed.success) return { ok: false, reason: "Haven couldn't read this document. Try a clearer copy." };
  if (!parsed.data.readable) return { ok: false, reason: "Haven couldn't make out this document. Try a clearer scan or photo." };
  if (!parsed.data.is_immigration_document) {
    return { ok: false, reason: "This doesn't look like an immigration document, so Haven didn't read it." };
  }

  // The model's own page count is the real one. countPages is only an estimate
  // (it can undercount compressed PDFs), so it never decides which pages are
  // kept. Past the limit the whole document is refused, with the reason, rather
  // than kept with its later pages quietly missing.
  const read = parsed.data.pages.filter((p) => p.page >= 1 && p.text.trim().length > 0);
  const pagesRead = Math.max(0, ...read.map((p) => p.page));
  if (pagesRead > MAX_PAGES_PER_DOCUMENT) {
    return {
      ok: false,
      reason: `This file has more than ${MAX_PAGES_PER_DOCUMENT} pages. Upload the notice or page you need on its own.`,
      pages: pagesRead
    };
  }
  const passages = toPassages(read);
  if (passages.length === 0) return { ok: false, reason: "Haven couldn't find any text in this document.", pages: pagesRead };
  return { ok: true, passages, model: DOCUMENT_READER_MODEL, pages: Math.max(pagesRead, 1) };
}

/** One embedding per passage, in order. */
export async function embedPassages(texts: string[], client?: OpenAI): Promise<number[][]> {
  const openai = client ?? openaiClient();
  if (!openai) throw new Error("OPENAI_API_KEY is not set.");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const response = await openai.embeddings.create({ model: DOCUMENT_EMBEDDING_MODEL, input: texts.slice(i, i + 64) });
    out.push(...response.data.map((d) => d.embedding));
  }
  return out;
}

export function asPgVector(values: number[]) {
  return `[${values.map((v) => Number(v).toFixed(8)).join(",")}]`;
}
