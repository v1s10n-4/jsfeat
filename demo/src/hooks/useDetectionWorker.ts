import { useCallback, useEffect, useRef, useState } from 'react';

export interface DetectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Hook that manages a Web Worker for off-main-thread face detection.
 *
 * - Creates worker on mount, terminates on unmount.
 * - `detect()` posts a message to the worker.
 * - Maintains a `pending` flag to avoid queuing multiple requests.
 * - Returns `rects` state (latest detection results).
 */
export function useDetectionWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(false);
  const [rects, setRects] = useState<DetectionRect[]>([]);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/detection.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent<{ rects: DetectionRect[] }>) => {
      setRects(e.data.rects);
      pendingRef.current = false;
    };

    worker.onerror = () => {
      pendingRef.current = false;
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const detect = useCallback(
    (
      grayData: Uint8Array,
      w: number,
      h: number,
      type: 'haar' | 'bbf',
      params: Record<string, unknown>,
      scaleX: number,
      scaleY: number,
    ) => {
      if (pendingRef.current || !workerRef.current) return;
      pendingRef.current = true;

      workerRef.current.postMessage(
        {
          type,
          data: grayData,
          width: w,
          height: h,
          params,
          scaleX,
          scaleY,
        },
        [grayData.buffer],
      );
    },
    [],
  );

  return { rects, detect, pending: pendingRef };
}
