import { useRef, useState, useCallback } from 'react';

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });

  const setResolution = useCallback((width: number, height: number) => {
    setDimensions({ width, height });
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
  }, []);

  const capture = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `jsfeat-capture-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const getCtx = useCallback(() => {
    return canvasRef.current?.getContext('2d') ?? null;
  }, []);

  return { canvasRef, dimensions, setResolution, capture, getCtx };
}
