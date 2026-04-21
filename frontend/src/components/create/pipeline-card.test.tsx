import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineCard } from './pipeline-card';
import { Sparkles } from 'lucide-react';

describe('PipelineCard', () => {
  it('renders correctly', () => {
    render(
      <PipelineCard
        title="Test Pipeline"
        description="A great pipeline"
        timeEstimate="1 min"
        icon={Sparkles}
        href="/test"
      />
    );
    expect(screen.getByText('Test Pipeline')).toBeInTheDocument();
    expect(screen.getByText('A great pipeline')).toBeInTheDocument();
    expect(screen.getByText(/Time: 1 min/i)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test');
  });
});
