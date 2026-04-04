/**
 * Web Worker for off-main-thread face detection (HAAR and BBF).
 *
 * Message protocol:
 * IN:  { type: 'haar'|'bbf', data: Uint8Array, width: number, height: number, params: {...}, scaleX: number, scaleY: number }
 * OUT: { rects: { x: number, y: number, width: number, height: number }[] }
 */

import { Matrix, U8C1 } from 'jsfeat/core';
import {
  resample,
  equalizeHistogram,
  computeIntegralImage,
} from 'jsfeat/imgproc';
import {
  haarDetectMultiScale,
  groupRectangles,
  bbfPrepareCascade,
  bbfBuildPyramid,
  bbfDetect,
  bbfGroupRectangles,
} from 'jsfeat/detect';
import { frontalface, bbfFace } from 'jsfeat/cascades';

// ---------------------------------------------------------------------------
// Persistent state (lives for the lifetime of the worker)
// ---------------------------------------------------------------------------

let bbfPrepared = false;

let small: Matrix | null = null;
let iiSum: Int32Array | null = null;
let iiSqSum: Int32Array | null = null;
let iiTilted: Int32Array | null = null;

function ensureSmall(w: number, h: number): Matrix {
  if (!small || small.cols !== w || small.rows !== h) {
    small = new Matrix(w, h, U8C1);
  }
  return small;
}

// ---------------------------------------------------------------------------
// HAAR detection
// ---------------------------------------------------------------------------

interface HaarParams {
  scaleFactor?: number;
  minNeighbors?: number;
  equalize?: boolean;
}

function detectHaar(
  gray: Matrix,
  params: HaarParams,
  scaleX: number,
  scaleY: number,
): { x: number; y: number; width: number; height: number }[] {
  const w = gray.cols;
  const h = gray.rows;

  // Downsample
  const maxDim = 160;
  const scale = Math.min(maxDim / w, maxDim / h, 1);
  const dw = (w * scale) | 0;
  const dh = (h * scale) | 0;

  const sm = ensureSmall(dw, dh);
  resample(gray, sm, dw, dh);

  // Optional equalization
  if (params.equalize !== false) {
    const eqDst = new Matrix(dw, dh, U8C1);
    equalizeHistogram(sm, eqDst);
    eqDst.copyTo(sm);
  }

  // Integral images
  const sz = (dw + 1) * (dh + 1);
  if (!iiSum || iiSum.length < sz) {
    iiSum = new Int32Array(sz);
    iiSqSum = new Int32Array(sz);
    iiTilted = new Int32Array(sz);
  }

  computeIntegralImage(sm, iiSum, iiSqSum!, iiTilted!);

  const rects = haarDetectMultiScale(
    iiSum,
    iiSqSum!,
    iiTilted!,
    null,
    dw,
    dh,
    frontalface,
    params.scaleFactor ?? 1.2,
  );
  const grouped = groupRectangles(rects, params.minNeighbors ?? 1);

  // Scale rects back to original coordinates, incorporating scaleX/scaleY
  const invScale = 1 / scale;
  return grouped.map((r) => ({
    x: r.x * invScale * scaleX,
    y: r.y * invScale * scaleY,
    width: r.width * invScale * scaleX,
    height: r.height * invScale * scaleY,
  }));
}

// ---------------------------------------------------------------------------
// BBF detection
// ---------------------------------------------------------------------------

interface BbfParams {
  interval?: number;
}

function detectBbf(
  gray: Matrix,
  params: BbfParams,
  scaleX: number,
  scaleY: number,
): { x: number; y: number; width: number; height: number }[] {
  if (!bbfPrepared) {
    bbfPrepareCascade(bbfFace);
    bbfPrepared = true;
  }

  const w = gray.cols;
  const h = gray.rows;

  // Downsample
  const maxDim = 160;
  const scale = Math.min(maxDim / w, maxDim / h, 1);
  const dw = (w * scale) | 0;
  const dh = (h * scale) | 0;

  const sm = ensureSmall(dw, dh);
  resample(gray, sm, dw, dh);

  const interval = params.interval ?? 4;
  const pyr = bbfBuildPyramid(sm, 24, 24, interval);
  const rects = bbfDetect(pyr, bbfFace);
  const grouped = bbfGroupRectangles(rects, 1);

  const invScale = 1 / scale;
  return grouped.map((r) => ({
    x: r.x * invScale * scaleX,
    y: r.y * invScale * scaleY,
    width: r.width * invScale * scaleX,
    height: r.height * invScale * scaleY,
  }));
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = (
  e: MessageEvent<{
    type: 'haar' | 'bbf';
    data: Uint8Array;
    width: number;
    height: number;
    params: Record<string, unknown>;
    scaleX: number;
    scaleY: number;
  }>,
) => {
  const { type, data, width, height, params, scaleX, scaleY } = e.data;

  // Reconstruct Matrix from raw data
  const gray = new Matrix(width, height, U8C1);
  (gray.data as Uint8Array).set(data);

  let rects: { x: number; y: number; width: number; height: number }[];

  if (type === 'haar') {
    rects = detectHaar(gray, params as HaarParams, scaleX, scaleY);
  } else {
    rects = detectBbf(gray, params as BbfParams, scaleX, scaleY);
  }

  self.postMessage({ rects });
};
