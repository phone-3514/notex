"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadNote, saveNote } from "./localStorage";

export type SaveStatus = "saved" | "saving" | "unsaved";

const AUTOSAVE_DELAY_MS = 500;
const DEFAULT_TITLE = "Untitled Note";
export const DEFAULT_CONTENT = `# Notex

Type Markdown on the left. Start a line with "= " for display math, or wrap an expression like @eps>0@ in "@" signs for inline math.

= sum n=1~oo 1/n

= int 0~1 x^2 dx

= sqrt(x+y)

Suppose @A in Mn(R)@.

@forall eps>0 exists delta>0@
`;

export function useNoteStorage() {
  const [title, setTitleState] = useState<string>(DEFAULT_TITLE);
  const [content, setContentState] = useState<string>(DEFAULT_CONTENT);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [hydrated, setHydrated] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title: DEFAULT_TITLE, content: DEFAULT_CONTENT });

  useEffect(() => {
    const hydrateFromStorage = () => {
      const existing = loadNote();
      if (existing) {
        setTitleState(existing.title);
        setContentState(existing.content);
        latest.current = { title: existing.title, content: existing.content };
      } else {
        saveNote(DEFAULT_TITLE, DEFAULT_CONTENT);
      }
      setHydrated(true);
    };
    hydrateFromStorage();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleSave = useCallback(() => {
    setStatus("unsaved");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveNote(latest.current.title, latest.current.content);
      setStatus("saved");
    }, AUTOSAVE_DELAY_MS);
  }, []);

  // Bypasses the debounce to save right away (Cmd+S).
  const saveNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    saveNote(latest.current.title, latest.current.content);
    setStatus("saved");
  }, []);

  const setContent = useCallback(
    (next: string) => {
      latest.current.content = next;
      setContentState(next);
      scheduleSave();
    },
    [scheduleSave]
  );

  const setTitle = useCallback(
    (next: string) => {
      latest.current.title = next;
      setTitleState(next);
      scheduleSave();
    },
    [scheduleSave]
  );

  return { title, setTitle, content, setContent, status, hydrated, saveNow };
}
