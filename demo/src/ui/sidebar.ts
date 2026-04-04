/* ------------------------------------------------------------------ *
 *  Category-grouped sidebar navigation
 * ------------------------------------------------------------------ */

import { CATEGORIES } from '../lib/demoBase';
import type { DemoEntry } from '../lib/demoBase';

export interface ExtraLink {
  label: string;
  href: string;
}

/**
 * Build a category-grouped sidebar into `nav`.
 *
 * - Demos are grouped under collapsible category headers.
 * - Extra links (API Ref, About, ...) appear at the bottom.
 */
export function buildSidebar(
  nav: HTMLElement,
  demos: DemoEntry[],
  onSelect: (id: string) => void,
  extraLinks?: ExtraLink[],
): void {
  nav.innerHTML = '';

  // Group demos by category, preserving CATEGORIES order
  const byCategory = new Map<string, DemoEntry[]>();
  for (const cat of CATEGORIES) {
    byCategory.set(cat, []);
  }
  for (const d of demos) {
    const list = byCategory.get(d.category);
    if (list) list.push(d);
    else byCategory.set(d.category, [d]);
  }

  // Render each category group
  for (const [category, entries] of byCategory) {
    if (entries.length === 0) continue;

    const group = document.createElement('div');
    group.className = 'nav-group';

    const header = document.createElement('div');
    header.className = 'nav-group-header';
    header.textContent = category;
    header.addEventListener('click', () => {
      group.classList.toggle('collapsed');
    });
    group.appendChild(header);

    const list = document.createElement('div');
    list.className = 'nav-group-list';
    for (const entry of entries) {
      const a = document.createElement('a');
      a.href = `#/demos/${entry.id}`;
      a.textContent = entry.title;
      a.dataset.id = entry.id;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        setActive(nav, entry.id);
        onSelect(entry.id);
      });
      list.appendChild(a);
    }
    group.appendChild(list);

    nav.appendChild(group);
  }

  // Extra links section
  if (extraLinks && extraLinks.length > 0) {
    const sep = document.createElement('div');
    sep.className = 'nav-separator';
    nav.appendChild(sep);

    for (const link of extraLinks) {
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.label;
      a.dataset.id = link.href;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        setActive(nav, link.href);
        onSelect(link.href);
      });
      nav.appendChild(a);
    }
  }
}

/**
 * Toggle the `.active` class on the matching link.
 */
export function setActive(nav: HTMLElement, id: string): void {
  const links = nav.querySelectorAll('a');
  for (const link of links) {
    link.classList.toggle('active', link.dataset.id === id);
  }
}
