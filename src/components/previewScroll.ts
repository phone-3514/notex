// Maps an editor cursor line to the preview block it falls in, and computes
// whether/where the preview's scroll container needs to move to keep that
// block visible. The layout math is kept pure (plain numbers in, a target
// scrollTop or null out) so it's testable without a real layout engine; only
// the thin wrappers below touch the DOM.

const DEFAULT_MARGIN_PX = 24;

/**
 * Returns the scrollTop the container should move to, or null if the block
 * is already fully visible (so callers don't fight the user's manual scroll
 * position on every keystroke).
 */
export function computeScrollTarget(
  containerScrollTop: number,
  containerClientHeight: number,
  elementTop: number,
  elementHeight: number,
  margin = DEFAULT_MARGIN_PX
): number | null {
  const elBottom = elementTop + elementHeight;
  const viewTop = containerScrollTop;
  const viewBottom = containerScrollTop + containerClientHeight;

  if (elementTop >= viewTop && elBottom <= viewBottom) return null;
  // Align the block's top just under the container's top edge. For a block
  // taller than the viewport (a tall display equation), this still shows its
  // start rather than jumping to wherever the bottom happens to land.
  return Math.max(0, elementTop - margin);
}

/** The element (if any) among `[data-src-line]` descendants that the given
 * editor line falls into: the closest one starting at or before that line. */
export function findBlockForLine(container: ParentNode, line: number): HTMLElement | null {
  const candidates = container.querySelectorAll<HTMLElement>("[data-src-line]");
  let best: HTMLElement | null = null;
  let bestLine = -1;
  for (const el of candidates) {
    const elLine = Number(el.dataset.srcLine);
    if (Number.isNaN(elLine)) continue;
    if (elLine <= line && elLine > bestLine) {
      best = el;
      bestLine = elLine;
    }
  }
  return best;
}

/** Scrolls `container` (smoothly) so `element` is visible, unless it already is. */
export function scrollBlockIntoView(container: HTMLElement, element: HTMLElement): void {
  const containerRect = container.getBoundingClientRect();
  const elRect = element.getBoundingClientRect();
  const elementTop = elRect.top - containerRect.top + container.scrollTop;
  const target = computeScrollTarget(container.scrollTop, container.clientHeight, elementTop, elRect.height);
  if (target === null) return;
  container.scrollTo({ top: target, behavior: "smooth" });
}
