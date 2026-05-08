import path from 'path';

const USCIS_FORMS_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  'public',
  'uscis-forms'
);

export function resolveLocalTemplatePath(localPath: string): string {
  return path.join(USCIS_FORMS_DIR, path.basename(localPath));
}

export function resolveNamedTemplatePath(formId: string): string {
  return path.join(USCIS_FORMS_DIR, `${formId}.pdf`);
}
