/* ------------------------------------------------------------------ *
 *  Demo interface & registry types
 * ------------------------------------------------------------------ */

import type { ControlDef } from '../ui/controls';
import type { Profiler } from '../ui/profiler';

/**
 * Every demo module default-exports an object conforming to this shape.
 */
export interface Demo {
  title: string;
  category: string;
  description: string;
  controls: ControlDef[];
  setup(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    params: Record<string, unknown>,
  ): void;
  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ): void;
  onParamChange?(key: string, value: unknown): void;
  cleanup(): void;
}

/**
 * Entry in the global demo registry (lazy-loaded).
 */
export interface DemoEntry {
  id: string;
  title: string;
  category: string;
  loader: () => Promise<{ default: Demo }>;
}

/**
 * Ordered list of sidebar categories.
 */
export const CATEGORIES = [
  'Image Processing',
  'Feature Detection',
  'Face Detection',
  'Motion',
  'Transforms',
  'Extras',
] as const;

export type Category = (typeof CATEGORIES)[number];
