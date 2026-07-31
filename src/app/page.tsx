"use client";

import { useCallback, useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import SplitView, { type ViewMode } from "@/components/SplitView";
import CommandsModal from "@/components/CommandsModal";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { useDarkMode, useIsNarrow, usePageSettings } from "@/components/hooks";
import { useNoteStorage } from "@/storage/useNoteStorage";
import { buildPageCssRule, DEFAULT_ZOOM, type Zoom } from "@/config/pageSettings";

export default function Home() {
  const { title, setTitle, content, setContent, status, hydrated, saveNow } = useNoteStorage();
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [commandsOpen, setCommandsOpen] = useState(false);
  const isNarrow = useIsNarrow();
  const { dark, toggle } = useDarkMode();
  const { settings: pageSettings, setSize: setPaperSize, setOrientation } = usePageSettings();
  const [zoom, setZoom] = useState<Zoom>(DEFAULT_ZOOM);

  const exportPdf = useCallback(() => {
    window.print();
  }, []);

  // The selected paper size/orientation is runtime (localStorage-persisted)
  // state, so the "@page" print rule can't live in static CSS — it's
  // injected as its own <style> tag and kept in sync with pageSettings.
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = buildPageCssRule(pageSettings);
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, [pageSettings]);

  // View/save/export shortcuts operate on app-level state, independent of
  // which element currently has focus, so they're handled at the window
  // level (unlike Cmd+B/1/2/3, which need the editor's own selection and are
  // handled inside Editor.tsx).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.metaKey) return;

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (e.shiftKey) setViewMode("preview");
        else exportPdf();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        if (e.shiftKey) setViewMode("split");
        else saveNow();
        return;
      }
      if ((e.key === "e" || e.key === "E") && e.shiftKey) {
        e.preventDefault();
        setViewMode("editor");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exportPdf, saveNow]);

  if (!hydrated) {
    return <div className="flex-1 bg-white dark:bg-neutral-950" />;
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      <TopBar
        title={title}
        onTitleChange={setTitle}
        status={status}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isNarrow={isNarrow}
        dark={dark}
        onToggleDark={toggle}
        onExportPdf={exportPdf}
        onOpenCommands={() => setCommandsOpen(true)}
        pageSettings={pageSettings}
        onPaperSizeChange={setPaperSize}
        onOrientationChange={setOrientation}
        zoom={zoom}
        onZoomChange={setZoom}
      />
      <SuggestionsPanel content={content} onChange={setContent} />
      <SplitView
        content={content}
        onChange={setContent}
        viewMode={viewMode}
        isNarrow={isNarrow}
        pageSettings={pageSettings}
        zoom={zoom}
      />
      <CommandsModal open={commandsOpen} onClose={() => setCommandsOpen(false)} />
    </div>
  );
}
