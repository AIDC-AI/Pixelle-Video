import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppIntlProvider } from '@/lib/i18n';
import { GlobalDropOverlay } from './global-drop-overlay';

let mockPathname = '/create/i2v';

const { toastError, toastInfo, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    info: toastInfo,
    success: toastSuccess,
  },
}));

function renderOverlay(children: React.ReactNode = <div>Content</div>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <AppIntlProvider>
      <QueryClientProvider client={queryClient}>
        <GlobalDropOverlay>{children}</GlobalDropOverlay>
      </QueryClientProvider>
    </AppIntlProvider>
  );
}

function createDragEvent(type: string, files: File[] = [], dragTypes: string[] = ['Files']) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      dropEffect: 'none',
      files,
      types: dragTypes,
    },
  });
  return event;
}

function getOverlay() {
  return screen.getByText('松手上传文件').closest('[aria-hidden]');
}

describe('GlobalDropOverlay', () => {
  beforeEach(() => {
    mockPathname = '/create/i2v';
    localStorage.setItem('skyframe-language-preference', 'zh-CN');
    document.documentElement.lang = 'zh-CN';
    toastSuccess.mockReset();
    toastError.mockReset();
    toastInfo.mockReset();
    vi.restoreAllMocks();
  });

  it('shows an overlay for file drags only', () => {
    renderOverlay();

    expect(getOverlay()).toHaveAttribute('aria-hidden', 'true');

    fireEvent(window, createDragEvent('dragenter', [], ['text/plain']));
    expect(getOverlay()).toHaveAttribute('aria-hidden', 'true');

    fireEvent(window, createDragEvent('dragenter'));
    expect(getOverlay()).toHaveAttribute('aria-hidden', 'false');
  });

  it('passes compatible files to Create page upload inputs', async () => {
    const onChange = vi.fn();
    const file = new File(['image'], 'portrait.png', { type: 'image/png' });
    renderOverlay(
      <input
        aria-label="Portrait"
        type="file"
        accept="image/*"
        onChange={onChange}
      />
    );

    fireEvent(window, createDragEvent('drop', [file]));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Portrait')).toHaveProperty('files', [file]);
  });

  it('uploads files on Library pages and invalidates library data', async () => {
    mockPathname = '/library/images';
    const file = new File(['image'], 'asset.png', { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201, statusText: 'Created' }));
    renderOverlay();

    fireEvent(window, createDragEvent('drop', [file]));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('已上传 1 个文件。'));
  });

  it('shows a toast when files are dropped outside Create or Library', async () => {
    mockPathname = '/settings';
    const file = new File(['image'], 'asset.png', { type: 'image/png' });
    renderOverlay();

    fireEvent(window, createDragEvent('drop', [file]));

    await waitFor(() => expect(toastInfo).toHaveBeenCalledWith('请在创建或素材页面上传文件。'));
  });
});
