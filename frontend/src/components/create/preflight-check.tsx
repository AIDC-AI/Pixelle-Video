'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type CheckStatus = 'fail' | 'pass' | 'warn';

export interface PreflightResult {
  checks: Array<{
    key: string;
    label: string;
    message?: string;
    status: CheckStatus;
  }>;
  passed: boolean;
}

export interface PreflightField {
  key: string;
  label: string;
  value: unknown;
}

interface PreflightCheckProps extends Omit<ComponentProps<typeof Button>, 'onClick'> {
  onPass: () => void | Promise<void>;
  pipeline: 'quick' | 'digital-human' | 'i2v' | 'action-transfer' | 'custom';
  requiredFields: PreflightField[];
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== null && value !== undefined;
}

function estimateRuntimeLabel(pipeline: PreflightCheckProps['pipeline']): string {
  if (pipeline === 'quick') {
    return '2-5 min';
  }
  if (pipeline === 'digital-human') {
    return '3-8 min';
  }
  if (pipeline === 'custom') {
    return '2-6 min';
  }
  return '2-4 min';
}

export function PreflightCheck({
  children,
  className,
  disabled,
  onPass,
  pipeline,
  requiredFields,
  variant = 'default',
  ...buttonProps
}: PreflightCheckProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);

  const runChecks = (): PreflightResult => {
    const settingsState = queryClient.getQueryState(['settings']);
    const settings = queryClient.getQueryData<Record<string, unknown>>(['settings']);
    const storageStats = queryClient.getQueryData<Record<string, unknown>>(['settings', 'storage-stats']);
    const missingFields = requiredFields.filter((field) => !isFilled(field.value)).map((field) => field.label);
    const llm = settings?.llm as Record<string, unknown> | undefined;
    const comfyui = settings?.comfyui as Record<string, unknown> | undefined;
    const hasApiKey = Boolean(
      (typeof llm?.api_key === 'string' && llm.api_key.trim()) ||
      (typeof comfyui?.comfyui_api_key === 'string' && comfyui.comfyui_api_key.trim()) ||
      (typeof comfyui?.runninghub_api_key === 'string' && comfyui.runninghub_api_key.trim())
    );
    const isSettingsPending = settingsState?.status === 'pending';
    const totalSizeBytes =
      typeof storageStats?.total_size_bytes === 'number'
        ? storageStats.total_size_bytes
        : null;

    const checks: PreflightResult['checks'] = [
      {
        key: 'required-fields',
        label: '必填项完整',
        status: missingFields.length === 0 ? 'pass' : 'fail',
        message:
          missingFields.length === 0
            ? '已通过当前表单校验。'
            : `缺少字段：${missingFields.join('、')}`,
      },
      {
        key: 'api-keys',
        label: 'API Key 已配置',
        status: hasApiKey ? 'pass' : isSettingsPending ? 'warn' : 'fail',
        message: hasApiKey
          ? '检测到可用凭据。'
          : isSettingsPending
            ? 'Settings 正在加载缓存中的凭据检查，将继续当前提交。'
            : '请先在 Settings 中配置可用密钥。',
      },
      {
        key: 'storage',
        label: '存储空间检查',
        status: 'pass',
        message: totalSizeBytes === null
          ? '未发现缓存的存储统计，将继续提交。'
          : `当前缓存用量约 ${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB。`,
      },
      {
        key: 'estimated-time',
        label: '预计耗时',
        status: 'warn',
        message: `该 pipeline 预计耗时 ${estimateRuntimeLabel(pipeline)}。`,
      },
    ];

    return {
      checks,
      passed: checks.every((check) => check.status !== 'fail') &&
        checks.every((check) => check.key === 'estimated-time' || check.status === 'pass'),
    };
  };

  const handleClick = async () => {
    const nextResult = runChecks();
    setResult(nextResult);

    const hasFailures = nextResult.checks.some((check) => check.status === 'fail');

    if (!hasFailures) {
      await onPass();
      return;
    }

    setDialogOpen(true);
  };

  const hasFailures = result?.checks.some((check) => check.status === 'fail') ?? false;

  return (
    <>
      <Button
        {...buttonProps}
        type="button"
        variant={variant}
        className={className}
        disabled={disabled}
        onClick={() => void handleClick()}
      >
        {children}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>提交前预检</DialogTitle>
            <DialogDescription>
              {hasFailures
                ? '修复失败项后再提交。'
                : '存在提示项，确认后仍可继续提交。'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {result?.checks.map((check) => (
              <div key={check.key} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{check.label}</p>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{check.status}</span>
                </div>
                {check.message ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {check.message}
                    {check.key === 'api-keys' && check.status === 'fail' ? (
                      <>
                        {' '}
                        <Link href="/settings" className="text-primary underline underline-offset-4">
                          前往 Settings
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              关闭
            </Button>
            {!hasFailures ? (
              <Button
                onClick={() => {
                  setDialogOpen(false);
                  void onPass();
                }}
              >
                继续提交
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
