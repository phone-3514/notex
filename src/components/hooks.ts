"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PAGE_SETTINGS,
  parseStoredPageSettings,
  type Orientation,
  type PageSettings,
  type PaperSize,
} from "@/config/pageSettings";

const THEME_KEY = "mathnote:theme";

export function useDarkMode() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      const stored = window.localStorage.getItem(THEME_KEY);
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDark(stored ? stored === "dark" : prefersDark);
      setReady(true);
    };
    syncFromStorage();
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark, ready]);

  const toggle = useCallback(() => setDark((d) => !d), []);
  return { dark, toggle };
}

// Below this width, forcing a 50/50 split leaves both panels too narrow to
// use, so the app switches to single-panel views instead.
const NARROW_BREAKPOINT_PX = 768;

export function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT_PX - 1}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return narrow;
}

const PAGE_SETTINGS_KEY = "mathnote:pageSettings";

// Same localStorage-persisted-state shape as useDarkMode above: read once on
// mount, write on every change thereafter.
export function usePageSettings() {
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      setSettings(parseStoredPageSettings(window.localStorage.getItem(PAGE_SETTINGS_KEY)));
      setReady(true);
    };
    syncFromStorage();
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(PAGE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, ready]);

  const setSize = useCallback((size: PaperSize) => setSettings((s) => ({ ...s, size })), []);
  const setOrientation = useCallback(
    (orientation: Orientation) => setSettings((s) => ({ ...s, orientation })),
    []
  );

  return { settings, setSize, setOrientation };
}
