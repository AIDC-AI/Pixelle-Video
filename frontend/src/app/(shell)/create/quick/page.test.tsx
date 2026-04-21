/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickCreatePage from './page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCurrentProjectStore } from '@/stores/current-project';
import { useSubmitQuick, useTaskPolling } from '@/lib/hooks/use-create-video';
import { useTtsWorkflows, useMediaWorkflows, useImageWorkflows, useBgmList } from '@/lib/hooks/use-resources';
import { toast } from 'sonner';

vi.mock('@/stores/current-project');
vi.mock('@/lib/hooks/use-create-video');
vi.mock('@/lib/hooks/use-resources');
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, params: any = {}) {
      super(type, params);
      this.pointerId = params.pointerId || 1;
      this.pointerType = params.pointerType || 'mouse';
      this.isPrimary = params.isPrimary !== false;
    }
  }
  (window as any).PointerEvent = PointerEvent as any;
}

describe('QuickCreatePage', () => {
  let queryClient: QueryClient;
  let mockMutateAsync: any;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();

    const mockPersist = {
      hasHydrated: vi.fn().mockReturnValue(true),
    };

    vi.mocked(useCurrentProjectStore).mockImplementation((selector: any) => {
      const state = {
        currentProject: { id: 'p-1', name: 'Test Proj' },
        persist: mockPersist,
      };
      return selector(state);
    });
    (useCurrentProjectStore as any).persist = mockPersist;

    vi.mocked(useTtsWorkflows).mockReturnValue({ data: { items: [{ id: 'tts1', name: 'TTS 1' }] } } as any);
    vi.mocked(useMediaWorkflows).mockReturnValue({ data: { items: [{ id: 'm1', name: 'Media 1' }] } } as any);
    vi.mocked(useImageWorkflows).mockReturnValue({ data: { items: [] } } as any);
    vi.mocked(useBgmList).mockReturnValue({ data: { items: [] } } as any);

    mockMutateAsync = vi.fn().mockResolvedValue({ id: 'task-999' });
    vi.mocked(useSubmitQuick).mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false } as any);
    
    vi.mocked(useTaskPolling).mockReturnValue({ data: undefined } as any);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <QuickCreatePage />
      </QueryClientProvider>
    );
  };

  it('renders form and config summary initially', () => {
    renderComponent();
    expect(screen.getByText('Quick Pipeline')).toBeInTheDocument();
    expect(screen.getByText('配置摘要')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成视频' })).toBeInTheDocument();
  });

  it('shows error if no project is selected', async () => {
    const user = userEvent.setup();
    const mockPersist = {
      hasHydrated: vi.fn().mockReturnValue(true),
    };
    vi.mocked(useCurrentProjectStore).mockImplementation((selector: any) => {
      const state = {
        currentProject: null,
        persist: mockPersist,
      };
      return selector(state);
    });
    (useCurrentProjectStore as any).persist = mockPersist;

    renderComponent();
    
    // Fill valid form so submission can happen
    await user.type(screen.getByLabelText('视频标题'), 'Valid Title');
    await user.type(screen.getByLabelText('创意描述 (Topic)'), 'Valid Topic with enough length');
    await user.click(screen.getByLabelText('配音 (TTS)'));
    await user.click(await screen.findByText('TTS 1'));
    await user.click(screen.getByLabelText('媒体流 (Media)'));
    await user.click(await screen.findByText('Media 1'));

    const submitBtn = screen.getByRole('button', { name: '生成视频' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('请先在顶部选择或创建一个项目');
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('submits form successfully and enters running state', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Fill form
    await user.type(screen.getByLabelText('视频标题'), 'My Title');
    await user.type(screen.getByLabelText('创意描述 (Topic)'), 'A valid topic description');
    
    // Open select dropdowns to select values
    const ttsSelect = screen.getByLabelText('配音 (TTS)');
    await user.click(ttsSelect);
    await user.click(await screen.findByText('TTS 1'));

    const mediaSelect = screen.getByLabelText('媒体流 (Media)');
    await user.click(mediaSelect);
    await user.click(await screen.findByText('Media 1'));

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        title: 'My Title',
        text: 'A valid topic description',
        mode: 'generate',
        tts_workflow: 'tts1',
        media_workflow: 'm1',
      }));
    });

    expect(screen.getByText('生成中...')).toBeInTheDocument();
  });

  it('handles task success state', () => {
    vi.mocked(useTaskPolling).mockReturnValue({
      data: { status: 'completed', progress: 100, result: { video_url: 'http://test.com/vid.mp4' } },
    } as any);

    renderComponent();
    expect(screen.getByText('生成结果')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /复制链接/i })).toBeInTheDocument();
  });

  it('handles task failure state', () => {
    vi.mocked(useTaskPolling).mockReturnValue({
      data: { status: 'failed', progress: 50, error_message: 'Some error' },
    } as any);

    renderComponent();
    expect(screen.getByText('生成失败')).toBeInTheDocument();
    expect(screen.getByText('Some error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新配置' })).toBeInTheDocument();
  });

  it('handles API submission failure', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('API Down'));
    const user = userEvent.setup();
    renderComponent();

    await user.type(screen.getByLabelText('视频标题'), 'My Title');
    await user.type(screen.getByLabelText('创意描述 (Topic)'), 'A valid topic description');
    
    await user.click(screen.getByLabelText('配音 (TTS)'));
    await user.click(await screen.findByText('TTS 1'));
    await user.click(screen.getByLabelText('媒体流 (Media)'));
    await user.click(await screen.findByText('Media 1'));

    await user.click(screen.getByRole('button', { name: '生成视频' }));

    await waitFor(() => {
      expect(screen.getByText('API Down')).toBeInTheDocument();
      expect(screen.getByText('生成失败')).toBeInTheDocument();
    });
  });
});
