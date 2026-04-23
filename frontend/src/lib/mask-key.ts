export function maskApiKey(value: string | null | undefined): string {
  const key = value?.trim() ?? '';

  if (key.length <= 8) {
    return '***';
  }

  return `${key.slice(0, 3)}***${key.slice(-3)}`;
}
