import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineCard } from './pipeline-card';
import { Sparkles } from 'lucide-react';
import { AppIntlProvider } from '@/lib/i18n';

describe('PipelineCard', () => {
  beforeEach(() => {
    localStorage.setItem('skyframe-language-preference', 'en-US');
  });

  it('renders correctly', () => {
    render(
      <AppIntlProvider>
        <PipelineCard
          title="Test Pipeline"
          description="A great pipeline"
          timeEstimate="1 min"
          icon={Sparkles}
          href="/test"
        />
      </AppIntlProvider>
    );
    expect(screen.getByText('Test Pipeline')).toBeInTheDocument();
    expect(screen.getByText('A great pipeline')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('1 min')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test');
  });

  it('renders the compact variant without a time estimate', () => {
    render(
      <AppIntlProvider>
        <PipelineCard
          title="Compact Pipeline"
          description="A shorter presentation"
          timeEstimate="1 min"
          icon={Sparkles}
          href="/compact"
          variant="compact"
        />
      </AppIntlProvider>
    );

    const card = screen.getByRole('link');
    expect(card).toHaveAttribute('href', '/compact');
    expect(card.querySelector('[data-variant="compact"]')).toBeInTheDocument();
    expect(screen.getByText('Compact Pipeline')).toBeInTheDocument();
    expect(screen.queryByText('Time')).not.toBeInTheDocument();
    expect(screen.queryByText('1 min')).not.toBeInTheDocument();
  });
});
