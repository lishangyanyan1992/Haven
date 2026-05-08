import { NextRequest } from 'next/server';
import { FORM_REGISTRY } from '@/lib/forms/form-registry';
import { fillForm } from '@/lib/forms/fill-pdf';
import { Answers } from '@/lib/forms/types';
import { FormSupplementAnswers } from '@/types/wizard';
import { validateForm } from '@/lib/forms/packet';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;
  const form = FORM_REGISTRY[formId];
  if (!form) {
    return new Response(JSON.stringify({ error: `Unknown formId: ${formId}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

  const issues = validateForm(form, answers, supplements).filter((issue) => issue.blocking);
  if (issues.length > 0) {
    return new Response(
      JSON.stringify({
        error: 'Form is missing required fields',
        issues,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const pdfBytes = await fillForm(form, answers, supplements);
    return new Response(pdfBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${form.name.replace(/\s+/g, '-')}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[generate-form] Error filling ${formId}:`, message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
