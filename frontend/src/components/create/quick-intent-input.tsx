'use client';

import { useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { useAppTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function QuickIntentInput({
  className,
  variant = 'default',
}: {
  className?: string;
  variant?: 'default' | 'compact';
}) {
  const [topic, setTopic] = useState('');
  const router = useRouter();
  const t = useAppTranslations('quickIntent');
  const isCompact = variant === 'compact';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      router.push(`/create/quick?topic=${encodeURIComponent(topic.trim())}`);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('group relative mx-auto w-full', isCompact ? 'max-w-none' : 'max-w-3xl', className)}
    >
      <div className={cn('pointer-events-none absolute inset-y-0 left-0 flex items-center', isCompact ? 'pl-3' : 'pl-4')}>
        <Sparkles
          className={cn(
            'text-muted-foreground transition-colors group-focus-within:text-primary',
            isCompact ? 'size-4' : 'size-5'
          )}
        />
      </div>
      <input
        type="text"
        className={cn(
          'w-full border border-border bg-card shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
          isCompact
            ? 'h-10 rounded-md pl-9 pr-20 text-sm'
            : 'h-14 rounded-xl pl-12 pr-24 text-base'
        )}
        placeholder={t('placeholder')}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />
      <div className={cn('absolute inset-y-0 flex items-center', isCompact ? 'right-1.5' : 'right-2')}>
        <button
          type="submit"
          disabled={!topic.trim()}
          className={cn(
            'flex items-center bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
            isCompact ? 'h-7 rounded-md px-3 text-xs' : 'h-10 rounded-lg px-4 text-sm'
          )}
        >
          <Search className={cn('mr-2', isCompact ? 'size-3.5' : 'size-4')} />
          {t('submit')}
        </button>
      </div>
    </form>
  );
}
