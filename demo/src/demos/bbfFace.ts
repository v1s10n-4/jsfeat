import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';
import { bbfPrepareCascade, bbfBuildPyramid, bbfDetect, bbfGroupRectangles } from 'jsfeat/detect';
import { bbfFace } from 'jsfeat/cascades';

let gray: Matrix | null = null;
let cascadePrepared = false;
let interval = 4;
let minScale = 1;

const demo: Demo = {
  title: 'BBF Face Detection',
  category: 'Face Detection',
  description: 'Brightness Binary Feature (BBF) face detection with pyramid scanning.',

  controls: [
    {
      type: 'slider',
      key: 'interval',
      label: 'Interval',
      min: 1,
      max: 5,
      step: 1,
      value: 4,
    },
    {
      type: 'slider',
      key: 'minScale',
      label: 'Min Scale',
      min: 1,
      max: 5,
      step: 0.5,
      value: 1,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    gray = new Matrix(w, h, U8C1);
    interval = (params.interval as number) ?? 4;
    minScale = (params.minScale as number) ?? 1;

    if (!cascadePrepared) {
      bbfPrepareCascade(bbfFace);
      cascadePrepared = true;
    }
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    // Compute minimum detection window size from minScale
    const minWidth = (bbfFace.width * minScale) | 0;
    const minHeight = (bbfFace.height * minScale) | 0;

    profiler.start('pyramid');
    const pyramid = bbfBuildPyramid(gray, minWidth, minHeight, interval);
    profiler.end('pyramid');

    profiler.start('detect');
    const rects = bbfDetect(pyramid, bbfFace);
    profiler.end('detect');

    profiler.start('group');
    const grouped = bbfGroupRectangles(rects, 1);
    profiler.end('group');

    profiler.start('render');
    ctx.putImageData(imageData, 0, 0);

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    for (const r of grouped) {
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    }

    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`Faces: ${grouped.length}`, 10, h - 10);
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'interval') interval = value as number;
    if (key === 'minScale') minScale = value as number;
  },

  cleanup() {
    gray = null;
  },
};

export default demo;
