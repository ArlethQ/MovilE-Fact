import { File } from 'expo-file-system';

import { pickReadableDocument } from './readableDocument';

export function pickReadablePdf() {
  return pickReadableDocument({
    type: 'application/pdf',
    extensions: ['pdf'],
    maxBytes: 10 * 1024 * 1024,
    invalidSelection: 'Selecciona un archivo .pdf de máximo 10 MB.',
  });
}

export async function readPdfBase64(uri: string): Promise<string> {
  let content: string;
  try {
    content = await new File(uri).base64();
  } catch (cause) {
    throw new Error('No se pudo leer el archivo PDF. Vuelve a seleccionarlo para crear una copia accesible.', { cause });
  }
  if (!content.startsWith('JVBERi0')) {
    throw new Error('El archivo seleccionado no contiene una cabecera PDF válida.');
  }
  return content;
}
