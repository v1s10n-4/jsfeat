import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale, gaussianBlur, cannyEdges } from 'jsfeat/imgproc';

let gray: Matrix | null = null;
let edges: Matrix | null = null;

/**
 * Live Canny edge detection: gaussian blur then canny.
 */
export function setup(
  canvas: HTMLCanvasElement,
  _video: HTMLVideoElement,
  _ctx: CanvasRenderingContext2D,
): void {
  const w = canvas.width;
  const h = canvas.height;
  gray = new Matrix(w, h, U8C1);
  edges = new Matrix(w, h, U8C1);
}

export function process(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
): void {
  if (!gray || !edges) return;

  ctx.drawImage(video, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
  gaussianBlur(gray, gray, 5, 0);
  cannyEdges(gray, edges, 20, 40);

  // Write edge map back to RGBA
  const src = edges.data;
  const dst = imageData.data;
  for (let i = 0, j = 0; i < dst.length; i += 4, j++) {
    const v = src[j];
    dst[i] = v;
    dst[i + 1] = v;
    dst[i + 2] = v;
    dst[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}

export function cleanup(): void {
  gray = null;
  edges = null;
}
