/**
 * Renders inline controls for a pipeline stage card.
 */

import type { StageControl } from '@/lib/stages';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface StageControlsProps {
  controls: StageControl[];
  params: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

export default function StageControls({ controls, params, onChange }: StageControlsProps) {
  if (controls.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full">
      {controls.map((ctrl) => {
        switch (ctrl.type) {
          case 'slider': {
            const current = params[ctrl.key] ?? ctrl.defaultNum ?? ctrl.min ?? 0;
            return (
              <div key={ctrl.key} className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0 w-16 truncate">
                  {ctrl.label}
                </Label>
                <Slider
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step}
                  value={[current]}
                  onValueChange={(val) => onChange(ctrl.key, Array.isArray(val) ? val[0] : val)}
                  className="flex-1"
                />
                <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
                  {typeof current === 'number' && current % 1 !== 0
                    ? current.toFixed(1)
                    : current}
                </span>
              </div>
            );
          }

          case 'select': {
            const current = params[ctrl.key] ?? ctrl.defaultStr ?? '';
            return (
              <div key={ctrl.key} className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0 w-16 truncate">
                  {ctrl.label}
                </Label>
                <Select value={current} onValueChange={(v: string) => onChange(ctrl.key, v)}>
                  <SelectTrigger className="flex-1 h-7" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ctrl.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          case 'checkbox': {
            const current = params[ctrl.key] ?? ctrl.defaultBool ?? false;
            return (
              <div key={ctrl.key} className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0 w-16 truncate">
                  {ctrl.label}
                </Label>
                <Switch
                  checked={current}
                  onCheckedChange={(v: boolean) => onChange(ctrl.key, v)}
                  size="sm"
                />
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
