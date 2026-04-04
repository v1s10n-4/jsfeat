import { Matrix, U8C1, Keypoint, ColorCode } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';
import { fastCorners } from 'jsfeat/features';

const MAX_CORNERS = 2000;
let gray: Matrix | null = null;
let corners: Keypoint[] = [];

/**
 * FAST corner detection with drawn circles.
 */
export function setup(
  canvas: HTMLCanvasElement,
  _video: HTMLVideoElement,
  _ctx: CanvasRenderingContext2D,
): void {
  gray = new Matrix(canvas.width, canvas.height, U8C1);
  corners = Array.from({ length: MAX_CORNERS }, () => new Keypoint());
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

  const count = fastCorners(gray, corners, 20);

  // Draw video frame first, then overlay corners
  ctx.putImageData(imageData, 0, 0);

  ctx.fillStyle = '#e94560';
  for (let i = 0; i < count; i++) {
    const kp = corners[i];
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function cleanup(): void {
  gray = null;
  corners = [];
}
