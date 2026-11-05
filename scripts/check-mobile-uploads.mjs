import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
const forbiddenPatterns = [
  { pattern: /as\s+unknown\s+as\s+Blob/, message: 'Usa appendMobileFile; no conviertas objetos URI a Blob.' },
  { pattern: /form(?:Data)?\.append\([^\n]*\{\s*uri\s*:/, message: 'Usa appendMobileFile para adjuntar archivos de Expo.' },
];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return files.flat();
}

const violations = [];
for (const file of await filesIn(sourceRoot)) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const content = await readFile(file, 'utf8');
  for (const { pattern, message } of forbiddenPatterns) {
    if (pattern.test(content)) violations.push(`${file}: ${message}`);
  }
}

if (violations.length) {
  console.error('Se detectaron adjuntos móviles incompatibles:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('Adjuntos móviles: verificación correcta.');
