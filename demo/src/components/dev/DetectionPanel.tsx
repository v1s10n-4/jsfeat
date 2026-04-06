import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DETECTION_DEFAULTS, MAIN_SLIDERS, ADVANCED_SLIDERS } from '@/lib/detection-constants';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { DetectionMetrics } from './DebugCanvas';

export const DEFAULT_PARAMS: Record<string, number> = { ...DETECTION_DEFAULTS };

interface DetectionPanelProps {
  params: Record<string, number>;
  onParamChange: (key: string, value: number) => void;
  onResetParams: () => void;
  metrics: DetectionMetrics | null;
  verdict: 'pass' | 'fail' | 'untested';
}

export default function DetectionPanel({
  params,
  onParamChange,
  onResetParams,
  metrics,
  verdict,
}: DetectionPanelProps) {
  return (
    <div className="space-y-3">
      {/* Detection Metrics — compact layout */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metrics</h3>
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
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {MAIN_SLIDERS.map(({ key, label, min, max, step }) => (
            <div key={key} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">{label}</Label>
                <span className="text-[10px] font-mono">{params[key] ?? DETECTION_DEFAULTS[key]}</span>
              </div>
              <Slider min={min} max={max} step={step}
                value={[params[key] ?? DETECTION_DEFAULTS[key]]}
                onValueChange={(v) => { const val = Array.isArray(v) ? v[0] : v; if (typeof val === 'number') onParamChange(key, val); }}
              />
            </div>
          ))}
        </div>

        {/* Advanced Settings Sheet */}
        <Sheet modal={false}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full mt-2">
              ⚙ Advanced Settings
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="overflow-y-auto w-80">
            <SheetHeader>
              <SheetTitle>Advanced Detection Settings</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              {ADVANCED_SLIDERS.map(({ section, sliders }) => (
                <div key={section}>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{section}</h4>
                  <div className="space-y-2">
                    {sliders.map(({ key, label, min, max, step }) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px]">{label}</Label>
                          <span className="text-[10px] font-mono">{params[key] ?? DETECTION_DEFAULTS[key]}</span>
                        </div>
                        <Slider min={min} max={max} step={step}
                          value={[params[key] ?? DETECTION_DEFAULTS[key]]}
                          onValueChange={(v) => { const val = Array.isArray(v) ? v[0] : v; if (typeof val === 'number') onParamChange(key, val); }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={onResetParams}>
                Reset All to Defaults
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

    </div>
  );
}
