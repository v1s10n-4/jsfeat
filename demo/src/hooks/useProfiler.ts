import { useRef, useState, useCallback } from 'react';

interface ProfilerStage {
  name: string;
  ms: number;
}

interface ProfilerDisplay {
  stages: ProfilerStage[];
  totalMs: number;
  fps: number;
}

export function useProfiler() {
  const [display, setDisplay] = useState<ProfilerDisplay>({
    stages: [],
    totalMs: 0,
    fps: 0,
  });

  const stagesRef = useRef<Map<string, number>>(new Map());
  const currentStagesRef = useRef<ProfilerStage[]>([]);
  const frameStartRef = useRef(0);
  const lastDisplayUpdateRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsWindowStartRef = useRef(performance.now());
  const currentFpsRef = useRef(0);

  const frameStart = useCallback(() => {
    frameStartRef.current = performance.now();
    currentStagesRef.current = [];
  }, []);

  const start = useCallback((name: string) => {
    stagesRef.current.set(name, performance.now());
  }, []);

  const end = useCallback((name: string) => {
    const startTime = stagesRef.current.get(name);
    if (startTime !== undefined) {
      currentStagesRef.current.push({
        name,
        ms: performance.now() - startTime,
      });
      stagesRef.current.delete(name);
    }
  }, []);

  const frameEnd = useCallback(() => {
    const now = performance.now();
    const totalMs = now - frameStartRef.current;

    frameCountRef.current++;
    const fpsElapsed = now - fpsWindowStartRef.current;
    if (fpsElapsed >= 1000) {
      currentFpsRef.current = Math.round(
        (frameCountRef.current * 1000) / fpsElapsed
      );
      frameCountRef.current = 0;
      fpsWindowStartRef.current = now;
    }

    if (now - lastDisplayUpdateRef.current >= 200) {
      lastDisplayUpdateRef.current = now;
      setDisplay({
        stages: [...currentStagesRef.current],
        totalMs,
        fps: currentFpsRef.current,
      });
    }
  }, []);

  return { frameStart, start, end, frameEnd, display };
}
