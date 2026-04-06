/**
 * DebugCanvas — dev-only component for the Detection Debug Workbench (Task 4).
 *
 * Renders the card detection pipeline on a canvas and draws toggleable overlays
 * (Canny edges in red, morph blob in yellow, contour outlines in cyan) on a
 * stacked overlay canvas.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { cardDetectionDemo, getCardDebugBuffers, resetCardTemporalState } from '@/lib/demos';
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

  // Offscreen canvas for processing at scaled resolution
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Overlay toggles
  const [showCanny, setShowCanny] = useState(true);
  const [showMorph, setShowMorph] = useState(true);
  const [showContours, setShowContours] = useState(false);
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

  /** Lazily create / resize the offscreen processing canvas. */
  function getOffscreenCanvas(w: number, h: number): HTMLCanvasElement {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const oc = offscreenCanvasRef.current;
    if (oc.width !== w || oc.height !== h) {
      oc.width = w;
      oc.height = h;
    }
    return oc;
  }

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
      const fullW = img.naturalWidth;
      const fullH = img.naturalHeight;

      // Display canvas at full resolution
      canvas.width = fullW;
      canvas.height = fullH;
      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas) {
        overlayCanvas.width = fullW;
        overlayCanvas.height = fullH;
      }

      // Offscreen at scaled resolution
      const procW = Math.round(fullW * s);
      const procH = Math.round(fullH * s);
      const offscreen = getOffscreenCanvas(procW, procH);
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true })!;

      // Draw to display (full) and offscreen (scaled)
      const displayCtx = canvas.getContext('2d', { willReadFrequently: true })!;
      displayCtx.drawImage(img, 0, 0, fullW, fullH);
      offCtx.drawImage(img, 0, 0, procW, procH);

      // Ensure dummy video exists
      if (!dummyVideoRef.current) {
        dummyVideoRef.current = document.createElement('video');
      }
      const dummy = dummyVideoRef.current;

      // Process on offscreen
      resetCardTemporalState();
      cardDetectionDemo.setup(offscreen, dummy, params);
      setupDoneRef.current = true;

      profiler.frameStart();
      cardDetectionDemo.process(offCtx, dummy, procW, procH, profiler);
      profiler.frameEnd();

      drawOverlays(fullW, fullH, 1 / s);
      reportMetrics(procW * procH);
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

    const dc = baseCanvasRef.current;
    const video = videoRef.current;
    if (!dc || !video) return;

    // Use a sensible default resolution; the canvas will follow the video's
    // intrinsic dimensions once it starts playing.
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    dc.width = w;
    dc.height = h;

    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      overlayCanvas.width = w;
      overlayCanvas.height = h;
    }

    // Initial setup uses the offscreen canvas at scaled resolution
    const s0 = scale ?? 1;
    const initProcW = Math.round(w * s0);
    const initProcH = Math.round(h * s0);
    const initOffscreen = getOffscreenCanvas(initProcW, initProcH);
    cardDetectionDemo.setup(initOffscreen, video, params);
    setupDoneRef.current = true;

    function loop() {
      const v = videoRef.current;
      const c = baseCanvasRef.current;
      if (!v || !c || frozen) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const s = scale ?? 1;
      const fullW = v.videoWidth;
      const fullH = v.videoHeight;

      // Display at full video resolution
      if (c.width !== fullW || c.height !== fullH) {
        c.width = fullW;
        c.height = fullH;
        const oc = overlayCanvasRef.current;
        if (oc) { oc.width = fullW; oc.height = fullH; }
      }

      if (v.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const procW = Math.round(fullW * s);
      const procH = Math.round(fullH * s);
      const offscreen = getOffscreenCanvas(procW, procH);
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true })!;

      // Draw video to both canvases
      const displayCtx = c.getContext('2d', { willReadFrequently: true })!;
      displayCtx.drawImage(v, 0, 0, fullW, fullH);
      offCtx.drawImage(v, 0, 0, procW, procH);

      profiler.frameStart();
      cardDetectionDemo.process(offCtx, v, procW, procH, profiler);
      profiler.frameEnd();

      drawOverlays(fullW, fullH, 1 / s);
      reportMetrics(procW * procH);

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
    // Display canvas is now at full resolution, so canvas coords = original coords
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    const s = scale ?? 1;
    return { origX: x, origY: y, s };
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
    if (canvas) drawOverlays(canvas.width, canvas.height, 1 / (scale ?? 1));
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
  const drawOverlays = useCallback((w: number, h: number, coordScale: number = 1) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const ovCtx = overlayCanvas.getContext('2d');
    if (!ovCtx) return;

    ovCtx.clearRect(0, 0, w, h);

    const bufs = getCardDebugBuffers();

    // Canny edges overlay (red) — buffer is at processing resolution, scale up
    const bufW = bufs.gray?.cols ?? 0;
    const bufH = bufs.gray?.rows ?? 0;
    if (showCannyRef.current && bufs.gray?.data && bufW > 0 && bufH > 0) {
      const ovImgData = ovCtx.createImageData(w, h);
      const dest = ovImgData.data;
      const src = bufs.gray.data as Uint8Array;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const srcX = Math.floor(x * bufW / w);
          const srcY = Math.floor(y * bufH / h);
          const v = src[srcY * bufW + srcX];
          if (v > 0) {
            const o = (y * w + x) * 4;
            dest[o] = 220; dest[o + 1] = 30; dest[o + 2] = 30; dest[o + 3] = 180;
          }
        }
      }
      ovCtx.putImageData(ovImgData, 0, 0);
    }

    // Morph blob overlay (yellow) — buffer is at processing resolution, scale up
    const edgeBufW = bufs.edges?.cols ?? 0;
    const edgeBufH = bufs.edges?.rows ?? 0;
    if (showMorphRef.current && bufs.edges?.data && edgeBufW > 0 && edgeBufH > 0) {
      const ovImgData = ovCtx.createImageData(w, h);
      const dest = ovImgData.data;
      const src = bufs.edges.data as Uint8Array;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const srcX = Math.floor(x * edgeBufW / w);
          const srcY = Math.floor(y * edgeBufH / h);
          const v = src[srcY * edgeBufW + srcX];
          if (v > 0) {
            const o = (y * w + x) * 4;
            dest[o] = 220; dest[o + 1] = 200; dest[o + 2] = 0; dest[o + 3] = 160;
          }
        }
      }
      // Composite on top (yellow overwrites red where both active)
      ovCtx.putImageData(ovImgData, 0, 0);
    }

    // Contour outlines (cyan) — multiply contour points by coordScale
    if (showContoursRef.current && bufs.contours) {
      ovCtx.strokeStyle = 'cyan';
      ovCtx.lineWidth = 1;
      for (const contour of bufs.contours) {
        if (contour.points.length < 3) continue;
        ovCtx.beginPath();
        ovCtx.moveTo(contour.points[0].x * coordScale, contour.points[0].y * coordScale);
        for (let i = 1; i < contour.points.length; i++) {
          ovCtx.lineTo(contour.points[i].x * coordScale, contour.points[i].y * coordScale);
        }
        ovCtx.closePath();
        ovCtx.stroke();
      }
    }

    // Detection quad (green frame)
    if (bufs.smoothedCorners && bufs.detected) {
      ovCtx.strokeStyle = '#00ff00';
      ovCtx.lineWidth = 2;
      ovCtx.beginPath();
      const c = bufs.smoothedCorners;
      ovCtx.moveTo(c[0].x * coordScale, c[0].y * coordScale);
      for (let i = 1; i < 4; i++) ovCtx.lineTo(c[i].x * coordScale, c[i].y * coordScale);
      ovCtx.closePath();
      ovCtx.stroke();
      // Corner dots (fixed 4px radius)
      ovCtx.fillStyle = '#00ff00';
      for (const pt of c) {
        ovCtx.beginPath();
        ovCtx.arc(pt.x * coordScale, pt.y * coordScale, 4, 0, Math.PI * 2);
        ovCtx.fill();
      }
    }

    // Status text (fixed 12px)
    ovCtx.font = '12px monospace';
    ovCtx.textAlign = 'left';
    ovCtx.fillStyle = bufs.detected ? '#0f0' : '#f66';
    ovCtx.fillText(
      (bufs.detected ? 'Card detected' : 'No card found') + (bufs.debugInfo ? ` | ${bufs.debugInfo}` : ''),
      8, h - 8,
    );

    // Quality chart (fixed 120x24px, top-right)
    if (bufs.qualityHistory?.length) {
      const chartW = Math.min(bufs.qualityHistory.length, 120);
      const chartH = 24;
      const chartX = w - chartW - 8;
      const chartY = 8;
      ovCtx.fillStyle = 'rgba(0,0,0,0.6)';
      ovCtx.fillRect(chartX - 1, chartY - 1, chartW + 2, chartH + 12);
      for (let ci = 0; ci < chartW; ci++) {
        const val = bufs.qualityHistory[bufs.qualityHistory.length - chartW + ci];
        const barH = val * chartH;
        ovCtx.fillStyle = val > 0.35 ? '#0f0' : val > 0.1 ? '#ff0' : '#f00';
        ovCtx.fillRect(chartX + ci, chartY + chartH - barH, 1, barH);
      }
      ovCtx.fillStyle = '#aaa'; ovCtx.font = '8px monospace';
      const lastQ = bufs.qualityHistory[bufs.qualityHistory.length - 1] ?? 0;
      ovCtx.fillText(`quality: ${(lastQ * 100).toFixed(0)}%`, chartX, chartY + chartH + 9);
    }

    // Annotation overlay (replaces ground truth when in annotation mode)
    if (annotationModeRef.current) {
      const corners = annotCornersRef.current;
      const selIdx = selectedCornerRef.current;
      const labels = ['TL', 'TR', 'BR', 'BL'];

      // Draw quad connecting the corners (blue dashed)
      // Annotation corners are in original-image space; display canvas is at full res
      if (corners.length >= 2) {
        ovCtx.strokeStyle = '#3b82f6';
        ovCtx.lineWidth = 2;
        ovCtx.setLineDash([8, 4]);
        ovCtx.beginPath();
        ovCtx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) {
          ovCtx.lineTo(corners[i].x, corners[i].y);
        }
        if (corners.length === 4) ovCtx.closePath();
        ovCtx.stroke();
        ovCtx.setLineDash([]);
      }

      // Draw corner circles and labels
      for (let i = 0; i < corners.length; i++) {
        const cx = corners[i].x;
        const cy = corners[i].y;

        // Circle
        ovCtx.beginPath();
        ovCtx.arc(cx, cy, 12, 0, Math.PI * 2);
        ovCtx.fillStyle = i === selIdx ? '#eab308' : '#3b82f6';
        ovCtx.fill();
        ovCtx.strokeStyle = '#ffffff';
        ovCtx.lineWidth = 2;
        ovCtx.stroke();

        // Label
        ovCtx.font = 'bold 12px monospace';
        ovCtx.fillStyle = '#ffffff';
        ovCtx.fillText(labels[i], cx + 16, cy + 4);
      }

      // Instruction text
      ovCtx.font = '13px sans-serif';
      ovCtx.fillStyle = 'rgba(255,255,255,0.85)';
      ovCtx.strokeStyle = 'rgba(0,0,0,0.6)';
      ovCtx.lineWidth = 3;
      const instr = corners.length < 4
        ? `Click to place corners (TL\u2192TR\u2192BR\u2192BL) \u2014 ${corners.length}/4`
        : 'Click a corner to select, then click to move';
      ovCtx.strokeText(instr, 12, 24);
      ovCtx.fillText(instr, 12, 24);
    } else {
      // Ground truth overlay (blue dashed) — only when NOT in annotation mode
      // Ground truth corners are in original-image space; display canvas is at full res
      if (showGroundTruthRef.current && groundTruth) {
        ovCtx.strokeStyle = '#3b82f6';
        ovCtx.lineWidth = 2;
        ovCtx.setLineDash([8, 4]);
        ovCtx.beginPath();
        const gt = groundTruth.corners;
        ovCtx.moveTo(gt[0].x, gt[0].y);
        for (let i = 1; i < 4; i++) ovCtx.lineTo(gt[i].x, gt[i].y);
        ovCtx.closePath();
        ovCtx.stroke();
        ovCtx.setLineDash([]);
      }
    }

    // Coordinate picker crosshair (magenta) — skip in annotation mode
    // Clicked coords are in original-image space; display canvas is at full res
    if (!annotationModeRef.current && clickedCoordRef.current) {
      const cx = clickedCoordRef.current.x;
      const cy = clickedCoordRef.current.y;
      ovCtx.strokeStyle = '#ff00ff';
      ovCtx.lineWidth = 1;
      ovCtx.beginPath();
      ovCtx.moveTo(cx - 10, cy); ovCtx.lineTo(cx + 10, cy);
      ovCtx.moveTo(cx, cy - 10); ovCtx.lineTo(cx, cy + 10);
      ovCtx.stroke();
    }
  }, [groundTruth]);

  // Redraw overlay when clicked coordinate or annotation state changes
  useEffect(() => {
    if (isWebcam) return;
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    drawOverlays(canvas.width, canvas.height, 1 / (scale ?? 1));
  }, [clickedCoord, annotCorners, selectedCorner, annotationMode, isWebcam, drawOverlays, scale]);

  // ---------------------------------------------------------------------------
  // Metrics reporter
  // ---------------------------------------------------------------------------
  const reportMetrics = useCallback((pixelCount: number) => {
    if (!onMetricsUpdate) return;

    const bufs = getCardDebugBuffers();

    const bData = bufs.gray?.data as Uint8Array | undefined;
    const brightness = bData ? meanBrightness(bData, pixelCount) : 0;

    onMetricsUpdate({
      detected: bufs.detected,
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
