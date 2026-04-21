'use client';

import { Badge } from '@/components/ui/badge';
import { batchStatusClassName, batchStatusLabel, type BatchStatus } from '@/lib/batch-utils';

export function BatchStatusBadge({ status }: { status: BatchStatus | string | null | undefined }) {
  return <Badge className={batchStatusClassName(status)}>{batchStatusLabel(status)}</Badge>;
}
