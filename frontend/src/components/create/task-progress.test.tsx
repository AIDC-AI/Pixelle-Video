import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskProgress } from './task-progress';

describe('TaskProgress', () => {
  it('renders pending state', () => {
    render(<TaskProgress taskId="t-123" status="pending" progress={0} />);
    expect(screen.getByText('任务进度')).toBeInTheDocument();
    expect(screen.getByText('排队中')).toBeInTheDocument();
    expect(screen.getByText('ID: t-123')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消任务' })).toBeInTheDocument();
  });

  it('renders running state with current step', () => {
    render(<TaskProgress taskId="t-123" status="running" progress={45} currentStep="Generating audio..." />);
    expect(screen.getByText('生成中')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('Generating audio...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消任务' })).toBeInTheDocument();
  });

  it('renders completed state without cancel button', () => {
    render(<TaskProgress taskId="t-123" status="completed" progress={100} />);
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消任务' })).not.toBeInTheDocument();
  });

  it('renders failed state without cancel button', () => {
    render(<TaskProgress taskId="t-123" status="failed" progress={45} />);
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消任务' })).not.toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<TaskProgress taskId="t-123" status="running" progress={45} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: '取消任务' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
