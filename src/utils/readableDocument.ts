import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { buildDeviceFileName } from './fileUtils';

type ReadableDocumentOptions = {
  type: string | string[];
  extensions: string[];
  maxBytes: number;
  invalidSelection: string;
};

export async function pickReadableDocument({ type, extensions, maxBytes, invalidSelection }: ReadableDocumentOptions): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const android = Platform.OS === 'android';
  // Expo Go can place the picker's automatic copy outside the project's readable cache.
  const result = await DocumentPicker.getDocumentAsync({ type, copyToCacheDirectory: !android });
  if (result.canceled) return null;

  const selected = result.assets[0];
  const extension = selected.name.toLowerCase().match(/\.([^.]+)$/)?.[1];
  if (!extension || !extensions.includes(extension) || selected.size === 0 || (selected.size ?? 0) > maxBytes) {
    throw new Error(invalidSelection);
  }
  if (!android) return selected;

  const cached = new File(Paths.cache, buildDeviceFileName('erubrica-adjunto', extension));
  try {
    await new File(selected.uri).copy(cached);
  } catch (cause) {
    throw new Error('No se pudo copiar el archivo al almacenamiento temporal de la aplicación. Vuelve a seleccionarlo.', { cause });
  }

  const size = cached.size;
  if (size <= 0 || size > maxBytes) {
    await cached.delete();
    throw new Error(invalidSelection);
  }
  return { ...selected, uri: cached.uri, size };
}
