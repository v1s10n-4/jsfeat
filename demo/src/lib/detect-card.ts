/**
 * Pure stateless card detection pipeline.
 *
 * Extracts the full detection logic from cardDetectionDemo.process() but with:
 * - NO mutable module-level state
 * - NO temporal smoothing (threshold, corner smoothing, grace frames)
 * - NO persistence bias in contour scoring
 * - NO DOM / canvas / video dependencies
 * - NO profiler calls
 *
 * Designed to be callable from both the main thread and Web Workers.
 */

import { Matrix, U8C1, S32C2 } from 'jsfeat/core';
import {
  grayscale,
  boxBlurGray,
  gaussianBlur,
  equalizeHistogram,
  cannyEdges,
  scharrDerivatives,
  findContours,
  approxPoly,
} from 'jsfeat/imgproc';
import { DETECTION_DEFAULTS } from './detection-constants';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DetectCardResult {
  detected: boolean;
  corners: { x: number; y: number }[] | null;
  debugInfo: string;
  rectFill: number;
  aspect: number;
  qualityScore: number;
  /** Internal buffers for debug visualization (optional, only set when requested). */
  buffers?: {
    gray: Matrix;
    edges: Matrix;
    blurred: Matrix;
    scharr: Matrix;
    contours: any[];
    prevThreshold: number;
  };
}

// ---------------------------------------------------------------------------
// Private helpers (copied from demos.ts)
// ---------------------------------------------------------------------------

function sortCorners(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  // Center point
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  // Sort by angle from center
  const sorted = pts.slice().sort((a, b) =>
    Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  // Find top-left (smallest x+y sum)
  let minSum = Infinity, minIdx = 0;
  for (let i = 0; i < 4; i++) {
    const s = sorted[i].x + sorted[i].y;
    if (s < minSum) { minSum = s; minIdx = i; }
  }
  // Rotate so TL is first
  const result = [];
  for (let i = 0; i < 4; i++) result.push(sorted[(minIdx + i) % 4]);
  return result;
}

/** Build card corners from a bounding rect, enforcing 5:7 (w:h) ratio. */
function buildCardCorners(br: { x: number; y: number; width: number; height: number }) {
  const cx = br.x + br.width / 2;
  const cy = br.y + br.height / 2;
  const isLandscape = br.width > br.height;
  let cw: number, ch: number;
  if (isLandscape) {
    cw = br.width; ch = cw * (5 / 7);
    if (ch < br.height) { ch = br.height; cw = ch * (7 / 5); }
  } else {
    ch = br.height; cw = ch * (5 / 7);
    if (cw < br.width) { cw = br.width; ch = cw * (7 / 5); }
  }
  return sortCorners([
    { x: cx - cw / 2, y: cy - ch / 2 },
    { x: cx + cw / 2, y: cy - ch / 2 },
    { x: cx + cw / 2, y: cy + ch / 2 },
    { x: cx - cw / 2, y: cy + ch / 2 },
  ]);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Pure stateless card detection pipeline.
 * Takes raw RGBA pixels, returns detection result.
 * No temporal smoothing, no persistence bias, no canvas dependency.
 */
export function detectCard(
  rgba: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  params: Record<string, number> = DETECTION_DEFAULTS as any,
  returnBuffers: boolean = false,
): DetectCardResult {
  // 1. Allocate buffers
  const gray = new Matrix(w, h, U8C1);
  const blurred = new Matrix(w, h, U8C1);
  const edges = new Matrix(w, h, U8C1);
  const scharr = new Matrix(w, h, S32C2);

  // 2. RGBA to grayscale (grayscale expects Uint8Array, not Uint8ClampedArray)
  grayscale(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), w, h, gray);

  // 3. Conditional equalization — boost contrast in dark images
  const gd = gray.data;
  let brightSum = 0;
  for (let i = 0; i < w * h; i++) brightSum += gd[i];
  if (brightSum / (w * h) < params.equalizationThreshold) {
    equalizeHistogram(gray, gray);
  }

  // 4. Gaussian blur
  let ks = params.blurKernel ?? 9;
  if (ks % 2 === 0) ks += 1;
  const detKs = Math.max(ks, params.minBlurKernel) | 1;
  gaussianBlur(gray, blurred, detKs, 0);

  // 5. Canny edge detection
  const cannyLo = params.cannyLow ?? 20;
  const cannyHi = Math.max((params.cannyHigh ?? 60), cannyLo + 10);
  cannyEdges(blurred, edges, cannyLo, cannyHi);

  // Save original Canny edges for later corner refinement
  gray.data.set(edges.data);
  const ed = edges.data;

  // 6. Scharr gradient merge — strengthen card border edges
  scharr.resize(w, h, 2);
  scharrDerivatives(blurred, scharr);
  const sd = scharr.data;
  for (let i = 0; i < w * h; i++) {
    const mag = Math.min(255, (Math.abs(sd[i * 2]) + Math.abs(sd[i * 2 + 1])) >> 3);
    if (mag > params.scharrThreshold) ed[i] = 255;
  }

  // 7. Color-based edge detection using raw RGBA data
  const colorBuf = gray; // reuse as temp
  const cbd = colorBuf.data;

  // Pass 1: Warmth (R-B) — detects neutral card borders against warm brown wood
  for (let i = 0; i < w * h; i++) {
    cbd[i] = Math.min(255, Math.max(0, 128 + rgba[i * 4] - rgba[i * 4 + 2]));
  }
  gaussianBlur(colorBuf, colorBuf, detKs, 0);
  scharrDerivatives(colorBuf, scharr);
  for (let i = 0; i < w * h; i++) {
    const px = i % w, py = (i / w) | 0;
    if (px < params.warmthBorderMargin || py < params.warmthBorderMargin || px >= w - params.warmthBorderMargin || py >= h - params.warmthBorderMargin) continue;
    const wmag = Math.min(255, (Math.abs(sd[i * 2]) + Math.abs(sd[i * 2 + 1])) >> 3);
    if (wmag > params.warmthThreshold) ed[i] = 255;
  }

  // Pass 2: Chroma (max-min of RGB) — detects color saturation transitions
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    cbd[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  gaussianBlur(colorBuf, colorBuf, detKs, 0);
  scharrDerivatives(colorBuf, scharr);
  for (let i = 0; i < w * h; i++) {
    const px = i % w, py = (i / w) | 0;
    if (px < params.warmthBorderMargin || py < params.warmthBorderMargin || px >= w - params.warmthBorderMargin || py >= h - params.warmthBorderMargin) continue;
    const cmag = Math.min(255, (Math.abs(sd[i * 2]) + Math.abs(sd[i * 2 + 1])) >> 3);
    if (cmag > params.chromaThreshold) ed[i] = 255;
  }

  // Restore grayscale Scharr for edge refinement
  scharrDerivatives(blurred, scharr);
  // Restore Canny edges for refinement
  gray.data.set(edges.data);

  // 8. Morph: box blur connects nearby edges into solid blobs
  boxBlurGray(edges, blurred, params.morphRadius);
  const bd = blurred.data;
  let densitySum = 0;
  for (let i = 0; i < w * h; i++) densitySum += bd[i];
  const meanDensity = densitySum / (w * h);
  // NO temporal smoothing — use rawThresh directly (each call is independent)
  const rawThresh = Math.max(params.morphThresholdMin, meanDensity + params.morphThresholdBias);
  for (let i = 0; i < w * h; i++) ed[i] = bd[i] > rawThresh ? 255 : 0;

  // Binary erosion: shrink the blob to remove thin background-merged edges
  boxBlurGray(edges, blurred, params.erosionRadius);
  for (let i = 0; i < w * h; i++) ed[i] = bd[i] > params.erosionThreshold ? 255 : 0;

  // 9. Find contours and pick the best card-shaped one
  let debugInfo = '';
  const minArea = Math.max(params.minContourArea ?? 1000, w * h * params.minAreaRatio);

  let detected = false;
  let cardCorners: { x: number; y: number }[] = [];
  let lastRectFill = 0;
  let lastAspect = 0;

  const contours = findContours(edges);

  let bestScore = 0;
  for (const contour of contours) {
    if (contour.area < minArea || contour.area > w * h * params.maxAreaRatio) continue;

    const br = contour.boundingRect;
    // Skip border-touching contours (desk shadows, frame edges)
    if (br.x <= params.borderMargin || br.y <= params.borderMargin || br.x + br.width >= w - params.borderMargin || br.y + br.height >= h - params.borderMargin) continue;

    const aspect = Math.min(br.width, br.height) / Math.max(br.width, br.height);
    if (aspect < params.minAspect) continue;

    // Convex hull first to eliminate concavities, then simplify to 4-sided polygon.
    const pts = contour.points;
    const hullPts: { x: number; y: number }[] = [];
    if (pts.length >= 4) {
      // Find lowest-rightmost point
      let startIdx = 0;
      for (let pi = 1; pi < pts.length; pi++) {
        if (pts[pi].y > pts[startIdx].y || (pts[pi].y === pts[startIdx].y && pts[pi].x > pts[startIdx].x)) {
          startIdx = pi;
        }
      }
      const start = pts[startIdx];
      // Sort by polar angle from start
      const sorted = pts.slice().sort((a, b) => {
        const angA = Math.atan2(a.y - start.y, a.x - start.x);
        const angB = Math.atan2(b.y - start.y, b.x - start.x);
        return angA - angB || ((a.x - start.x) ** 2 + (a.y - start.y) ** 2) - ((b.x - start.x) ** 2 + (b.y - start.y) ** 2);
      });
      // Build hull
      for (const p of sorted) {
        while (hullPts.length >= 2) {
          const a = hullPts[hullPts.length - 2], bPt = hullPts[hullPts.length - 1];
          if ((bPt.x - a.x) * (p.y - a.y) - (bPt.y - a.y) * (p.x - a.x) <= 0) hullPts.pop();
          else break;
        }
        hullPts.push(p);
      }
    }

    // Build a virtual contour from the hull for approxPoly
    const hullContour = hullPts.length >= 4 ? {
      points: hullPts,
      area: contour.area,
      perimeter: hullPts.reduce((sum, p, i) => {
        const n = hullPts[(i + 1) % hullPts.length];
        return sum + Math.sqrt((n.x - p.x) ** 2 + (n.y - p.y) ** 2);
      }, 0),
      boundingRect: contour.boundingRect,
    } : contour;

    let poly = approxPoly(hullContour, hullContour.perimeter * 0.02);
    for (let ep = 0.04; poly.length > 4 && ep <= 0.15; ep += 0.02) {
      poly = approxPoly(hullContour, hullContour.perimeter * ep);
    }
    // If still 5 points, merge the two closest adjacent vertices
    if (poly.length === 5) {
      let minDist = Infinity, mergeIdx = 0;
      for (let pi = 0; pi < 5; pi++) {
        const ni = (pi + 1) % 5;
        const ddx = poly[ni].x - poly[pi].x, ddy = poly[ni].y - poly[pi].y;
        const d = ddx * ddx + ddy * ddy;
        if (d < minDist) { minDist = d; mergeIdx = pi; }
      }
      const ni = (mergeIdx + 1) % 5;
      const mid = { x: (poly[mergeIdx].x + poly[ni].x) / 2, y: (poly[mergeIdx].y + poly[ni].y) / 2 };
      const newPoly = [];
      for (let pi = 0; pi < 5; pi++) {
        if (pi === mergeIdx) newPoly.push(mid);
        else if (pi !== ni) newPoly.push(poly[pi]);
      }
      poly = newPoly;
    }
    if (poly.length < 4) continue;

    const aspectMatch = 1 - Math.abs(aspect - params.targetAspect) * 3;
    if (aspectMatch < 0) continue;

    // Score: strongly prefer large filled contours with good 5:7 aspect
    // NO persistence bias — each call is independent (persistence = 1 always)
    const rectFill = contour.area / (br.width * br.height);
    const ptPenalty = poly.length === 4 ? 1 : 0.7;
    const score = contour.area * Math.max(0.3, rectFill) * (0.3 + aspectMatch) * ptPenalty;

    if (score > bestScore) {
      bestScore = score;
      detected = true;
      lastRectFill = rectFill;
      lastAspect = aspect;
      debugInfo = `a=${contour.area} asp=${aspect.toFixed(2)} rf=${rectFill.toFixed(2)} pts=${poly.length}`;

      if (poly.length === 4) {
        const sq = sortCorners(poly);
        const sides: number[] = [];
        for (let si = 0; si < 4; si++) {
          const sa = sq[si], sb = sq[(si + 1) % 4];
          sides.push(Math.sqrt((sb.x - sa.x) ** 2 + (sb.y - sa.y) ** 2));
        }
        const maxS = Math.max(...sides), minS = Math.min(...sides);
        if (minS <= maxS * params.sideRatioMin) {
          cardCorners = buildCardCorners(br);
        } else if (hullPts.length >= 8) {
          // Line fitting: fit lines to hull segments between corners, intersect for precision
          const refined = sq.map(p => ({ ...p }));
          for (let si = 0; si < 4; si++) {
            const c1 = sq[si], c2 = sq[(si + 1) % 4];
            // Collect hull points near this edge
            const ex = c2.x - c1.x, ey = c2.y - c1.y;
            const eLen = Math.sqrt(ex * ex + ey * ey) || 1;
            const enx = ex / eLen, eny = ey / eLen;
            const pts2: { x: number; y: number }[] = [];
            for (const hp of hullPts) {
              const dx = hp.x - c1.x, dy = hp.y - c1.y;
              const proj = dx * enx + dy * eny;
              const perp = Math.abs(dx * (-eny) + dy * enx);
              if (proj > eLen * 0.1 && proj < eLen * 0.9 && perp < eLen * 0.3) {
                pts2.push(hp);
              }
            }
            if (pts2.length >= 3) {
              // Least squares line: y = mx + b (or x = my + b for vertical)
              const useX = Math.abs(ex) > Math.abs(ey);
              let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0;
              for (const p of pts2) {
                const a = useX ? p.x : p.y;
                const b2 = useX ? p.y : p.x;
                sumA += a; sumB += b2; sumAB += a * b2; sumA2 += a * a;
              }
              const n = pts2.length;
              const det = n * sumA2 - sumA * sumA;
              if (Math.abs(det) > 1e-6) {
                const m = (n * sumAB - sumA * sumB) / det;
                const b2 = (sumB - m * sumA) / n;
                // Shift corner along the edge normal by the line offset at that position
                const c1proj = useX ? c1.x : c1.y;
                const c1perp = useX ? c1.y : c1.x;
                const fitPerp = m * c1proj + b2;
                const shift = fitPerp - c1perp;
                if (Math.abs(shift) < params.lineFitMaxShift) {
                  if (useX) refined[si].y += shift * params.lineFitFactor;
                  else refined[si].x += shift * params.lineFitFactor;
                }
                const c2proj = useX ? c2.x : c2.y;
                const c2perp = useX ? c2.y : c2.x;
                const fitPerp2 = m * c2proj + b2;
                const shift2 = fitPerp2 - c2perp;
                if (Math.abs(shift2) < params.lineFitMaxShift) {
                  if (useX) refined[(si + 1) % 4].y += shift2 * params.lineFitFactor;
                  else refined[(si + 1) % 4].x += shift2 * params.lineFitFactor;
                }
              }
            }
          }
          cardCorners = refined;
        } else {
          cardCorners = sq;
        }
      } else {
        cardCorners = buildCardCorners(br);
      }
    }
  }

  // 10. Edge refinement: for each edge, scan perpendicular to find actual Canny border
  if (detected && cardCorners.length === 4) {
    const cannyOrig = gray.data;
    const shifts = Array.from({ length: 4 }, () => ({ x: 0, y: 0, n: 0 }));

    for (let ei = 0; ei < 4; ei++) {
      const p1 = cardCorners[ei], p2 = cardCorners[(ei + 1) % 4];
      const edx = p2.x - p1.x, edy = p2.y - p1.y;
      const elen = Math.sqrt(edx * edx + edy * edy) || 1;
      // Inward normal for CW polygon (TL->TR->BR->BL)
      const nx = -edy / elen, ny = edx / elen;

      // Sample along edge, scan perpendicularly for nearest Canny edge
      const offsets: number[] = [];
      for (let si = 1; si <= params.refineSamples; si++) {
        const t = si / (params.refineSamples + 2);
        const sx = p1.x + edx * t, sy = p1.y + edy * t;
        for (let scanD = params.refineScanMin; scanD <= params.refineScanMax; scanD++) {
          const px = Math.round(sx + nx * scanD);
          const py = Math.round(sy + ny * scanD);
          if (px >= 0 && py >= 0 && px < w && py < h && cannyOrig[py * w + px] > 0) {
            offsets.push(scanD);
            break;
          }
        }
      }
      if (offsets.length >= 3) {
        offsets.sort((a, b) => a - b);
        const med = offsets[Math.floor(offsets.length / 2)];
        shifts[ei].x += nx * med; shifts[ei].y += ny * med; shifts[ei].n++;
        shifts[(ei + 1) % 4].x += nx * med; shifts[(ei + 1) % 4].y += ny * med; shifts[(ei + 1) % 4].n++;
      }
    }
    for (let ci = 0; ci < 4; ci++) {
      if (shifts[ci].n > 0) {
        cardCorners[ci] = {
          x: cardCorners[ci].x + shifts[ci].x / shifts[ci].n,
          y: cardCorners[ci].y + shifts[ci].y / shifts[ci].n,
        };
      }
    }
  }

  // 11. Quality score computation
  let qualityScore = 0;
  if (detected && cardCorners.length === 4) {
    const topLen = Math.sqrt((cardCorners[1].x - cardCorners[0].x) ** 2 + (cardCorners[1].y - cardCorners[0].y) ** 2);
    const botLen = Math.sqrt((cardCorners[2].x - cardCorners[3].x) ** 2 + (cardCorners[2].y - cardCorners[3].y) ** 2);
    const leftLen = Math.sqrt((cardCorners[3].x - cardCorners[0].x) ** 2 + (cardCorners[3].y - cardCorners[0].y) ** 2);
    const rightLen = Math.sqrt((cardCorners[2].x - cardCorners[1].x) ** 2 + (cardCorners[2].y - cardCorners[1].y) ** 2);
    const avgW = (topLen + botLen) / 2;
    const avgH = (leftLen + rightLen) / 2;
    const quadAspect = Math.min(avgW, avgH) / Math.max(avgW, avgH);
    qualityScore = Math.max(0, 1 - Math.abs(quadAspect - params.targetAspect) * 3);
  }

  // 12. Build result
  const result: DetectCardResult = {
    detected,
    corners: detected ? cardCorners : null,
    debugInfo,
    rectFill: lastRectFill,
    aspect: lastAspect,
    qualityScore,
  };

  if (returnBuffers) {
    result.buffers = {
      gray,
      edges,
      blurred,
      scharr,
      contours,
      prevThreshold: rawThresh,
    };
  }

  return result;
}
