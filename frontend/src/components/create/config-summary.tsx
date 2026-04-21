import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ConfigSummaryProps {
  config: Record<string, unknown>;
}

export function ConfigSummary({ config }: ConfigSummaryProps) {
  return (
    <Card className="bg-card border-border shadow-none">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-lg font-medium">配置摘要</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3 text-sm">
        {Object.entries(config).map(([key, value]) => {
          if (!value) return null;
          return (
            <div key={key} className="flex justify-between items-start">
              <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}</span>
              <span className="text-foreground font-medium text-right max-w-[60%] truncate" title={String(value)}>
                {String(value)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
