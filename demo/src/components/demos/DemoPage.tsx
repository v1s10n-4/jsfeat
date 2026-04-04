/**
 * Full demo view -- looks up demo by id and runs it with webcam + canvas + profiler.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { useWebcam } from '@/hooks/useWebcam';
import { useCanvas } from '@/hooks/useCanvas';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useProfiler } from '@/hooks/useProfiler';
import { useIsMobile } from '@/hooks/useMediaQuery';
import CanvasView from '@/components/layout/CanvasView';
import ControlsPanel from './ControlsPanel';
import { Button } from '@/components/ui/button';
import { demoRegistry } from '@/lib/demos';

export default function DemoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const demo = id ? demoRegistry.get(id) : undefined;

  const { videoRef, start, stop, isActive, error } = useWebcam();
  const { canvasRef, dimensions, setResolution, capture, getCtx } = useCanvas();
  const profiler = useProfiler();
  const [frozen, setFrozen] = useState(false);

  // Build initial params from control defaults
  const buildDefaultParams = useCallback(() => {
    if (!demo) return {};
    const p: Record<string, any> = {};
    for (const ctrl of demo.controls) {
      if (ctrl.type === 'slider') p[ctrl.key] = ctrl.defaultNum ?? ctrl.min ?? 0;
      if (ctrl.type === 'select') p[ctrl.key] = ctrl.defaultStr ?? '';
      if (ctrl.type === 'checkbox') p[ctrl.key] = ctrl.defaultBool ?? false;
    }
    return p;
  }, [demo]);

  const [params, setParams] = useState<Record<string, any>>(buildDefaultParams);

  // Track current demo id to detect changes
  const prevIdRef = useRef(id);

  // Setup/cleanup on mount and demo change
  useEffect(() => {
    if (!demo) return;

    // If demo changed, rebuild params
    if (prevIdRef.current !== id) {
      const newParams = buildDefaultParams();
      setParams(newParams);
      prevIdRef.current = id;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      demo.setup(canvas, video, params);
    }

    start({ width: dimensions.width, height: dimensions.height });

    return () => {
      demo.cleanup();
      stop();
    };
    // Only re-run when demo id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Frame loop
  const processFrame = useCallback(() => {
    if (frozen || !demo) return;
    const ctx = getCtx();
    const video = videoRef.current;
    if (!ctx || !video || video.readyState < 2) return;

    profiler.frameStart();
    demo.process(ctx, video, dimensions.width, dimensions.height, profiler);
    profiler.frameEnd();
  }, [frozen, demo, getCtx, videoRef, dimensions, profiler]);

  useAnimationLoop(processFrame, isActive);

  // Param change handler
  function handleParamChange(key: string, value: any) {
    setParams((prev) => ({ ...prev, [key]: value }));
    demo?.onParamChange?.(key, value);
  }

  function handleResolutionChange(w: number, h: number) {
    setResolution(w, h);
    stop();
    start({ width: w, height: h });
  }

  // Not found
  if (!demo) {
    return (
      <div className="p-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/demos')}>
          <ArrowLeft className="size-4" />
          Back to Demos
        </Button>
        <p className="mt-4 text-muted-foreground">Demo not found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/demos')}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div>
          <h1 className="text-xl font-bold">{demo.title}</h1>
          <p className="text-sm text-muted-foreground">{demo.description}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div
        className={
          isMobile
            ? 'flex flex-col gap-4'
            : 'flex flex-row gap-6'
        }
      >
        {/* Canvas area */}
        <div className={isMobile ? '' : 'flex-1 min-w-0'}>
          <CanvasView
            canvasRef={canvasRef}
            videoRef={videoRef}
            dimensions={dimensions}
            onResolutionChange={handleResolutionChange}
            onCapture={capture}
            frozen={frozen}
            onFreeze={() => setFrozen((v) => !v)}
            profilerDisplay={profiler.display}
          />
          {isMobile && demo.controls.length > 0 && (
            <div className="mt-3">
              <ControlsPanel
                controls={demo.controls}
                params={params}
                onParamChange={handleParamChange}
              />
            </div>
          )}
        </div>

        {/* Desktop controls */}
        {!isMobile && (
          <ControlsPanel
            controls={demo.controls}
            params={params}
            onParamChange={handleParamChange}
          />
        )}
      </div>
    </div>
  );
}
