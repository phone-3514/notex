"use client";

import type { SaveStatus } from "@/storage/useNoteStorage";
import type { ViewMode } from "./SplitView";
import type { Orientation, PageSettings, PaperSize, Zoom } from "@/config/pageSettings";

interface TopBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  status: SaveStatus;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isNarrow: boolean;
  dark: boolean;
  onToggleDark: () => void;
  onExportPdf: () => void;
  onOpenCommands: () => void;
  pageSettings: PageSettings;
  onPaperSizeChange: (size: PaperSize) => void;
  onOrientationChange: (orientation: Orientation) => void;
  zoom: Zoom;
  onZoomChange: (zoom: Zoom) => void;
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved",
};

function ViewButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 text-xs border ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
          : "border-neutral-300 bg-transparent text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500"
      }`}
    >
      {label}
    </button>
  );
}

export default function TopBar({
  title,
  onTitleChange,
  status,
  viewMode,
  onViewModeChange,
  isNarrow,
  dark,
  onToggleDark,
  onExportPdf,
  onOpenCommands,
  pageSettings,
  onPaperSizeChange,
  onOrientationChange,
  zoom,
  onZoomChange,
}: TopBarProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950 print:hidden">
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label="Note title"
        className="min-w-0 flex-1 basis-full border-0 bg-transparent text-sm font-medium text-neutral-900 outline-none sm:basis-auto dark:text-neutral-100"
      />

      <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
        {STATUS_LABEL[status]}
      </span>

      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="View mode">
        <ViewButton label="Editor" active={viewMode === "editor"} onClick={() => onViewModeChange("editor")} />
        {!isNarrow && (
          <ViewButton label="Split" active={viewMode === "split"} onClick={() => onViewModeChange("split")} />
        )}
        <ViewButton label="Preview" active={viewMode === "preview"} onClick={() => onViewModeChange("preview")} />
      </div>

      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Paper size">
        <ViewButton label="A3" active={pageSettings.size === "A3"} onClick={() => onPaperSizeChange("A3")} />
        <ViewButton label="A2" active={pageSettings.size === "A2"} onClick={() => onPaperSizeChange("A2")} />
      </div>

      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Orientation">
        <ViewButton
          label="Portrait"
          active={pageSettings.orientation === "portrait"}
          onClick={() => onOrientationChange("portrait")}
        />
        <ViewButton
          label="Landscape"
          active={pageSettings.orientation === "landscape"}
          onClick={() => onOrientationChange("landscape")}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Zoom">
        <ViewButton label="Fit" active={zoom === "fit"} onClick={() => onZoomChange("fit")} />
        <ViewButton label="75%" active={zoom === "75"} onClick={() => onZoomChange("75")} />
        <ViewButton label="100%" active={zoom === "100"} onClick={() => onZoomChange("100")} />
      </div>

      <button
        type="button"
        onClick={onOpenCommands}
        className="shrink-0 border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500"
      >
        Commands
      </button>

      <button
        type="button"
        onClick={onExportPdf}
        className="shrink-0 border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500"
      >
        Export PDF
      </button>

      <button
        type="button"
        onClick={onToggleDark}
        aria-label="Toggle dark mode"
        className="shrink-0 border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500"
      >
        {dark ? "Light" : "Dark"}
      </button>
    </header>
  );
}
