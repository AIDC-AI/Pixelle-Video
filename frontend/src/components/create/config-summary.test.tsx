import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigSummary } from './config-summary';

describe('ConfigSummary', () => {
  it('renders config entries', () => {
    const config = {
      title: 'My Video',
      duration: 30,
      empty_field: '',
    };
    render(<ConfigSummary config={config} />);
    
    expect(screen.getByText('配置摘要')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('My Video')).toBeInTheDocument();
    expect(screen.getByText('duration')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    
    // empty fields are omitted
    expect(screen.queryByText('empty field')).not.toBeInTheDocument();
  });
});
