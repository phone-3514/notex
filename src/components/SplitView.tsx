"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Editor from "./Editor";
import Preview from "./Preview";
import type { PageSettings, Zoom } from "@/config/pageSettings";

export type ViewMode = "editor" | "split" | "preview";

interface SplitViewProps {
  content: string;
  onChange: (value: string) => void;
  viewMode: ViewMode;
  isNarrow: boolean;
  pageSettings: PageSettings;
  zoom: Zoom;
}

const MIN_RATIO = 0.3;
const MAX_RATIO = 0.7;

export default function SplitView({ content, onChange, viewMode, isNarrow, pageSettings, zoom }: SplitViewProps) {
  const [ratio, setRatio] = useState(0.5);
  const [cursorLine, setCursorLine] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const endDragRef = useRef<(() => void) | null>(null);

  // Split mode is unavailable on narrow screens — the user picks Editor or
  // Preview instead of squeezing both into unusable widths.
  const effectiveMode = isNarrow && viewMode === "split" ? "editor" : viewMode;
  const showEditor = effectiveMode !== "preview";
  const showPreview = effectiveMode !== "editor";
  const showDivider = effectiveMode === "split";

  // Each drag session gets its own pair of handlers so pointerup can remove
  // itself without a self-referencing callback.
  const startDragging = useCallback((e: ReactPointerEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const handleMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const next = (ev.clientX - rect.left) / rect.width;
      setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, next)));
    };
    const handleUp = () => {
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      endDragRef.current = null;
    };

    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    endDragRef.current = handleUp;
  }, []);

  // Safety net in case the component unmounts mid-drag.
  useEffect(() => () => endDragRef.current?.(), []);

  const editorWidth = !showEditor ? "0%" : showDivider ? `${ratio * 100}%` : "100%";
  const previewWidth = !showPreview ? "0%" : showDivider ? `${(1 - ratio) * 100}%` : "100%";

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1">
      <div
        className="h-full min-w-0 overflow-y-auto overflow-x-hidden border-neutral-200 dark:border-neutral-800"
        style={{ width: editorWidth, borderRightWidth: showDivider ? 0 : undefined }}
      >
        <Editor value={content} onChange={onChange} onCursorLineChange={setCursorLine} />
      </div>

      {showDivider && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and preview panels"
          onPointerDown={startDragging}
          className="w-1 shrink-0 cursor-col-resize bg-neutral-200 transition-colors hover:bg-neutral-400 dark:bg-neutral-800 dark:hover:bg-neutral-600"
        />
      )}

      <div
        id="print-area"
        className="h-full min-w-0 overflow-y-auto overflow-x-hidden"
        style={{ width: previewWidth }}
      >
        <Preview content={content} cursorLine={cursorLine} pageSettings={pageSettings} zoom={zoom} />
      </div>
    </div>
  );
}
