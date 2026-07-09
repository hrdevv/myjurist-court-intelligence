import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, RotateCw, Gauge } from "lucide-react";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEEDS = [1, 1.25, 1.5, 2];

export interface AudioPlayerHandle {
  seekTo: (seconds: number) => void;
}

export function AudioPlayer({
  src,
  onReady,
}: {
  src: string;
  onReady?: (handle: AudioPlayerHandle) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);

  useEffect(() => {
    if (onReady) {
      onReady({
        seekTo: (seconds: number) => {
          const el = audioRef.current;
          if (!el) return;
          el.currentTime = seconds;
          void el.play();
        },
      });
    }
  }, [onReady]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  function skip(delta: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
  }

  function cycleSpeed() {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" aria-label="Rewind 5 seconds" onClick={() => skip(-5)}>
          <RotateCcw className="size-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label={playing ? "Pause" : "Play"}
          onClick={togglePlay}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button variant="ghost" size="sm" aria-label="Forward 5 seconds" onClick={() => skip(5)}>
          <RotateCw className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-xs"
          aria-label="Change playback speed"
          onClick={cycleSpeed}
        >
          <Gauge className="size-3.5" /> {SPEEDS[speedIdx]}×
        </Button>
      </div>

      <Slider
        value={[current]}
        max={duration || 0}
        step={0.1}
        aria-label="Seek"
        onValueChange={([v]) => {
          if (audioRef.current) audioRef.current.currentTime = v;
          setCurrent(v);
        }}
      />

      <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
        <span>{formatTime(current)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
