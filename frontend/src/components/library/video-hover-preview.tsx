'use client';

import { useRef, useState } from 'react';

import { formatDurationClock } from '@/lib/pipeline-utils';

interface VideoHoverPreviewProps {
  duration?: number | null;
  src?: string | null;
}

export function VideoHoverPreview({ duration = 0, src }: VideoHoverPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastUpdateRef = useRef(0);
  const [previewTime, setPreviewTime] = useState(0);
  const [visible, setVisible] = useState(false);

  if (!src) {
    return null;
  }

  const updatePreview = (event: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < 100) {
      return;
    }
    lastUpdateRef.current = now;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0;
    const nextTime = Math.round((duration ?? 0) * ratio);
    setPreviewTime(nextTime);

    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
    }
  };

  return (
    <div
      className="absolute inset-x-3 top-3 z-10"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onMouseMove={updatePreview}
    >
      <div
        className={`rounded-xl border border-white/20 bg-black/70 p-2 text-white shadow-xl backdrop-blur transition-opacity duration-150 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <video
          ref={videoRef}
          className="h-20 w-full rounded-lg object-cover"
          src={src}
          muted
          playsInline
          preload="metadata"
          aria-label="Video hover preview"
        />
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${duration ? (previewTime / duration) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-1 text-center text-[11px]">{formatDurationClock(previewTime)}</p>
      </div>
    </div>
  );
}
