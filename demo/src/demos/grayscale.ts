import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';

let gray: Matrix | null = null;

/**
 * Real-time webcam grayscale conversion.
 */
export function setup(
  canvas: HTMLCanvasElement,
  _video: HTMLVideoElement,
  _ctx: CanvasRenderingContext2D,
): void {
  gray = new Matrix(canvas.width, canvas.height, U8C1);
}

export function process(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
): void {
  if (!gray) return;

  ctx.drawImage(video, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);

  // Write grayscale back to RGBA imageData
  const src = gray.data;
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
}
