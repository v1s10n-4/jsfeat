/**
 * DebugCanvas — dev-only component for the Detection Debug Workbench (Task 4).
 *
 * Renders the card detection pipeline on a canvas and draws toggleable overlays
 * (Canny edges in red, morph blob in yellow, contour outlines in cyan) on a
 * stacked overlay canvas.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { cardDetectionDemo, getCardDebugBuffers, setCardPipelineOverlays, resetCardTemporalState } from '@/lib/demos';
import { useProfiler } from '@/hooks/useProfiler';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { GroundTruth } from '@/lib/test-manifest';

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
  corners: { x: number; y: number }[] | null;
  accuracy: { meanDist: number; maxDist: number; perCorner: number[] } | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Four-corner tuple used for annotation callbacks. */
export type CornerTuple = [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
];

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
  /** Called when static image processing completes (for batch Run All). */
  onProcessingComplete?: () => void;
  /** Scale factor for test images (1 = original, 0.5 = half, etc.). */
  scale?: number;
  /** Ground truth corners for the current image (if annotated). */
  groundTruth?: GroundTruth | null;
  /** When true, enable interactive corner annotation mode. */
  annotationMode?: boolean;
  /** Bump to force re-processing the current image. */
  retestTick?: number;
  /** Called whenever annotation corners are updated. */
  onAnnotationUpdate?: (corners: CornerTuple) => void;
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
  onProcessingComplete,
  scale,
  groundTruth,
  annotationMode,
  onAnnotationUpdate,
  retestTick,
}: DebugCanvasProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Overlay toggles
  const [showCanny, setShowCanny] = useState(true);
  const [showMorph, setShowMorph] = useState(true);
  const [showContours, setShowContours] = useState(false);
  const [showPipelineOverlays, setShowPipelineOverlays] = useState(true);
  const [showGroundTruth, setShowGroundTruth] = useState(true);

  // RAF handle for cleanup
  const rafRef = useRef<number>(0);

  // Dummy video element for static-image mode
  const dummyVideoRef = useRef<HTMLVideoElement | null>(null);

  // Track whether setup has been called for the current canvas/video pair
  const setupDoneRef = useRef(false);

  // Keep a stable ref to the current imageSrc for re-processing
  const imageSrcRef = useRef(imageSrc);
  useEffect(() => { imageSrcRef.current = imageSrc; }, [imageSrc]);

  const profiler = useProfiler();

  // Clicked coordinate for the picker (static-image mode only)
  const [clickedCoord, setClickedCoord] = useState<{ x: number; y: number } | null>(null);
  const clickedCoordRef = useRef(clickedCoord);
  useEffect(() => { clickedCoordRef.current = clickedCoord; }, [clickedCoord]);

  // Annotation state
  const [annotCorners, setAnnotCorners] = useState<{ x: number; y: number }[]>([]);
  const [selectedCorner, setSelectedCorner] = useState<number | null>(null);
  const annotCornersRef = useRef(annotCorners);
  const selectedCornerRef = useRef(selectedCorner);
  const annotationModeRef = useRef(annotationMode);
  useEffect(() => { annotCornersRef.current = annotCorners; }, [annotCorners]);
  useEffect(() => { selectedCornerRef.current = selectedCorner; }, [selectedCorner]);
  useEffect(() => { annotationModeRef.current = annotationMode; }, [annotationMode]);

  // Dragging state for annotation corners
  const draggingCornerRef = useRef<number | null>(null);

  // Stable ref for onAnnotationUpdate to avoid stale closures
  const onAnnotationUpdateRef = useRef(onAnnotationUpdate);
  useEffect(() => { onAnnotationUpdateRef.current = onAnnotationUpdate; }, [onAnnotationUpdate]);

  // Initialize / reset annotation corners when groundTruth or imageSrc changes
  useEffect(() => {
    if (!annotationMode) return;
    if (groundTruth) {
      setAnnotCorners(groundTruth.corners.map((c) => ({ x: c.x, y: c.y })));
    } else {
      setAnnotCorners([]);
    }
    setSelectedCorner(null);
  }, [groundTruth, imageSrc, annotationMode]);

  // Expose refs via stable callbacks so the animation loop can read them
  const showCannyRef = useRef(showCanny);
  const showMorphRef = useRef(showMorph);
  const showContoursRef = useRef(showContours);
  const showGroundTruthRef = useRef(showGroundTruth);
  useEffect(() => { showCannyRef.current = showCanny; }, [showCanny]);
  useEffect(() => { showMorphRef.current = showMorph; }, [showMorph]);
  useEffect(() => { showContoursRef.current = showContours; }, [showContours]);
  useEffect(() => { showGroundTruthRef.current = showGroundTruth; }, [showGroundTruth]);

  // ---------------------------------------------------------------------------
  // Pipeline overlay toggle side-effect
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setCardPipelineOverlays(showPipelineOverlays);

    // Re-run static image processing when the toggle changes
    if (!isWebcam && imageSrcRef.current) {
      const canvas = baseCanvasRef.current;
      if (!canvas) return;

      const img = new Image();
      img.onload = () => {
        const s = scale ?? 1;
        const canvasW = Math.round(img.naturalWidth * s);
        const canvasH = Math.round(img.naturalHeight * s);
        canvas.width = canvasW;
        canvas.height = canvasH;

        const overlayCanvas = overlayCanvasRef.current;
        if (overlayCanvas) {
          overlayCanvas.width = canvasW;
          overlayCanvas.height = canvasH;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        if (!dummyVideoRef.current) {
          dummyVideoRef.current = document.createElement('video');
        }
        const dummy = dummyVideoRef.current;

        cardDetectionDemo.setup(canvas, dummy, params);
        setupDoneRef.current = true;

        ctx.drawImage(img, 0, 0, canvasW, canvasH);

        profiler.frameStart();
        cardDetectionDemo.process(ctx, dummy, canvasW, canvasH, profiler);
        profiler.frameEnd();

        drawOverlays(canvasW, canvasH);
        reportMetrics(canvasW * canvasH);
      };
      img.src = imageSrcRef.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPipelineOverlays]);

  // ---------------------------------------------------------------------------
  // Load static image → draw to base canvas and run once
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isWebcam || !imageSrc) return;

    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      const s = scale ?? 1;
      const canvasW = Math.round(img.naturalWidth * s);
      const canvasH = Math.round(img.naturalHeight * s);
      canvas.width = canvasW;
      canvas.height = canvasH;

      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas) {
        overlayCanvas.width = canvasW;
        overlayCanvas.height = canvasH;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Ensure dummy video exists
      if (!dummyVideoRef.current) {
        dummyVideoRef.current = document.createElement('video');
      }
      const dummy = dummyVideoRef.current;

      resetCardTemporalState(); // Clear smoothed corners, grace period from previous image
      cardDetectionDemo.setup(canvas, dummy, params);
      setupDoneRef.current = true;

      ctx.drawImage(img, 0, 0, canvasW, canvasH);

      profiler.frameStart();
      cardDetectionDemo.process(ctx, dummy, canvasW, canvasH, profiler);
      profiler.frameEnd();

      drawOverlays(canvasW, canvasH);
      reportMetrics(canvasW * canvasH);
      onProcessingComplete?.();
    };
    img.src = imageSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, isWebcam, scale, retestTick]);

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

      // Resize canvas if video dimensions changed, applying scale
      const s = scale ?? 1;
      const targetW = Math.round(v.videoWidth * s);
      const targetH = Math.round(v.videoHeight * s);
      if (v.videoWidth > 0 && (c.width !== targetW || c.height !== targetH)) {
        c.width = targetW;
        c.height = targetH;
        const oc = overlayCanvasRef.current;
        if (oc) { oc.width = targetW; oc.height = targetH; }
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
  }, [isWebcam, videoRef, scale]);

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
  // Mouse coordinate helper — converts mouse event to original image space
  // ---------------------------------------------------------------------------
  function mouseToOriginal(e: React.MouseEvent<HTMLCanvasElement>): { origX: number; origY: number; s: number } | null {
    const canvas = baseCanvasRef.current;
    if (!canvas || isWebcam) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    const s = scale ?? 1;
    return { origX: Math.round(x / s), origY: Math.round(y / s), s };
  }

  function findNearCorner(origX: number, origY: number, s: number): number | null {
    const corners = annotCornersRef.current;
    if (corners.length < 4) return null;
    const THRESHOLD = 30;
    let nearIdx: number | null = null;
    let nearDist = Infinity;
    for (let i = 0; i < 4; i++) {
      const dx = corners[i].x - origX;
      const dy = corners[i].y - origY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < THRESHOLD / s && dist < nearDist) {
        nearIdx = i;
        nearDist = dist;
      }
    }
    return nearIdx;
  }

  // ---------------------------------------------------------------------------
  // Mouse handlers — click for picker/placement, drag for annotation corners
  // ---------------------------------------------------------------------------
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = mouseToOriginal(e);
    if (!pos) return;

    if (annotationMode && annotCornersRef.current.length === 4) {
      const near = findNearCorner(pos.origX, pos.origY, pos.s);
      if (near !== null) {
        draggingCornerRef.current = near;
        setSelectedCorner(near);
        e.preventDefault();
        return;
      }
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (draggingCornerRef.current === null) return;
    const pos = mouseToOriginal(e);
    if (!pos) return;

    const corners = [...annotCornersRef.current];
    const idx = draggingCornerRef.current;
    corners[idx] = { x: pos.origX, y: pos.origY };
    setAnnotCorners(corners);

    // Redraw overlays immediately for smooth feedback
    const canvas = baseCanvasRef.current;
    if (canvas) drawOverlays(canvas.width, canvas.height);
  }

  function handleMouseUp(_e: React.MouseEvent<HTMLCanvasElement>) {
    if (draggingCornerRef.current !== null) {
      draggingCornerRef.current = null;
      setSelectedCorner(null);
      // Emit final position
      if (annotCornersRef.current.length === 4) {
        onAnnotationUpdateRef.current?.(annotCornersRef.current as CornerTuple);
      }
      return;
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    // Skip if we just finished a drag
    if (draggingCornerRef.current !== null) return;

    const pos = mouseToOriginal(e);
    if (!pos) return;

    if (annotationMode) {
      handleAnnotationClick(pos.origX, pos.origY, pos.s);
      return;
    }

    setClickedCoord({ x: pos.origX, y: pos.origY });
  }

  // ---------------------------------------------------------------------------
  // Annotation click handler
  // ---------------------------------------------------------------------------
  function handleAnnotationClick(origX: number, origY: number, s: number) {
    const corners = [...annotCornersRef.current];

    if (corners.length < 4) {
      // Placing corners one by one: TL, TR, BR, BL
      const next = [...corners, { x: origX, y: origY }];
      setAnnotCorners(next);
      setSelectedCorner(null);
      if (next.length === 4) {
        onAnnotationUpdateRef.current?.(next as CornerTuple);
      }
      return;
    }

    // All 4 corners exist — check if click is near an existing corner
    const THRESHOLD = 20; // pixels in original image space
    let nearIdx: number | null = null;
    let nearDist = Infinity;
    for (let i = 0; i < 4; i++) {
      const dx = corners[i].x - origX;
      const dy = corners[i].y - origY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Account for scale: threshold is in original-image pixels
      if (dist < THRESHOLD / s && dist < nearDist) {
        nearIdx = i;
        nearDist = dist;
      }
    }

    if (nearIdx !== null) {
      // Select this corner
      setSelectedCorner(nearIdx);
    } else if (selectedCornerRef.current !== null) {
      // Move the selected corner to the clicked position
      const idx = selectedCornerRef.current;
      corners[idx] = { x: origX, y: origY };
      setAnnotCorners(corners);
      setSelectedCorner(null);
      onAnnotationUpdateRef.current?.(corners as CornerTuple);
    }
  }

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

    // Contour outlines (cyan)
    if (showContoursRef.current && bufs.contours) {
      octx.strokeStyle = 'cyan';
      octx.lineWidth = 1;
      for (const contour of bufs.contours) {
        if (contour.points.length < 3) continue;
        octx.beginPath();
        octx.moveTo(contour.points[0].x, contour.points[0].y);
        for (let i = 1; i < contour.points.length; i++) {
          octx.lineTo(contour.points[i].x, contour.points[i].y);
        }
        octx.closePath();
        octx.stroke();
      }
    }

    // Annotation overlay (replaces ground truth when in annotation mode)
    if (annotationModeRef.current) {
      const s = scale ?? 1;
      const corners = annotCornersRef.current;
      const selIdx = selectedCornerRef.current;
      const labels = ['TL', 'TR', 'BR', 'BL'];

      // Draw quad connecting the corners (blue dashed)
      if (corners.length >= 2) {
        octx.strokeStyle = '#3b82f6';
        octx.lineWidth = 2;
        octx.setLineDash([8, 4]);
        octx.beginPath();
        octx.moveTo(corners[0].x * s, corners[0].y * s);
        for (let i = 1; i < corners.length; i++) {
          octx.lineTo(corners[i].x * s, corners[i].y * s);
        }
        if (corners.length === 4) octx.closePath();
        octx.stroke();
        octx.setLineDash([]);
      }

      // Draw corner circles and labels
      for (let i = 0; i < corners.length; i++) {
        const cx = corners[i].x * s;
        const cy = corners[i].y * s;

        // Circle
        octx.beginPath();
        octx.arc(cx, cy, 12, 0, Math.PI * 2);
        octx.fillStyle = i === selIdx ? '#eab308' : '#3b82f6';
        octx.fill();
        octx.strokeStyle = '#ffffff';
        octx.lineWidth = 2;
        octx.stroke();

        // Label
        octx.font = 'bold 12px monospace';
        octx.fillStyle = '#ffffff';
        octx.fillText(labels[i], cx + 16, cy + 4);
      }

      // Instruction text
      octx.font = '13px sans-serif';
      octx.fillStyle = 'rgba(255,255,255,0.85)';
      octx.strokeStyle = 'rgba(0,0,0,0.6)';
      octx.lineWidth = 3;
      const instr = corners.length < 4
        ? `Click to place corners (TL\u2192TR\u2192BR\u2192BL) \u2014 ${corners.length}/4`
        : 'Click a corner to select, then click to move';
      octx.strokeText(instr, 12, 24);
      octx.fillText(instr, 12, 24);
    } else {
      // Ground truth overlay (blue dashed) — only when NOT in annotation mode
      if (showGroundTruthRef.current && groundTruth) {
        const s = scale ?? 1;
        octx.strokeStyle = '#3b82f6';
        octx.lineWidth = 2;
        octx.setLineDash([8, 4]);
        octx.beginPath();
        const gt = groundTruth.corners;
        octx.moveTo(gt[0].x * s, gt[0].y * s);
        for (let i = 1; i < 4; i++) octx.lineTo(gt[i].x * s, gt[i].y * s);
        octx.closePath();
        octx.stroke();
        octx.setLineDash([]);
      }
    }

    // Coordinate picker crosshair (magenta) — skip in annotation mode
    if (!annotationModeRef.current && clickedCoordRef.current) {
      const s = scale ?? 1;
      const cx = clickedCoordRef.current.x * s;
      const cy = clickedCoordRef.current.y * s;
      octx.strokeStyle = '#ff00ff';
      octx.lineWidth = 1;
      octx.beginPath();
      octx.moveTo(cx - 10, cy); octx.lineTo(cx + 10, cy);
      octx.moveTo(cx, cy - 10); octx.lineTo(cx, cy + 10);
      octx.stroke();
    }
  }, [groundTruth, scale]);

  // Redraw overlay when clicked coordinate or annotation state changes
  useEffect(() => {
    if (isWebcam) return;
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    drawOverlays(canvas.width, canvas.height);
  }, [clickedCoord, annotCorners, selectedCorner, annotationMode, isWebcam, drawOverlays]);

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
      corners: bufs.smoothedCorners ? [...bufs.smoothedCorners] : null,
      accuracy: null,
    });
  }, [onMetricsUpdate]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const { display } = profiler;

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Overlay toggles */}
      <div className="flex items-center gap-6 flex-wrap">
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
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-contours"
            checked={showContours}
            onCheckedChange={setShowContours}
          />
          <Label htmlFor="toggle-contours" className="text-xs text-cyan-400">
            Contours
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-pipeline-hud"
            checked={showPipelineOverlays}
            onCheckedChange={setShowPipelineOverlays}
          />
          <Label htmlFor="toggle-pipeline-hud" className="text-xs text-white">
            Pipeline HUD
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="toggle-gt" checked={showGroundTruth} onCheckedChange={setShowGroundTruth} />
          <Label htmlFor="toggle-gt" className="text-xs text-blue-400">Ground truth</Label>
        </div>
      </div>

      {/* Stacked canvases — scales to fit container */}
      <div className="relative flex-1 min-h-0">
        {/* Base canvas: pipeline draws here */}
        <canvas
          ref={baseCanvasRef}
          className="block w-full h-full object-contain"
          style={!isWebcam ? { cursor: annotationMode ? 'grab' : 'crosshair' } : undefined}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
        {/* Overlay canvas: debug colors drawn here, positioned on top */}
        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 w-full h-full object-contain"
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
        {clickedCoord && !isWebcam && (
          <div className="text-xs font-mono text-blue-400">
            Clicked: ({clickedCoord.x}, {clickedCoord.y}) in 1920x1080 space
          </div>
        )}
      </div>
    </div>
  );
}
