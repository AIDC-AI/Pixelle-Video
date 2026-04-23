'use client';

import React, { Suspense } from 'react';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useAppTranslations } from '@/lib/i18n';

export default function Page() {
  const t = useAppTranslations('settings');
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t('fallback.loadingSettings')}</div>}>
      <SettingsShell />
    </Suspense>
  );
}
