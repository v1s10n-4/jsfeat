import { useRef, useEffect } from 'react';
import { getCardDebugBuffers } from '@/lib/demos';

const STAGES = [
  { id: 'gray', label: 'Grayscale', color: false },
  { id: 'blurred', label: 'Blurred', color: false },
  { id: 'canny', label: 'Canny', color: false },
  { id: 'edges', label: 'Morph', color: true },
] as const;

interface PipelineStagesProps {
  width: number;
  height: number;
  renderTick: number;
}

export default function PipelineStages({ width, height, renderTick }: PipelineStagesProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    const bufs = getCardDebugBuffers();
    if (!bufs.gray) return;

    const thumbW = 160;
    const thumbH = Math.round(thumbW * height / width) || 90;

    for (let si = 0; si < STAGES.length; si++) {
      const canvas = canvasRefs.current[si];
      if (!canvas) continue;
      canvas.width = thumbW;
      canvas.height = thumbH;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const stage = STAGES[si];
      let srcData: Uint8Array | null = null;

      if (stage.id === 'gray') srcData = bufs.gray?.data ?? null;
      else if (stage.id === 'blurred') srcData = bufs.blurred?.data ?? null;
      else if (stage.id === 'canny') srcData = bufs.gray?.data ?? null;
      else if (stage.id === 'edges') srcData = bufs.edges?.data ?? null;

      if (!srcData) continue;

      const imgData = ctx.createImageData(thumbW, thumbH);
      const px = imgData.data;
      const scaleX = width / thumbW;
      const scaleY = height / thumbH;

      for (let y = 0; y < thumbH; y++) {
        for (let x = 0; x < thumbW; x++) {
          const srcIdx = (Math.floor(y * scaleY) * width + Math.floor(x * scaleX));
          const dstIdx = (y * thumbW + x) * 4;
          const v = srcData[srcIdx] ?? 0;

          if (stage.color) {
            px[dstIdx] = 0;
            px[dstIdx + 1] = v ? 180 : 20;
            px[dstIdx + 2] = 0;
          } else {
            px[dstIdx] = v;
            px[dstIdx + 1] = v;
            px[dstIdx + 2] = v;
          }
          px[dstIdx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }, [renderTick, width, height]);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pipeline Stages</h3>
      {STAGES.map((stage, i) => (
        <div key={stage.id}>
          <div className="text-[10px] text-muted-foreground mb-0.5">{stage.label}</div>
          <canvas
            ref={(el) => { canvasRefs.current[i] = el; }}
            className="w-full border border-border/50 rounded"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      ))}
    </div>
  );
}
