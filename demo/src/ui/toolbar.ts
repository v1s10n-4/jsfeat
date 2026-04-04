/* ------------------------------------------------------------------ *
 *  Toolbar: resolution picker, freeze/resume, capture, fullscreen
 * ------------------------------------------------------------------ */

export interface ToolbarCallbacks {
  onResolution(width: number, height: number): void;
  onFreeze(frozen: boolean): void;
  onCapture(): void;
  onFullscreen(): void;
}

const RESOLUTIONS: { label: string; w: number; h: number }[] = [
  { label: '320 x 240', w: 320, h: 240 },
  { label: '640 x 480', w: 640, h: 480 },
  { label: '1280 x 720', w: 1280, h: 720 },
];

/**
 * Build the toolbar into `container` and wire up callbacks.
 * Returns an object with helpers to update button state.
 */
export function buildToolbar(
  container: HTMLElement,
  callbacks: ToolbarCallbacks,
): { setFrozen(frozen: boolean): void } {
  container.innerHTML = '';

  // ---- resolution picker ----
  const resSelect = document.createElement('select');
  resSelect.className = 'tb-select';
  for (const r of RESOLUTIONS) {
    const opt = document.createElement('option');
    opt.value = `${r.w}x${r.h}`;
    opt.textContent = r.label;
    if (r.w === 640) opt.selected = true;
    resSelect.appendChild(opt);
  }
  resSelect.addEventListener('change', () => {
    const [w, h] = resSelect.value.split('x').map(Number);
    callbacks.onResolution(w, h);
  });
  container.appendChild(resSelect);

  // ---- freeze / resume ----
  let frozen = false;
  const freezeBtn = btn('Freeze', 'tb-btn');
  freezeBtn.addEventListener('click', () => {
    frozen = !frozen;
    freezeBtn.textContent = frozen ? 'Resume' : 'Freeze';
    freezeBtn.classList.toggle('tb-btn--active', frozen);
    callbacks.onFreeze(frozen);
  });
  container.appendChild(freezeBtn);

  // ---- capture PNG ----
  const captureBtn = btn('Capture', 'tb-btn');
  captureBtn.addEventListener('click', () => {
    callbacks.onCapture();
  });
  container.appendChild(captureBtn);

  // ---- fullscreen ----
  const fsBtn = btn('Fullscreen', 'tb-btn');
  fsBtn.addEventListener('click', () => {
    callbacks.onFullscreen();
  });
  container.appendChild(fsBtn);

  return {
    setFrozen(v: boolean) {
      frozen = v;
      freezeBtn.textContent = v ? 'Resume' : 'Freeze';
      freezeBtn.classList.toggle('tb-btn--active', v);
    },
  };
}

// ---- helpers ---------------------------------------------------------

function btn(text: string, className: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = className;
  b.textContent = text;
  return b;
}
