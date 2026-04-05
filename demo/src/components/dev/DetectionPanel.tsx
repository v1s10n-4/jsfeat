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
    <div className="space-y-4">
      {/* Controls */}
      <div className="space-y-3">
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

      {/* Detection Metrics */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Detection Metrics
        </h3>
        {metrics ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground">Status</span>
              <Badge variant={metrics.detected ? 'default' : 'destructive'}>
                {metrics.detected ? 'Detected' : 'Not Detected'}
              </Badge>
              <Badge
                variant="outline"
                className={
                  verdict === 'pass' ? 'border-green-500 text-green-400' :
                  verdict === 'fail' ? 'border-red-500 text-red-400' :
                  'border-muted text-muted-foreground'
                }
              >
                {verdict === 'pass' ? 'PASS' : verdict === 'fail' ? 'FAIL' : 'UNTESTED'}
              </Badge>
              <Button variant="outline" size="xs" onClick={onRetest} className="h-5 text-[9px] px-1.5 ml-auto">
                Retest
              </Button>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground break-all leading-relaxed">
              {metrics.debugInfo}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <MetricRow label="RectFill" value={metrics.rectFill.toFixed(3)} />
              <MetricRow label="Aspect" value={metrics.aspect.toFixed(3)} />
              <MetricRow label="MorphThr" value={metrics.morphThreshold.toFixed(1)} />
              <MetricRow label="Quality" value={metrics.qualityScore.toFixed(2)} />
            </div>
            {metrics.accuracy && (
              <div className="mt-1">
                <div className="text-[9px] text-muted-foreground">Accuracy (vs ground truth)</div>
                <div className="flex gap-3 text-[10px] font-mono">
                  <span>mean: <span className={metrics.accuracy.meanDist < 20 ? 'text-green-400' : metrics.accuracy.meanDist < 50 ? 'text-yellow-400' : 'text-red-400'}>{metrics.accuracy.meanDist.toFixed(1)}px</span></span>
                  <span>max: {metrics.accuracy.maxDist.toFixed(1)}px</span>
                </div>
              </div>
            )}
            {metrics.corners && (
              <div className="mt-1">
                <div className="text-[9px] text-muted-foreground">Corners (TL TR BR BL)</div>
                <div className="flex flex-wrap gap-x-2 text-[9px] font-mono">
                  {metrics.corners.map((c, i) => (
                    <span key={i}>({Math.round(c.x)},{Math.round(c.y)})</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">No metrics yet.</p>
        )}
      </div>

    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[10px] font-mono text-foreground">{value}</span>
    </div>
  );
}
