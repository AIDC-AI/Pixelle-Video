import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoResult } from './video-result';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

describe('VideoResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders video and metadata', () => {
    const { container } = render(
      <VideoResult 
        videoUrl="http://test.com/video.mp4" 
        duration={15.5} 
        fileSize={2 * 1024 * 1024} 
        onRegenerate={vi.fn()} 
      />
    );
    expect(screen.getByText('生成结果')).toBeInTheDocument();
    expect(screen.getByText('时长: 15.5s')).toBeInTheDocument();
    expect(screen.getByText('大小: 2.0 MB')).toBeInTheDocument();
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('src', 'http://test.com/video.mp4');
  });

  it('handles copy link', () => {
    render(<VideoResult videoUrl="http://test.com/v.mp4" onRegenerate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /复制链接/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://test.com/v.mp4');
    expect(toast.success).toHaveBeenCalledWith('链接已复制到剪贴板');
  });

  it('calls onRegenerate', () => {
    const onRegenerate = vi.fn();
    render(<VideoResult videoUrl="http://test.com/v.mp4" onRegenerate={onRegenerate} />);
    fireEvent.click(screen.getByRole('button', { name: /基于此重生成/i }));
    expect(onRegenerate).toHaveBeenCalled();
  });
});
