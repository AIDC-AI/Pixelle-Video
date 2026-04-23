/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjects, useCreateProject } from './use-projects';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '../api-client';

vi.mock('../api-client');

describe('useProjects', () => {
  it('calls apiClient correctly', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({ items: [] });
    const queryClient = new QueryClient();
    const wrapper = ({ children }: any) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useProjects(), { wrapper });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient).toHaveBeenCalledWith('/api/projects');
  });

  it('useCreateProject calls apiClient correctly', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({ id: '1', name: 'Test' });
    const queryClient = new QueryClient();
    const wrapper = ({ children }: any) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useCreateProject(), { wrapper });
    
    result.current.mutate({ name: 'Test' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    expect(apiClient).toHaveBeenCalledWith('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' })
    });
  });
});
