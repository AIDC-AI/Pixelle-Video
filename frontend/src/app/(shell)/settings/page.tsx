import React, { Suspense } from 'react';
import { SettingsShell } from '@/components/settings/settings-shell';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading settings…</div>}>
      <SettingsShell />
    </Suspense>
  );
}
