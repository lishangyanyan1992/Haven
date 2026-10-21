/**
 * Document reader check, against the real model.
 *
 * Run with: npm run check:document-extraction  (from apps/haven)
 * Needs OPENAI_API_KEY (read from .env.local). Costs a few cents per run.
 *
 * Every fixture in ./fixtures is synthetic — invented names, numbers and
 * employers — so running this sends no real person's document anywhere.
 *
 * Each fixture is sent to the reader as a PDF built here (the model path; plain
 * text skips the model), and the check confirms the passages carry the dates
 * and numbers that matter, on the right page, and that a non-immigration
 * document produces nothing. Exits non-zero on any failure.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "../..");

function loadEnvValue(key: string) {
  for (const file of [path.join(appRoot, ".env.local"), path.join(appRoot, "../../.env.local")]) {
    if (!fs.existsSync(file)) continue;
    const line = fs.readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

process.env.OPENAI_API_KEY ??= loadEnvValue("OPENAI_API_KEY");
if (!process.env.OPENAI_API_KEY) {
  console.log("OPENAI_API_KEY not set; skipping.");
  process.exit(1);
}

const { readDocument, unreadableReason, countPages, splitPage } = await import("../../src/lib/document-context/read");

/** A one-page PDF with the given lines of text, built by hand so no PDF library is needed. */
function textPdf(text: string) {
  const lines = text.split("\n");
  const escape = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = ["BT", "/F1 10 Tf", "12 TL", "40 760 Td", ...lines.map((l) => `(${escape(l)}) '`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

interface Case {
  name: string;
  file: string;
  /** Text that must appear in some passage, compared ignoring spaces, case and punctuation. */
  mustContain: string[];
  notImmigration?: boolean;
}

const cases: Case[] = [
  { name: "I-797 approval for I-140", file: "i797-i140-approval.txt", mustContain: ["IOE0912345678", "06/14/2022", "03/03/2025", "E21", "Northwind"] },
  { name: "I-20", file: "i20.txt", mustContain: ["F-1", "05/15/2027", "N0012345678"] },
  { name: "EAD card", file: "ead.txt", mustContain: ["C03C", "07/01/2025", "06/30/2027"] },
  { name: "Passport page", file: "passport.txt", mustContain: ["X1234567", "13 JUN 2032"] },
  { name: "Not an immigration document", file: "not-immigration.txt", mustContain: [], notImmigration: true }
];

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}`, detail ?? "");
  }
}

console.log("Local checks (no model call)");
check("encrypted PDF is refused before reading", unreadableReason({ fileName: "x.pdf", mimeType: "application/pdf", bytes: Buffer.from("%PDF-1.4 /Encrypt 5 0 R") }) !== null);
check("Word file gets a plain-language reason", /PDF/.test(unreadableReason({ fileName: "x.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: Buffer.from("x") }) ?? ""));
check("built PDF counts as one page", countPages({ fileName: "x.pdf", mimeType: "application/pdf", bytes: textPdf("a") }) === 1);
const long = Array.from({ length: 60 }, (_, i) => `Line ${i}: Priority Date: 06/14/2022`).join("\n");
const parts = splitPage(long);
check("long page splits into several passages", parts.length > 1, parts.length);
check("no line is split in half", parts.every((p) => p.split("\n").every((l) => /^Line \d+: Priority Date: 06\/14\/2022$/.test(l))));
// A paragraph with no line breaks, longer than a passage, must survive whole.
const paragraph = Array.from({ length: 40 }, (_, i) => `word${i} Admit Until Date 09/30/2027`).join(" ");
const pieces = splitPage(paragraph);
check("a long paragraph is split, not cut off", pieces.length > 1 && pieces.join(" ").includes("word39"), pieces.length);
check(
  "bookmark /Count is not taken as pages",
  countPages({ fileName: "x.pdf", mimeType: "application/pdf", bytes: Buffer.from("%PDF-1.5\n1 0 obj << /Type /Outlines /Count 35 >> endobj\n2 0 obj << /Count 20 /Kids [] /Type /Pages >> endobj /ObjStm") }) === 20
);
check(
  "page tree /Count is found past inherited resources",
  countPages({
    fileName: "x.pdf",
    mimeType: "application/pdf",
    bytes: Buffer.from("%PDF-1.5\n1 0 obj << /Type /Pages /Resources << /Font << /F1 5 0 R >> >> /Count 40 /Kids [] >> endobj\n2 0 obj << /Type /Outlines /Count 99 >> endobj /ObjStm")
  }) === 40
);
check("page tree /Count is used when page objects are hidden", countPages({ fileName: "x.pdf", mimeType: "application/pdf", bytes: Buffer.from("%PDF-1.5 /Type /Pages /Count 3 /ObjStm") }) === 3);

// The model reads three pages of a PDF whose page objects are compressed (so
// the local count says 1). All three pages must be kept.
const threePages = {
  responses: {
    create: async () => ({
      output_text: JSON.stringify({
        readable: true,
        is_immigration_document: true,
        pages: [1, 2, 3].map((page) => ({ page, text: `Page ${page}\nReceipt Number: IOE000000000${page}` }))
      })
    })
  }
} as unknown as Parameters<typeof readDocument>[1];
const compressed = await readDocument({ fileName: "c.pdf", mimeType: "application/pdf", bytes: Buffer.from("%PDF-1.5 /ObjStm") }, threePages);
const fortyPages = {
  responses: {
    create: async () => ({
      output_text: JSON.stringify({
        readable: true,
        is_immigration_document: true,
        pages: Array.from({ length: 40 }, (_, i) => ({ page: i + 1, text: `Page ${i + 1}` }))
      })
    })
  }
} as unknown as Parameters<typeof readDocument>[1];
const tooLong = await readDocument({ fileName: "l.pdf", mimeType: "application/pdf", bytes: Buffer.from("%PDF-1.5 /ObjStm") }, fortyPages);
check(
  "a document the model finds too long is refused, not cut short",
  !tooLong.ok && /more than 30 pages/.test(tooLong.reason) && tooLong.pages === 40,
  tooLong
);
check(
  "pages the model read are kept even when the local count is lower",
  compressed.ok && new Set(compressed.passages.map((p) => p.page)).size === 3 && compressed.pages === 3,
  compressed
);

const plain = await readDocument({ fileName: "x.txt", mimeType: "text/plain", bytes: Buffer.from("Receipt Number: IOE1") });
check("plain text is read without the model", plain.ok && plain.model === "plain-text" && plain.passages[0]?.content.includes("IOE1"));

for (const c of cases) {
  console.log(c.name);
  const text = fs.readFileSync(path.join(here, "fixtures", c.file), "utf8");
  const result = await readDocument({ fileName: c.file.replace(".txt", ".pdf"), mimeType: "application/pdf", bytes: textPdf(text) });

  if (c.notImmigration) {
    check("produces no passages", !result.ok, result);
    continue;
  }
  if (!result.ok) {
    check("document was read", false, result.reason);
    continue;
  }
  const all = squash(result.passages.map((p) => p.content).join(" "));
  for (const want of c.mustContain) check(`contains ${want}`, all.includes(squash(want)));
  check("every passage is on page 1", result.passages.every((p) => p.page === 1), result.passages.map((p) => p.page));
}

if (failures > 0) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nAll document reading checks passed");
