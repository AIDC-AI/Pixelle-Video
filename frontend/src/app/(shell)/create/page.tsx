'use client';

import { Sparkles, User, Image as ImageIcon, Activity, PenTool } from 'lucide-react';
import { PipelineCard } from '@/components/create/pipeline-card';
import { ProjectBar } from '@/components/create/project-bar';
import { QuickIntentInput } from '@/components/create/quick-intent-input';
import { RecentTasksPanel } from '@/components/create/recent-tasks-panel';
import { useAppTranslations } from '@/lib/i18n';

export default function CreateHeroPage() {
  const t = useAppTranslations('createHero');
  const pipelines = [
    {
      title: t('quickTitle'),
      description: t('quickDescription'),
      timeEstimate: t('quickTime'),
      icon: Sparkles,
      href: '/create/quick',
    },
    {
      title: t('digitalHumanTitle'),
      description: t('digitalHumanDescription'),
      timeEstimate: t('digitalHumanTime'),
      icon: User,
      href: '/create/digital-human',
    },
    {
      title: t('i2vTitle'),
      description: t('i2vDescription'),
      timeEstimate: t('i2vTime'),
      icon: ImageIcon,
      href: '/create/i2v',
    },
    {
      title: t('actionTransferTitle'),
      description: t('actionTransferDescription'),
      timeEstimate: t('actionTransferTime'),
      icon: Activity,
      href: '/create/action-transfer',
    },
    {
      title: t('customTitle'),
      description: t('customDescription'),
      timeEstimate: t('customTime'),
      icon: PenTool,
      href: '/create/custom',
    },
  ];

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col px-4 pb-12 pt-6 md:px-8">
      <h1 className="sr-only">{t('title')}</h1>
      <div className="space-y-5">
        <ProjectBar />
        <QuickIntentInput variant="compact" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-label={t('description')}>
          <div data-testid="pipeline-grid" className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {pipelines.map((pipeline) => (
              <PipelineCard
                key={pipeline.href}
                title={pipeline.title}
                description={pipeline.description}
                timeEstimate={pipeline.timeEstimate}
                icon={pipeline.icon}
                href={pipeline.href}
                variant="compact"
              />
            ))}
          </div>
        </section>
        <RecentTasksPanel />
      </div>
    </div>
  );
}
