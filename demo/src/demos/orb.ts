import { Matrix, U8C1, Keypoint, ColorCode } from 'jsfeat/core';
import { grayscale, gaussianBlur } from 'jsfeat/imgproc';
import { fastCorners } from 'jsfeat/features';
import { orbDescribe } from 'jsfeat/features';

const MAX_CORNERS = 1000;
let gray: Matrix | null = null;
let corners: Keypoint[] = [];
let descriptors: Matrix | null = null;

/**
 * ORB feature visualization: detect FAST corners, compute ORB descriptors,
 * draw keypoints with orientation indicators.
 */
export function setup(
  canvas: HTMLCanvasElement,
  _video: HTMLVideoElement,
  _ctx: CanvasRenderingContext2D,
): void {
  const w = canvas.width;
  const h = canvas.height;
  gray = new Matrix(w, h, U8C1);
  corners = Array.from({ length: MAX_CORNERS }, () => new Keypoint());
  // 32 bytes per descriptor
  descriptors = new Matrix(32, MAX_CORNERS, U8C1);
}

export function process(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
): void {
  if (!gray || !descriptors) return;

  ctx.drawImage(video, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
  gaussianBlur(gray, gray, 3, 0);

  const count = fastCorners(gray, corners, 20);
  const usable = Math.min(count, MAX_CORNERS);

  // Compute ORB descriptors (also computes orientation)
  if (usable > 0) {
    orbDescribe(gray, corners, usable, descriptors);
  }

  // Draw video frame
  ctx.putImageData(imageData, 0, 0);

  // Draw keypoints with orientation
  for (let i = 0; i < usable; i++) {
    const kp = corners[i];

    // Color based on descriptor byte as a visual indicator
    const descByte = descriptors.data[i * 32] || 0;
    const hue = (descByte * 1.4) % 360;
    ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
    ctx.lineWidth = 1.5;

    // Draw circle at keypoint
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2);
    ctx.stroke();

    // Draw orientation line if angle is computed
    if (kp.angle >= 0) {
      const len = 10;
      const ex = kp.x + len * Math.cos(kp.angle);
      const ey = kp.y + len * Math.sin(kp.angle);
      ctx.beginPath();
      ctx.moveTo(kp.x, kp.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  // Display feature count
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText(`Features: ${usable}`, 10, h - 10);
}

export function cleanup(): void {
  gray = null;
  corners = [];
  descriptors = null;
}
