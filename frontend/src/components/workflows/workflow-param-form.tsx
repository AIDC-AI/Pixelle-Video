'use client';

import { Input } from '@/components/ui/input';

interface WorkflowParamFormProps {
  onChange: (values: Record<string, unknown>) => void;
  schema: Record<string, unknown>;
  values: Record<string, unknown>;
}

interface NormalizedField {
  enumValues?: string[];
  key: string;
  label: string;
  type: 'boolean' | 'enum' | 'number' | 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function inferFieldType(key: string, descriptor: unknown): NormalizedField {
  if (isRecord(descriptor)) {
    const enumValues = Array.isArray(descriptor.enum)
      ? descriptor.enum.filter((item): item is string => typeof item === 'string')
      : undefined;
    const type = typeof descriptor.type === 'string' ? descriptor.type : undefined;

    if (enumValues && enumValues.length > 0) {
      return { enumValues, key, label: String(descriptor.title ?? key), type: 'enum' };
    }

    if (type === 'number' || type === 'integer') {
      return { key, label: String(descriptor.title ?? key), type: 'number' };
    }

    if (type === 'boolean') {
      return { key, label: String(descriptor.title ?? key), type: 'boolean' };
    }

    return { key, label: String(descriptor.title ?? key), type: 'string' };
  }

  if (typeof descriptor === 'number') {
    return { key, label: key, type: 'number' };
  }

  if (typeof descriptor === 'boolean') {
    return { key, label: key, type: 'boolean' };
  }

  return { key, label: key, type: 'string' };
}

export function normalizeWorkflowParamSchema(schema: Record<string, unknown>): NormalizedField[] {
  const source = isRecord(schema.properties) ? schema.properties : schema;

  return Object.entries(source)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => inferFieldType(key, value));
}

export function extractWorkflowInputSchema(workflowJson: Record<string, unknown>): Record<string, unknown> {
  const directSchema =
    workflowJson.input_schema ?? workflowJson.inputs_schema ?? workflowJson.parameters ?? workflowJson.schema;
  if (isRecord(directSchema)) {
    return directSchema;
  }

  for (const [, value] of Object.entries(workflowJson)) {
    if (!isRecord(value)) {
      continue;
    }

    const classType = String(value.class_type ?? value.type ?? '').toLowerCase();
    if ((classType.includes('input') || classType.includes('load')) && isRecord(value.inputs)) {
      return value.inputs;
    }
  }

  return {};
}

function coerceValue(type: NormalizedField['type'], value: string | boolean): unknown {
  if (type === 'boolean') {
    return Boolean(value);
  }

  if (type === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return value;
}

export function WorkflowParamForm({ schema, values, onChange }: WorkflowParamFormProps) {
  const fields = normalizeWorkflowParamSchema(schema);

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">No exposed input parameters were detected.</p>;
  }

  const updateValue = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <label key={field.key} className="grid gap-2">
          <span className="text-sm font-medium text-foreground">{field.label}</span>
          {field.type === 'boolean' ? (
            <button
              type="button"
              role="switch"
              aria-label={field.label}
              aria-checked={Boolean(values[field.key])}
              className="w-fit rounded-full border border-border px-3 py-1 text-sm data-[enabled=true]:bg-primary data-[enabled=true]:text-primary-foreground"
              data-enabled={Boolean(values[field.key])}
              onClick={() => updateValue(field.key, !Boolean(values[field.key]))}
            >
              {Boolean(values[field.key]) ? 'On' : 'Off'}
            </button>
          ) : field.type === 'enum' ? (
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={String(values[field.key] ?? field.enumValues?.[0] ?? '')}
              onChange={(event) => updateValue(field.key, event.target.value)}
            >
              {field.enumValues?.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={field.type === 'number' ? 'number' : 'text'}
              value={String(values[field.key] ?? '')}
              onChange={(event) => updateValue(field.key, coerceValue(field.type, event.target.value))}
            />
          )}
        </label>
      ))}
    </div>
  );
}
