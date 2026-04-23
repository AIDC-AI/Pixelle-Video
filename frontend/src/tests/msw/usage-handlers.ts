import { http, HttpResponse } from 'msw';

import type { UsageGroupBy, UsagePeriod, UsageResponse } from '@/lib/hooks/use-usage';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function buildUsageResponse(period: UsagePeriod, groupBy: UsageGroupBy): UsageResponse {
  const multiplier = period === 'today' ? 1 : 18;
  const keys = groupBy === 'pipeline' ? ['quick', 'i2v', 'digital-human'] : ['gpt-5.4', 'seedance', 'tts-local'];

  return {
    period,
    group_by: groupBy,
    summary: {
      api_calls: 42 * multiplier,
      downloads_bytes: 1024 * 1024 * 4 * multiplier,
      generated_count: 9 * multiplier,
      storage_bytes: 1024 * 1024 * 128,
    },
    trend: Array.from({ length: period === 'today' ? 6 : 14 }).map((_, index) => ({
      date: period === 'today' ? `${index * 4}:00` : `Apr ${index + 1}`,
      api_calls: (index + 1) * 5,
      generated: (index % 4) + 1,
      cost_usd: Number(((index + 1) * 0.18).toFixed(2)),
    })),
    breakdown: keys.map((key, index) => ({
      key,
      calls: (index + 1) * 12 * multiplier,
      generated: (index + 1) * 3 * multiplier,
      cost_usd: Number(((index + 1) * 0.85 * multiplier).toFixed(2)),
    })),
  };
}

export const usageHandlers = [
  http.get(`${baseURL}/api/usage`, ({ request }) => {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') === 'month' ? 'month' : 'today';
    const groupBy = url.searchParams.get('group_by') === 'model' ? 'model' : 'pipeline';

    return HttpResponse.json(buildUsageResponse(period, groupBy));
  }),
  http.get(`${baseURL}/api/usage/export`, ({ request }) => {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') ?? 'today';
    const csv = `period,api_calls,generated\n${period},42,9\n`;

    return new HttpResponse(csv, {
      headers: {
        'Content-Disposition': `attachment; filename="usage-${period}.csv"`,
        'Content-Type': 'text/csv',
      },
    });
  }),
];
