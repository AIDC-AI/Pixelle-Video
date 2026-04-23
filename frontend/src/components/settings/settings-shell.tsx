'use client';

import packageJson from '../../../package.json';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Cloud,
  Eye,
  EyeOff,
  ExternalLink,
  HardDrive,
  Info,
  KeyRound,
  Palette,
  RefreshCw,
  Save,
  Server,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import type { ApiError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProviderStatusCard, type ProviderConnectionStatus } from '@/components/settings/provider-status-card';
import { StorageUsageChart, buildStorageUsageSlices } from '@/components/settings/storage-usage-chart';
import { BrandMark } from '@/components/shell/brand-mark';
import {
  useCheckComfyUIConnection,
  useCheckLlmConnection,
  useCheckRunningHubConnection,
  useCleanupStorage,
  useHealthStatus,
  useSettings,
  useStorageStats,
  useUpdateSettings,
} from '@/lib/hooks/use-settings';
import { useAiFeatures } from '@/lib/hooks/use-ai-features';
import {
  SIDEBAR_PREFERENCE_EVENT,
  readSidebarCollapsedPreference,
  writeSidebarCollapsedPreference,
} from '@/lib/preferences';
import { useAppTranslations } from '@/lib/i18n';
import { maskApiKey } from '@/lib/mask-key';
import {
  RUNNINGHUB_INSTANCE_TYPE_AUTO,
  RUNNINGHUB_INSTANCE_TYPE_PLUS,
  normalizeRunningHubInstanceType,
} from '@/lib/runninghub-instance-type';
import type { components } from '@/types/api';

type SettingsPayload = components['schemas']['SettingsPayload'];
type SettingsUpdatePayload = components['schemas']['SettingsUpdatePayload'];
type LLMConnectionCheckResponse = components['schemas']['LLMConnectionCheckResponse'];
type ComfyUIConnectionCheckResponse = components['schemas']['ComfyUICheckResponse'];
type RunningHubConnectionCheckResponse = components['schemas']['RunningHubConnectionCheckResponse'];
type ProviderConnectionCheckResponse =
  | LLMConnectionCheckResponse
  | ComfyUIConnectionCheckResponse
  | RunningHubConnectionCheckResponse;
type ProviderConnectionDiagnosticsPayload = ProviderConnectionCheckResponse['diagnostics'];
type AppearanceTheme = 'dark' | 'light' | 'system';
type SettingsTabKey = 'keys' | 'appearance' | 'storage' | 'about';
type ProviderKey = 'llm' | 'comfyui' | 'runninghub';

interface AppearanceDraft {
  sidebarCollapsed: boolean;
  theme: AppearanceTheme;
}

type ProviderCheckState =
  | { kind: 'idle' }
  | { kind: 'stale'; previous: ProviderConnectionCheckResponse }
  | { kind: 'result'; result: ProviderConnectionCheckResponse };

interface NormalizedSettings {
  comfyui: {
    comfyui_api_key: string;
    comfyui_url: string;
    runninghub_api_key: string;
    runninghub_concurrent_limit: number;
    runninghub_instance_type: string;
  };
  llm: {
    api_key: string;
    base_url: string;
    model: string;
  };
  project_name: string;
  template: {
    default_template: string;
  };
}

const SETTINGS_TABS = [
  {
    value: 'keys',
    labelKey: 'tabs.keys.label',
    descriptionKey: 'tabs.keys.description',
    icon: KeyRound,
  },
  {
    value: 'appearance',
    labelKey: 'tabs.appearance.label',
    descriptionKey: 'tabs.appearance.description',
    icon: Palette,
  },
  {
    value: 'storage',
    labelKey: 'tabs.storage.label',
    descriptionKey: 'tabs.storage.description',
    icon: HardDrive,
  },
  {
    value: 'about',
    labelKey: 'tabs.about.label',
    descriptionKey: 'tabs.about.description',
    icon: Info,
  },
] as const satisfies ReadonlyArray<{
  descriptionKey:
    | 'tabs.keys.description'
    | 'tabs.appearance.description'
    | 'tabs.storage.description'
    | 'tabs.about.description';
  icon: typeof KeyRound;
  labelKey:
    | 'tabs.keys.label'
    | 'tabs.appearance.label'
    | 'tabs.storage.label'
    | 'tabs.about.label';
  value: SettingsTabKey;
}>;

const DEFAULT_STORAGE_PATHS = [
  { key: 'output', path: 'output/', exists: true, file_count: 0, total_size_bytes: 0 },
  { key: 'temp', path: 'temp/', exists: true, file_count: 0, total_size_bytes: 0 },
  { key: 'uploads', path: 'output/uploads/', exists: true, file_count: 0, total_size_bytes: 0 },
];
const RUNNINGHUB_CHECK_ENDPOINT = 'https://www.runninghub.cn/uc/openapi/accountStatus';
const INITIAL_PROVIDER_CHECKS: Record<ProviderKey, ProviderCheckState> = {
  llm: { kind: 'idle' },
  comfyui: { kind: 'idle' },
  runninghub: { kind: 'idle' },
};

function getActiveTab(rawValue: string | null): SettingsTabKey {
  return SETTINGS_TABS.some((tab) => tab.value === rawValue) ? (rawValue as SettingsTabKey) : 'keys';
}

function normalizeSettings(payload: SettingsPayload): NormalizedSettings {
  return {
    project_name: payload.project_name,
    llm: {
      api_key: payload.llm?.api_key ?? '',
      base_url: payload.llm?.base_url ?? '',
      model: payload.llm?.model ?? '',
    },
    comfyui: {
      comfyui_url: payload.comfyui?.comfyui_url ?? '',
      comfyui_api_key: payload.comfyui?.comfyui_api_key ?? '',
      runninghub_api_key: payload.comfyui?.runninghub_api_key ?? '',
      runninghub_concurrent_limit: payload.comfyui?.runninghub_concurrent_limit ?? 1,
      runninghub_instance_type: normalizeRunningHubInstanceType(payload.comfyui?.runninghub_instance_type),
    },
    template: {
      default_template: payload.template?.default_template ?? '',
    },
  };
}

function toSettingsUpdatePayload(draft: NormalizedSettings): SettingsUpdatePayload {
  return {
    project_name: draft.project_name,
    llm: {
      api_key: draft.llm.api_key,
      base_url: draft.llm.base_url,
      model: draft.llm.model,
    },
    comfyui: {
      comfyui_url: draft.comfyui.comfyui_url,
      comfyui_api_key: draft.comfyui.comfyui_api_key || null,
      runninghub_api_key: draft.comfyui.runninghub_api_key || null,
      runninghub_concurrent_limit: draft.comfyui.runninghub_concurrent_limit,
      runninghub_instance_type:
        draft.comfyui.runninghub_instance_type === RUNNINGHUB_INSTANCE_TYPE_PLUS
          ? RUNNINGHUB_INSTANCE_TYPE_PLUS
          : null,
    },
    template: {
      default_template: draft.template.default_template || null,
    },
  };
}

function normalizeAppearanceTheme(theme: string | undefined): AppearanceTheme {
  if (theme === 'light' || theme === 'system') {
    return theme;
  }

  return 'dark';
}

function jsonFingerprint(value: object | null): string {
  return JSON.stringify(value);
}

function formatBytes(value: number): string {
  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function SettingsField({
  children,
  description,
  label,
}: {
  children: React.ReactNode;
  description?: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function SecretInput({
  description,
  label,
  onChange,
  placeholder,
  testId,
  value,
}: {
  description?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId: string;
  value: string;
}) {
  const t = useAppTranslations('settings') as (key: string, values?: Record<string, unknown>) => string;
  const [visible, setVisible] = useState(false);

  return (
    <SettingsField label={label} description={description}>
      <div className="flex items-center gap-2">
        <Input
          data-testid={testId}
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t('buttons.hideSecret', { label }) : t('buttons.showSecret', { label })}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    </SettingsField>
  );
}

function getStoragePathLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  key: string
): string {
  switch (key) {
    case 'output':
      return t('storage.pathLabels.output');
    case 'temp':
      return t('storage.pathLabels.temp');
    case 'uploads':
      return t('storage.pathLabels.uploads');
    default:
      return key;
  }
}

function getStoragePathDescription(
  t: (key: string, values?: Record<string, unknown>) => string,
  key: string
): string | null {
  switch (key) {
    case 'output':
      return t('storage.pathDescriptions.output');
    case 'temp':
      return t('storage.pathDescriptions.temp');
    case 'uploads':
      return t('storage.pathDescriptions.uploads');
    default:
      return null;
  }
}

function getProviderCheckBadgeVariant(state: ProviderCheckState): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (state.kind === 'idle') {
    return 'secondary';
  }

  if (state.kind === 'stale') {
    return 'outline';
  }

  if (state.result.status === 'success') {
    return 'default';
  }

  if (state.result.status === 'warning') {
    return 'outline';
  }

  return 'destructive';
}

function getProviderConnectionStatus(
  state: ProviderCheckState,
  isPending: boolean
): ProviderConnectionStatus {
  if (isPending) {
    return 'checking';
  }

  if (state.kind !== 'result') {
    return 'unknown';
  }

  return state.result.status === 'success' || state.result.status === 'warning' ? 'valid' : 'invalid';
}

function ProviderCheckBadge({
  state,
  testId,
}: {
  state: ProviderCheckState;
  testId: string;
}) {
  const t = useAppTranslations('settings') as (key: string, values?: Record<string, unknown>) => string;
  const label =
    state.kind === 'idle'
      ? t('keys.validation.status.idle')
      : state.kind === 'stale'
        ? t('keys.validation.status.stale')
        : state.result.status === 'success'
          ? t('keys.validation.status.success')
          : state.result.status === 'warning'
            ? t('keys.validation.status.warning')
            : t('keys.validation.status.error');

  return (
    <Badge data-testid={testId} variant={getProviderCheckBadgeVariant(state)}>
      {label}
    </Badge>
  );
}

function formatCheckEndpoint(endpoint: string | null | undefined, fallback: string): string {
  if (!endpoint) {
    return fallback;
  }

  return endpoint;
}

function ProviderCheckDetails({
  provider,
  state,
  testId,
}: {
  provider: ProviderKey;
  state: ProviderCheckState;
  testId: string;
}) {
  const t = useAppTranslations('settings') as (key: string, values?: Record<string, unknown>) => string;

  if (state.kind === 'idle') {
    return <p className="text-xs text-muted-foreground">{t('keys.validation.idleDescription')}</p>;
  }

  const result = state.kind === 'result' ? state.result : state.previous;
  const diagnostics = result.diagnostics as ProviderConnectionDiagnosticsPayload | undefined;

  const rows: Array<{ label: string; value: string }> = [
    {
      label: t('keys.validation.rows.endpoint'),
      value: formatCheckEndpoint(result.endpoint, t('keys.validation.notAvailable')),
    },
    {
      label: t('keys.validation.rows.reachable'),
      value: result.reachable ? t('keys.validation.boolean.yes') : t('keys.validation.boolean.no'),
    },
    {
      label: t('keys.validation.rows.authenticated'),
      value: result.authenticated ? t('keys.validation.boolean.yes') : t('keys.validation.boolean.no'),
    },
  ];

  if (result.status_code !== null && result.status_code !== undefined) {
    rows.push({
      label: t('keys.validation.rows.statusCode'),
      value: `HTTP ${result.status_code}`,
    });
  }

  if (result.response_time_ms !== null && result.response_time_ms !== undefined) {
    rows.push({
      label: t('keys.validation.rows.responseTime'),
      value: t('keys.validation.responseTimeMs', { count: result.response_time_ms }),
    });
  }

  if (diagnostics?.error_code) {
    rows.push({
      label: t('keys.validation.rows.errorCode'),
      value: diagnostics.error_code,
    });
  }

  if (provider === 'llm') {
    if (diagnostics?.model_count !== null && diagnostics?.model_count !== undefined) {
      rows.push({
        label: t('keys.llm.details.modelCount'),
        value: String(diagnostics.model_count),
      });
    }
    if (diagnostics?.selected_model) {
      rows.push({
        label: t('keys.llm.details.selectedModel'),
        value: diagnostics.selected_model,
      });
    }
    if (diagnostics?.selected_model_available !== null && diagnostics?.selected_model_available !== undefined) {
      rows.push({
        label: t('keys.llm.details.selectedModelAvailable'),
        value: diagnostics.selected_model_available
          ? t('keys.validation.boolean.yes')
          : t('keys.validation.boolean.no'),
      });
    }
  }

  if (provider === 'comfyui') {
    if (diagnostics?.auth_applied !== null && diagnostics?.auth_applied !== undefined) {
      rows.push({
        label: t('keys.comfyui.details.authApplied'),
        value: diagnostics.auth_applied ? t('keys.validation.boolean.yes') : t('keys.validation.boolean.no'),
      });
    }
    if (diagnostics?.auth_required !== null && diagnostics?.auth_required !== undefined) {
      rows.push({
        label: t('keys.comfyui.details.authRequired'),
        value: diagnostics.auth_required ? t('keys.validation.boolean.yes') : t('keys.validation.boolean.no'),
      });
    }
  }

  if (provider === 'runninghub') {
    if (diagnostics?.api_type) {
      rows.push({
        label: t('keys.runninghub.details.apiType'),
        value: diagnostics.api_type,
      });
    }
    if (diagnostics?.current_task_nums !== null && diagnostics?.current_task_nums !== undefined) {
      rows.push({
        label: t('keys.runninghub.details.currentTasks'),
        value: String(diagnostics.current_task_nums),
      });
    }
    if (diagnostics?.remain_num) {
      rows.push({
        label: t('keys.runninghub.details.remainingCredits'),
        value: diagnostics.remain_num,
      });
    }
    if (diagnostics?.remain_money) {
      rows.push({
        label: t('keys.runninghub.details.remainingBalance'),
        value: diagnostics.currency ? `${diagnostics.remain_money} ${diagnostics.currency}` : diagnostics.remain_money,
      });
    }
  }

  return (
    <div
      data-testid={testId}
      className="space-y-3 rounded-2xl border border-border/70 bg-muted/10 p-4"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{t('keys.validation.resultTitle')}</p>
        {state.kind === 'stale' ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('keys.validation.staleDescription')}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">{result.message}</p>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={`${row.label}:${row.value}`} className="space-y-1">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-sm text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SettingsShell() {
  const t = useAppTranslations('settings') as (key: string, values?: Record<string, unknown>) => string;
  const brandT = useAppTranslations('brand') as (key: string, values?: Record<string, unknown>) => string;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const healthQuery = useHealthStatus();
  const llmCheck = useCheckLlmConnection();
  const comfyCheck = useCheckComfyUIConnection();
  const runningHubCheck = useCheckRunningHubConnection();
  const storageStatsQuery = useStorageStats();
  const cleanupStorage = useCleanupStorage();
  const aiFeatures = useAiFeatures();
  const activeTab = getActiveTab(searchParams.get('tab'));

  const [settingsDraft, setSettingsDraft] = useState<NormalizedSettings | null>(null);
  const [appearanceDraft, setAppearanceDraft] = useState<AppearanceDraft | null>(null);
  const [sidebarCollapsedPreference, setSidebarCollapsedPreference] = useState(false);
  const [providerChecks, setProviderChecks] =
    useState<Record<ProviderKey, ProviderCheckState>>(INITIAL_PROVIDER_CHECKS);
  const [expandedProviders, setExpandedProviders] = useState<Record<ProviderKey, boolean>>({
    llm: true,
    comfyui: true,
    runninghub: true,
  });
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'current'>('idle');

  useEffect(() => {
    const syncSidebarPreference = () => {
      setSidebarCollapsedPreference(readSidebarCollapsedPreference());
    };

    syncSidebarPreference();
    window.addEventListener(SIDEBAR_PREFERENCE_EVENT, syncSidebarPreference as EventListener);
    return () => {
      window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, syncSidebarPreference as EventListener);
    };
  }, []);

  const baseSettings = useMemo(
    () =>
      settingsQuery.data
        ? normalizeSettings(settingsQuery.data)
        : normalizeSettings({
            project_name: 'Demo Project',
            llm: { api_key: '', base_url: '', model: '' },
            comfyui: {
              comfyui_url: '',
              comfyui_api_key: null,
              runninghub_api_key: null,
              runninghub_concurrent_limit: 1,
              runninghub_instance_type: null,
            },
            template: { default_template: '' },
          }),
    [settingsQuery.data]
  );
  const baseAppearance = useMemo<AppearanceDraft>(
    () => ({
      theme: normalizeAppearanceTheme(theme),
      sidebarCollapsed: sidebarCollapsedPreference,
    }),
    [sidebarCollapsedPreference, theme]
  );

  const updateTab = (tab: SettingsTabKey) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (tab === 'keys') {
      nextSearchParams.delete('tab');
    } else {
      nextSearchParams.set('tab', tab);
    }

    const nextHref = nextSearchParams.toString() ? `${pathname}?${nextSearchParams.toString()}` : pathname;
    router.replace(nextHref, { scroll: false });
  };

  const currentSettingsDraft = settingsDraft ?? baseSettings;
  const currentAppearanceDraft = appearanceDraft ?? baseAppearance;
  const settingsDirty =
    settingsDraft !== null && jsonFingerprint(currentSettingsDraft) !== jsonFingerprint(baseSettings);
  const appearanceDirty =
    appearanceDraft !== null && jsonFingerprint(currentAppearanceDraft) !== jsonFingerprint(baseAppearance);
  const hasUnsavedChanges = settingsDirty || appearanceDirty;
  const activeTabLabel = t(
    SETTINGS_TABS.find((tab) => tab.value === activeTab)?.labelKey ?? 'tabs.keys.label'
  );
  const currentStoragePaths = storageStatsQuery.data?.paths ?? DEFAULT_STORAGE_PATHS;
  const storageUsageSlices = useMemo(
    () => buildStorageUsageSlices(currentStoragePaths),
    [currentStoragePaths]
  );

  const aboutRows = useMemo(
    () => [
      { label: t('about.rows.product'), value: brandT('productName') },
      { label: t('about.rows.frontendVersion'), value: packageJson.version },
      {
        label: t('about.rows.nodeVersion'),
        value: typeof process !== 'undefined' && process.version ? process.version : t('about.notReported'),
      },
      { label: t('about.rows.backendVersion'), value: healthQuery.data?.version ?? t('about.notReported') },
      { label: t('about.rows.service'), value: healthQuery.data?.service ?? t('about.notReported') },
      { label: t('about.rows.gitSha'), value: process.env.NEXT_PUBLIC_GIT_SHA ?? t('about.notSet') },
      { label: t('about.rows.healthStatus'), value: healthQuery.data?.status ?? t('about.degraded') },
      { label: t('about.rows.license'), value: 'Apache-2.0' },
    ],
    [brandT, healthQuery.data?.service, healthQuery.data?.status, healthQuery.data?.version, t]
  );

  const toggleProviderFields = (provider: ProviderKey) => {
    setExpandedProviders((current) => ({
      ...current,
      [provider]: !current[provider],
    }));
  };

  const setProviderResult = (provider: ProviderKey, result: ProviderConnectionCheckResponse) => {
    setProviderChecks((current) => ({
      ...current,
      [provider]: { kind: 'result', result },
    }));
  };

  const invalidateProviderCheck = (provider: ProviderKey) => {
    setProviderChecks((current) => {
      const next = current[provider];
      if (next.kind !== 'result') {
        return current;
      }

      return {
        ...current,
        [provider]: { kind: 'stale', previous: next.result },
      };
    });
  };

  const updateSettingsState = (updater: (draft: NormalizedSettings) => NormalizedSettings) => {
    setSettingsDraft((current) => updater(current ?? currentSettingsDraft));
  };

  const toInlineCheckError = (
    provider: ProviderKey,
    error: unknown,
    endpoint: string | null,
  ): ProviderConnectionCheckResponse => {
    const apiError = error as ApiError | undefined;
    return {
      provider,
      status: 'error',
      success: false,
      reachable: false,
      authenticated: false,
      message:
        typeof apiError?.message === 'string' && apiError.message.trim()
          ? apiError.message
          : t('toasts.connectionCheckFailed'),
      endpoint,
      status_code: typeof apiError?.status === 'number' ? apiError.status : null,
      response_time_ms: null,
      diagnostics: {
        error_code: typeof apiError?.code === 'string' ? apiError.code : 'UNKNOWN_ERROR',
        model_count: null,
        selected_model: null,
        selected_model_available: null,
        auth_applied: null,
        auth_required: null,
        api_type: null,
        current_task_nums: null,
        remain_num: null,
        remain_money: null,
        currency: null,
      },
    };
  };

  const handleSave = async () => {
    try {
      if (settingsDirty) {
        await updateSettings.mutateAsync(toSettingsUpdatePayload(currentSettingsDraft));
        setSettingsDraft(null);
      }

      if (appearanceDirty) {
        setTheme(currentAppearanceDraft.theme);
        writeSidebarCollapsedPreference(currentAppearanceDraft.sidebarCollapsed);
        setSidebarCollapsedPreference(currentAppearanceDraft.sidebarCollapsed);
        setAppearanceDraft(null);
      }

      if (hasUnsavedChanges) {
        toast.success(t('toasts.saved'));
      }
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : t('toasts.saveFailed');
      toast.error(message);
    }
  };

  const handleCheckComfyUI = async () => {
    try {
      const result = await comfyCheck.mutateAsync({
        comfyui_url: currentSettingsDraft.comfyui.comfyui_url,
        comfyui_api_key: currentSettingsDraft.comfyui.comfyui_api_key || null,
      });
      setProviderResult('comfyui', result);
    } catch (error) {
      setProviderResult(
        'comfyui',
        toInlineCheckError('comfyui', error, currentSettingsDraft.comfyui.comfyui_url || null)
      );
    }
  };

  const handleCheckLlm = async () => {
    try {
      const result = await llmCheck.mutateAsync({
        api_key: currentSettingsDraft.llm.api_key || null,
        base_url: currentSettingsDraft.llm.base_url || null,
        model: currentSettingsDraft.llm.model || null,
      });
      setProviderResult('llm', result);
    } catch (error) {
      setProviderResult('llm', toInlineCheckError('llm', error, currentSettingsDraft.llm.base_url || null));
    }
  };

  const handleCheckRunningHub = async () => {
    try {
      const result = await runningHubCheck.mutateAsync({
        runninghub_api_key: currentSettingsDraft.comfyui.runninghub_api_key || null,
        runninghub_instance_type:
          currentSettingsDraft.comfyui.runninghub_instance_type === RUNNINGHUB_INSTANCE_TYPE_PLUS
            ? RUNNINGHUB_INSTANCE_TYPE_PLUS
            : null,
      });
      setProviderResult('runninghub', result);
    } catch (error) {
      setProviderResult('runninghub', toInlineCheckError('runninghub', error, RUNNINGHUB_CHECK_ENDPOINT));
    }
  };

  const handleCleanupStorage = async () => {
    try {
      const result = await cleanupStorage.mutateAsync({ target: 'temp' });
      setCleanupConfirmOpen(false);
      toast.success(
        t('toasts.cleanupSuccess', {
          count: result.deleted_files,
          size: formatBytes(result.reclaimed_bytes),
        })
      );
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : t('toasts.cleanupFailed');
      toast.error(message);
    }
  };

  const handleCheckForUpdates = () => {
    setUpdateCheckStatus('current');
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground">
            {t('page.breadcrumb')}
          </Link>
          <span>/</span>
          <span className="text-foreground">{activeTabLabel}</span>
        </nav>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('page.description')}
          </p>
        </div>
      </div>

      {settingsQuery.isError && !settingsQuery.data ? (
        <Card className="border-destructive/30 bg-card shadow-none">
          <CardHeader>
            <CardTitle>{t('page.backendUnavailableTitle')}</CardTitle>
            <CardDescription>
              {t('page.backendUnavailableDescription')}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Tabs
        orientation="vertical"
        value={activeTab}
        onValueChange={(value) => updateTab(getActiveTab(String(value)))}
        className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]"
      >
        <Card className="h-fit border-border/70 bg-card shadow-none">
          <CardContent className="p-3">
            <TabsList className="flex-col items-stretch">
              {SETTINGS_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.value} value={tab.value} className="w-full justify-start gap-3">
                    <Icon className="size-4" />
                    <span className="flex flex-col items-start gap-0.5">
                      <span>{t(tab.labelKey)}</span>
                      <span className="text-xs font-normal text-muted-foreground">{t(tab.descriptionKey)}</span>
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <TabsContent value="keys" className="space-y-6">
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>{t('keys.projectDefaults.title')}</CardTitle>
                <CardDescription>{t('keys.projectDefaults.description')}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <SettingsField
                  label={t('keys.projectDefaults.fields.projectName')}
                  description={t('keys.projectDefaults.fieldDescriptions.projectName')}
                >
                  <Input
                    value={currentSettingsDraft.project_name}
                    onChange={(event) =>
                      updateSettingsState((draft) => ({
                        ...draft,
                        project_name: event.target.value,
                      }))
                    }
                  />
                </SettingsField>
                <SettingsField
                  label={t('keys.projectDefaults.fields.defaultTemplate')}
                  description={t('keys.projectDefaults.fieldDescriptions.defaultTemplate')}
                >
                  <Input
                    value={currentSettingsDraft.template.default_template}
                    onChange={(event) =>
                      updateSettingsState((draft) => ({
                        ...draft,
                        template: {
                          ...draft.template,
                          default_template: event.target.value,
                        },
                      }))
                    }
                  />
                </SettingsField>
              </CardContent>
            </Card>

            <ProviderStatusCard
              name={t('keys.llm.title')}
              description={t('keys.llm.description')}
              logo={<KeyRound className="size-5" aria-hidden="true" />}
              maskedKey={maskApiKey(currentSettingsDraft.llm.api_key)}
              status={getProviderConnectionStatus(providerChecks.llm, llmCheck.isPending)}
              expanded={expandedProviders.llm}
              onEdit={() => toggleProviderFields('llm')}
              onTest={() => void handleCheckLlm()}
            />

            {expandedProviders.llm ? (
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{t('keys.llm.title')}</CardTitle>
                    <CardDescription>{t('keys.llm.description')}</CardDescription>
                  </div>
                  <ProviderCheckBadge state={providerChecks.llm} testId="settings-llm-status" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <SecretInput
                    label={t('keys.llm.fields.apiKey')}
                    description={t('keys.llm.fieldDescriptions.apiKey')}
                    placeholder="sk-****"
                    testId="settings-llm-api-key"
                    value={currentSettingsDraft.llm.api_key}
                    onChange={(value) => {
                      updateSettingsState((draft) => ({
                        ...draft,
                        llm: { ...draft.llm, api_key: value },
                      }));
                      invalidateProviderCheck('llm');
                    }}
                  />
                  <SettingsField
                    label={t('keys.llm.fields.baseUrl')}
                    description={t('keys.llm.fieldDescriptions.baseUrl')}
                  >
                    <Input
                      data-testid="settings-llm-base-url"
                      value={currentSettingsDraft.llm.base_url}
                      onChange={(event) => {
                        updateSettingsState((draft) => ({
                          ...draft,
                          llm: { ...draft.llm, base_url: event.target.value },
                        }));
                        invalidateProviderCheck('llm');
                      }}
                    />
                  </SettingsField>
                  <SettingsField
                    label={t('keys.llm.fields.model')}
                    description={t('keys.llm.fieldDescriptions.model')}
                  >
                    <Input
                      data-testid="settings-llm-model"
                      value={currentSettingsDraft.llm.model}
                      onChange={(event) => {
                        updateSettingsState((draft) => ({
                          ...draft,
                          llm: { ...draft.llm, model: event.target.value },
                        }));
                        invalidateProviderCheck('llm');
                      }}
                    />
                  </SettingsField>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="settings-llm-verify"
                    onClick={() => void handleCheckLlm()}
                    disabled={llmCheck.isPending}
                  >
                    {llmCheck.isPending ? t('buttons.verifying') : t('keys.llm.actions.verify')}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t('keys.validation.hint')}</p>
                </div>
                <ProviderCheckDetails provider="llm" state={providerChecks.llm} testId="settings-llm-result" />
              </CardContent>
            </Card>
            ) : null}

            <ProviderStatusCard
              name={t('keys.comfyui.title')}
              description={t('keys.comfyui.description')}
              logo={<Server className="size-5" aria-hidden="true" />}
              maskedKey={maskApiKey(currentSettingsDraft.comfyui.comfyui_api_key)}
              status={getProviderConnectionStatus(providerChecks.comfyui, comfyCheck.isPending)}
              expanded={expandedProviders.comfyui}
              onEdit={() => toggleProviderFields('comfyui')}
              onTest={() => void handleCheckComfyUI()}
            />

            {expandedProviders.comfyui ? (
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{t('keys.comfyui.title')}</CardTitle>
                    <CardDescription>{t('keys.comfyui.description')}</CardDescription>
                  </div>
                  <ProviderCheckBadge state={providerChecks.comfyui} testId="settings-comfyui-status" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <SettingsField
                    label={t('keys.comfyui.fields.endpoint')}
                    description={t('keys.comfyui.fieldDescriptions.endpoint')}
                  >
                    <Input
                      data-testid="settings-comfyui-url"
                      value={currentSettingsDraft.comfyui.comfyui_url}
                      onChange={(event) => {
                        updateSettingsState((draft) => ({
                          ...draft,
                          comfyui: {
                            ...draft.comfyui,
                            comfyui_url: event.target.value,
                          },
                        }));
                        invalidateProviderCheck('comfyui');
                      }}
                    />
                  </SettingsField>

                  <SecretInput
                    label={t('keys.comfyui.fields.apiKey')}
                    description={t('keys.comfyui.fieldDescriptions.apiKey')}
                    placeholder={t('keys.comfyui.placeholders.maskedOnSave')}
                    testId="settings-comfyui-api-key"
                    value={currentSettingsDraft.comfyui.comfyui_api_key}
                    onChange={(value) => {
                      updateSettingsState((draft) => ({
                        ...draft,
                        comfyui: { ...draft.comfyui, comfyui_api_key: value },
                      }));
                      invalidateProviderCheck('comfyui');
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="settings-comfyui-verify"
                    onClick={() => void handleCheckComfyUI()}
                    disabled={comfyCheck.isPending}
                  >
                    {comfyCheck.isPending ? t('buttons.verifying') : t('keys.comfyui.actions.verify')}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t('keys.validation.hint')}</p>
                </div>
                <ProviderCheckDetails provider="comfyui" state={providerChecks.comfyui} testId="settings-comfyui-result" />
              </CardContent>
            </Card>
            ) : null}

            <ProviderStatusCard
              name={t('keys.runninghub.title')}
              description={t('keys.runninghub.description')}
              logo={<Cloud className="size-5" aria-hidden="true" />}
              maskedKey={maskApiKey(currentSettingsDraft.comfyui.runninghub_api_key)}
              status={getProviderConnectionStatus(providerChecks.runninghub, runningHubCheck.isPending)}
              expanded={expandedProviders.runninghub}
              onEdit={() => toggleProviderFields('runninghub')}
              onTest={() => void handleCheckRunningHub()}
            />

            {expandedProviders.runninghub ? (
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{t('keys.runninghub.title')}</CardTitle>
                    <CardDescription>{t('keys.runninghub.description')}</CardDescription>
                  </div>
                  <ProviderCheckBadge state={providerChecks.runninghub} testId="settings-runninghub-status" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <SecretInput
                    label={t('keys.runninghub.fields.apiKey')}
                    description={t('keys.runninghub.fieldDescriptions.apiKey')}
                    placeholder={t('keys.runninghub.placeholders.maskedOnSave')}
                    testId="settings-runninghub-api-key"
                    value={currentSettingsDraft.comfyui.runninghub_api_key}
                    onChange={(value) => {
                      updateSettingsState((draft) => ({
                        ...draft,
                        comfyui: { ...draft.comfyui, runninghub_api_key: value },
                      }));
                      invalidateProviderCheck('runninghub');
                    }}
                  />
                  <SettingsField
                    label={t('keys.runninghub.fields.concurrency')}
                    description={t('keys.runninghub.fieldDescriptions.concurrency')}
                  >
                    <Input
                      data-testid="settings-runninghub-concurrency"
                      type="number"
                      min={1}
                      value={String(currentSettingsDraft.comfyui.runninghub_concurrent_limit)}
                      onChange={(event) => {
                        updateSettingsState((draft) => ({
                          ...draft,
                          comfyui: {
                            ...draft.comfyui,
                            runninghub_concurrent_limit: Math.max(
                              1,
                              Number.parseInt(event.target.value || '1', 10) || 1
                            ),
                          },
                        }));
                      }}
                    />
                  </SettingsField>
                  <SettingsField
                    label={t('keys.runninghub.fields.instanceType')}
                    description={t('keys.runninghub.fieldDescriptions.instanceType')}
                  >
                    <Select
                      value={currentSettingsDraft.comfyui.runninghub_instance_type}
                      onValueChange={(value) => {
                        updateSettingsState((draft) => ({
                          ...draft,
                          comfyui: {
                            ...draft.comfyui,
                            runninghub_instance_type: normalizeRunningHubInstanceType(value),
                          },
                        }));
                      }}
                    >
                      <SelectTrigger
                        aria-label={t('keys.runninghub.fields.instanceType')}
                        data-testid="settings-runninghub-instance-type"
                      >
                        <span className="flex flex-1 text-left">
                          {currentSettingsDraft.comfyui.runninghub_instance_type === RUNNINGHUB_INSTANCE_TYPE_PLUS
                            ? t('keys.runninghub.options.plus')
                            : t('keys.runninghub.options.auto')}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={RUNNINGHUB_INSTANCE_TYPE_AUTO}>
                          {t('keys.runninghub.options.auto')}
                        </SelectItem>
                        <SelectItem value={RUNNINGHUB_INSTANCE_TYPE_PLUS}>
                          {t('keys.runninghub.options.plus')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingsField>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="settings-runninghub-verify"
                    onClick={() => void handleCheckRunningHub()}
                    disabled={runningHubCheck.isPending}
                  >
                    {runningHubCheck.isPending ? t('buttons.verifying') : t('keys.runninghub.actions.verify')}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t('keys.validation.hint')}</p>
                </div>
                <ProviderCheckDetails
                  provider="runninghub"
                  state={providerChecks.runninghub}
                  testId="settings-runninghub-result"
                />
              </CardContent>
            </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>{t('appearance.title')}</CardTitle>
                <CardDescription>{t('appearance.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SettingsField label={t('appearance.fields.theme')}>
                  <div className="flex flex-wrap gap-2">
                    {(['dark', 'light', 'system'] as const).map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={currentAppearanceDraft.theme === option ? 'default' : 'outline'}
                        onClick={() =>
                          setAppearanceDraft((current) => ({
                            ...(current ?? currentAppearanceDraft),
                            theme: option,
                          }))
                        }
                      >
                        {option === 'dark'
                          ? t('appearance.theme.dark')
                          : option === 'light'
                            ? t('appearance.theme.light')
                            : t('appearance.theme.system')}
                      </Button>
                    ))}
                  </div>
                </SettingsField>

                <SettingsField label={t('appearance.fields.sidebarCollapse')}>
                  <Button
                    type="button"
                    variant={currentAppearanceDraft.sidebarCollapsed ? 'default' : 'outline'}
                    onClick={() =>
                      setAppearanceDraft((current) => ({
                        ...(current ?? currentAppearanceDraft),
                        sidebarCollapsed: !(current ?? currentAppearanceDraft).sidebarCollapsed,
                      }))
                    }
                  >
                    {currentAppearanceDraft.sidebarCollapsed
                      ? t('appearance.sidebar.collapsed')
                      : t('appearance.sidebar.expanded')}
                  </Button>
                </SettingsField>

                <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Advanced</p>
                    <p className="text-xs text-muted-foreground">
                      When enabled, Create pages can show real-time preview and AI rewrite placeholders. Backend
                      support is required before these controls call any endpoint.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={aiFeatures.previewEnabled}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-4 py-3 text-left text-sm"
                      onClick={() => aiFeatures.setPreviewEnabled(!aiFeatures.previewEnabled)}
                    >
                      <span>
                        <span className="block font-medium text-foreground">AI Real-time Preview</span>
                        <span className="text-xs text-muted-foreground">Default off. No backend call is made.</span>
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {aiFeatures.previewEnabled ? 'On' : 'Off'}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={aiFeatures.promptAssistEnabled}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-4 py-3 text-left text-sm"
                      onClick={() => aiFeatures.setPromptAssistEnabled(!aiFeatures.promptAssistEnabled)}
                    >
                      <span>
                        <span className="block font-medium text-foreground">AI Prompt Assist</span>
                        <span className="text-xs text-muted-foreground">Default off. Shows rewrite placeholders only.</span>
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {aiFeatures.promptAssistEnabled ? 'On' : 'Off'}
                      </span>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="storage" className="space-y-6">
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>{t('storage.runtimePathsTitle')}</CardTitle>
                <CardDescription>
                  {t('storage.runtimePathsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {currentStoragePaths.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    <p className="text-sm font-medium text-foreground">{getStoragePathLabel(t, item.key)}</p>
                    {getStoragePathDescription(t, item.key) ? (
                      <p className="mt-1 text-xs text-muted-foreground">{getStoragePathDescription(t, item.key)}</p>
                    ) : null}
                    <p className="mt-2 font-mono text-sm text-muted-foreground">{item.path}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.exists
                        ? t('storage.pathStats', {
                            count: item.file_count,
                            size: formatBytes(item.total_size_bytes),
                          })
                        : t('storage.missing')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>{t('storage.statsTitle')}</CardTitle>
                <CardDescription>{t('storage.statsDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {storageStatsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">{t('storage.loading')}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('storage.totalStorage', { size: formatBytes(storageStatsQuery.data?.total_size_bytes ?? 0) })}
                  </p>
                )}
                <StorageUsageChart data={storageUsageSlices} />
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCleanupConfirmOpen(true)}
                    disabled={cleanupStorage.isPending}
                  >
                    {cleanupStorage.isPending ? t('buttons.cleaning') : t('storage.cleanTemporaryFiles')}
                  </Button>
                  <p className="max-w-2xl text-xs text-muted-foreground">
                    {t('storage.cleanupDescription')}
                  </p>
                </div>
                <Dialog open={cleanupConfirmOpen} onOpenChange={setCleanupConfirmOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('storage.cleanupDialog.title')}</DialogTitle>
                      <DialogDescription>{t('storage.cleanupDialog.description')}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setCleanupConfirmOpen(false)}>
                        {t('storage.cleanupDialog.cancel')}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void handleCleanupStorage()}
                        disabled={cleanupStorage.isPending}
                      >
                        {cleanupStorage.isPending ? t('buttons.cleaning') : t('storage.cleanupDialog.confirm')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="space-y-6">
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>{t('about.buildHealthTitle')}</CardTitle>
                <CardDescription>{t('about.buildHealthDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <BrandMark size="xl" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-foreground">{brandT('productName')}</p>
                    <p className="text-sm text-muted-foreground">{brandT('browserDescription')}</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {aboutRows.map((row) => (
                    <div key={row.label} className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                      <p className="text-sm font-medium text-foreground">{row.label}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{row.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>{t('about.linksTitle')}</CardTitle>
                <CardDescription>{t('about.linksDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href="https://github.com/AIDC-AI/Pixelle-Video" target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLink className="size-4" />
                    {t('about.links.github')}
                  </Button>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href="https://aidc-ai.github.io/Pixelle-Video/zh" target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLink className="size-4" />
                    {t('about.links.docs')}
                  </Button>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href="https://github.com/AIDC-AI/Pixelle-Video/issues" target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLink className="size-4" />
                    {t('about.links.feedback')}
                  </Button>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLink className="size-4" />
                    {t('about.links.license')}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCheckForUpdates}>
                    <RefreshCw className="size-4" />
                    {t('about.links.checkUpdates')}
                  </Button>
                </div>
                {updateCheckStatus === 'current' ? (
                  <p className="text-sm text-muted-foreground">
                    {t('about.updateCurrent', { version: packageJson.version })}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {healthQuery.isError ? (
              <Card className="border-border/70 bg-card shadow-none">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  {t('about.healthUnavailable')}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <Card className="border-border/70 bg-card shadow-none">
            <CardContent className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                {hasUnsavedChanges ? t('footer.unsavedChanges') : t('footer.synced')}
              </p>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasUnsavedChanges || updateSettings.isPending}
              >
                <Save className="size-4" />
                {updateSettings.isPending ? t('buttons.saving') : t('buttons.save')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
}
