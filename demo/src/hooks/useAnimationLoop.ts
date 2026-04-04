import { useRef, useEffect } from 'react';

export function useAnimationLoop(callback: () => void, active: boolean) {
  const callbackRef = useRef(callback);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!active) return;

    function loop() {
      callbackRef.current();
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [active]);
}
