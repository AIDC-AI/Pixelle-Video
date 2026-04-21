import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ConfigSummaryProps {
  config: Record<string, unknown>;
}

export function ConfigSummary({ config }: ConfigSummaryProps) {
  const formatValue = (value: unknown): string => {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '0 items';
      }
      if (value.every((item) => typeof item === 'string' || typeof item === 'number')) {
        return value.join(', ');
      }
      return `${value.length} items`;
    }
    if (typeof value === 'object' && value !== null) {
      return `${Object.keys(value).length} fields`;
    }
    return String(value);
  };

  return (
    <Card className="bg-card border-border shadow-none">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-lg font-medium">配置摘要</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3 text-sm">
        {Object.entries(config).map(([key, value]) => {
          if (value === null || value === undefined || value === '') return null;
          const displayValue = formatValue(value);
          return (
            <div key={key} className="flex justify-between items-start">
              <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}</span>
              <span className="text-foreground font-medium text-right max-w-[60%] truncate" title={displayValue}>
                {displayValue}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
