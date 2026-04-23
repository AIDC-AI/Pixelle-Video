import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildStorageUsageSlices, StorageUsageChart } from './storage-usage-chart';

const MB = 1024 * 1024;

describe('buildStorageUsageSlices', () => {
  it('maps backend paths into stable storage categories', () => {
    const slices = buildStorageUsageSlices([
      { key: 'output', total_size_bytes: 12 * MB },
      { key: 'uploads', total_size_bytes: 2 * MB },
      { key: 'temp', total_size_bytes: 4 * MB },
    ]);

    expect(slices).toEqual([
      expect.objectContaining({ type: 'video', label: 'Video', bytes: 12 * MB }),
      expect.objectContaining({ type: 'image', label: 'Image', bytes: 2 * MB }),
      expect.objectContaining({ type: 'script', label: 'Scripts', bytes: 4 * MB }),
    ]);
  });

  it('filters empty and negative values', () => {
    expect(
      buildStorageUsageSlices([
        { key: 'output', total_size_bytes: 0 },
        { key: 'temp', total_size_bytes: -1 },
      ])
    ).toEqual([]);
  });
});

describe('StorageUsageChart', () => {
  it('renders textual legend data before the chart module finishes loading', () => {
    render(
      <StorageUsageChart
        data={[
          { type: 'video', label: 'Video', bytes: 12 * MB, color: '#38bdf8' },
          { type: 'image', label: 'Image', bytes: 2 * MB, color: '#34d399' },
        ]}
      />
    );

    expect(screen.getByText('Loading storage chart...')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.getByText('12.0 MB')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
  });

  it('renders an empty state for zero usage', () => {
    render(<StorageUsageChart data={[]} />);

    expect(screen.getByText('No storage usage yet.')).toBeInTheDocument();
  });
});
