'use client';

import { useEffect, useState } from 'react';

interface ExifPanelProps {
  src?: File | string | null;
}

interface ExifSummary {
  aperture?: string | number;
  camera?: string;
  focalLength?: string | number;
  iso?: string | number;
  lens?: string;
  shutter?: string | number;
}

function normalizeExif(raw: Record<string, unknown> | null | undefined): ExifSummary {
  return {
    aperture: raw?.FNumber as string | number | undefined,
    camera: [raw?.Make, raw?.Model].filter(Boolean).join(' ') || undefined,
    focalLength: raw?.FocalLength as string | number | undefined,
    iso: raw?.ISO as string | number | undefined,
    lens: raw?.LensModel as string | undefined,
    shutter: raw?.ExposureTime as string | number | undefined,
  };
}

export function ExifPanel({ src }: ExifPanelProps) {
  const [summary, setSummary] = useState<ExifSummary | null>(null);
  const [status, setStatus] = useState<'empty' | 'loading' | 'ready'>('empty');

  useEffect(() => {
    let cancelled = false;

    const loadExif = async () => {
      if (!src) {
        setSummary(null);
        setStatus('empty');
        return;
      }

      setStatus('loading');
      try {
        const exifr = await import('exifr');
        const raw = await exifr.parse(src, {
          pick: ['Make', 'Model', 'LensModel', 'ISO', 'FNumber', 'ExposureTime', 'FocalLength'],
        });
        if (!cancelled) {
          setSummary(normalizeExif(raw as Record<string, unknown> | null | undefined));
          setStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setSummary({});
          setStatus('ready');
        }
      }
    };

    void loadExif();

    return () => {
      cancelled = true;
    };
  }, [src]);

  const fields = [
    ['Camera', summary?.camera],
    ['Lens', summary?.lens],
    ['ISO', summary?.iso],
    ['Aperture', summary?.aperture],
    ['Shutter', summary?.shutter],
    ['Focal length', summary?.focalLength],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">EXIF</h3>
      {status === 'loading' ? <p className="mt-2 text-sm text-muted-foreground">Loading EXIF…</p> : null}
      {status !== 'loading' && fields.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No EXIF metadata found.</p>
      ) : null}
      {fields.length > 0 ? (
        <dl className="mt-3 grid gap-2 text-sm">
          {fields.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
