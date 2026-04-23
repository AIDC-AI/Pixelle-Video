'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type DashboardRange = '1d' | '7d' | '30d';

interface DashboardChartsProps {
  durationData: Array<{ bucket: string; count: number }>;
  onRangeChange: (range: DashboardRange) => void;
  range: DashboardRange;
  successData: Array<{ name: string; value: number }>;
}

type RechartsModule = typeof import('recharts');

export function DashboardCharts({
  durationData,
  onRangeChange,
  range,
  successData,
}: DashboardChartsProps) {
  const [charts, setCharts] = useState<RechartsModule | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('recharts').then((module) => {
      if (!cancelled) {
        setCharts(module);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ranges: DashboardRange[] = ['1d', '7d', '30d'];

  return (
    <Card className="border-border/70 bg-card shadow-none">
      <CardHeader className="flex flex-col gap-3 border-b md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Batch performance</CardTitle>
          <CardDescription>Success rate and duration distribution.</CardDescription>
        </div>
        <div className="flex gap-2">
          {ranges.map((item) => (
            <Button
              key={item}
              type="button"
              variant={range === item ? 'default' : 'outline'}
              size="sm"
              onClick={() => onRangeChange(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-4 lg:grid-cols-2">
        {!charts ? (
          <p className="text-sm text-muted-foreground">Loading charts…</p>
        ) : (
          <>
            <div className="h-64">
              <charts.ResponsiveContainer width="100%" height="100%">
                <charts.PieChart>
                  <charts.Pie data={successData} dataKey="value" nameKey="name" outerRadius={86} label>
                    {successData.map((entry, index) => (
                      <charts.Cell
                        key={entry.name}
                        fill={index === 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                      />
                    ))}
                  </charts.Pie>
                  <charts.Tooltip />
                  <charts.Legend />
                </charts.PieChart>
              </charts.ResponsiveContainer>
            </div>
            <div className="h-64">
              <charts.ResponsiveContainer width="100%" height="100%">
                <charts.BarChart data={durationData}>
                  <charts.CartesianGrid strokeDasharray="3 3" />
                  <charts.XAxis dataKey="bucket" />
                  <charts.YAxis allowDecimals={false} />
                  <charts.Tooltip />
                  <charts.Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </charts.BarChart>
              </charts.ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
