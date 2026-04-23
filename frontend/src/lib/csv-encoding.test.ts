import { describe, expect, it } from 'vitest';

import { decodeCSV, detectEncoding } from '@/lib/csv-encoding';

describe('csv-encoding', () => {
  it('detects utf-8 buffers', () => {
    const buffer = new TextEncoder().encode('title,text\nhello,world').buffer;

    expect(detectEncoding(buffer)).toBe('utf-8');
    expect(decodeCSV(buffer)).toBe('title,text\nhello,world');
  });

  it('falls back to gbk when utf-8 decoding fails', () => {
    const buffer = new Uint8Array([0xc4, 0xe3, 0xba, 0xc3, 0x2c, 0x6e, 0x61, 0x6d, 0x65]).buffer;

    expect(detectEncoding(buffer)).toBe('gbk');
    expect(decodeCSV(buffer)).toContain('你好,name');
  });
});
