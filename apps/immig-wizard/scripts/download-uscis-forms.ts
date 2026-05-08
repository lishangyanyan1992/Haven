#!/usr/bin/env node
/**
 * Downloads official USCIS fillable PDFs to public/uscis-forms/
 * Run: npx tsx scripts/download-uscis-forms.ts
 */

import fs from 'fs';
import path from 'path';

const FORMS = [
  { id: 'g1145', url: 'https://www.uscis.gov/sites/default/files/document/forms/g-1145.pdf' },
  { id: 'i130', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf' },
  { id: 'i130a', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-130a.pdf' },
  { id: 'g1450', url: 'https://www.uscis.gov/sites/default/files/document/forms/g-1450.pdf' },
  { id: 'i485', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf' },
  { id: 'i864', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-864.pdf' },
  { id: 'i765', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf' },
  { id: 'i131', url: 'https://www.uscis.gov/sites/default/files/document/forms/i-131.pdf' },
];

const outDir = path.join(process.cwd(), 'public', 'uscis-forms');
fs.mkdirSync(outDir, { recursive: true });

for (const form of FORMS) {
  const outPath = path.join(outDir, `${form.id}.pdf`);
  console.log(`Downloading ${form.id}...`);
  const res = await fetch(form.url);
  if (!res.ok) {
    console.error(`  FAILED: ${res.status} ${res.statusText}`);
    continue;
  }
  const buf = await res.arrayBuffer();
  fs.writeFileSync(outPath, Buffer.from(buf));
  console.log(`  Saved to ${outPath} (${Math.round(buf.byteLength / 1024)}KB)`);
}

console.log('Done.');
