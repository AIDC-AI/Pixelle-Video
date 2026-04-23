'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export type UsagePeriod = 'month' | 'today';
export type UsageGroupBy = 'model' | 'pipeline';

export interface UsageBreakdownItem {
  calls: number;
  cost_usd: number;
  generated: number;
  key: string;
}

export interface UsageTrendItem {
  api_calls: number;
  cost_usd: number;
  date: string;
  generated: number;
}

export interface UsageSummary {
  api_calls: number;
  downloads_bytes: number;
  generated_count: number;
  storage_bytes: number;
}

export interface UsageResponse {
  breakdown: UsageBreakdownItem[];
  group_by: UsageGroupBy;
  period: UsagePeriod;
  summary: UsageSummary;
  trend: UsageTrendItem[];
}

export function useUsage(period: UsagePeriod, groupBy: UsageGroupBy) {
  return useQuery({
    queryKey: ['usage', period, groupBy],
    queryFn: () =>
      apiClient<UsageResponse>(
        `/api/usage?${new URLSearchParams({ period, group_by: groupBy }).toString()}`
      ),
    staleTime: 60 * 1000,
  });
}
