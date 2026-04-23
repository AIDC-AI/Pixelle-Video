'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUsage, type UsageGroupBy, type UsagePeriod } from '@/lib/hooks/use-usage';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type RechartsModule = typeof import('recharts');

function formatBytes(value: number): string {
  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-border/70 bg-card shadow-none">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export default function UsageSettingsPage() {
  const [period, setPeriod] = useState<UsagePeriod>('today');
  const [groupBy, setGroupBy] = useState<UsageGroupBy>('pipeline');
  const [charts, setCharts] = useState<RechartsModule | null>(null);
  const usageQuery = useUsage(period, groupBy);
  const data = usageQuery.data;

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

  const exportCsv = async () => {
    const response = await fetch(
      `${baseURL}/api/usage/export?${new URLSearchParams({ format: 'csv', period }).toString()}`
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `usage-${period}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Usage</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Mocked usage metrics for calls, generated assets, storage, and exports until backend endpoints ship.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['today', 'month'] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={period === item ? 'default' : 'outline'}
              onClick={() => setPeriod(item)}
            >
              {item === 'today' ? 'Today' : 'This month'}
            </Button>
          ))}
          {(['pipeline', 'model'] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={groupBy === item ? 'default' : 'outline'}
              onClick={() => setGroupBy(item)}
            >
              By {item}
            </Button>
          ))}
          <Button type="button" variant="outline" onClick={() => void exportCsv()}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {usageQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading usage metrics…</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="API calls" value={data.summary.api_calls} />
            <MetricCard label="Generated assets" value={data.summary.generated_count} />
            <MetricCard label="Storage usage" value={formatBytes(data.summary.storage_bytes)} />
            <MetricCard label="Download traffic" value={formatBytes(data.summary.downloads_bytes)} />
          </div>

          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader>
              <CardTitle>Usage charts</CardTitle>
              <CardDescription>Daily trend and distribution by {groupBy}.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              {!charts ? (
                <p className="text-sm text-muted-foreground">Loading charts…</p>
              ) : (
                <>
                  <div className="h-72">
                    <charts.ResponsiveContainer width="100%" height="100%">
                      <charts.LineChart data={data.trend}>
                        <charts.CartesianGrid strokeDasharray="3 3" />
                        <charts.XAxis dataKey="date" />
                        <charts.YAxis allowDecimals={false} />
                        <charts.Tooltip />
                        <charts.Legend />
                        <charts.Line type="monotone" dataKey="api_calls" stroke="hsl(var(--primary))" />
                        <charts.Line type="monotone" dataKey="generated" stroke="hsl(var(--success))" />
                      </charts.LineChart>
                    </charts.ResponsiveContainer>
                  </div>
                  <div className="h-72">
                    <charts.ResponsiveContainer width="100%" height="100%">
                      <charts.PieChart>
                        <charts.Pie data={data.breakdown} dataKey="calls" nameKey="key" outerRadius={90} label>
                          {data.breakdown.map((item, index) => (
                            <charts.Cell
                              key={item.key}
                              fill={['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))'][index % 3]}
                            />
                          ))}
                        </charts.Pie>
                        <charts.Tooltip />
                        <charts.Legend />
                      </charts.PieChart>
                    </charts.ResponsiveContainer>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
