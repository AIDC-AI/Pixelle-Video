const UTF8_BOM = [0xef, 0xbb, 0xbf];

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return UTF8_BOM.every((value, index) => bytes[index] === value);
}

function canDecodeUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function detectEncoding(buffer: ArrayBuffer): 'utf-8' | 'gbk' {
  const bytes = new Uint8Array(buffer);

  if (bytes.length === 0 || hasUtf8Bom(bytes) || canDecodeUtf8(bytes)) {
    return 'utf-8';
  }

  return 'gbk';
}

export function decodeCSV(buffer: ArrayBuffer): string {
  const encoding = detectEncoding(buffer);
  return new TextDecoder(encoding).decode(new Uint8Array(buffer));
}
