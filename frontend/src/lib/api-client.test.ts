import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from './api-client';

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches json data successfully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ items: [] }),
    } as unknown as Response);

    const data = await apiClient('/api/test');
    expect(data).toEqual({ items: [] });
  });

  it('handles empty response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '',
    } as unknown as Response);

    const data = await apiClient('/api/test');
    expect(data).toEqual({});
  });

  it('throws ApiError on failure with { detail: { code, message } }', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: { code: 'ERR_1', message: 'Fail object' } }),
    } as unknown as Response);

    await expect(apiClient('/api/test')).rejects.toEqual({ status: 400, code: 'ERR_1', message: 'Fail object' });
  });

  it('throws ApiError on failure with { detail: "string" }', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Fail string' }),
    } as unknown as Response);

    await expect(apiClient('/api/test')).rejects.toEqual({ status: 404, code: '404', message: 'Fail string' });
  });

  it('throws ApiError on failure without json body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Error',
      json: async () => { throw new Error('parse error'); },
    } as unknown as Response);

    await expect(apiClient('/api/test')).rejects.toEqual({ status: 500, code: 'UNKNOWN_ERROR', message: 'Internal Error' });
  });
});
