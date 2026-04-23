'use client';

import packageJson from '../../../package.json';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ExternalLink, HardDrive, Info, KeyRound, Palette, Save } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandMark } from '@/components/shell/brand-mark';
import { useHealthStatus, useSettings, useUpdateSettings } from '@/lib/hooks/use-settings';
import {
  readLanguagePreference,
  readSidebarCollapsedPreference,
  writeLanguagePreference,
  writeSidebarCollapsedPreference,
} from '@/lib/preferences';
import { useAppTranslations } from '@/lib/i18n';
import type { components } from '@/types/api';

type SettingsPayload = components['schemas']['SettingsPayload'];
type SettingsUpdatePayload = components['schemas']['SettingsUpdatePayload'];
type AppearanceTheme = 'dark' | 'light' | 'system';
type SettingsTabKey = 'keys' | 'appearance' | 'storage' | 'about';

interface AppearanceDraft {
  language: 'zh-CN' | 'en-US';
  sidebarCollapsed: boolean;
  theme: AppearanceTheme;
}

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

const SETTINGS_TABS: Array<{
  description: string;
  icon: typeof KeyRound;
  label: string;
  value: SettingsTabKey;
}> = [
  {
    value: 'keys',
    label: 'API Keys',
    description: 'Model credentials and endpoint defaults.',
    icon: KeyRound,
  },
  {
    value: 'appearance',
    label: 'Appearance',
    description: 'Theme, language, and sidebar behavior.',
    icon: Palette,
  },
  {
    value: 'storage',
    label: 'Storage',
    description: 'Read-only paths and cleanup status.',
    icon: HardDrive,
  },
  {
    value: 'about',
    label: 'About',
    description: 'Version, health, and project links.',
    icon: Info,
  },
];

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
      runninghub_instance_type: payload.comfyui?.runninghub_instance_type ?? '',
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
      runninghub_instance_type: draft.comfyui.runninghub_instance_type || null,
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
  label,
  onChange,
  placeholder,
  testId,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId: string;
  value: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <SettingsField label={label}>
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
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button type="button" variant="outline" disabled>
          Unavailable
        </Button>
      </div>
    </SettingsField>
  );
}

export function SettingsShell() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const healthQuery = useHealthStatus();
  const brandT = useAppTranslations('brand') as (key: 'productName' | 'browserDescription') => string;
  const activeTab = getActiveTab(searchParams.get('tab'));

  const [settingsDraft, setSettingsDraft] = useState<NormalizedSettings | null>(null);
  const [appearanceDraft, setAppearanceDraft] = useState<AppearanceDraft | null>(null);

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
      language: readLanguagePreference(),
      sidebarCollapsed: readSidebarCollapsedPreference(),
    }),
    [theme]
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
    settingsDraft !== null &&
    jsonFingerprint(currentSettingsDraft) !== jsonFingerprint(baseSettings);
  const appearanceDirty =
    appearanceDraft !== null &&
    jsonFingerprint(currentAppearanceDraft) !== jsonFingerprint(baseAppearance);
  const hasUnsavedChanges = settingsDirty || appearanceDirty;

  const activeTabLabel = SETTINGS_TABS.find((tab) => tab.value === activeTab)?.label ?? 'API Keys';

  const handleSave = async () => {
    try {
      if (settingsDirty) {
        await updateSettings.mutateAsync(toSettingsUpdatePayload(currentSettingsDraft));
        setSettingsDraft(null);
      }

      if (appearanceDirty) {
        setTheme(currentAppearanceDraft.theme);
        writeLanguagePreference(currentAppearanceDraft.language);
        writeSidebarCollapsedPreference(currentAppearanceDraft.sidebarCollapsed);
        setAppearanceDraft(null);
      }

      if (hasUnsavedChanges) {
        toast.success('Settings saved.');
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }

      if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string') {
          toast.error(message);
          return;
        }
      }

      toast.error('Failed to save settings.');
    }
  };

  const aboutRows = useMemo(
    () => [
      { label: 'Product', value: brandT('productName') },
      { label: 'Frontend Version', value: packageJson.version },
      { label: 'Backend Version', value: healthQuery.data?.version ?? 'Unavailable' },
      { label: 'Service', value: healthQuery.data?.service ?? 'Unavailable' },
      { label: 'Git SHA', value: process.env.NEXT_PUBLIC_GIT_SHA ?? 'Unavailable' },
      { label: 'Startup Time', value: 'Unavailable in current /health payload' },
      { label: 'License', value: 'Apache-2.0' },
    ],
    [brandT, healthQuery.data?.service, healthQuery.data?.version]
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground">
            Settings
          </Link>
          <span>/</span>
          <span className="text-foreground">{activeTabLabel}</span>
        </nav>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure provider credentials, local presentation preferences, and runtime metadata.
          </p>
        </div>
      </div>

      {settingsQuery.isError && !settingsQuery.data ? (
        <Card className="border-destructive/30 bg-card shadow-none">
          <CardHeader>
            <CardTitle>Backend settings are unavailable.</CardTitle>
            <CardDescription>
              The workbench is showing safe defaults until `/api/settings` becomes reachable again.
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
                      <span>{tab.label}</span>
                      <span className="text-xs font-normal text-muted-foreground">{tab.description}</span>
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
                <CardTitle>Project Defaults</CardTitle>
                <CardDescription>These values are persisted to the backend config file.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <SettingsField label="Project Name">
                  <Input
                    value={currentSettingsDraft.project_name}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...(current ?? currentSettingsDraft),
                        project_name: event.target.value,
                      }))
                    }
                  />
                </SettingsField>
                <SettingsField label="Default Template">
                  <Input
                    value={currentSettingsDraft.template.default_template}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...(current ?? currentSettingsDraft),
                        template: {
                          ...(current ?? currentSettingsDraft).template,
                          default_template: event.target.value,
                        },
                      }))
                    }
                  />
                </SettingsField>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>LLM</CardTitle>
                <CardDescription>Masked values are returned by the backend and can be saved back safely.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <SecretInput
                  label="LLM API Key"
                  placeholder="sk-****"
                  testId="settings-llm-api-key"
                  value={currentSettingsDraft.llm.api_key}
                  onChange={(value) =>
                    setSettingsDraft((current) => ({
                      ...(current ?? currentSettingsDraft),
                      llm: { ...(current ?? currentSettingsDraft).llm, api_key: value },
                    }))
                  }
                />
                <SettingsField label="LLM Base URL">
                  <Input
                    data-testid="settings-llm-base-url"
                    value={currentSettingsDraft.llm.base_url}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...(current ?? currentSettingsDraft),
                        llm: { ...(current ?? currentSettingsDraft).llm, base_url: event.target.value },
                      }))
                    }
                  />
                </SettingsField>
                <SettingsField label="LLM Model">
                  <Input
                    data-testid="settings-llm-model"
                    value={currentSettingsDraft.llm.model}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...(current ?? currentSettingsDraft),
                        llm: { ...(current ?? currentSettingsDraft).llm, model: event.target.value },
                      }))
                    }
                  />
                </SettingsField>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>ComfyUI</CardTitle>
                <CardDescription>Connection checks are still pending dedicated backend endpoints.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <SettingsField label="ComfyUI Endpoint">
                  <div className="flex items-center gap-2">
                    <Input
                      data-testid="settings-comfyui-url"
                      value={currentSettingsDraft.comfyui.comfyui_url}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...(current ?? currentSettingsDraft),
                          comfyui: {
                            ...(current ?? currentSettingsDraft).comfyui,
                            comfyui_url: event.target.value,
                          },
                        }))
                      }
                    />
                    <Button type="button" variant="outline" disabled>
                      Unavailable
                    </Button>
                  </div>
                </SettingsField>
                <SecretInput
                  label="ComfyUI API Key"
                  placeholder="Masked on save"
                  testId="settings-comfyui-api-key"
                  value={currentSettingsDraft.comfyui.comfyui_api_key}
                  onChange={(value) =>
                    setSettingsDraft((current) => ({
                      ...(current ?? currentSettingsDraft),
                      comfyui: { ...(current ?? currentSettingsDraft).comfyui, comfyui_api_key: value },
                    }))
                  }
                />
                <SecretInput
                  label="RunningHub API Key"
                  placeholder="Masked on save"
                  testId="settings-runninghub-api-key"
                  value={currentSettingsDraft.comfyui.runninghub_api_key}
                  onChange={(value) =>
                    setSettingsDraft((current) => ({
                      ...(current ?? currentSettingsDraft),
                      comfyui: { ...(current ?? currentSettingsDraft).comfyui, runninghub_api_key: value },
                    }))
                  }
                />
                <SettingsField label="RunningHub Concurrency">
                  <Input
                    data-testid="settings-runninghub-concurrency"
                    type="number"
                    min={1}
                    value={String(currentSettingsDraft.comfyui.runninghub_concurrent_limit)}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...(current ?? currentSettingsDraft),
                        comfyui: {
                          ...(current ?? currentSettingsDraft).comfyui,
                          runninghub_concurrent_limit: Math.max(
                            1,
                            Number.parseInt(event.target.value || '1', 10) || 1
                          ),
                        },
                      }))
                    }
                  />
                </SettingsField>
                <SettingsField label="RunningHub Instance Type">
                  <Input
                    data-testid="settings-runninghub-instance-type"
                    value={currentSettingsDraft.comfyui.runninghub_instance_type}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...(current ?? currentSettingsDraft),
                        comfyui: {
                          ...(current ?? currentSettingsDraft).comfyui,
                          runninghub_instance_type: event.target.value,
                        },
                      }))
                    }
                  />
                </SettingsField>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>These preferences stay local to the browser session.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SettingsField label="Theme">
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
                        {option === 'dark' ? 'Dark' : option === 'light' ? 'Light' : 'System'}
                      </Button>
                    ))}
                  </div>
                </SettingsField>

                <SettingsField label="Language" description="UI-only until next-intl wiring is completed.">
                  <Select
                    value={currentAppearanceDraft.language}
                    onValueChange={(value) =>
                      setAppearanceDraft((current) => ({
                        ...(current ?? currentAppearanceDraft),
                        language: value === 'en-US' ? 'en-US' : 'zh-CN',
                      }))
                    }
                  >
                    <SelectTrigger aria-label="Language preference">
                      <SelectValue placeholder="Choose a language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh-CN">zh-CN</SelectItem>
                      <SelectItem value="en-US">en-US</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsField>

                <SettingsField label="Sidebar Collapse Preference">
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
                    {currentAppearanceDraft.sidebarCollapsed ? 'Collapsed by default' : 'Expanded by default'}
                  </Button>
                </SettingsField>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="storage" className="space-y-6">
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>Storage Paths</CardTitle>
                <CardDescription>
                  The current backend settings schema does not expose path overrides, so the workbench shows the default runtime conventions.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {[
                  ['Output', 'output/'],
                  ['Temp', 'temp/'],
                  ['Uploads', 'output/uploads/'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="mt-2 font-mono text-sm text-muted-foreground">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>Storage Stats</CardTitle>
                <CardDescription>P4+ once the backend exposes runtime storage metrics.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Storage usage metrics are not included in the current `/api/settings` contract.
                </p>
                <Button type="button" variant="outline" disabled>
                  Clean Temporary Files
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="space-y-6">
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <div className="mb-2 flex items-center gap-3">
                  <BrandMark size="xl" />
                  <div>
                    <p className="text-base font-semibold text-foreground">{brandT('productName')}</p>
                    <p className="text-sm text-muted-foreground">{brandT('browserDescription')}</p>
                  </div>
                </div>
                <CardTitle>Build & Health</CardTitle>
                <CardDescription>Version data comes from `/health` plus the local frontend package metadata.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {aboutRows.map((row) => (
                  <div key={row.label} className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{row.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader>
                <CardTitle>Links</CardTitle>
                <CardDescription>Reference destinations for source, docs, and feedback.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<a href="https://github.com/AIDC-AI/Pixelle-Video" target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink className="size-4" />
                  GitHub
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<a href="https://aidc-ai.github.io/Pixelle-Video/zh" target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink className="size-4" />
                  Docs
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<a href="https://github.com/AIDC-AI/Pixelle-Video/issues" target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink className="size-4" />
                  Feedback
                </Button>
              </CardContent>
            </Card>

            {healthQuery.isError ? (
              <Card className="border-border/70 bg-card shadow-none">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Backend health information is temporarily unavailable.
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <Card className="border-border/70 bg-card shadow-none">
            <CardContent className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                {hasUnsavedChanges ? 'You have unsaved changes.' : 'All settings are in sync.'}
              </p>
              <Button type="button" onClick={() => void handleSave()} disabled={!hasUnsavedChanges || updateSettings.isPending}>
                <Save className="size-4" />
                Save
              </Button>
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
}
