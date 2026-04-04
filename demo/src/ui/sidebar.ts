export interface DemoEntry {
  id: string;
  label: string;
}

/**
 * Populate the sidebar nav with demo links and handle active state.
 */
export function buildSidebar(
  nav: HTMLElement,
  demos: DemoEntry[],
  onSelect: (id: string) => void,
): void {
  for (const demo of demos) {
    const a = document.createElement('a');
    a.href = '#' + demo.id;
    a.textContent = demo.label;
    a.dataset.id = demo.id;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setActive(nav, demo.id);
      onSelect(demo.id);
    });
    nav.appendChild(a);
  }
}

export function setActive(nav: HTMLElement, id: string): void {
  const links = nav.querySelectorAll('a');
  for (const link of links) {
    link.classList.toggle('active', link.dataset.id === id);
  }
}
