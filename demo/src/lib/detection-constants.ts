/**
 * All card detection pipeline constants in one place.
 * Used by demos.ts (processing), DetectionPanel.tsx (UI controls), and DevPage.tsx (defaults).
 */

export const DETECTION_DEFAULTS = {
  // --- Main controls (visible in panel) ---
  blurKernel: 9,
  cannyLow: 20,
  cannyHigh: 60,
  minContourArea: 1000,
  morphRadius: 5,
  erosionRadius: 2,
  scharrThreshold: 30,
  warmthThreshold: 25,

  // --- Advanced controls (in Sheet drawer) ---
  // Preprocessing
  equalizationThreshold: 100,
  minBlurKernel: 15,

  // Edge detection
  chromaThreshold: 30,
  warmthBorderMargin: 30,

  // Morphology
  morphThresholdBias: 7,
  morphThresholdMin: 8,
  morphSmoothing: 0.7,
  erosionThreshold: 200,

  // Contour filtering
  minAreaRatio: 0.03,
  maxAreaRatio: 0.4,
  borderMargin: 3,
  minAspect: 0.35,
  targetAspect: 5 / 7,
  sideRatioMin: 0.2,

  // Corner refinement
  refineSamples: 16,
  refineScanMin: -40,
  refineScanMax: 15,
  lineFitFactor: 0.9,
  lineFitMaxShift: 30,

  // Temporal
  smoothingFactor: 0.7,
  jumpThreshold: 80,
  graceFrames: 12,
  persistenceDistance: 100,
  persistenceBoost: 1.5,

  // Display / debug overlay
  debugFontSize: 22,
  warpPreviewSize: 300,
  qualityChartWidth: 140,
} as const;

export type DetectionParamKey = keyof typeof DETECTION_DEFAULTS;
export type DetectionParams = Record<DetectionParamKey, number>;

/** Slider definitions for the main controls panel (2-col grid, always visible). */
export const MAIN_SLIDERS: { key: DetectionParamKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'cannyLow', label: 'Canny Low', min: 5, max: 100, step: 1 },
  { key: 'cannyHigh', label: 'Canny High', min: 20, max: 250, step: 1 },
  { key: 'blurKernel', label: 'Blur Kernel', min: 3, max: 21, step: 2 },
  { key: 'minContourArea', label: 'Min Area', min: 200, max: 50000, step: 100 },
  { key: 'morphRadius', label: 'Morph Radius', min: 2, max: 12, step: 1 },
  { key: 'erosionRadius', label: 'Erosion Radius', min: 1, max: 5, step: 1 },
  { key: 'scharrThreshold', label: 'Scharr Thresh', min: 10, max: 80, step: 1 },
  { key: 'warmthThreshold', label: 'Warmth Thresh', min: 10, max: 60, step: 1 },
];

/** Slider definitions for advanced settings (in Sheet drawer). */
export const ADVANCED_SLIDERS: { section: string; sliders: { key: DetectionParamKey; label: string; min: number; max: number; step: number }[] }[] = [
  {
    section: 'Preprocessing',
    sliders: [
      { key: 'equalizationThreshold', label: 'Equalize Thresh', min: 50, max: 200, step: 5 },
      { key: 'minBlurKernel', label: 'Min Blur Kernel', min: 7, max: 21, step: 2 },
    ],
  },
  {
    section: 'Edge Detection',
    sliders: [
      { key: 'chromaThreshold', label: 'Chroma Thresh', min: 10, max: 60, step: 1 },
      { key: 'warmthBorderMargin', label: 'Color Border Margin', min: 10, max: 80, step: 5 },
    ],
  },
  {
    section: 'Morphology',
    sliders: [
      { key: 'morphThresholdBias', label: 'Morph Bias', min: 0, max: 20, step: 1 },
      { key: 'morphSmoothing', label: 'Morph Smoothing', min: 0.1, max: 0.95, step: 0.05 },
      { key: 'erosionThreshold', label: 'Erosion Thresh', min: 100, max: 250, step: 10 },
    ],
  },
  {
    section: 'Contour Filtering',
    sliders: [
      { key: 'minAspect', label: 'Min Aspect', min: 0.2, max: 0.6, step: 0.05 },
      { key: 'maxAreaRatio', label: 'Max Area %', min: 0.2, max: 0.6, step: 0.05 },
      { key: 'sideRatioMin', label: 'Side Ratio Min', min: 0.1, max: 0.5, step: 0.05 },
    ],
  },
  {
    section: 'Corner Refinement',
    sliders: [
      { key: 'refineScanMin', label: 'Scan Out', min: -80, max: -5, step: 5 },
      { key: 'refineScanMax', label: 'Scan In', min: 5, max: 40, step: 5 },
      { key: 'lineFitFactor', label: 'Line Fit Factor', min: 0.1, max: 1.5, step: 0.1 },
    ],
  },
  {
    section: 'Temporal',
    sliders: [
      { key: 'smoothingFactor', label: 'Smoothing', min: 0.1, max: 0.95, step: 0.05 },
      { key: 'jumpThreshold', label: 'Jump Thresh', min: 20, max: 200, step: 10 },
      { key: 'graceFrames', label: 'Grace Frames', min: 0, max: 30, step: 1 },
    ],
  },
  {
    section: 'Display',
    sliders: [
      { key: 'debugFontSize', label: 'Debug Font Size', min: 10, max: 28, step: 1 },
      { key: 'warpPreviewSize', label: 'Card Preview Width', min: 80, max: 600, step: 10 },
      { key: 'qualityChartWidth', label: 'Quality Chart Width', min: 60, max: 200, step: 10 },
    ],
  },
];
