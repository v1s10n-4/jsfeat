import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, Keypoint, Pyramid, ColorCode, DataType, Channel } from 'jsfeat/core';
import { grayscale, pyrDown } from 'jsfeat/imgproc';
import { fastCorners } from 'jsfeat/features';
import { lucasKanade } from 'jsfeat/flow';
import { ransac, createRansacParams, homography2d, affine2d } from 'jsfeat/motion';

/* ------------------------------------------------------------------ *
 *  Constants
 * ------------------------------------------------------------------ */

const PYRAMID_LEVELS = 3;
const MAX_POINTS = 500;

/* ------------------------------------------------------------------ *
 *  State
 * ------------------------------------------------------------------ */

let gray: Matrix | null = null;
let corners: Keypoint[] = [];

let prevPyr: Pyramid | null = null;
let currPyr: Pyramid | null = null;
let prevXY: Float32Array | null = null;
let currXY: Float32Array | null = null;
let flowStatus: Uint8Array | null = null;
let pointCount = 0;
let frameCount = 0;

// Motion accumulation
interface Transform {
  dx: number;
  dy: number;
  da: number; // rotation angle
  ds: number; // scale
}

let transforms: Transform[] = [];
let trajectory: Transform[] = [];
let smoothedTrajectory: Transform[] = [];

// Model matrix for RANSAC
let modelMat: Matrix | null = null;
let motionModel: 'affine' | 'homography' = 'homography';
let smoothingRadius = 15;

// Extra canvas for split view
let offCanvas: HTMLCanvasElement | null = null;
let offCtx: CanvasRenderingContext2D | null = null;

const demo: Demo = {
  title: 'Video Stabilization',
  category: 'Motion',
  description:
    'Split-screen: original (left) vs stabilized (right). Tracks features with Lucas-Kanade, estimates motion via RANSAC, and applies Gaussian smoothing to the trajectory.',

  controls: [
    {
      type: 'dropdown',
      key: 'motionModel',
      label: 'Motion Model',
      options: [
        { label: 'Homography', value: 'homography' },
        { label: 'Affine', value: 'affine' },
      ],
      value: 'homography',
    },
    {
      type: 'slider',
      key: 'smoothingRadius',
      label: 'Smoothing Radius',
      min: 5,
      max: 30,
      step: 1,
      value: 15,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;

    motionModel = (params.motionModel as 'affine' | 'homography') ?? 'homography';
    smoothingRadius = (params.smoothingRadius as number) ?? 15;

    gray = new Matrix(w, h, U8C1);
    corners = Array.from({ length: MAX_POINTS }, () => new Keypoint());

    prevPyr = new Pyramid(PYRAMID_LEVELS);
    prevPyr.allocate(w, h, U8C1);
    prevPyr.pyrdown = pyrDown;

    currPyr = new Pyramid(PYRAMID_LEVELS);
    currPyr.allocate(w, h, U8C1);
    currPyr.pyrdown = pyrDown;

    prevXY = new Float32Array(MAX_POINTS * 2);
    currXY = new Float32Array(MAX_POINTS * 2);
    flowStatus = new Uint8Array(MAX_POINTS);

    modelMat = new Matrix(3, 3, DataType.F32 | Channel.C1);

    pointCount = 0;
    frameCount = 0;
    transforms = [];
    trajectory = [];
    smoothedTrajectory = [];

    // Offscreen canvas for stabilized frame
    offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    offCtx = offCanvas.getContext('2d')!;
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (
      !gray ||
      !prevPyr ||
      !currPyr ||
      !prevXY ||
      !currXY ||
      !flowStatus ||
      !modelMat ||
      !offCanvas ||
      !offCtx
    )
      return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    // Swap pyramids
    const tmp = prevPyr;
    prevPyr = currPyr;
    currPyr = tmp;

    profiler.start('pyramid');
    const lvl0 = currPyr.data[0];
    const n = w * h;
    for (let i = 0; i < n; i++) {
      lvl0.data[i] = gray.data[i];
    }
    currPyr.build(currPyr.data[0], true);
    profiler.end('pyramid');

    // Detect features
    profiler.start('detect');
    const count = fastCorners(gray, corners, 20);
    const ptCount = Math.min(count, MAX_POINTS);
    for (let i = 0; i < ptCount; i++) {
      currXY[i * 2] = corners[i].x;
      currXY[i * 2 + 1] = corners[i].y;
    }
    profiler.end('detect');

    let dx = 0, dy = 0, da = 0;

    if (ptCount > 0 && frameCount > 0) {
      // Copy current to prev for tracking
      for (let i = 0; i < ptCount * 2; i++) {
        prevXY[i] = currXY[i];
      }

      profiler.start('track');
      lucasKanade(prevPyr, currPyr, prevXY, currXY, ptCount, 20, 30, flowStatus, 0.01, 0.0001);
      profiler.end('track');

      // Collect matched point pairs
      const fromPts: { x: number; y: number }[] = [];
      const toPts: { x: number; y: number }[] = [];
      for (let i = 0; i < ptCount; i++) {
        if (flowStatus[i] === 1) {
          const cx = currXY[i * 2], cy = currXY[i * 2 + 1];
          if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
            fromPts.push({ x: prevXY[i * 2], y: prevXY[i * 2 + 1] });
            toPts.push({ x: cx, y: cy });
          }
        }
      }

      if (fromPts.length >= 4) {
        profiler.start('estimate');
        const kernel = motionModel === 'affine' ? affine2d : homography2d;
        const rParams = createRansacParams(motionModel === 'affine' ? 3 : 4, 3.0, 0.5, 0.99);
        ransac(rParams, kernel, fromPts, toPts, fromPts.length, modelMat, null, 500);
        profiler.end('estimate');

        // Extract translation and rotation from the model
        const md = modelMat.data;
        dx = md[2] as number;
        dy = md[5] as number;
        da = Math.atan2(md[3] as number, md[0] as number);
      }
    }

    // Accumulate transform
    const t: Transform = { dx, dy, da, ds: 1.0 };
    transforms.push(t);

    // Accumulate trajectory
    const prevTraj = trajectory.length > 0 ? trajectory[trajectory.length - 1] : { dx: 0, dy: 0, da: 0, ds: 1 };
    trajectory.push({
      dx: prevTraj.dx + dx,
      dy: prevTraj.dy + dy,
      da: prevTraj.da + da,
      ds: 1.0,
    });

    // Smooth trajectory with Gaussian window
    const smoothed = smoothTrajectory(trajectory, smoothingRadius);
    smoothedTrajectory = smoothed;

    // Compute correction for current frame
    const fi = trajectory.length - 1;
    const corrDx = fi < smoothed.length ? smoothed[fi].dx - trajectory[fi].dx : 0;
    const corrDy = fi < smoothed.length ? smoothed[fi].dy - trajectory[fi].dy : 0;
    const corrDa = fi < smoothed.length ? smoothed[fi].da - trajectory[fi].da : 0;

    // Render stabilized frame on right half
    profiler.start('render');

    // Draw original video on offscreen canvas
    offCtx.drawImage(video, 0, 0, w, h);

    // Apply stabilization transform
    offCtx.save();
    offCtx.clearRect(0, 0, w, h);
    const cosA = Math.cos(corrDa);
    const sinA = Math.sin(corrDa);
    offCtx.setTransform(cosA, sinA, -sinA, cosA, corrDx + w / 2 * (1 - cosA) + h / 2 * sinA, corrDy + h / 2 * (1 - cosA) - w / 2 * sinA);
    offCtx.drawImage(video, 0, 0, w, h);
    offCtx.restore();

    // Draw split screen: left = original, right = stabilized
    const halfW = w >> 1;
    ctx.putImageData(imageData, 0, 0);

    // Draw stabilized on right half
    ctx.drawImage(offCanvas, halfW, 0, halfW, h, halfW, 0, halfW, h);

    // Draw divider
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(halfW, h);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Original', halfW / 2, 20);
    ctx.fillText('Stabilized', halfW + halfW / 2, 20);
    ctx.textAlign = 'start';

    // Info
    ctx.fillText(`dX: ${dx.toFixed(1)}  dY: ${dy.toFixed(1)}  dA: ${(da * 180 / Math.PI).toFixed(1)}`, 10, h - 10);

    profiler.end('render');

    pointCount = ptCount;
    frameCount++;
    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'motionModel') motionModel = value as 'affine' | 'homography';
    if (key === 'smoothingRadius') smoothingRadius = value as number;
  },

  cleanup() {
    prevPyr = null;
    currPyr = null;
    prevXY = null;
    currXY = null;
    flowStatus = null;
    gray = null;
    corners = [];
    modelMat = null;
    pointCount = 0;
    frameCount = 0;
    transforms = [];
    trajectory = [];
    smoothedTrajectory = [];
    offCanvas = null;
    offCtx = null;
  },
};

/* ------------------------------------------------------------------ *
 *  Gaussian trajectory smoothing
 * ------------------------------------------------------------------ */

function smoothTrajectory(traj: Transform[], radius: number): Transform[] {
  const result: Transform[] = [];
  const len = traj.length;

  for (let i = 0; i < len; i++) {
    let sumDx = 0, sumDy = 0, sumDa = 0;
    let sumW = 0;

    for (let j = -radius; j <= radius; j++) {
      const idx = i + j;
      if (idx < 0 || idx >= len) continue;
      const w = Math.exp((-j * j) / (2 * (radius / 3) * (radius / 3)));
      sumDx += traj[idx].dx * w;
      sumDy += traj[idx].dy * w;
      sumDa += traj[idx].da * w;
      sumW += w;
    }

    result.push({
      dx: sumDx / sumW,
      dy: sumDy / sumW,
      da: sumDa / sumW,
      ds: 1.0,
    });
  }

  return result;
}

export default demo;
