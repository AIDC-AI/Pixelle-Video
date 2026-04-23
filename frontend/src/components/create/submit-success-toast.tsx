'use client';

import Link from 'next/link';

interface SubmitSuccessToastProps {
  taskName: string;
}

export function SubmitSuccessToast({ taskName }: SubmitSuccessToastProps) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-foreground">已加入队列</p>
      <p className="text-muted-foreground">{taskName}</p>
      <Link href="/batch/queue" className="text-primary underline underline-offset-4">
        查看队列
      </Link>
    </div>
  );
}
