import { useRef, useEffect } from 'react';
import { getCardDebugBuffers } from '@/lib/demos';

const STAGES = [
  { id: 'gradient', label: 'Gradient Magnitude' },
  { id: 'lsd-segments', label: 'LSD Segments' },
  { id: 'winning-quad', label: 'Winning Quad' },
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

    // Determine thumbnail dimensions from scharr or blurred buffer, fall back to props
    const refBuf = bufs.scharr ?? bufs.blurred;
    const bufW = refBuf?.cols || width;
    const bufH = refBuf?.rows || height;
    const thumbW = 160;
    const thumbH = Math.round(thumbW * bufH / bufW) || 90;
    const sw = thumbW;
    const sh = thumbH;

    for (let si = 0; si < STAGES.length; si++) {
      const canvas = canvasRefs.current[si];
      if (!canvas) continue;
      canvas.width = sw;
      canvas.height = sh;
      const stageCtx = canvas.getContext('2d');
      if (!stageCtx) continue;

      const stage = STAGES[si];
      const imgData = stageCtx.createImageData(sw, sh);

      // Fill imgData with black (transparent alpha → opaque black for bg stages)
      for (let i = 3; i < imgData.data.length; i += 4) imgData.data[i] = 255;

      if (stage.id === 'gradient' && bufs.scharr) {
        const sd = bufs.scharr.data;
        const srcW = bufs.scharr.cols;
        const srcH = bufs.scharr.rows;
        for (let dy = 0; dy < sh; dy++) {
          for (let dx = 0; dx < sw; dx++) {
            const si2 = (Math.floor(dy * srcH / sh) * srcW + Math.floor(dx * srcW / sw));
            const mag = Math.min(255, (Math.abs(sd[si2 * 2]) + Math.abs(sd[si2 * 2 + 1])) >> 3);
            const oi = (dy * sw + dx) * 4;
            imgData.data[oi] = mag; imgData.data[oi + 1] = mag; imgData.data[oi + 2] = mag; imgData.data[oi + 3] = 255;
          }
        }
        stageCtx.putImageData(imgData, 0, 0);
      }

      if (stage.id === 'lsd-segments' && bufs.lsdSegments) {
        stageCtx.putImageData(imgData, 0, 0); // black bg
        const srcW = bufs.blurred?.cols ?? 1920;
        const srcH = bufs.blurred?.rows ?? 1080;
        const scaleX = sw / srcW, scaleY = sh / srcH;
        stageCtx.lineWidth = 1;
        stageCtx.strokeStyle = '#00ff00';
        for (const seg of bufs.lsdSegments) {
          stageCtx.beginPath();
          stageCtx.moveTo(seg.x1 * scaleX, seg.y1 * scaleY);
          stageCtx.lineTo(seg.x2 * scaleX, seg.y2 * scaleY);
          stageCtx.stroke();
        }
      }

      if (stage.id === 'winning-quad' && bufs.smoothedCorners) {
        stageCtx.putImageData(imgData, 0, 0); // black bg
        const srcW = bufs.blurred?.cols ?? 1920;
        const srcH = bufs.blurred?.rows ?? 1080;
        const scaleX = sw / srcW, scaleY = sh / srcH;
        stageCtx.strokeStyle = '#00ff00'; stageCtx.lineWidth = 2;
        stageCtx.beginPath();
        const c = bufs.smoothedCorners;
        stageCtx.moveTo(c[0].x * scaleX, c[0].y * scaleY);
        for (let i = 1; i < 4; i++) stageCtx.lineTo(c[i].x * scaleX, c[i].y * scaleY);
        stageCtx.closePath();
        stageCtx.stroke();
        stageCtx.fillStyle = 'rgba(0, 255, 0, 0.15)';
        stageCtx.fill();
        stageCtx.fillStyle = '#ff0';
        for (const p of c) {
          stageCtx.beginPath();
          stageCtx.arc(p.x * scaleX, p.y * scaleY, 3, 0, Math.PI * 2);
          stageCtx.fill();
        }
      }
    }
  }, [renderTick, width, height]);

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pipeline Stages</h3>
      <div className="grid grid-cols-2 gap-1">
        {STAGES.map((stage, i) => (
          <div key={stage.id}>
            <div className="text-[9px] text-muted-foreground">{stage.label}</div>
            <canvas
              ref={(el) => { canvasRefs.current[i] = el; }}
              className="w-full border border-border/50 rounded"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
