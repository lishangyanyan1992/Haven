import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function resolveExisting(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const relative = specifier.slice(2);
    const resolved = resolveExisting(path.join(projectRoot, 'src', relative));
    if (resolved) {
      return nextResolve(resolved, context);
    }
  }

  if ((specifier.startsWith('./') || specifier.startsWith('../')) && path.extname(specifier) === '') {
    const parentPath = context.parentURL
      ? path.dirname(new URL(context.parentURL).pathname)
      : projectRoot;
    const resolved = resolveExisting(path.resolve(parentPath, specifier));
    if (resolved) {
      return nextResolve(resolved, context);
    }
  }

  return nextResolve(specifier, context);
}
