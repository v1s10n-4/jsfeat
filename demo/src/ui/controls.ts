/* ------------------------------------------------------------------ *
 *  Declarative parameter-control panel
 *  Each demo declares a ControlDef[] array; buildControls() renders
 *  them into a container and returns the initial values.
 * ------------------------------------------------------------------ */

// ---- type definitions ------------------------------------------------

export interface SliderDef {
  type: 'slider';
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface CheckboxDef {
  type: 'checkbox';
  key: string;
  label: string;
  value: boolean;
}

export interface DropdownDef {
  type: 'dropdown';
  key: string;
  label: string;
  options: { label: string; value: string }[];
  value: string;
}

export interface ButtonDef {
  type: 'button';
  label: string;
  action: string;           // key sent via onChange
}

export interface SeparatorDef {
  type: 'separator';
  label?: string;
}

export type ControlDef =
  | SliderDef
  | CheckboxDef
  | DropdownDef
  | ButtonDef
  | SeparatorDef;

// ---- builder ---------------------------------------------------------

/**
 * Render controls into `container` from a ControlDef[] descriptor and
 * return an object holding the initial values.
 *
 * `onChange(key, value)` fires on every user interaction.
 */
export function buildControls(
  container: HTMLElement,
  defs: ControlDef[],
  onChange: (key: string, value: unknown) => void,
): Record<string, unknown> {
  container.innerHTML = '';
  const values: Record<string, unknown> = {};

  for (const def of defs) {
    switch (def.type) {
      case 'slider': {
        values[def.key] = def.value;
        const row = el('div', 'ctrl-row');

        const label = el('label', 'ctrl-label');
        label.textContent = def.label;
        row.appendChild(label);

        const valSpan = el('span', 'ctrl-value');
        valSpan.textContent = String(def.value);
        row.appendChild(valSpan);

        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(def.min);
        input.max = String(def.max);
        input.step = String(def.step);
        input.value = String(def.value);
        input.className = 'ctrl-slider';
        input.addEventListener('input', () => {
          const v = Number(input.value);
          valSpan.textContent = String(v);
          values[def.key] = v;
          onChange(def.key, v);
        });
        row.appendChild(input);
        container.appendChild(row);
        break;
      }

      case 'checkbox': {
        values[def.key] = def.value;
        const row = el('div', 'ctrl-row ctrl-row--inline');

        const label = document.createElement('label');
        label.className = 'ctrl-check-label';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = def.value;
        input.addEventListener('change', () => {
          values[def.key] = input.checked;
          onChange(def.key, input.checked);
        });
        label.appendChild(input);

        const span = document.createElement('span');
        span.textContent = ' ' + def.label;
        label.appendChild(span);

        row.appendChild(label);
        container.appendChild(row);
        break;
      }

      case 'dropdown': {
        values[def.key] = def.value;
        const row = el('div', 'ctrl-row');

        const label = el('label', 'ctrl-label');
        label.textContent = def.label;
        row.appendChild(label);

        const select = document.createElement('select');
        select.className = 'ctrl-select';
        for (const opt of def.options) {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (opt.value === def.value) o.selected = true;
          select.appendChild(o);
        }
        select.addEventListener('change', () => {
          values[def.key] = select.value;
          onChange(def.key, select.value);
        });
        row.appendChild(select);
        container.appendChild(row);
        break;
      }

      case 'button': {
        const row = el('div', 'ctrl-row');
        const btn = document.createElement('button');
        btn.className = 'ctrl-btn';
        btn.textContent = def.label;
        btn.addEventListener('click', () => {
          onChange(def.action, true);
        });
        row.appendChild(btn);
        container.appendChild(row);
        break;
      }

      case 'separator': {
        const sep = el('div', 'ctrl-separator');
        if (def.label) {
          const span = el('span', 'ctrl-sep-label');
          span.textContent = def.label;
          sep.appendChild(span);
        }
        container.appendChild(sep);
        break;
      }
    }
  }

  return values;
}

// ---- helpers ---------------------------------------------------------

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
