import { useState, useCallback, useRef, useEffect } from 'react';
import DebugCanvas, { type DetectionMetrics, type CornerTuple } from '@/components/dev/DebugCanvas';
import PipelineStages from '@/components/dev/PipelineStages';
import DetectionPanel, { DEFAULT_PARAMS } from '@/components/dev/DetectionPanel';
import TestImageStrip, { type Verdict } from '@/components/dev/TestImageStrip';
import { testImages, computeAccuracy } from '@/lib/test-manifest';
import type { GroundTruth } from '@/lib/test-manifest';
import { cardDetectionDemo, getCardDebugBuffers, resetCardTemporalState } from '@/lib/demos';
import { useWebcam } from '@/hooks/useWebcam';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const LS_VERDICTS = 'detection-debug-verdicts';
const LS_NOTES = 'detection-debug-notes';

function loadVerdicts(): Record<string, Verdict> {
  try {
    const raw = localStorage.getItem(LS_VERDICTS);
    if (raw) return JSON.parse(raw) as Record<string, Verdict>;
  } catch {
    // ignore
  }
  return {};
}

function saveVerdicts(v: Record<string, Verdict>) {
  try {
    localStorage.setItem(LS_VERDICTS, JSON.stringify(v));
  } catch {
    // ignore
  }
}

function loadNotes(): string {
  try {
    return localStorage.getItem(LS_NOTES) ?? '';
  } catch {
    return '';
  }
}

function saveNotes(n: string) {
  try {
    localStorage.setItem(LS_NOTES, n);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DevPage() {
  const [isWebcam, setIsWebcam] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(
    testImages[0]?.path ?? null,
  );
  const [frozen, setFrozen] = useState(false);
  const [params, setParams] = useState<Record<string, number>>({ ...DEFAULT_PARAMS });
  const [scale, setScale] = useState(1);
  const [metrics, setMetrics] = useState<DetectionMetrics | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>(loadVerdicts);
  const [batchRunning, setBatchRunning] = useState(false);
  const [accuracyThreshold, setAccuracyThreshold] = useState(50); // pixels
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationEdits, setAnnotationEdits] = useState<Record<string, CornerTuple>>({});
  const [exportToast, setExportToast] = useState(false);

  // Latest metrics ref used by handleRunAll without stale closure issues
  const latestMetricsRef = useRef<DetectionMetrics | null>(null);

  // Promise resolver for onProcessingComplete (batch Run All)
  const processingResolveRef = useRef<(() => void) | null>(null);

  // Ground truth for selected image — annotation edits take priority
  const manifestGroundTruth: GroundTruth | null = selectedImage
    ? (testImages.find((img) => img.path === selectedImage)?.groundTruth ?? null)
    : null;
  const currentGroundTruth: GroundTruth | null = selectedImage && annotationEdits[selectedImage]
    ? { corners: annotationEdits[selectedImage] }
    : manifestGroundTruth;
  const currentGroundTruthRef = useRef(currentGroundTruth);
  useEffect(() => { currentGroundTruthRef.current = currentGroundTruth; }, [currentGroundTruth]);

  const { videoRef, start, stop, isActive } = useWebcam();

  // -------------------------------------------------------------------------
  // Webcam toggle
  // -------------------------------------------------------------------------
  const handleWebcamToggle = useCallback(
    async (checked: boolean) => {
      setIsWebcam(checked);
      if (checked) {
        setSelectedImage(null);
        await start({ width: 640, height: 480 });
      } else {
        stop();
        setSelectedImage(testImages[0]?.path ?? null);
      }
    },
    [start, stop],
  );

  // -------------------------------------------------------------------------
  // Param change
  // -------------------------------------------------------------------------
  const handleParamChange = useCallback((key: string, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    cardDetectionDemo.onParamChange?.(key, value);
  }, []);

  // -------------------------------------------------------------------------
  // Reset params
  // -------------------------------------------------------------------------
  const handleResetParams = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS });
    for (const [key, value] of Object.entries(DEFAULT_PARAMS)) {
      cardDetectionDemo.onParamChange?.(key, value);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Metrics update — also bumps renderTick so PipelineStages refreshes
  // -------------------------------------------------------------------------
  const handleMetricsUpdate = useCallback((m: DetectionMetrics) => {
    const gt = currentGroundTruthRef.current;
    if (m.corners && m.corners.length === 4 && gt) {
      m.accuracy = computeAccuracy(m.corners, gt, scale);
    }
    latestMetricsRef.current = m;
    setMetrics(m);
    setRenderTick((t) => t + 1);
  }, [scale]);

  // -------------------------------------------------------------------------
  // Verdict + notes
  // -------------------------------------------------------------------------
  const selectedVerdict: Verdict =
    selectedImage ? (verdicts[selectedImage] ?? 'untested') : 'untested';


  // -------------------------------------------------------------------------
  // Annotation update
  // -------------------------------------------------------------------------
  const handleAnnotationUpdate = useCallback(
    (corners: CornerTuple) => {
      if (!selectedImage) return;
      setAnnotationEdits((prev) => ({ ...prev, [selectedImage]: corners }));
    },
    [selectedImage],
  );

  const handleExportAnnotations = useCallback(async () => {
    const output: Record<string, { corners: CornerTuple }> = {};
    for (const [path, corners] of Object.entries(annotationEdits)) {
      output[path] = { corners };
    }
    const json = JSON.stringify(output, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setExportToast(true);
      setTimeout(() => setExportToast(false), 2000);
    } catch {
      // Fallback: prompt-style alert
      window.alert('Copied annotation JSON — paste into manifest.\n\n' + json);
    }
  }, [annotationEdits]);

  // -------------------------------------------------------------------------
  // Image selection
  // -------------------------------------------------------------------------
  const handleSelectImage = useCallback((path: string) => {
    setSelectedImage(path);
  }, []);

  // -------------------------------------------------------------------------
  // Keyboard navigation: arrow keys cycle test images
  // -------------------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isWebcam) return;
      const idx = testImages.findIndex((img) => img.path === selectedImage);
      if (idx === -1) return;
      if (e.key === 'ArrowRight' && idx < testImages.length - 1) {
        e.preventDefault();
        setSelectedImage(testImages[idx + 1].path);
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        setSelectedImage(testImages[idx - 1].path);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, isWebcam]);

  // -------------------------------------------------------------------------
  // Processing complete callback (for promise-based Run All)
  // -------------------------------------------------------------------------
  const handleProcessingComplete = useCallback(() => {
    processingResolveRef.current?.();
    processingResolveRef.current = null;
  }, []);

  function waitForProcessing(): Promise<void> {
    return new Promise((resolve) => {
      processingResolveRef.current = resolve;
      // Fallback timeout in case the callback never fires
      setTimeout(() => { resolve(); processingResolveRef.current = null; }, 2000);
    });
  }

  // -------------------------------------------------------------------------
  // Run all — accuracy-based pass/fail using ground truth
  // -------------------------------------------------------------------------
  const handleRunAll = useCallback(async () => {
    if (batchRunning) return;
    setBatchRunning(true);

    const nextVerdicts = { ...verdicts };
    // Create offscreen canvas for direct processing (bypasses React rendering)
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true })!;
    const dummyVideo = document.createElement('video');
    const profilerStub = { start: () => {}, end: () => {}, frameStart: () => {}, frameEnd: () => {} };

    for (const img of testImages) {
      if (!img.groundTruth) {
        nextVerdicts[img.path] = 'untested';
        continue;
      }

      // Load image directly
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = img.path;
      });

      const s = scale;
      const cw = Math.round(image.naturalWidth * s);
      const ch = Math.round(image.naturalHeight * s);
      offCanvas.width = cw;
      offCanvas.height = ch;

      // Reset state, setup, draw, process
      resetCardTemporalState();
      cardDetectionDemo.setup(offCanvas, dummyVideo, params);
      offCtx.drawImage(image, 0, 0, cw, ch);
      cardDetectionDemo.process(offCtx, dummyVideo, cw, ch, profilerStub as any);

      // Read results directly from buffers
      const bufs = getCardDebugBuffers();
      const corners = bufs.smoothedCorners;

      if (!corners || corners.length < 4) {
        nextVerdicts[img.path] = 'fail';
      } else {
        const acc = computeAccuracy(corners, img.groundTruth, s);
        nextVerdicts[img.path] = acc.meanDist <= accuracyThreshold ? 'pass' : 'fail';
      }

      // Update display to show progress
      setSelectedImage(img.path);
    }

    cardDetectionDemo.cleanup();
    setVerdicts(nextVerdicts);
    saveVerdicts(nextVerdicts);
    setBatchRunning(false);
  }, [batchRunning, verdicts, accuracyThreshold, scale, params]);

  // -------------------------------------------------------------------------
  // Derived canvas dimensions (used for PipelineStages)
  // -------------------------------------------------------------------------
  const canvasWidth = 640;
  const canvasHeight = 480;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-3 p-4 h-[calc(100vh-48px)] overflow-hidden">
      {/* Hidden video element for webcam */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Detection Debug Workbench</h1>

        <select
          className="h-7 rounded border border-border bg-background px-2 text-xs"
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
        >
          <option value={1}>1920x1080</option>
          <option value={0.5}>960x540</option>
          <option value={0.33}>640x360</option>
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="annotate-toggle"
            checked={annotationMode}
            onCheckedChange={setAnnotationMode}
          />
          <Label htmlFor="annotate-toggle" className="text-sm">
            Annotate
          </Label>
        </div>

        {annotationMode && Object.keys(annotationEdits).length > 0 && (
          <div className="relative">
            <Button variant="outline" size="sm" onClick={handleExportAnnotations}>
              Export Annotations ({Object.keys(annotationEdits).length})
            </Button>
            {exportToast && (
              <span className="absolute -bottom-6 left-0 text-xs text-green-400 whitespace-nowrap">
                Copied to clipboard
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Switch
            id="webcam-toggle"
            checked={isWebcam}
            onCheckedChange={handleWebcamToggle}
          />
          <Label htmlFor="webcam-toggle" className="text-sm">
            Webcam
          </Label>
        </div>

        {isActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFrozen((f) => !f)}
          >
            {frozen ? 'Unfreeze' : 'Freeze'}
          </Button>
        )}
      </div>

      {/* Main area: canvas left, sidebar right — fills remaining height */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* DebugCanvas — flex-[3], constrained to available height */}
        <div className="flex-[3] min-w-0 overflow-hidden flex flex-col">
          {/* Current image label */}
          {selectedImage && !isWebcam && (
            <div className="text-xs font-mono text-muted-foreground mb-1 truncate">
              {selectedImage.replace('/test-images/', '')}
            </div>
          )}
          <DebugCanvas
            imageSrc={isWebcam ? null : selectedImage}
            videoRef={videoRef}
            isWebcam={isWebcam}
            frozen={frozen}
            params={params}
            onMetricsUpdate={handleMetricsUpdate}
            onProcessingComplete={handleProcessingComplete}
            scale={scale}
            groundTruth={currentGroundTruth}
            annotationMode={annotationMode}
            onAnnotationUpdate={handleAnnotationUpdate}
          />
        </div>

        {/* Sidebar — flex-[2], scrolls independently */}
        <div className="flex-[2] min-w-0 flex flex-col gap-3 overflow-y-auto">
          <PipelineStages
            width={canvasWidth}
            height={canvasHeight}
            renderTick={renderTick}
          />
          <DetectionPanel
            params={params}
            onParamChange={handleParamChange}
            onResetParams={handleResetParams}
            metrics={metrics}
            verdict={selectedVerdict}
            onRetest={() => {
              if (!selectedImage) return;
              const m = latestMetricsRef.current;
              const gt = currentGroundTruthRef.current;
              if (!gt || !m?.detected || !m.accuracy) {
                const next = { ...verdicts, [selectedImage]: 'fail' as const };
                setVerdicts(next); saveVerdicts(next);
              } else {
                const v = m.accuracy.meanDist <= accuracyThreshold ? 'pass' : 'fail';
                const next = { ...verdicts, [selectedImage]: v as 'pass' | 'fail' };
                setVerdicts(next); saveVerdicts(next);
              }
            }}
          />
        </div>
      </div>

      {/* Bottom: TestImageStrip */}
      <div className="flex-shrink-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-muted-foreground">Pass threshold:</span>
        <input
          type="number"
          className="w-14 h-6 rounded border border-border bg-background px-1 text-xs text-center"
          value={accuracyThreshold}
          onChange={(e) => setAccuracyThreshold(Number(e.target.value) || 50)}
          min={5}
          max={500}
        />
        <span className="text-[10px] text-muted-foreground">px (mean corner distance)</span>
      </div>
      <TestImageStrip
        selectedImage={selectedImage}
        onSelectImage={handleSelectImage}
        verdicts={verdicts}
        onRunAll={handleRunAll}
        running={batchRunning}
      />
      </div>
    </div>
  );
}
