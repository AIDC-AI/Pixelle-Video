import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppTranslations } from '@/lib/i18n';
import type { ConfigSummaryItem } from '@/lib/resource-display';

interface ConfigSummaryProps {
  config?: Record<string, unknown>;
  items?: readonly ConfigSummaryItem[];
}

export function ConfigSummary({ config, items }: ConfigSummaryProps) {
  const t = useAppTranslations('configSummary');
  const formatValue = (value: unknown): string => {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return t('items', { count: 0 });
      }
      if (value.every((item) => typeof item === 'string' || typeof item === 'number')) {
        return value.join(', ');
      }
      return t('items', { count: value.length });
    }
    if (typeof value === 'object' && value !== null) {
      return t('fields', { count: Object.keys(value).length });
    }
    return String(value);
  };

  const rows =
    items && items.length > 0
      ? items.map((item) => ({
          key: item.key,
          label: item.label,
          value: item.value,
          detail: item.detail ?? null,
        }))
      : Object.entries(config ?? {})
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => ({
            key,
            label: key.replace(/_/g, ' '),
            value: formatValue(value),
            detail: null,
          }));

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-lg font-medium">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4 text-sm">
        {rows.map((row) => {
          return (
            <div key={row.key} className="flex items-start justify-between gap-3">
              <span className="capitalize text-muted-foreground">{row.label}</span>
              <div className="max-w-[60%] text-right">
                <span className="truncate font-medium text-foreground" title={row.value}>
                  {row.value}
                </span>
                {row.detail ? <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p> : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
