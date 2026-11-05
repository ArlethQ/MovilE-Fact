export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function buildDeviceFileName(filename: string, extension: string) {
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
  const safeName = filename.replace(/[^a-z0-9._-]/gi, '-');
  const withoutExtension = safeName.toLowerCase().endsWith(normalizedExtension.toLowerCase())
    ? safeName.slice(0, -normalizedExtension.length)
    : safeName;
  return `${withoutExtension}-${Date.now()}${normalizedExtension}`;
}
