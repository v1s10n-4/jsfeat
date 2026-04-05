import { useState, useCallback, useRef, useEffect } from 'react';
import DebugCanvas, { type DetectionMetrics } from '@/components/dev/DebugCanvas';
import PipelineStages from '@/components/dev/PipelineStages';
import DetectionPanel, { DEFAULT_PARAMS } from '@/components/dev/DetectionPanel';
import TestImageStrip, { type Verdict } from '@/components/dev/TestImageStrip';
import { testImages, computeAccuracy } from '@/lib/test-manifest';
import type { GroundTruth } from '@/lib/test-manifest';
import { cardDetectionDemo } from '@/lib/demos';
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
  const [notes, setNotes] = useState<string>(loadNotes);
  const [batchRunning, setBatchRunning] = useState(false);

  // Latest metrics ref used by handleRunAll without stale closure issues
  const latestMetricsRef = useRef<DetectionMetrics | null>(null);

  // Ground truth for selected image
  const currentGroundTruth: GroundTruth | null = selectedImage
    ? (testImages.find((img) => img.path === selectedImage)?.groundTruth ?? null)
    : null;
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

  const handleVerdictChange = useCallback(
    (v: 'pass' | 'fail') => {
      if (!selectedImage) return;
      const next = { ...verdicts, [selectedImage]: v };
      setVerdicts(next);
      saveVerdicts(next);
    },
    [selectedImage, verdicts],
  );

  const handleNotesChange = useCallback((n: string) => {
    setNotes(n);
    saveNotes(n);
  }, []);

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
  // Run all — iterate test images, wait 300 ms each, record pass/fail
  // -------------------------------------------------------------------------
  const handleRunAll = useCallback(async () => {
    if (batchRunning) return;
    setBatchRunning(true);

    const nextVerdicts = { ...verdicts };

    for (const img of testImages) {
      setSelectedImage(img.path);
      // Give DebugCanvas time to process the image and call onMetricsUpdate
      await new Promise<void>((res) => setTimeout(res, 300));

      const m = latestMetricsRef.current;
      nextVerdicts[img.path] = m?.detected ? 'pass' : 'fail';
    }

    setVerdicts(nextVerdicts);
    saveVerdicts(nextVerdicts);
    setBatchRunning(false);
  }, [batchRunning, verdicts]);

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
            scale={scale}
            groundTruth={currentGroundTruth}
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
            onVerdictChange={handleVerdictChange}
            notes={notes}
            onNotesChange={handleNotesChange}
          />
        </div>
      </div>

      {/* Bottom: TestImageStrip */}
      <div className="flex-shrink-0">
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
