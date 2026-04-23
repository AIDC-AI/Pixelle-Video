const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export function toApiFileUrl(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null;
  }

  const trimmed = filePath.trim();
  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  const normalized = trimmed.replace(/^\/+/, '');
  if (normalized.startsWith('api/files/')) {
    return `${API_BASE_URL}/${normalized}`;
  }

  return `${API_BASE_URL}/api/files/${normalized}`;
}
