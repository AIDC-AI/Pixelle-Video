'use client';

import { useId } from 'react';

import { useAppTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type BrandMarkSize = 'sm' | 'md' | 'lg' | 'xl';

interface BrandMarkProps {
  className?: string;
  size?: BrandMarkSize;
}

const BRAND_MARK_SIZES: Record<BrandMarkSize, number> = {
  sm: 16,
  md: 20,
  lg: 32,
  xl: 64,
};

export function BrandMark({ className, size = 'md' }: BrandMarkProps) {
  const t = useAppTranslations('brand') as (key: 'productName') => string;
  const gradientId = `pixelle-sky-${useId().replace(/:/g, '')}`;
  const pixelSize = BRAND_MARK_SIZES[size];

  return (
    <svg
      role="img"
      aria-label={t('productName')}
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      className={cn(
        'shrink-0 text-foreground [--brand-mark-sky-start:hsl(245_60%_55%)] [--brand-mark-sky-end:hsl(220_70%_85%)] dark:[--brand-mark-sky-start:hsl(245_60%_70%)] dark:[--brand-mark-sky-end:hsl(220_70%_45%)]',
        className
      )}
    >
      <defs>
        <linearGradient id={gradientId} x1="12" y1="4.5" x2="12" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--brand-mark-sky-start)" />
          <stop offset="100%" stopColor="var(--brand-mark-sky-end)" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="16" height="16" rx="4" ry="4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6.5" y="6.5" width="11" height="6.5" rx="2" ry="2" fill={`url(#${gradientId})`} />
      <path d="M7 16.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}
