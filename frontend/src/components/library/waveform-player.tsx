'use client';

import { Play, Pause } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

interface WaveformPlayerProps {
  height?: number;
  src: string;
}

type WaveSurferInstance = {
  destroy: () => void;
  on: (event: string, callback: () => void) => void;
  pause: () => void;
  play: () => Promise<void> | void;
  playPause: () => Promise<void> | void;
};

export function WaveformPlayer({ height = 48, src }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurferInstance | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const createWaveSurfer = async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        const { default: WaveSurfer } = await import('wavesurfer.js');
        if (cancelled || !containerRef.current) {
          return;
        }

        const instance = WaveSurfer.create({
          barGap: 2,
          barRadius: 2,
          barWidth: 2,
          container: containerRef.current,
          cursorWidth: 1,
          height,
          normalize: true,
          progressColor: 'hsl(var(--primary))',
          url: src,
          waveColor: 'hsl(var(--muted-foreground) / 0.35)',
        }) as WaveSurferInstance;

        instance.on('ready', () => setIsReady(true));
        instance.on('play', () => setIsPlaying(true));
        instance.on('pause', () => setIsPlaying(false));
        instance.on('finish', () => setIsPlaying(false));
        waveSurferRef.current = instance;
      } catch {
        if (!cancelled) {
          setIsReady(false);
        }
      }
    };

    void createWaveSurfer();

    return () => {
      cancelled = true;
      waveSurferRef.current?.destroy();
      waveSurferRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
    };
  }, [height, src]);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div ref={containerRef} aria-label="Audio waveform" />
      {!isReady ? (
        <audio className="mt-2 w-full" src={src} controls preload="none">
          <track kind="captions" />
        </audio>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isReady}
          onClick={() => {
            void waveSurferRef.current?.playPause();
          }}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <span className="text-xs text-muted-foreground">{isReady ? 'Ready' : 'Loading waveform…'}</span>
      </div>
    </div>
  );
}
