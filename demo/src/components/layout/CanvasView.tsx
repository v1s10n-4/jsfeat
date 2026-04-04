import { useState, type RefObject } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Pause, Play, Camera, Maximize, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CanvasViewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  dimensions: { width: number; height: number };
  onResolutionChange: (w: number, h: number) => void;
  onCapture: () => void;
  frozen: boolean;
  onFreeze: () => void;
  profilerDisplay: {
    stages: { name: string; ms: number }[];
    totalMs: number;
    fps: number;
  };
}

const RESOLUTIONS = [
  { label: '320x240', w: 320, h: 240 },
  { label: '640x480', w: 640, h: 480 },
  { label: '1280x720', w: 1280, h: 720 },
] as const;

export default function CanvasView({
  canvasRef,
  videoRef,
  dimensions,
  onResolutionChange,
  onCapture,
  frozen,
  onFreeze,
  profilerDisplay,
}: CanvasViewProps) {
  const isMobile = useIsMobile();
  const [profilerExpanded, setProfilerExpanded] = useState(false);

  const currentResLabel = `${dimensions.width}x${dimensions.height}`;

  function handleResolutionChange(value: string | null) {
    if (!value) return;
    const res = RESOLUTIONS.find((r) => r.label === value);
    if (res) onResolutionChange(res.w, res.h);
  }

  function handleFullscreen() {
    canvasRef.current?.requestFullscreen?.();
  }

  const maxStageMs = Math.max(
    ...profilerDisplay.stages.map((s) => s.ms),
    1
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <TooltipProvider>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={currentResLabel} onValueChange={handleResolutionChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem key={r.label} value={r.label}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="sm" onClick={onFreeze} />
              }
            >
              {frozen ? <Play className="size-4" /> : <Pause className="size-4" />}
              <span className="hidden sm:inline">{frozen ? 'Resume' : 'Freeze'}</span>
            </TooltipTrigger>
            <TooltipContent>{frozen ? 'Resume' : 'Freeze'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="sm" onClick={onCapture} />
              }
            >
              <Camera className="size-4" />
              <span className="hidden sm:inline">Capture</span>
            </TooltipTrigger>
            <TooltipContent>Save as PNG</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="sm" onClick={handleFullscreen} />
              }
            >
              <Maximize className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Fullscreen</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Canvas */}
      <div className="overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="max-w-full h-auto"
        />
      </div>

      {/* Hidden video */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Profiler */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {profilerDisplay.fps} FPS
          </Badge>
          {profilerDisplay.totalMs > 0 && (
            <span className="text-xs text-muted-foreground">
              {profilerDisplay.totalMs.toFixed(1)} ms / frame
            </span>
          )}
          {isMobile && profilerDisplay.stages.length > 0 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setProfilerExpanded((v) => !v)}
              aria-label={profilerExpanded ? 'Collapse profiler' : 'Expand profiler'}
            >
              {profilerExpanded ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </Button>
          )}
        </div>

        {(!isMobile || profilerExpanded) && profilerDisplay.stages.length > 0 && (
          <div className="flex flex-col gap-1">
            {profilerDisplay.stages.map((stage) => (
              <div key={stage.name} className="flex items-center gap-2 text-xs">
                <span className="w-24 truncate text-muted-foreground">
                  {stage.name}
                </span>
                <div className="relative h-3 flex-1 rounded bg-muted">
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded bg-primary/60'
                    )}
                    style={{
                      width: `${Math.min((stage.ms / maxStageMs) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="w-14 text-right tabular-nums text-muted-foreground">
                  {stage.ms.toFixed(1)} ms
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
