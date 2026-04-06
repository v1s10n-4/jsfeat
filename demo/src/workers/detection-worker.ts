import { detectCard } from '../lib/detect-card';
import { computeAccuracy } from '../lib/test-manifest';
import type { GroundTruth } from '../lib/test-manifest';

interface WorkerInput {
  imagePath: string;
  params: Record<string, number>;
  scale: number;
  groundTruth: GroundTruth | null;
  accuracyThreshold: number;
}

interface WorkerOutput {
  imagePath: string;
  detected: boolean;
  corners: { x: number; y: number }[] | null;
  verdict: 'pass' | 'fail' | 'untested';
  accuracy: { meanDist: number; maxDist: number } | null;
  debugInfo: string;
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { imagePath, params, scale, groundTruth, accuracyThreshold } = e.data;

  try {
    const response = await fetch(imagePath);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const procW = Math.round(bitmap.width * scale);
    const procH = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(procW, procH);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, procW, procH);
    bitmap.close();

    const imageData = ctx.getImageData(0, 0, procW, procH);
    const result = detectCard(imageData.data, procW, procH, params);

    let verdict: 'pass' | 'fail' | 'untested' = 'untested';
    let accuracy: { meanDist: number; maxDist: number } | null = null;
    if (groundTruth && result.corners && result.corners.length === 4) {
      const acc = computeAccuracy(result.corners, groundTruth, scale);
      accuracy = { meanDist: acc.meanDist, maxDist: acc.maxDist };
      verdict = acc.meanDist <= accuracyThreshold ? 'pass' : 'fail';
    } else if (groundTruth) {
      verdict = 'fail';
    }

    self.postMessage({
      imagePath, detected: result.detected, corners: result.corners,
      verdict, accuracy, debugInfo: result.debugInfo,
    } satisfies WorkerOutput);
  } catch (err) {
    self.postMessage({
      imagePath, detected: false, corners: null,
      verdict: 'fail' as const, accuracy: null,
      debugInfo: `Worker error: ${err}`,
    } satisfies WorkerOutput);
  }
};
