import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/tests/pipeline-page-test-utils';
import { useUsage } from './use-usage';

describe('useUsage', () => {
  it('loads mocked usage metrics', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUsage('today', 'pipeline'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.summary.api_calls).toBeGreaterThan(0);
    expect(result.current.data?.breakdown[0].key).toBe('quick');
  });
});
