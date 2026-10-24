/* istanbul ignore file */
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

// Helpers for the page layout specs. The Karma context is an iframe of about
// 800x437 px with the Jasmine reporter above the fixture, so the specs resize
// the iframe to a laptop window and measure the page the way the screenshot
// harness in tests/visual does.

/** Resizes the Karma iframe and returns a function that restores it. */
export function resizeTestWindow(width: number, height: number): () => void {
  const frame = window.frameElement as HTMLElement | null;
  if (!frame) return () => undefined;
  const previous = { width: frame.style.width, height: frame.style.height };
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  return () => {
    frame.style.width = previous.width;
    frame.style.height = previous.height;
  };
}

interface PageLayout {
  /** window.innerHeight */
  window: number;
  /**
   * The document height the page would give in the app: the header, the
   * container padding, the page host with anything that overflows it, the
   * padding and the footer.
   */
  document: number;
  /** One rem in px. */
  rem: number;
  /** The tree table body (.tt-body). */
  body: number;
  /** The tree table header (.tt-header). */
  header: number;
  /** The header kept out of flex shrinking, as with no rows. */
  headerNoRows: number;
}

/** Measures a page whose host is sized from the window like compare's. */
export function measurePage(host: HTMLElement): PageLayout {
  const root = getComputedStyle(document.documentElement);
  const rem = parseFloat(root.fontSize);
  const token = (name: string) => {
    const probe = document.createElement('div');
    probe.style.height = `var(${name})`;
    document.body.appendChild(probe);
    const px = probe.getBoundingClientRect().height;
    probe.remove();
    return px;
  };
  const height = (el: Element | null) =>
    el ? el.getBoundingClientRect().height : 0;
  const header = host.querySelector('.tt-header') as HTMLElement | null;
  let headerNoRows = 0;
  if (header) {
    const flex = header.style.flex;
    header.style.flex = 'none';
    headerNoRows = height(header);
    header.style.flex = flex;
  }
  return {
    window: window.innerHeight,
    document:
      token('--app-header-height') +
      2 * rem +
      Math.max(host.clientHeight, host.scrollHeight) +
      token('--app-footer-height'),
    rem,
    body: height(host.querySelector('.tt-body')),
    header: height(header),
    headerNoRows,
  };
}
