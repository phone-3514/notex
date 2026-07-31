"use client";

import { useEffect, useMemo, useRef } from "react";
import { renderMarkdownToHtml } from "@/renderer/markdown";
import { findBlockForLine, scrollBlockIntoView } from "./previewScroll";
import { getPageDimensionsMm, type PageSettings, type Zoom } from "@/config/pageSettings";

interface PreviewProps {
  content: string;
  // 0-indexed editor cursor line. Only set while the user is actively
  // typing (see Editor's onCursorLineChange), so manual preview scrolling is
  // never fought outside of that.
  cursorLine?: number;
  pageSettings: PageSettings;
  zoom: Zoom;
}

export default function Preview({ content, cursorLine, pageSettings, zoom }: PreviewProps) {
  const html = useMemo(() => renderMarkdownToHtml(content), [content]);
  // The scrollable viewport, not the page canvas below — previewScroll's
  // querySelectorAll/getBoundingClientRect calls only care that this is the
  // actual scrolling element; they work the same regardless of how many
  // wrapper divs sit between it and the [data-src-line] elements.
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || cursorLine === undefined) return;
    const block = findBlockForLine(container, cursorLine);
    if (block) scrollBlockIntoView(container, block);
    // Deliberately keyed on cursorLine only: the DOM the effect reads is
    // already current by the time it runs (effects fire after the render
    // that updated dangerouslySetInnerHTML), and re-running on every content
    // change — rather than only when the cursor's line changes — would
    // re-scroll on every keystroke elsewhere in the document.
  }, [cursorLine]);

  const { width, height } = getPageDimensionsMm(pageSettings);
  // "Fit" scales the page's width to the panel (100% of the centering
  // wrapper below); 75%/100% use the page's real physical width in CSS "mm"
  // units, the standard unit print layout already relies on. No JS
  // measurement or transform: scale() needed either way.
  const pageWidth = zoom === "fit" ? "100%" : `${width * (zoom === "100" ? 1 : 0.75)}mm`;

  return (
    <div ref={containerRef} className="mn-page-viewport h-full overflow-auto bg-neutral-100 dark:bg-neutral-900">
      <div className="mn-page-frame p-6">
        {/* mx-auto (block-level centering), not flex+justify-center: a flex
            child's explicit width is only a flex-basis and flex's
            justify-content: center clips an overflowing item asymmetrically,
            hiding its start edge with no way to scroll to it. A block
            element's width is authoritative and mx-auto centers a page
            narrower than the panel while leaving one wider than it fully
            scrollable in both directions, matching "scrollable when page
            exceeds panel". */}
        <div
          className="mn-page mx-auto bg-white text-neutral-900 shadow-sm border border-neutral-200"
          style={{ width: pageWidth, aspectRatio: `${width} / ${height}` }}
        >
          <div className="prose-mathnote p-4 text-[17px] leading-[1.75]" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}
