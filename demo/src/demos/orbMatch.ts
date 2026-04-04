import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, F32C1, Keypoint, ColorCode, DataType, Channel } from 'jsfeat/core';
import { grayscale, gaussianBlur } from 'jsfeat/imgproc';
import { fastCorners, orbDescribe } from 'jsfeat/features';
import { ransac, createRansacParams, homography2d } from 'jsfeat/motion';

/* ------------------------------------------------------------------ *
 *  Hamming distance between two 32-byte ORB descriptors
 * ------------------------------------------------------------------ */

function hammingDistance(
  d1: { [i: number]: number },
  off1: number,
  d2: { [i: number]: number },
  off2: number,
): number {
  let dist = 0;
  for (let i = 0; i < 32; i++) {
    let v = (d1[off1 + i] ^ d2[off2 + i]) | 0;
    v = v - ((v >> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
    dist += (((v + (v >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
  }
  return dist;
}

/* ------------------------------------------------------------------ *
 *  State
 * ------------------------------------------------------------------ */

const MAX_FEATURES = 2000;
const DESCRIPTOR_SIZE = 32; // bytes per ORB descriptor

let gray: Matrix | null = null;
let liveCorners: Keypoint[] = [];
let liveDescriptors: Matrix | null = null;

// Pattern data (trained from a frozen frame)
let patternTrained = false;
let patternGray: Matrix | null = null;
let patternCorners: Keypoint[] = [];
let patternDescriptors: Matrix | null = null;
let patternCount = 0;
let patternW = 0;
let patternH = 0;

// Homography
let homo3x3: Matrix | null = null;
let matchMask: Matrix | null = null;

// Parameters
let matchThreshold = 48;
let maxFeatures = 500;

// Last frame ImageData for training
let lastImageData: ImageData | null = null;

const demo: Demo = {
  title: 'ORB Match',
  category: 'Feature Detection',
  description:
    'ORB feature matching with RANSAC homography. Press "Train Pattern" to capture the current frame as a reference pattern.',

  controls: [
    {
      type: 'button',
      label: 'Train Pattern',
      action: 'train',
    },
    {
      type: 'slider',
      key: 'matchThreshold',
      label: 'Match Threshold',
      min: 30,
      max: 100,
      step: 1,
      value: 48,
    },
    {
      type: 'slider',
      key: 'maxFeatures',
      label: 'Max Features',
      min: 200,
      max: 2000,
      step: 100,
      value: 500,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;

    matchThreshold = (params.matchThreshold as number) ?? 48;
    maxFeatures = (params.maxFeatures as number) ?? 500;

    gray = new Matrix(w, h, U8C1);
    liveCorners = Array.from({ length: MAX_FEATURES }, () => new Keypoint());
    liveDescriptors = new Matrix(DESCRIPTOR_SIZE, MAX_FEATURES, U8C1);

    patternGray = new Matrix(w, h, U8C1);
    patternCorners = Array.from({ length: MAX_FEATURES }, () => new Keypoint());
    patternDescriptors = new Matrix(DESCRIPTOR_SIZE, MAX_FEATURES, U8C1);

    homo3x3 = new Matrix(3, 3, DataType.F32 | Channel.C1);
    matchMask = new Matrix(MAX_FEATURES, 1, U8C1);

    patternTrained = false;
    patternCount = 0;
    patternW = w;
    patternH = h;
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !liveDescriptors || !patternDescriptors || !homo3x3 || !matchMask) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    lastImageData = imageData;
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    profiler.start('blur');
    gaussianBlur(gray, gray, 3, 0);
    profiler.end('blur');

    profiler.start('detect');
    const liveCount = fastCorners(gray, liveCorners, 20);
    const usableLive = Math.min(liveCount, maxFeatures);
    profiler.end('detect');

    profiler.start('describe');
    if (usableLive > 0) {
      orbDescribe(gray, liveCorners, usableLive, liveDescriptors);
    }
    profiler.end('describe');

    profiler.start('render');
    ctx.putImageData(imageData, 0, 0);

    if (patternTrained && patternCount > 0 && usableLive > 0) {
      // Brute-force match: for each live descriptor, find best in pattern
      const matchFrom: { x: number; y: number }[] = [];
      const matchTo: { x: number; y: number }[] = [];

      for (let i = 0; i < usableLive; i++) {
        let bestDist = 256;
        let bestIdx = -1;
        for (let j = 0; j < patternCount; j++) {
          const d = hammingDistance(
            liveDescriptors.data,
            i * DESCRIPTOR_SIZE,
            patternDescriptors.data,
            j * DESCRIPTOR_SIZE,
          );
          if (d < bestDist) {
            bestDist = d;
            bestIdx = j;
          }
        }
        if (bestDist < matchThreshold && bestIdx >= 0) {
          matchFrom.push({ x: patternCorners[bestIdx].x, y: patternCorners[bestIdx].y });
          matchTo.push({ x: liveCorners[i].x, y: liveCorners[i].y });
        }
      }

      // Draw match count
      ctx.fillStyle = '#fff';
      ctx.font = '14px monospace';
      ctx.fillText(`Matches: ${matchFrom.length}`, 10, h - 30);
      ctx.fillText(`Live features: ${usableLive}`, 10, h - 10);

      // If enough matches, estimate homography with RANSAC
      if (matchFrom.length >= 4) {
        const rParams = createRansacParams(4, 3.0, 0.5, 0.99);
        const ok = ransac(rParams, homography2d, matchFrom, matchTo, matchFrom.length, homo3x3, matchMask, 1000);

        if (ok) {
          // Transform pattern corners through homography
          const corners = [
            { x: 0, y: 0 },
            { x: patternW, y: 0 },
            { x: patternW, y: patternH },
            { x: 0, y: patternH },
          ];
          const projected = corners.map((c) => {
            const m = homo3x3!.data;
            const ww = m[6] * c.x + m[7] * c.y + m[8];
            return {
              x: (m[0] * c.x + m[1] * c.y + m[2]) / ww,
              y: (m[3] * c.x + m[4] * c.y + m[5]) / ww,
            };
          });

          // Draw green quadrilateral
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(projected[0].x, projected[0].y);
          for (let i = 1; i < 4; i++) {
            ctx.lineTo(projected[i].x, projected[i].y);
          }
          ctx.closePath();
          ctx.stroke();

          // Count inliers
          let inliers = 0;
          for (let i = 0; i < matchFrom.length; i++) {
            if (matchMask!.data[i]) inliers++;
          }
          ctx.fillText(`Inliers: ${inliers}`, 10, h - 50);
        }
      }

      // Draw matched keypoints
      ctx.fillStyle = '#00ccff';
      for (let i = 0; i < matchTo.length; i++) {
        ctx.beginPath();
        ctx.arc(matchTo[i].x, matchTo[i].y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Draw live features
      ctx.fillStyle = '#e94560';
      for (let i = 0; i < usableLive; i++) {
        ctx.beginPath();
        ctx.arc(liveCorners[i].x, liveCorners[i].y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#fff';
      ctx.font = '14px monospace';
      ctx.fillText(`Features: ${usableLive}`, 10, h - 10);
      if (!patternTrained) {
        ctx.fillText('Press "Train Pattern" to capture reference', 10, h - 30);
      }
    }
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'matchThreshold') matchThreshold = value as number;
    if (key === 'maxFeatures') maxFeatures = value as number;

    if (key === 'train' && gray && patternGray && patternDescriptors) {
      // Train: copy current grayscale as pattern
      const n = gray.cols * gray.rows;
      for (let i = 0; i < n; i++) {
        patternGray.data[i] = gray.data[i];
      }
      patternW = gray.cols;
      patternH = gray.rows;

      // Detect and describe pattern features
      const count = fastCorners(patternGray, patternCorners, 20);
      patternCount = Math.min(count, maxFeatures);
      if (patternCount > 0) {
        gaussianBlur(patternGray, patternGray, 3, 0);
        orbDescribe(patternGray, patternCorners, patternCount, patternDescriptors);
      }
      patternTrained = true;
    }
  },

  cleanup() {
    gray = null;
    liveCorners = [];
    liveDescriptors = null;
    patternGray = null;
    patternCorners = [];
    patternDescriptors = null;
    patternTrained = false;
    patternCount = 0;
    homo3x3 = null;
    matchMask = null;
    lastImageData = null;
  },
};

export default demo;
