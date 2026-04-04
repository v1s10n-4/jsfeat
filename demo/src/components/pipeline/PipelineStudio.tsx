/**
 * Pipeline Studio -- the main page component that composes webcam, canvas,
 * a sortable pipeline chain, and the stage picker.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { RotateCcw } from 'lucide-react';

import { useWebcam } from '@/hooks/useWebcam';
import { useCanvas } from '@/hooks/useCanvas';
import { useAnimationLoop } from '@/hooks/useAnimationLoop';
import { useProfiler } from '@/hooks/useProfiler';
import { useIsMobile } from '@/hooks/useMediaQuery';
import CanvasView from '@/components/layout/CanvasView';
import StageCard from './StageCard';
import StagePicker from './StagePicker';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { stageRegistry } from '@/lib/stages';
import { createDefaultPipeline, type PipelineStage } from '@/lib/pipeline';
import { Matrix, U8C1 } from 'jsfeat/core';

export default function PipelineStudio() {
  const isMobile = useIsMobile();
  const { videoRef, start, stop, isActive, error } = useWebcam();
  const { canvasRef, dimensions, setResolution, capture, getCtx } = useCanvas();
  const profiler = useProfiler();
  const [frozen, setFrozen] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineStage[]>(createDefaultPipeline);

  // Shared gray matrix, persisted across frames
  const grayRef = useRef<Matrix | null>(null);

  // Start webcam on mount
  useEffect(() => {
    start({ width: dimensions.width, height: dimensions.height });
    return () => stop();
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DnD sensors
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  // -----------------------------------------------------------------------
  // Frame processing
  // -----------------------------------------------------------------------
  const processFrame = useCallback(() => {
    if (frozen) return;
    const ctx = getCtx();
    const video = videoRef.current;
    if (!ctx || !video || video.readyState < 2) return;

    profiler.frameStart();
    const w = dimensions.width;
    const h = dimensions.height;

    // 1. Draw video
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    // 2. Prepare gray matrix
    if (!grayRef.current || grayRef.current.cols !== w || grayRef.current.rows !== h) {
      grayRef.current = new Matrix(w, h, U8C1);
    }
    const gray = grayRef.current;

    // Track whether pixels need to be written back
    let pixelsDirty = false;

    // 3. Run each stage
    for (const stage of pipeline) {
      const def = stageRegistry.get(stage.stageId);
      if (!def) continue;

      profiler.start(def.name);

      // Determine if this stage modifies pixel data vs drawing overlays
      const isOverlay = ['fastCorners', 'yape06', 'haarFace', 'bbfFace'].includes(stage.stageId);
      const isDerivative = ['sobel', 'scharr'].includes(stage.stageId);

      if (isDerivative) {
        // Derivative stages handle putImageData themselves
        if (pixelsDirty) {
          // Write current gray → imageData first
          writeGrayToImageData(gray, imageData, w, h);
          ctx.putImageData(imageData, 0, 0);
          pixelsDirty = false;
        }
        def.process(ctx, gray, w, h, stage.params, imageData);
      } else if (isOverlay) {
        // Write pending pixel changes before drawing overlays
        if (pixelsDirty) {
          writeGrayToImageData(gray, imageData, w, h);
          ctx.putImageData(imageData, 0, 0);
          pixelsDirty = false;
        }
        def.process(ctx, gray, w, h, stage.params, imageData);
      } else {
        def.process(ctx, gray, w, h, stage.params, imageData);
        // Non-overlay stages that modify gray mark pixels dirty
        if (stage.stageId !== 'grayscale') {
          pixelsDirty = true;
        } else {
          // Grayscale just populates the matrix — need to show it
          pixelsDirty = true;
        }
      }

      profiler.end(def.name);
    }

    // Final write-back if any pixel stage was the last
    if (pixelsDirty) {
      writeGrayToImageData(gray, imageData, w, h);
      ctx.putImageData(imageData, 0, 0);
    }

    profiler.frameEnd();
  }, [frozen, getCtx, videoRef, dimensions, pipeline, profiler]);

  useAnimationLoop(processFrame, isActive);

  // -----------------------------------------------------------------------
  // Pipeline mutation helpers
  // -----------------------------------------------------------------------
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPipeline((prev) => {
        const oldIdx = prev.findIndex((s) => s.id === active.id);
        const newIdx = prev.findIndex((s) => s.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  function handleAddStage(stageId: string) {
    const def = stageRegistry.get(stageId);
    if (!def) return;
    // Initialize defaults from control definitions
    const params: Record<string, any> = {};
    for (const ctrl of def.controls) {
      if (ctrl.type === 'slider') params[ctrl.key] = ctrl.defaultNum ?? ctrl.min ?? 0;
      if (ctrl.type === 'select') params[ctrl.key] = ctrl.defaultStr ?? '';
      if (ctrl.type === 'checkbox') params[ctrl.key] = ctrl.defaultBool ?? false;
    }
    def.init?.();
    setPipeline((prev) => [
      ...prev,
      { id: crypto.randomUUID(), stageId, params },
    ]);
  }

  function handleDeleteStage(instanceId: string) {
    setPipeline((prev) => prev.filter((s) => s.id !== instanceId));
  }

  function handleParamChange(instanceId: string, key: string, value: any) {
    setPipeline((prev) =>
      prev.map((s) =>
        s.id === instanceId ? { ...s, params: { ...s.params, [key]: value } } : s,
      ),
    );
  }

  function handleReset() {
    setPipeline(createDefaultPipeline());
  }

  function handleResolutionChange(w: number, h: number) {
    setResolution(w, h);
    stop();
    start({ width: w, height: h });
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Pipeline Studio</h1>
        <p className="text-sm text-muted-foreground">
          Build real-time computer vision pipelines. Default: Trading Card Detection.
        </p>
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
        </div>

        {/* Pipeline panel */}
        <div
          className={
            isMobile
              ? 'flex flex-col gap-2'
              : 'w-80 shrink-0 flex flex-col gap-2'
          }
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pipeline</h2>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                data-testid="reset-pipeline-btn"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
              <StagePicker onAdd={handleAddStage} />
            </div>
          </div>

          <ScrollArea className={isMobile ? 'max-h-[50vh]' : 'max-h-[calc(100vh-16rem)]'}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={pipeline.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2 pr-2">
                  {pipeline.map((stage) => {
                    const def = stageRegistry.get(stage.stageId);
                    if (!def) return null;
                    return (
                      <StageCard
                        key={stage.id}
                        instanceId={stage.id}
                        definition={def}
                        params={stage.params}
                        onParamChange={(key, value) =>
                          handleParamChange(stage.id, key, value)
                        }
                        onDelete={() => handleDeleteStage(stage.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {pipeline.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No stages. Click "Add Stage" to begin.
              </p>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a grayscale Matrix back into an RGBA ImageData. */
function writeGrayToImageData(
  gray: Matrix,
  imageData: ImageData,
  w: number,
  h: number,
) {
  const src = gray.data;
  const dst = imageData.data;
  const gw = gray.cols;
  const gh = gray.rows;
  const sw = Math.min(w, gw);
  const sh = Math.min(h, gh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const v = src[y * gw + x];
      const di = (y * w + x) * 4;
      dst[di] = v;
      dst[di + 1] = v;
      dst[di + 2] = v;
      dst[di + 3] = 255;
    }
  }
}
