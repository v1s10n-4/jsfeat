/**
 * Controls panel for individual demo pages.
 * Desktop: fixed right panel. Mobile: bottom Sheet.
 */

import type { StageControl } from '@/lib/stages';
import { useIsMobile } from '@/hooks/useMediaQuery';
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
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';

interface ControlsPanelProps {
  controls: StageControl[];
  params: Record<string, any>;
  onParamChange: (key: string, value: any) => void;
}

function ControlsList({ controls, params, onParamChange }: ControlsPanelProps) {
  if (controls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No adjustable parameters for this demo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {controls.map((ctrl) => {
        switch (ctrl.type) {
          case 'slider': {
            const current = params[ctrl.key] ?? ctrl.defaultNum ?? ctrl.min ?? 0;
            return (
              <div key={ctrl.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{ctrl.label}</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {typeof current === 'number' && current % 1 !== 0
                      ? current.toFixed(1)
                      : current}
                  </span>
                </div>
                <Slider
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step}
                  value={[current]}
                  onValueChange={(val) => onParamChange(ctrl.key, Array.isArray(val) ? val[0] : val)}
                />
              </div>
            );
          }

          case 'select': {
            const current = params[ctrl.key] ?? ctrl.defaultStr ?? '';
            return (
              <div key={ctrl.key} className="flex flex-col gap-1.5">
                <Label className="text-xs">{ctrl.label}</Label>
                <Select value={current} onValueChange={(v: string) => onParamChange(ctrl.key, v)}>
                  <SelectTrigger size="sm">
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
              <div key={ctrl.key} className="flex items-center justify-between">
                <Label className="text-xs">{ctrl.label}</Label>
                <Switch
                  checked={current}
                  onCheckedChange={(v: boolean) => onParamChange(ctrl.key, v)}
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

export default function ControlsPanel({ controls, params, onParamChange }: ControlsPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger render={<Button variant="outline" size="sm" />}>
          <Settings2 className="size-4" />
          Controls
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Controls</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <ControlsList controls={controls} params={params} onParamChange={onParamChange} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="w-64 shrink-0 flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Controls</h3>
      <ControlsList controls={controls} params={params} onParamChange={onParamChange} />
    </div>
  );
}
