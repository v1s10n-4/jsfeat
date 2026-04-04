/* ------------------------------------------------------------------ *
 *  Placeholder demo for entries that don't have an implementation yet
 * ------------------------------------------------------------------ */

import type { Demo } from '../lib/demoBase';

const placeholder: Demo = {
  title: 'Coming Soon',
  category: 'Extras',
  description: 'This demo is not yet implemented.',
  controls: [],

  setup(_canvas: HTMLCanvasElement, _video: HTMLVideoElement) {
    // nothing to set up
  },

  process(
    ctx: CanvasRenderingContext2D,
    _video: HTMLVideoElement,
    w: number,
    h: number,
  ) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#555';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Coming soon', w / 2, h / 2 - 16);

    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#444';
    ctx.fillText('This demo is under development', w / 2, h / 2 + 20);

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  },

  cleanup() {
    // nothing to clean up
  },
};

export default placeholder;
