import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { parseWorkflowGraph, WorkflowGraphPreview } from './workflow-graph-preview';

describe('WorkflowGraphPreview', () => {
  it('parses ComfyUI-style nodes and links', () => {
    const graph = parseWorkflowGraph({
      '1': { class_type: 'LoadImage', inputs: {} },
      '2': { class_type: 'KSampler', inputs: { image: ['1', 0] } },
    });

    expect(graph?.nodes).toHaveLength(2);
    expect(graph?.edges).toEqual([{ from: '1', to: '2' }]);
  });

  it('renders an SVG preview with zoom controls', () => {
    render(
      <WorkflowGraphPreview
        workflowJson={{
          '1': { class_type: 'LoadImage', inputs: {} },
          '2': { class_type: 'SaveImage', inputs: { image: ['1', 0] } },
        }}
      />
    );

    const graph = screen.getByRole('img', { name: 'Read-only workflow graph preview' });
    expect(screen.getByText('LoadImage')).toBeInTheDocument();

    fireEvent.wheel(graph, { deltaY: -100 });
    expect(screen.getByText(/zoom 110%/)).toBeInTheDocument();
  });

  it('falls back to JSON when graph nodes cannot be parsed', () => {
    render(<WorkflowGraphPreview workflowJson={{ hello: 'world' }} />);

    expect(screen.getByText('JSON fallback preview')).toBeInTheDocument();
    expect(screen.getByText(/"hello": "world"/)).toBeInTheDocument();
  });
});
