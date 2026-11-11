import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { buildDeviceFileName } from './fileUtils';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const INVALID_SELECTION = 'Selecciona un archivo .pdf de máximo 10 MB.';

export async function pickReadablePdf(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  // On Android, use the provider's granted content URI and copy to the project's
  // cache. The picker's global Expo Go cache can be outside this project's scope.
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: Platform.OS !== 'android',
  });
  if (result.canceled) return null;

  const selected = result.assets[0];
  if (!selected.name.toLowerCase().endsWith('.pdf') || (selected.size ?? 0) > MAX_PDF_BYTES) {
    throw new Error(INVALID_SELECTION);
  }
  if (Platform.OS !== 'android') return selected;

  const cached = new File(Paths.cache, buildDeviceFileName('erubrica-pdf', '.pdf'));
  try {
    await new File(selected.uri).copy(cached);
  } catch (cause) {
    throw new Error('No se pudo copiar el PDF al almacenamiento temporal de la aplicación. Vuelve a seleccionarlo.', { cause });
  }
  const size = cached.size;
  if (size > MAX_PDF_BYTES) {
    cached.delete();
    throw new Error(INVALID_SELECTION);
  }
  return { ...selected, uri: cached.uri, size };
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
