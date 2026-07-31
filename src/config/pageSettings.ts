// Single source of truth for paper dimensions — every place that needs A3/A2
// sizing (Preview's page canvas, the print "@page" rule) computes from here,
// so the numbers are never duplicated between components/CSS.

export type PaperSize = "A3" | "A2";
export type Orientation = "portrait" | "landscape";

export interface PageSettings {
  size: PaperSize;
  orientation: Orientation;
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = { size: "A3", orientation: "landscape" };

const PORTRAIT_DIMENSIONS_MM: Record<PaperSize, { width: number; height: number }> = {
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
};

export function getPageDimensionsMm({ size, orientation }: PageSettings): { width: number; height: number } {
  const { width, height } = PORTRAIT_DIMENSIONS_MM[size];
  return orientation === "landscape" ? { width: height, height: width } : { width, height };
}

export function isPageSettings(value: unknown): value is PageSettings {
  const v = value as PageSettings | null;
  return (
    !!v &&
    typeof v === "object" &&
    (v.size === "A3" || v.size === "A2") &&
    (v.orientation === "portrait" || v.orientation === "landscape")
  );
}

// Pure parse of whatever usePageSettings finds in localStorage (or null, on
// first run) — kept separate from the hook so the fallback-on-malformed-data
// behavior is unit-testable without mounting a component.
export function parseStoredPageSettings(raw: string | null): PageSettings {
  if (!raw) return DEFAULT_PAGE_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPageSettings(parsed) ? parsed : DEFAULT_PAGE_SETTINGS;
  } catch {
    return DEFAULT_PAGE_SETTINGS;
  }
}

// Preview-only zoom — not persisted (page size/orientation are; zoom is a
// transient viewing preference, reset on reload).
export type Zoom = "fit" | "75" | "100";
export const DEFAULT_ZOOM: Zoom = "fit";

// The "@page" print rule text for the given settings — page.tsx injects this
// into a <style> tag, since the selected size is runtime state and can't
// live in static CSS.
export function buildPageCssRule(settings: PageSettings): string {
  const { width, height } = getPageDimensionsMm(settings);
  return `@page { size: ${width}mm ${height}mm; }`;
}
