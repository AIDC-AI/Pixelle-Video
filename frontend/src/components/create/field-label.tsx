import React from 'react';

interface FieldLabelProps {
  label: string;
  required?: boolean;
}

export function FieldLabel({ label, required = false }: FieldLabelProps) {
  return (
    <span className="flex items-center gap-2">
      {required ? (
        <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
      ) : (
        <span className="text-xs font-normal text-muted-foreground">Optional</span>
      )}
      <span>{label}</span>
    </span>
  );
}
