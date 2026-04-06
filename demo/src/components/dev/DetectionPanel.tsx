import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { DetectionMetrics } from './DebugCanvas';

export const DEFAULT_PARAMS: Record<string, number> = {
  blurKernel: 9,
  cannyLow: 20,
  cannyHigh: 60,
  minContourArea: 1000,
};

interface DetectionPanelProps {
  params: Record<string, number>;
  onParamChange: (key: string, value: number) => void;
  onResetParams: () => void;
  metrics: DetectionMetrics | null;
  verdict: 'pass' | 'fail' | 'untested';
  onRetest: () => void;
}

const SLIDERS = [
  { key: 'blurKernel', label: 'Blur Kernel', min: 1, max: 31, step: 2 },
  { key: 'cannyLow', label: 'Canny Low', min: 1, max: 100, step: 1 },
  { key: 'cannyHigh', label: 'Canny High', min: 1, max: 200, step: 1 },
  { key: 'minContourArea', label: 'Min Area', min: 100, max: 10000, step: 100 },
] as const;

export default function DetectionPanel({
  params,
  onParamChange,
  onResetParams,
  metrics,
  verdict,
  onRetest,
}: DetectionPanelProps) {
  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Controls
          </h3>
          <Button variant="outline" size="xs" onClick={onResetParams}>
            Reset
          </Button>
        </div>
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">{label}</Label>
              <span className="text-[10px] font-mono text-foreground">
                {params[key] ?? DEFAULT_PARAMS[key]}
              </span>
            </div>
            <Slider
              min={min}
              max={max}
              step={step}
              value={[params[key] ?? DEFAULT_PARAMS[key]]}
              onValueChange={(value) => {
                const v = Array.isArray(value) ? value[0] : value;
                if (typeof v === 'number') onParamChange(key, v);
              }}
            />
          </div>
        ))}
      </div>

      {/* Detection Metrics — compact layout */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metrics</h3>
          <Button variant="outline" size="xs" onClick={onRetest} className="h-5 text-[9px] px-1.5">Retest</Button>
        </div>
        {metrics ? (
          <>
            {/* Status + verdict inline */}
            <div className="flex items-center gap-1.5">
              <Badge variant={metrics.detected ? 'default' : 'destructive'} className="text-[9px] h-4">
                {metrics.detected ? 'Detected' : 'No Card'}
              </Badge>
              <Badge variant="outline" className={`text-[9px] h-4 ${verdict === 'pass' ? 'border-green-500 text-green-400' : verdict === 'fail' ? 'border-red-500 text-red-400' : 'border-muted text-muted-foreground'}`}>
                {verdict === 'pass' ? 'PASS' : verdict === 'fail' ? 'FAIL' : '—'}
              </Badge>
              {metrics.accuracy && (
                <span className={`text-[9px] font-mono ml-auto ${metrics.accuracy.meanDist < 20 ? 'text-green-400' : metrics.accuracy.meanDist < 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {metrics.accuracy.meanDist.toFixed(1)}px
                </span>
              )}
            </div>
            {/* All metrics on two compact rows */}
            <div className="font-mono text-[9px] text-muted-foreground flex flex-wrap gap-x-3">
              <span>rf={metrics.rectFill.toFixed(2)}</span>
              <span>asp={metrics.aspect.toFixed(2)}</span>
              <span>thr={metrics.morphThreshold.toFixed(0)}</span>
              <span>q={metrics.qualityScore.toFixed(2)}</span>
              {metrics.accuracy && <span>max={metrics.accuracy.maxDist.toFixed(0)}px</span>}
            </div>
            {/* Corners on one line */}
            {metrics.corners && (
              <div className="font-mono text-[9px] text-muted-foreground">
                {metrics.corners.map((c) => `(${Math.round(c.x)},${Math.round(c.y)})`).join(' ')}
              </div>
            )}
          </>
        ) : (
          <p className="text-[9px] text-muted-foreground italic">No metrics yet.</p>
        )}
      </div>

    </div>
  );
}

