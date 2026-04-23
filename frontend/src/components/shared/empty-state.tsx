'use client';

import Link from 'next/link';
import { createElement, isValidElement, type ElementType, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateAction {
  href?: string;
  label: string;
  onClick?: () => void;
  role?: 'button' | 'link';
  variant?: 'default' | 'outline';
}

interface EmptyStateProps {
  action?: EmptyStateAction;
  actionHref?: string;
  actionLabel?: string;
  description?: string;
  icon?: LucideIcon | ReactNode;
  secondaryAction?: Omit<EmptyStateAction, 'variant'>;
  title: string;
}

function renderIcon(icon: EmptyStateProps['icon']) {
  if (!icon) {
    return null;
  }

  if (isValidElement(icon)) {
    return icon;
  }

  return createElement(icon as ElementType, {
    className: 'size-12 text-muted-foreground',
  });
}

function ActionButton({ action }: { action: EmptyStateAction }) {
  if (action.href) {
    return (
      <Link
        href={action.href}
        role={action.role}
        className={buttonVariants({
          variant: action.variant ?? 'default',
        })}
      >
        {action.label}
      </Link>
    );
  }

  return (
    <Button type="button" onClick={action.onClick} variant={action.variant ?? 'default'}>
      {action.label}
    </Button>
  );
}

export function EmptyState({
  action,
  actionHref,
  actionLabel,
  description,
  icon,
  secondaryAction,
  title,
}: EmptyStateProps) {
  const primaryAction = action ?? (
    actionHref && actionLabel
      ? {
          href: actionHref,
          label: actionLabel,
        }
      : null
  );

  return (
    <Card className="border-border/70 bg-card shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        {icon ? (
          <div
            className={cn(
              'flex size-24 items-center justify-center rounded-full border border-border/70 bg-muted/40',
              isValidElement(icon) ? 'p-5' : undefined
            )}
          >
            {renderIcon(icon)}
          </div>
        ) : null}
        <div className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">{title}</h2>
          {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {primaryAction || secondaryAction ? (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {primaryAction ? <ActionButton action={primaryAction} /> : null}
            {secondaryAction ? (
              <ActionButton action={{ ...secondaryAction, variant: 'outline' }} />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
