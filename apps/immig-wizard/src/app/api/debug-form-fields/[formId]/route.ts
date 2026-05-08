import { NextRequest } from 'next/server';
import fs from 'fs';
import { resolveNamedTemplatePath } from '@/lib/forms/template-path';

const USCIS_URLS: Record<string, string> = {
  g1145: 'https://www.uscis.gov/sites/default/files/document/forms/g-1145.pdf',
  i130: 'https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf',
  i130a: 'https://www.uscis.gov/sites/default/files/document/forms/i-130a.pdf',
  g1450: 'https://www.uscis.gov/sites/default/files/document/forms/g-1450.pdf',
  i485: 'https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf',
  i864: 'https://www.uscis.gov/sites/default/files/document/forms/i-864.pdf',
  i765: 'https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf',
  i131: 'https://www.uscis.gov/sites/default/files/document/forms/i-131.pdf',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;
  const url = USCIS_URLS[formId];
  if (!url) {
    return Response.json({ error: `Unknown formId: ${formId}` }, { status: 400 });
  }

  let pdfBytes: Uint8Array;

  const localPath = resolveNamedTemplatePath(formId);
  if (fs.existsSync(localPath)) {
    pdfBytes = new Uint8Array(fs.readFileSync(localPath));
  } else {
    const res = await fetch(url);
    if (!res.ok) {
      return Response.json({ error: `Failed to fetch ${url}: ${res.status}` }, { status: 502 });
    }
    pdfBytes = new Uint8Array(await res.arrayBuffer());
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfDoc = await pdfjs.getDocument({ data: pdfBytes, useSystemFonts: true }).promise;
  const fields: Array<{ name: string; type: string | null; page: number }> = [];

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
    const page = await pdfDoc.getPage(pageNumber);
    const annotations = await page.getAnnotations();
    for (const annotation of annotations) {
      if (!annotation.fieldName) continue;
      fields.push({
        name: annotation.fieldName,
        type: annotation.fieldType ?? null,
        page: pageNumber,
      });
    }
  }

  return Response.json({ formId, fieldCount: fields.length, fields });
}
