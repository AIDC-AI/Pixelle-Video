'use client';

import { useMemo, useState } from 'react';

interface WorkflowNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface WorkflowEdge {
  from: string;
  to: string;
}

interface ParsedWorkflowGraph {
  edges: WorkflowEdge[];
  nodes: WorkflowNode[];
}

interface WorkflowGraphPreviewProps {
  workflowJson: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNodeLabel(id: string, value: Record<string, unknown>): string {
  if (typeof value.class_type === 'string' && value.class_type.trim()) {
    return value.class_type;
  }

  if (typeof value.type === 'string' && value.type.trim()) {
    return value.type;
  }

  if (typeof value.name === 'string' && value.name.trim()) {
    return value.name;
  }

  return `Node ${id}`;
}

function getInputLinks(inputs: unknown): string[] {
  if (!isRecord(inputs)) {
    return [];
  }

  return Object.values(inputs).flatMap((value) => {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return [value[0]];
    }

    if (isRecord(value) && typeof value.node === 'string') {
      return [value.node];
    }

    if (isRecord(value) && typeof value.from === 'string') {
      return [value.from];
    }

    return [];
  });
}

export function parseWorkflowGraph(workflowJson: Record<string, unknown>): ParsedWorkflowGraph | null {
  const nodeEntries = Object.entries(workflowJson).filter(([, value]) => {
    if (!isRecord(value)) {
      return false;
    }

    return 'class_type' in value || 'inputs' in value || 'type' in value || 'name' in value;
  });

  if (nodeEntries.length === 0) {
    return null;
  }

  const ids = new Set(nodeEntries.map(([id]) => id));
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(nodeEntries.length)));
  const nodes = nodeEntries.map(([id, value], index) => ({
    id,
    label: getNodeLabel(id, value as Record<string, unknown>),
    x: 40 + (index % columnCount) * 220,
    y: 40 + Math.floor(index / columnCount) * 130,
  }));
  const edges = nodeEntries.flatMap(([targetId, value]) =>
    getInputLinks((value as Record<string, unknown>).inputs)
      .filter((sourceId) => ids.has(sourceId))
      .map((sourceId) => ({ from: sourceId, to: targetId }))
  );

  return { edges, nodes };
}

function JsonFallback({ workflowJson }: { workflowJson: Record<string, unknown> }) {
  const json = JSON.stringify(workflowJson, null, 2);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">JSON fallback preview</p>
      <pre className="max-h-[32rem] overflow-auto rounded-2xl border border-border/70 bg-muted/10 p-4 text-xs leading-6 text-foreground">
        <code>{json}</code>
      </pre>
    </div>
  );
}

export function WorkflowGraphPreview({ workflowJson }: WorkflowGraphPreviewProps) {
  const graph = useMemo(() => parseWorkflowGraph(workflowJson), [workflowJson]);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  if (!graph) {
    return <JsonFallback workflowJson={workflowJson} />;
  }

  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const width = Math.max(640, ...graph.nodes.map((node) => node.x + 180));
  const height = Math.max(360, ...graph.nodes.map((node) => node.y + 90));

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border/70 bg-muted/10"
      onWheel={(event) => {
        event.preventDefault();
        setScale((current) => Math.min(2, Math.max(0.5, current + (event.deltaY < 0 ? 0.1 : -0.1))));
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
      }}
      onPointerMove={(event) => {
        if (!dragStart) {
          return;
        }

        setPan({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
      }}
      onPointerUp={() => setDragStart(null)}
      role="img"
      aria-label="Read-only workflow graph preview"
    >
      <div className="border-b border-border/70 px-4 py-2 text-xs text-muted-foreground">
        Read-only graph · zoom {Math.round(scale * 100)}%
      </div>
      <svg className="h-[32rem] w-full touch-none" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <marker id="workflow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" className="fill-primary" />
          </marker>
        </defs>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
          {graph.edges.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) {
              return null;
            }

            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x + 170}
                y1={from.y + 32}
                x2={to.x}
                y2={to.y + 32}
                className="stroke-primary"
                strokeWidth="2"
                markerEnd="url(#workflow-arrow)"
              />
            );
          })}
          {graph.nodes.map((node) => (
            <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
              <rect width="170" height="64" rx="14" className="fill-card stroke-border" strokeWidth="1.5" />
              <text x="14" y="26" className="fill-muted-foreground text-[11px]">
                {node.id}
              </text>
              <text x="14" y="45" className="fill-foreground text-[13px] font-medium">
                {node.label.length > 18 ? `${node.label.slice(0, 18)}...` : node.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
