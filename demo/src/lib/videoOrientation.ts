/**
 * iOS video stream orientation correction.
 *
 * iOS captures video in the native sensor orientation and embeds rotation
 * metadata separately. When the phone is tilted (e.g., pointing at a table),
 * iOS updates the reported orientation — but CV pipelines process raw pixels
 * without respecting that metadata, causing the image to appear rotated.
 *
 * This module listens to `deviceorientation` events and provides a correction
 * angle to counter-rotate the canvas before drawing the video frame.
 */

let correctionAngle = 0;
let listening = false;

function handleOrientation(e: DeviceOrientationEvent) {
  const gamma = e.gamma ?? 0; // left/right tilt (-90 to 90)
  const beta = e.beta ?? 0; // front/back tilt (-180 to 180)

  if (Math.abs(gamma) > 45) {
    correctionAngle = gamma > 0 ? -90 : 90;
  } else if (beta < -45) {
    correctionAngle = 180;
  } else {
    correctionAngle = 0;
  }
}

/** Start listening to device orientation changes. Call once on app init. */
export function startOrientationTracking(): void {
  if (listening) return;
  if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
    window.addEventListener('deviceorientation', handleOrientation);
    listening = true;
  }
}

/** Stop listening. */
export function stopOrientationTracking(): void {
  if (!listening) return;
  window.removeEventListener('deviceorientation', handleOrientation);
  listening = false;
  correctionAngle = 0;
}

/** Get current correction angle in degrees (0, 90, -90, or 180). */
export function getCorrectionAngle(): number {
  return correctionAngle;
}

/**
 * Draw a video frame to canvas with iOS orientation correction applied.
 * Use this instead of `ctx.drawImage(video, 0, 0, w, h)` everywhere.
 */
export function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
): void {
  const angle = correctionAngle;

  if (angle === 0) {
    // No correction needed — fast path
    ctx.drawImage(video, 0, 0, w, h);
    return;
  }

  // Apply counter-rotation around canvas center
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((angle * Math.PI) / 180);

  // For 90/-90 degree rotation, swap dimensions
  if (Math.abs(angle) === 90) {
    ctx.drawImage(video, -h / 2, -w / 2, h, w);
  } else {
    ctx.drawImage(video, -w / 2, -h / 2, w, h);
  }

  ctx.restore();
}

/**
 * Try to lock screen orientation to prevent the layout itself from spinning.
 * Fails silently if not supported (desktop browsers, older iOS).
 */
export function lockOrientation(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orientation = screen.orientation as any;
    orientation?.lock?.('portrait-primary')?.catch?.(() => {});
  } catch {
    // Not supported
  }
}
