import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAppTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface PipelineCardProps {
  title: string;
  description: string;
  timeEstimate: string;
  icon: LucideIcon;
  href: string;
  variant?: 'default' | 'compact';
}

export function PipelineCard({ title, description, timeEstimate, icon: Icon, href, variant = 'default' }: PipelineCardProps) {
  const t = useAppTranslations('createCommon');
  const isCompact = variant === 'compact';

  return (
    <Link href={href}>
      <Card
        data-variant={variant}
        className={cn(
          'group relative flex transform-gpu flex-col overflow-hidden border-border bg-card transition-all duration-150 ease-out hover:-translate-y-1 hover:border-primary hover:shadow-md',
          isCompact
            ? 'h-auto bg-gradient-to-br from-primary/10 via-card to-card p-4'
            : 'h-full p-6'
        )}
      >
        <div className={isCompact ? 'mb-3' : 'mb-4'}>
          <div
            className={cn(
              'flex items-center justify-center rounded-md bg-muted transition-colors group-hover:bg-primary/10',
              isCompact ? 'size-9' : 'size-12'
            )}
          >
            <Icon
              className={cn(
                'text-muted-foreground transition-colors group-hover:text-primary',
                isCompact ? 'size-5' : 'size-6'
              )}
            />
          </div>
        </div>
        <h3 className={cn('font-semibold text-foreground transition-colors group-hover:text-primary', isCompact ? 'mb-1 text-base' : 'mb-2 text-lg')}>
          {title}
        </h3>
        <p className={cn('text-sm text-muted-foreground', isCompact ? 'line-clamp-1' : 'mb-4 flex-1')}>
          {description}
        </p>
        {!isCompact ? (
          <div className="mt-auto border-t border-border pt-4 text-xs font-medium text-muted-foreground">
            <span>{t('time')}</span>
            <span aria-hidden="true">: </span>
            <span>{timeEstimate}</span>
          </div>
        ) : null}
      </Card>
    </Link>
  );
}
