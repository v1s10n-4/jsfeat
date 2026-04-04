import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale, equalizeHistogram, computeIntegralImage } from 'jsfeat/imgproc';
import { haarDetectMultiScale, groupRectangles } from 'jsfeat/detect';
import { frontalface } from 'jsfeat/cascades';

let gray: Matrix | null = null;
let intSum: Int32Array | null = null;
let intSqsum: Int32Array | null = null;
let intTilted: Int32Array | null = null;

/**
 * HAAR face detection with bounding boxes using frontalface cascade.
 */
export function setup(
  canvas: HTMLCanvasElement,
  _video: HTMLVideoElement,
  _ctx: CanvasRenderingContext2D,
): void {
  const w = canvas.width;
  const h = canvas.height;
  gray = new Matrix(w, h, U8C1);
  // Integral images are (w+1)*(h+1)
  const integralSize = (w + 1) * (h + 1);
  intSum = new Int32Array(integralSize);
  intSqsum = new Int32Array(integralSize);
  intTilted = new Int32Array(integralSize);
}

export function process(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
): void {
  if (!gray || !intSum || !intSqsum || !intTilted) return;

  ctx.drawImage(video, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
  equalizeHistogram(gray, gray);
  computeIntegralImage(gray, intSum, intSqsum, intTilted);

  const rects = haarDetectMultiScale(
    intSum,
    intSqsum,
    intTilted,
    null,
    w + 1,
    h + 1,
    frontalface,
    1.2,
    2.0,
  );

  const grouped = groupRectangles(rects, 1);

  // Draw video frame then overlay bounding boxes
  ctx.putImageData(imageData, 0, 0);

  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  for (const r of grouped) {
    ctx.strokeRect(r.x, r.y, r.width, r.height);
  }
}

export function cleanup(): void {
  gray = null;
  intSum = null;
  intSqsum = null;
  intTilted = null;
}
