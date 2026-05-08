import { NextRequest } from 'next/server';
import JSZip from 'jszip';
import { FORM_REGISTRY } from '@/lib/forms/form-registry';
import { fillForm } from '@/lib/forms/fill-pdf';
import { Answers } from '@/lib/forms/types';
import { FormSupplementAnswers } from '@/types/wizard';
import { getSelectedFormIds, validateSelectedForms } from '@/lib/forms/packet';

export async function POST(req: NextRequest) {
  let answers: Answers;
  let supplements: FormSupplementAnswers;

  try {
    const body = await req.json();
    answers = (body.answers ?? {}) as Answers;
    supplements = (body.supplements ?? {}) as FormSupplementAnswers;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validationByForm = validateSelectedForms(answers, supplements);
  const blockingIssues = Object.values(validationByForm)
    .flat()
    .filter((issue) => issue.blocking);

  if (blockingIssues.length > 0) {
    return new Response(
      JSON.stringify({
        error: 'One or more selected forms are missing required fields',
        issues: blockingIssues,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const zip = new JSZip();
  const errors: string[] = [];
  const selectedFormIds = getSelectedFormIds(answers);

  await Promise.all(
    selectedFormIds.map(async (formId) => {
      const form = FORM_REGISTRY[formId];
      try {
        const pdfBytes = await fillForm(form, answers, supplements);
        zip.file(`${form.name.replace(/\s+/g, '-')}.pdf`, pdfBytes);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[generate-all-forms] Error filling ${formId}:`, message);
        errors.push(`${formId}: ${message}`);
      }
    })
  );

  if (errors.length === selectedFormIds.length) {
    return new Response(JSON.stringify({ error: 'All forms failed', details: errors }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

  return new Response(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="immig-forms.zip"',
    },
  });
}
