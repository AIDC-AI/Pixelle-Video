import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DashboardCharts } from './dashboard-charts';

describe('DashboardCharts', () => {
  it('renders range controls and chart loading state', async () => {
    const user = userEvent.setup();
    const onRangeChange = vi.fn();
    render(
      <DashboardCharts
        range="1d"
        onRangeChange={onRangeChange}
        successData={[
          { name: 'Succeeded', value: 3 },
          { name: 'Failed', value: 1 },
        ]}
        durationData={[{ bucket: '<1m', count: 2 }]}
      />
    );

    expect(screen.getByText('Batch performance')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '7d' }));

    expect(onRangeChange).toHaveBeenCalledWith('7d');
  });
});
