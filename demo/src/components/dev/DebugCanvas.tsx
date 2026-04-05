/**
 * DebugCanvas — dev-only component for the Detection Debug Workbench (Task 4).
 *
 * Renders the card detection pipeline on a canvas and draws toggleable overlays
 * (Canny edges in red, morph blob in yellow) on a stacked overlay canvas.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { cardDetectionDemo, getCardDebugBuffers } from '@/lib/demos';
import { useProfiler } from '@/hooks/useProfiler';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface DetectionMetrics {
  detected: boolean;
  debugInfo: string;
  rectFill: number;
  aspect: number;
  meanBrightness: number;
  morphThreshold: number;
  qualityScore: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DebugCanvasProps {
  /** Static image URL, or null when using webcam. */
  imageSrc: string | null;
  /** Ref to a live webcam video element. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Whether webcam mode is active. */
  isWebcam: boolean;
  /** When true, freeze frame processing. */
  frozen: boolean;
  /** Detection pipeline parameter overrides. */
  params: Record<string, unknown>;
  /** Called each processed frame with updated metrics. */
  onMetricsUpdate?: (metrics: DetectionMetrics) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute mean brightness from a Uint8Array grayscale buffer. */
function meanBrightness(data: Uint8Array, size: number): number {
  if (size === 0) return 0;
  let sum = 0;
  for (let i = 0; i < size; i++) sum += data[i];
  return sum / size;
}

/**
 * Render a grayscale buffer as a color tinted overlay into an ImageData.
 * Pixels with value > 0 are painted with the given [r, g, b] color at the
 * specified opacity.
 */
function paintOverlay(
  src: Uint8Array,
  dest: Uint8Array,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
) {
  const size = w * h;
  for (let i = 0; i < size; i++) {
    const o = i * 4;
    if (src[i] > 0) {
      dest[o] = r;
      dest[o + 1] = g;
      dest[o + 2] = b;
      dest[o + 3] = alpha;
    } else {
      dest[o] = 0;
      dest[o + 1] = 0;
      dest[o + 2] = 0;
      dest[o + 3] = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DebugCanvas({
  imageSrc,
  videoRef,
  isWebcam,
  frozen,
  params,
  onMetricsUpdate,
}: DebugCanvasProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Overlay toggles
  const [showCanny, setShowCanny] = useState(true);
  const [showMorph, setShowMorph] = useState(true);

  // RAF handle for cleanup
  const rafRef = useRef<number>(0);

  // Dummy video element for static-image mode
  const dummyVideoRef = useRef<HTMLVideoElement | null>(null);

  // Track whether setup has been called for the current canvas/video pair
  const setupDoneRef = useRef(false);

  const profiler = useProfiler();

  // Expose refs via stable callbacks so the animation loop can read them
  const showCannyRef = useRef(showCanny);
  const showMorphRef = useRef(showMorph);
  useEffect(() => { showCannyRef.current = showCanny; }, [showCanny]);
  useEffect(() => { showMorphRef.current = showMorph; }, [showMorph]);

  // ---------------------------------------------------------------------------
  // Load static image → draw to base canvas and run once
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isWebcam || !imageSrc) return;

    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas) {
        overlayCanvas.width = img.naturalWidth;
        overlayCanvas.height = img.naturalHeight;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Ensure dummy video exists
      if (!dummyVideoRef.current) {
        dummyVideoRef.current = document.createElement('video');
      }
      const dummy = dummyVideoRef.current;

      cardDetectionDemo.setup(canvas, dummy, params);
      setupDoneRef.current = true;

      ctx.drawImage(img, 0, 0);

      profiler.frameStart();
      cardDetectionDemo.process(ctx, dummy, img.naturalWidth, img.naturalHeight, profiler);
      profiler.frameEnd();

      drawOverlays(img.naturalWidth, img.naturalHeight);
      reportMetrics(img.naturalWidth * img.naturalHeight);
    };
    img.src = imageSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, isWebcam]);

  // ---------------------------------------------------------------------------
  // Notify demo of param changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    for (const [key, value] of Object.entries(params)) {
      cardDetectionDemo.onParamChange?.(key, value);
    }
  }, [params]);

  // ---------------------------------------------------------------------------
  // Webcam: setup once then drive via RAF
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isWebcam) return;

    const canvas = baseCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Use a sensible default resolution; the canvas will follow the video's
    // intrinsic dimensions once it starts playing.
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;

    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      overlayCanvas.width = w;
      overlayCanvas.height = h;
    }

    cardDetectionDemo.setup(canvas, video, params);
    setupDoneRef.current = true;

    function loop() {
      const v = videoRef.current;
      const c = baseCanvasRef.current;
      if (!v || !c || frozen) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Resize canvas if video dimensions changed (e.g. after stream starts)
      if (v.videoWidth > 0 && (c.width !== v.videoWidth || c.height !== v.videoHeight)) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const oc = overlayCanvasRef.current;
        if (oc) { oc.width = v.videoWidth; oc.height = v.videoHeight; }
      }

      if (v.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      profiler.frameStart();
      cardDetectionDemo.process(ctx, v, c.width, c.height, profiler);
      profiler.frameEnd();

      drawOverlays(c.width, c.height);
      reportMetrics(c.width * c.height);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      cardDetectionDemo.cleanup();
      setupDoneRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWebcam, videoRef]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (setupDoneRef.current) {
        cardDetectionDemo.cleanup();
        setupDoneRef.current = false;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Overlay renderer (reads debug buffers, paints onto overlay canvas)
  // ---------------------------------------------------------------------------
  const drawOverlays = useCallback((w: number, h: number) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const octx = overlayCanvas.getContext('2d');
    if (!octx) return;

    octx.clearRect(0, 0, w, h);

    const bufs = getCardDebugBuffers();
    const imgData = octx.createImageData(w, h);
    const dest = new Uint8Array(imgData.data.buffer);

    // Start with a transparent buffer
    dest.fill(0);

    // Canny edges overlay (red) — sourced from bufs.gray which the pipeline
    // overwrites with the original Canny output before morphological close.
    if (showCannyRef.current && bufs.gray?.data && bufs.gray.data.length >= w * h) {
      paintOverlay(bufs.gray.data as Uint8Array, dest, w, h, 220, 30, 30, 180);
    }

    // Morph blob overlay (yellow) — sourced from bufs.edges (post-morph binary)
    if (showMorphRef.current && bufs.edges?.data && bufs.edges.data.length >= w * h) {
      // Yellow overwrites red where both are active — intentional (morph is on top)
      paintOverlay(bufs.edges.data as Uint8Array, dest, w, h, 220, 200, 0, 160);
    }

    octx.putImageData(imgData, 0, 0);
  }, []);

  // ---------------------------------------------------------------------------
  // Metrics reporter
  // ---------------------------------------------------------------------------
  const reportMetrics = useCallback((pixelCount: number) => {
    if (!onMetricsUpdate) return;

    const bufs = getCardDebugBuffers();

    const bData = bufs.gray?.data as Uint8Array | undefined;
    const brightness = bData ? meanBrightness(bData, pixelCount) : 0;

    onMetricsUpdate({
      detected: Boolean(bufs.debugInfo && bufs.debugInfo.length > 0),
      debugInfo: bufs.debugInfo ?? '',
      rectFill: bufs.lastRectFill ?? 0,
      aspect: bufs.lastAspect ?? 0,
      meanBrightness: brightness,
      morphThreshold: bufs.prevThreshold ?? 0,
      qualityScore: bufs.qualityHistory?.length
        ? (bufs.qualityHistory[bufs.qualityHistory.length - 1] ?? 0)
        : 0,
    });
  }, [onMetricsUpdate]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const { display } = profiler;

  return (
    <div className="flex flex-col gap-3">
      {/* Overlay toggles */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-canny"
            checked={showCanny}
            onCheckedChange={setShowCanny}
          />
          <Label htmlFor="toggle-canny" className="text-xs text-red-400">
            Canny edges
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-morph"
            checked={showMorph}
            onCheckedChange={setShowMorph}
          />
          <Label htmlFor="toggle-morph" className="text-xs text-yellow-400">
            Morph blob
          </Label>
        </div>
      </div>

      {/* Stacked canvases — constrained height to fit viewport */}
      <div className="relative inline-block max-h-[60vh] overflow-hidden">
        {/* Base canvas: pipeline draws here */}
        <canvas
          ref={baseCanvasRef}
          className="block max-w-full max-h-[60vh]"
          style={{ display: 'block', objectFit: 'contain' }}
        />
        {/* Overlay canvas: debug colors drawn here, positioned on top */}
        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 max-w-full max-h-[60vh]"
          style={{ position: 'absolute', top: 0, left: 0, objectFit: 'contain' }}
        />
      </div>

      {/* Profiler stats */}
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
        <div className="mb-1 flex gap-4">
          <span>
            fps: <span className="text-foreground">{display.fps}</span>
          </span>
          <span>
            total: <span className="text-foreground">{display.totalMs.toFixed(1)} ms</span>
          </span>
        </div>
        {display.stages.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {display.stages.map((s) => (
              <span key={s.name}>
                {s.name}:{' '}
                <span className="text-foreground">{s.ms.toFixed(1)} ms</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
