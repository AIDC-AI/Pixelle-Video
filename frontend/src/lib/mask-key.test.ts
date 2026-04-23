import { describe, expect, it } from 'vitest';

import { maskApiKey } from './mask-key';

describe('maskApiKey', () => {
  it('keeps only a stable prefix and suffix for long keys', () => {
    expect(maskApiKey('sk-1234567890')).toBe('sk-***890');
    expect(maskApiKey('rh_live_abcdef')).toBe('rh_***def');
  });

  it('does not expose short or empty secrets', () => {
    expect(maskApiKey('short')).toBe('***');
    expect(maskApiKey('')).toBe('***');
    expect(maskApiKey(null)).toBe('***');
    expect(maskApiKey(undefined)).toBe('***');
  });

  it('trims surrounding whitespace before masking', () => {
    expect(maskApiKey('  cf-123456789  ')).toBe('cf-***789');
  });
});
