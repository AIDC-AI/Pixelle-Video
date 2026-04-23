'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import hints from '@/data/param-hints.json';

import { cn } from '@/lib/utils';

interface ParamHint {
  description: string;
  key: string;
  range: string;
  recommended: string;
  tip: string;
  title: string;
}

export interface ParamHintPopoverProps {
  children: React.ReactNode;
  paramKey: string;
}

function canUseHover(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia ? window.matchMedia('(hover: hover)').matches : true;
}

const hintMap = new Map<string, ParamHint>((hints as ParamHint[]).map((hint) => [hint.key, hint]));

export function ParamHintPopover({ children, paramKey }: ParamHintPopoverProps) {
  const hint = useMemo(() => hintMap.get(paramKey), [paramKey]);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const updatePosition = () => {
    if (!anchorRef.current) {
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    const maxLeft = Math.max(window.innerWidth - 296, 16);

    setPosition({
      left: Math.min(rect.left, maxLeft),
      top: Math.min(rect.bottom + 8, window.innerHeight - 16),
    });
  };

  const handleMouseEnter = () => {
    if (!hint || !canUseHover()) {
      return;
    }

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      updatePosition();
      setOpen(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    clearTimer();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleViewportChange = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open]);

  useEffect(() => clearTimer, []);

  if (!hint) {
    return <>{children}</>;
  }

  return (
    <>
      <div ref={anchorRef} className="block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {children}
      </div>
      {open && position && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={cn(
                'fixed z-50 w-[280px] space-y-3 rounded-lg bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10'
              )}
              style={{ left: position.left, top: position.top }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-popover-foreground">{hint.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{hint.description}</p>
              </div>
              <dl className="space-y-2 text-xs leading-5">
                <div>
                  <dt className="font-medium text-popover-foreground">Range</dt>
                  <dd className="text-muted-foreground">{hint.range}</dd>
                </div>
                <div>
                  <dt className="font-medium text-popover-foreground">Recommended</dt>
                  <dd className="text-muted-foreground">{hint.recommended}</dd>
                </div>
                <div>
                  <dt className="font-medium text-popover-foreground">Tip</dt>
                  <dd className="text-muted-foreground">{hint.tip}</dd>
                </div>
              </dl>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
