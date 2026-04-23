'use client';

import { Pause, Play } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatDurationClock } from '@/lib/pipeline-utils';

interface InlineAudioPlayerProps {
  duration?: number | null;
  src: string;
}

let activeAudio: HTMLAudioElement | null = null;

export function InlineAudioPlayer({ duration, src }: InlineAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (activeAudio && activeAudio !== audio) {
      activeAudio.pause();
    }

    if (audio.paused) {
      activeAudio = audio;
      await audio.play();
    } else {
      audio.pause();
    }
  };

  return (
    <div
      className="flex min-w-48 items-center gap-2"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === ' ') {
          event.preventDefault();
          void togglePlayback();
        }
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
        }}
      >
        <track kind="captions" />
      </audio>
      <Button type="button" variant="outline" size="icon-sm" aria-label={isPlaying ? 'Pause audio' : 'Play audio'} onClick={() => void togglePlayback()}>
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <Progress value={progress} aria-label="Audio progress" className="h-2 min-w-24" />
      <span className="text-xs text-muted-foreground">{formatDurationClock(duration)}</span>
    </div>
  );
}
