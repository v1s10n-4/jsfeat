import { useState, useCallback, useRef } from 'react';
import DebugCanvas, { type DetectionMetrics } from '@/components/dev/DebugCanvas';
import PipelineStages from '@/components/dev/PipelineStages';
import DetectionPanel, { DEFAULT_PARAMS } from '@/components/dev/DetectionPanel';
import TestImageStrip, { type Verdict } from '@/components/dev/TestImageStrip';
import { testImages } from '@/lib/test-manifest';
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
  const [metrics, setMetrics] = useState<DetectionMetrics | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>(loadVerdicts);
  const [notes, setNotes] = useState<string>(loadNotes);
  const [batchRunning, setBatchRunning] = useState(false);

  // Latest metrics ref used by handleRunAll without stale closure issues
  const latestMetricsRef = useRef<DetectionMetrics | null>(null);

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
    latestMetricsRef.current = m;
    setMetrics(m);
    setRenderTick((t) => t + 1);
  }, []);

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
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-3 p-4 h-[calc(100vh-48px)] overflow-hidden">
      {/* Hidden video element for webcam */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Detection Debug Workbench</h1>

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
        <div className="flex-[3] min-w-0 overflow-hidden">
          <DebugCanvas
            imageSrc={isWebcam ? null : selectedImage}
            videoRef={videoRef}
            isWebcam={isWebcam}
            frozen={frozen}
            params={params}
            onMetricsUpdate={handleMetricsUpdate}
          />
        </div>

        {/* Sidebar — flex-[2], no scroll */}
        <div className="flex-[2] min-w-0 flex flex-col gap-3 overflow-hidden">
          <PipelineStages renderTick={renderTick} />
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

      {/* Bottom: TestImageStrip — fixed height, no grow */}
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
