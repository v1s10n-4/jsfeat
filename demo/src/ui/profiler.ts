/* ------------------------------------------------------------------ *
 *  Per-stage performance profiler with horizontal bar-chart renderer
 * ------------------------------------------------------------------ */

const HISTORY = 30; // frames to average over

interface StageTiming {
  name: string;
  start: number;
  total: number;          // running sum of the last HISTORY entries
  ring: Float64Array;     // circular buffer
  idx: number;
}

export class Profiler {
  private stages: Map<string, StageTiming> = new Map();
  private order: string[] = [];
  private frameStartTime = 0;
  private frameTimes: Float64Array = new Float64Array(HISTORY);
  private frameIdx = 0;
  private frameTotal = 0;
  private frameCount = 0;

  /** Call at the very start of a frame. */
  frameStart(): void {
    this.frameStartTime = performance.now();
  }

  /** Begin timing a named stage within the frame. */
  start(name: string): void {
    let s = this.stages.get(name);
    if (!s) {
      s = {
        name,
        start: 0,
        total: 0,
        ring: new Float64Array(HISTORY),
        idx: 0,
      };
      this.stages.set(name, s);
      this.order.push(name);
    }
    s.start = performance.now();
  }

  /** End timing a named stage. */
  end(name: string): void {
    const s = this.stages.get(name);
    if (!s) return;
    const elapsed = performance.now() - s.start;

    // Update circular buffer
    s.total -= s.ring[s.idx];
    s.ring[s.idx] = elapsed;
    s.total += elapsed;
    s.idx = (s.idx + 1) % HISTORY;
  }

  /** Call at the end of a frame. */
  frameEnd(): void {
    const elapsed = performance.now() - this.frameStartTime;

    this.frameTotal -= this.frameTimes[this.frameIdx];
    this.frameTimes[this.frameIdx] = elapsed;
    this.frameTotal += elapsed;
    this.frameIdx = (this.frameIdx + 1) % HISTORY;

    if (this.frameCount < HISTORY) this.frameCount++;
  }

  /** Average ms per frame (over last HISTORY frames). */
  avgFrameMs(): number {
    return this.frameCount > 0 ? this.frameTotal / this.frameCount : 0;
  }

  /** Average FPS. */
  avgFps(): number {
    const ms = this.avgFrameMs();
    return ms > 0 ? 1000 / ms : 0;
  }

  /** Return stage averages in insertion order. */
  getStages(): { name: string; avgMs: number }[] {
    const count = Math.max(this.frameCount, 1);
    return this.order.map((name) => {
      const s = this.stages.get(name)!;
      return { name, avgMs: s.total / count };
    });
  }

  /** Reset all state (call when switching demos). */
  reset(): void {
    this.stages.clear();
    this.order = [];
    this.frameTimes.fill(0);
    this.frameIdx = 0;
    this.frameTotal = 0;
    this.frameCount = 0;
  }
}

// ---- renderer --------------------------------------------------------

const BAR_MAX_WIDTH = 180; // px

/**
 * Render profiler data into `container` as a horizontal bar chart.
 * Called once per frame; lightweight DOM reuse via innerHTML.
 */
export function renderProfiler(
  container: HTMLElement,
  profiler: Profiler,
): void {
  const stages = profiler.getStages();
  const totalMs = profiler.avgFrameMs();
  const fps = profiler.avgFps();

  let html = '';

  for (const s of stages) {
    const pct = totalMs > 0 ? (s.avgMs / totalMs) * 100 : 0;
    const barW = Math.max(1, (pct / 100) * BAR_MAX_WIDTH);
    html += `<div class="prof-row">
      <span class="prof-name">${s.name}</span>
      <span class="prof-bar" style="width:${barW}px"></span>
      <span class="prof-ms">${s.avgMs.toFixed(1)} ms</span>
    </div>`;
  }

  html += `<div class="prof-total">${fps.toFixed(0)} FPS &mdash; ${totalMs.toFixed(1)} ms/frame</div>`;

  container.innerHTML = html;
}
