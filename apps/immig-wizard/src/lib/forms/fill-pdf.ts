import {
  PDFDocument,
  PDFTextField,
  PDFDropdown,
  PDFCheckBox,
  StandardFonts,
  rgb,
  PDFName,
  PDFString,
  PDFDict,
  PDFArray,
  PDFRef,
} from 'pdf-lib';

import fs from 'fs';
import type { FormDefinition } from './types';
import { buildFieldValues } from './resolver';
import type { Answers } from './types';
import type { FormSupplementAnswers } from '@/types/wizard';
import { resolveLocalTemplatePath } from './template-path';

/**
 * Loads the PDF template for a form from disk or fetches from USCIS as fallback.
 */
async function loadTemplate(form: FormDefinition): Promise<Uint8Array> {
  const localPath = resolveLocalTemplatePath(form.localPath);
  if (fs.existsSync(localPath)) {
    return new Uint8Array(fs.readFileSync(localPath));
  }
  const res = await fetch(form.uscisUrl);
  if (!res.ok) throw new Error(`Failed to fetch ${form.uscisUrl}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Build a map of fully-qualified XFA field name → PDFRef for all leaf widget fields.
 * This traverses the AcroForm field tree without using the high-level getField() API
 * (which throws on rich text fields).
 */
function buildFieldRefMap(pdfDoc: PDFDocument): Map<string, PDFRef> {
  const map = new Map<string, PDFRef>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getDict(refOrDict: unknown): PDFDict | null {
    if (refOrDict instanceof PDFDict) return refOrDict;
    if (refOrDict instanceof PDFRef) {
      try {
        const obj = pdfDoc.context.lookup(refOrDict);
        if (obj instanceof PDFDict) return obj;
      } catch { /* skip */ }
    }
    return null;
  }

  function traverse(ref: unknown, parentPath: string): void {
    const dict = getDict(ref);
    if (!dict) return;

    // Get this node's /T (partial field name)
    const tVal = dict.get(PDFName.of('T'));
    const partName = tVal instanceof PDFString ? tVal.decodeText() : null;
    const fullPath = partName
      ? parentPath
        ? `${parentPath}.${partName}`
        : partName
      : parentPath;

    // Check for /Kids — if present, recurse
    const kids = dict.get(PDFName.of('Kids'));
    if (kids instanceof PDFArray) {
      for (let i = 0; i < kids.size(); i++) {
        traverse(kids.get(i), fullPath);
      }
    } else if (ref instanceof PDFRef) {
      // Leaf node — store it
      if (fullPath) map.set(fullPath, ref as PDFRef);
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acroFormRef = (pdfDoc.catalog as any).get(PDFName.of('AcroForm'));
    if (!acroFormRef) return map;
    const acroForm = getDict(acroFormRef);
    if (!acroForm) return map;

    const fields = acroForm.get(PDFName.of('Fields'));
    if (!(fields instanceof PDFArray)) return map;

    for (let i = 0; i < fields.size(); i++) {
      traverse(fields.get(i), '');
    }
  } catch { /* best-effort */ }

  return map;
}

/**
 * Directly sets /V on a field dict, handling text, choice (dropdown), and button fields.
 * Avoids the high-level PDFForm API that throws on rich text fields.
 */
function setFieldValueDirect(
  pdfDoc: PDFDocument,
  fieldRef: PDFRef,
  value: string
): void {
  const dict = pdfDoc.context.lookup(fieldRef);
  if (!(dict instanceof PDFDict)) return;

  // Determine field type
  const ft = dict.get(PDFName.of('FT'));
  const ftName = ft instanceof PDFName ? ft.decodeText() : null;

  if (ftName === 'Tx' || !ftName) {
    // Text field — set /V as PDFString
    dict.set(PDFName.of('V'), PDFString.of(value));
    // Clear appearance stream so Adobe re-renders with the new value
    dict.delete(PDFName.of('AP'));
  } else if (ftName === 'Ch') {
    // Choice/dropdown — set /V as PDFString and update /I index if needed
    dict.set(PDFName.of('V'), PDFString.of(value));
    dict.delete(PDFName.of('AP'));
  } else if (ftName === 'Btn') {
    // Button/checkbox — set /V as PDFName (the export value)
    dict.set(PDFName.of('V'), PDFName.of(value === 'Yes' || value === '1' ? 'Yes' : 'Off'));
    dict.delete(PDFName.of('AP'));
  }
}

/**
 * First tries the high-level pdf-lib form API for a field.
 * Falls back to direct dictionary manipulation if the high-level API throws
 * (e.g. for rich text fields).
 */
function fillFieldSafe(
  pdfDoc: PDFDocument,
  fieldRefMap: Map<string, PDFRef>,
  fieldName: string,
  value: string,
  skipped: string[],
  errors: string[]
): void {
  // 1. Try the high-level API first (gives proper appearance streams)
  try {
    const pdfForm = pdfDoc.getForm();
    const field = pdfForm.getField(fieldName);

    if (field instanceof PDFTextField) {
      field.setText(value);
      return;
    }
    if (field instanceof PDFDropdown) {
      const options = field.getOptions();
      const match = options.find((o) => o.toLowerCase() === value.toLowerCase());
      if (match) { field.select(match); return; }
      const abbr = options.find((o) => o === value.toUpperCase());
      if (abbr) { field.select(abbr); return; }
      // Value not in dropdown options — fall through to direct approach
    } else if (field instanceof PDFCheckBox) {
      if (value === 'Yes' || value === 'true' || value === '1') field.check();
      return;
    } else {
      skipped.push(`${fieldName}: type ${field?.constructor?.name} not supported`);
      return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Rich-text error or field-not-found: fall through to direct approach
    if (!msg.includes('rich text') && !msg.includes('Could not find field')) {
      errors.push(`${fieldName} (high-level): ${msg}`);
      return;
    }
  }

  // 2. Direct fallback — look up by our pre-built ref map
  const ref = fieldRefMap.get(fieldName);
  if (!ref) {
    skipped.push(`${fieldName}: not found in field tree`);
    return;
  }
  try {
    setFieldValueDirect(pdfDoc, ref, value);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`${fieldName} (direct): ${msg}`);
  }
}

/**
 * Fills a USCIS PDF form with wizard answers and returns the filled PDF bytes.
 */
export async function fillForm(
  form: FormDefinition,
  answers: Answers,
  supplements: FormSupplementAnswers
): Promise<Uint8Array> {
  const templateBytes = await loadTemplate(form);
  if (form.fillStrategy === 'overlay') {
    return fillOverlayForm(templateBytes, form, answers, supplements);
  }
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });

  // Disable rich-text formatting on all text fields so pdf-lib can save without
  // throwing "Reading rich text fields is not supported". The RichText flag (bit 25
  // of /Ff) causes pdf-lib to call getText() during appearance stream generation,
  // which throws when the field has no /V value. We also strip /RV and /DS as an
  // extra safety measure.
  try {
    const pdfForm = pdfDoc.getForm();
    const allFields = pdfForm.getFields();
    for (const field of allFields) {
      try {
        if (field instanceof PDFTextField && field.isRichFormatted()) {
          field.disableRichFormatting();
        }
        const dict = pdfDoc.context.lookup(field.ref);
        if (dict instanceof PDFDict) {
          dict.delete(PDFName.of('RV'));
          dict.delete(PDFName.of('DS'));
        }
      } catch { /* skip */ }
    }
  } catch { /* getFields() itself shouldn't throw, but guard anyway */ }

  for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict) {
      obj.delete(PDFName.of('RV'));
      obj.delete(PDFName.of('DS'));
    }
  }

  const fieldRefMap = buildFieldRefMap(pdfDoc);
  const fieldValues = buildFieldValues(form.fieldMappings, answers, supplements);
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const [fieldName, value] of fieldValues) {
    fillFieldSafe(pdfDoc, fieldRefMap, fieldName, value, skipped, errors);
  }

  if (skipped.length > 0) console.warn('[fill-pdf] Skipped:', skipped);
  if (errors.length > 0) console.warn('[fill-pdf] Errors:', errors);

  return pdfDoc.save();
}

type OverlayAnnotation = {
  fieldName: string;
  fieldType: string | null;
  rect: [number, number, number, number];
  pageIndex: number;
  textAlignment?: number | null;
};

async function getOverlayAnnotations(
  templateBytes: Uint8Array
): Promise<Map<string, OverlayAnnotation>> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: templateBytes, useSystemFonts: true }).promise;
  const annotations = new Map<string, OverlayAnnotation>();

  for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex += 1) {
    const page = await doc.getPage(pageIndex + 1);
    const pageAnnotations = await page.getAnnotations();
    for (const annotation of pageAnnotations) {
      if (!annotation.fieldName || !annotation.rect) continue;
      annotations.set(annotation.fieldName, {
        fieldName: annotation.fieldName,
        fieldType: annotation.fieldType ?? null,
        rect: annotation.rect as [number, number, number, number],
        pageIndex,
        textAlignment: annotation.textAlignment,
      });
    }
  }

  return annotations;
}

async function fillOverlayForm(
  templateBytes: Uint8Array,
  form: FormDefinition,
  answers: Answers,
  supplements: FormSupplementAnswers
): Promise<Uint8Array> {
  const fieldValues = buildFieldValues(form.fieldMappings, answers, supplements);
  try {
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const annotations = await getOverlayAnnotations(templateBytes);

    for (const [fieldName, value] of fieldValues) {
      const annotation = annotations.get(fieldName);
      if (!annotation) continue;

      const page = pdfDoc.getPage(annotation.pageIndex);
      const [left, bottom, right, top] = annotation.rect;
      const width = right - left;
      const height = top - bottom;

      if (annotation.fieldType === 'Btn') {
        page.drawText('X', {
          x: left + 1.5,
          y: bottom + 0.5,
          size: Math.max(10, height - 1),
          font,
          color: rgb(0, 0, 0),
        });
        continue;
      }

      let fontSize = Math.min(10, Math.max(7, height - 4));
      while (font.widthOfTextAtSize(value, fontSize) > width - 4 && fontSize > 6) {
        fontSize -= 0.5;
      }

      const textWidth = font.widthOfTextAtSize(value, fontSize);
      let x = left + 2;
      if (annotation.textAlignment === 1) {
        x = left + Math.max(2, (width - textWidth) / 2);
      } else if (annotation.textAlignment === 2) {
        x = right - textWidth - 2;
      }

      page.drawText(value, {
        x,
        y: bottom + Math.max(2, (height - fontSize) / 2),
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth: width - 4,
      });
    }

    return pdfDoc.save();
  } catch (error) {
    console.warn(`[fill-pdf] Overlay fallback for ${form.id}:`, error);
    return buildFallbackOverlayPdf(form, fieldValues);
  }
}

async function buildFallbackOverlayPdf(
  form: FormDefinition,
  fieldValues: Map<string, string>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage([612, 792]);
  let y = 740;

  page.drawText(form.name, {
    x: 48,
    y,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 28;
  page.drawText(
    'Official USCIS template could not be written directly in this environment. Review these captured values and transfer them onto the current official form if needed.',
    {
      x: 48,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: 516,
      lineHeight: 12,
    }
  );
  y -= 42;

  for (const [fieldName, value] of fieldValues) {
    if (y < 64) {
      page = pdfDoc.addPage([612, 792]);
      y = 740;
    }
    page.drawText(fieldName, {
      x: 48,
      y,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
      maxWidth: 240,
    });
    page.drawText(value, {
      x: 300,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0),
      maxWidth: 260,
    });
    y -= 18;
  }

  return pdfDoc.save();
}
