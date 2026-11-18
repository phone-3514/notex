"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type CompositionEvent,
} from "react";
import { matchMathSnippets, isNoteSnippetContext, type MathSnippet } from "@/editor/mathSnippets";
import { matchNoteSnippet } from "@/editor/noteSnippets";
import {
  wrapBold,
  insertHeading,
  indentSelection,
  outdentSelection,
  type IndentEdit,
  type TextState,
} from "@/editor/shortcuts";
import { isComposingInput } from "@/editor/composition";
import { getCaretCoordinates } from "@/editor/caretCoordinates";
import { lineNumberAt } from "@/editor/cursorLine";
import { highlightToHtml } from "@/editor/highlight";
import { UndoHistory } from "@/editor/undoHistory";
import AutocompleteMenu from "./AutocompleteMenu";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  // Reports the 0-indexed line the cursor is on whenever the content
  // actually changes (typing, snippet insertion, shortcuts) — not on plain
  // clicks/arrow-key navigation, so the preview only auto-scrolls while the
  // user is actively editing.
  onCursorLineChange?: (line: number) => void;
}

interface MenuState {
  suggestions: MathSnippet[];
  highlight: number;
  wordStart: number;
  top: number;
  left: number;
}

// The word autocomplete matches against: a contiguous run of letters
// immediately before the cursor.
const WORD_RE = /[A-Za-z]+$/;
// A note-snippet trigger: ";" followed by letters, immediately before the cursor.
const NOTE_TRIGGER_RE = /;[a-zA-Z]*$/;
// Where the editor's undo steps are saved (see saveHistory).
const UNDO_STORAGE_KEY = "mathnote:undo";

export default function Editor({ value, onChange, onCursorLineChange }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const composingRef = useRef(false);
  const [menu, setMenu] = useState<MenuState | null>(null);

  // Undo/redo: the editor keeps its own history (see editor/undoHistory.ts)
  // instead of the browser's, which programmatic edits wipe. `lastValueRef` is
  // the document as the history last saw it, so each change can be recorded as
  // a patch from it; `compositionStartRef` is the text before an IME
  // composition began, so a whole composition is one step.
  const historyRef = useRef<UndoHistory>(new UndoHistory());
  const lastValueRef = useRef(value);
  const compositionStartRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);

  // Saves the undo steps (debounced) so they survive a reload; they're only
  // reused if the saved note text is still the document they end at.
  const saveHistory = useCallback(() => {
    try {
      window.localStorage.setItem(UNDO_STORAGE_KEY, historyRef.current.serialize(lastValueRef.current));
    } catch {
      // Storage full or unavailable: undo still works for this session.
    }
  }, []);
  const scheduleHistorySave = useCallback(() => {
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(saveHistory, 600);
  }, [saveHistory]);

  // Records the document changing from the last seen value to `next`.
  const recordChange = useCallback(
    (next: string, sealed: boolean) => {
      historyRef.current.record(lastValueRef.current, next, { sealed });
      lastValueRef.current = next;
      scheduleHistorySave();
    },
    [scheduleHistorySave]
  );

  // The colour layer: the same text, drawn in syntax colours underneath the
  // (transparent-text) textarea. A trailing zero-width space keeps a final
  // empty line from collapsing, so both layers always have the same height.
  const highlightedHtml = useMemo(() => highlightToHtml(value) + "\u200b", [value]);

  // Keeps the colour layer pixel-aligned with the textarea: same scroll
  // offset, and the same wrapping width (the textarea loses width to its
  // scrollbar, so the layer gets matching extra right padding).
  const syncHighlightLayer = useCallback(() => {
    const ta = textareaRef.current;
    const layer = highlightRef.current;
    if (!ta || !layer) return;
    layer.style.paddingRight = `${16 + (ta.offsetWidth - ta.clientWidth)}px`;
    layer.scrollTop = ta.scrollTop;
  }, []);

  useEffect(() => {
    syncHighlightLayer();
  }, [value, syncHighlightLayer]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const observer = new ResizeObserver(syncHighlightLayer);
    observer.observe(ta);
    return () => observer.disconnect();
  }, [syncHighlightLayer]);

  // Writes the result of a text transform back into both React state and the
  // live DOM node, so the caret lands in the right place without waiting for
  // a re-render (the same trick that already keeps the cursor stable during
  // normal typing).
  const commit = useCallback(
    (state: TextState) => {
      recordChange(state.value, true);
      onChange(state.value);
      const el = textareaRef.current;
      if (el) {
        el.value = state.value;
        el.setSelectionRange(state.selectionStart, state.selectionEnd);
      }
      onCursorLineChange?.(lineNumberAt(state.value, state.selectionStart));
    },
    [onChange, onCursorLineChange, recordChange]
  );

  // Steps the editor's own history back/forward (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z).
  const stepHistory = useCallback(
    (direction: "undo" | "redo") => {
      const el = textareaRef.current;
      if (!el) return;
      const result = direction === "undo" ? historyRef.current.undo(el.value) : historyRef.current.redo(el.value);
      if (!result) return;
      lastValueRef.current = result.value;
      onChange(result.value);
      el.value = result.value;
      el.setSelectionRange(result.caret, result.caret);
      onCursorLineChange?.(lineNumberAt(result.value, result.caret));
      setMenu(null);
      scheduleHistorySave();
    },
    [onChange, onCursorLineChange, scheduleHistorySave]
  );

  // Restore the saved history once, at mount, if it belongs to this document.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(UNDO_STORAGE_KEY);
    } catch {
      saved = null;
    }
    historyRef.current = UndoHistory.restore(saved, value);
    lastValueRef.current = value;
    // Mount only: later changes of `value` are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The document changed from outside the textarea (e.g. a figure was saved
  // from the figure editor): make that its own undo step too.
  useEffect(() => {
    if (value !== lastValueRef.current) recordChange(value, true);
  }, [value, recordChange]);

  // Route the browser's own undo/redo requests (Edit menu, context menu) here,
  // and flush the saved history if the page is closing.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType === "historyUndo") {
        e.preventDefault();
        stepHistory("undo");
      } else if (e.inputType === "historyRedo") {
        e.preventDefault();
        stepHistory("redo");
      }
    };
    const flush = () => {
      window.clearTimeout(saveTimerRef.current);
      saveHistory();
    };
    el.addEventListener("beforeinput", onBeforeInput);
    window.addEventListener("pagehide", flush);
    return () => {
      el.removeEventListener("beforeinput", onBeforeInput);
      window.removeEventListener("pagehide", flush);
    };
  }, [stepHistory, saveHistory]);

  const updateAutocomplete = useCallback((el: HTMLTextAreaElement) => {
    if (composingRef.current) return;
    const pos = el.selectionStart;
    if (pos !== el.selectionEnd) {
      setMenu(null);
      return;
    }
    const word = WORD_RE.exec(el.value.slice(0, pos))?.[0] ?? "";
    if (!word) {
      setMenu(null);
      return;
    }
    if (isNoteSnippetContext(el.value, pos - word.length)) {
      setMenu(null);
      return;
    }
    const suggestions = matchMathSnippets(word);
    if (suggestions.length === 0) {
      setMenu(null);
      return;
    }
    const wordStart = pos - word.length;
    const caret = getCaretCoordinates(el, pos);
    setMenu({ suggestions, highlight: 0, wordStart, top: caret.top + caret.height, left: caret.left });
  }, []);

  const applySnippet = useCallback(
    (snippet: MathSnippet) => {
      const el = textareaRef.current;
      if (!el || !menu) return;
      const pos = el.selectionStart;
      const before = el.value.slice(0, menu.wordStart);
      const after = el.value.slice(pos);
      commit({
        value: before + snippet.insertText + after,
        selectionStart: menu.wordStart + snippet.selectStart,
        selectionEnd: menu.wordStart + snippet.selectEnd,
      });
      setMenu(null);
    },
    [commit, menu]
  );

  // Applies an indent/outdent as one undoable edit: the replaced range is
  // selected and overwritten via the browser's own insertText command, so
  // Cmd+Z undoes it in a single step (assigning el.value would wipe the undo
  // history). Falls back to a plain commit where that command isn't available.
  const applyIndentEdit = useCallback(
    (el: HTMLTextAreaElement, edit: IndentEdit) => {
      el.setSelectionRange(edit.from, edit.to);
      let applied = false;
      try {
        applied = document.execCommand("insertText", false, edit.text);
      } catch {
        applied = false;
      }
      if (applied && el.value === edit.value) {
        el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
        onCursorLineChange?.(lineNumberAt(el.value, edit.selectionStart));
      } else {
        commit(edit);
      }
    },
    [commit, onCursorLineChange]
  );

  // Returns true if a note snippet was expanded (caller should preventDefault).
  const tryExpandNoteSnippet = useCallback(
    (el: HTMLTextAreaElement): boolean => {
      const pos = el.selectionStart;
      if (pos !== el.selectionEnd) return false;
      const trigger = NOTE_TRIGGER_RE.exec(el.value.slice(0, pos))?.[0];
      if (!trigger) return false;
      const snippet = matchNoteSnippet(trigger);
      if (!snippet) return false;
      const start = pos - trigger.length;
      const caret = start + (snippet.cursorOffset ?? snippet.expansion.length);
      commit({
        value: el.value.slice(0, start) + snippet.expansion + el.value.slice(pos),
        selectionStart: caret,
        selectionEnd: caret,
      });
      return true;
    },
    [commit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isComposingInput(composingRef.current, e.nativeEvent)) return;
      const el = e.currentTarget;

      // Undo / redo from the editor's own history.
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.altKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        stepHistory(e.shiftKey ? "redo" : "undo");
        return;
      }
      if (mod && !e.altKey && !e.shiftKey && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        stepHistory("redo");
        return;
      }

      if (menu) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMenu({ ...menu, highlight: (menu.highlight + 1) % menu.suggestions.length });
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMenu({ ...menu, highlight: (menu.highlight - 1 + menu.suggestions.length) % menu.suggestions.length });
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMenu(null);
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          applySnippet(menu.suggestions[menu.highlight]);
          return;
        }
      }

      if (e.key === "Tab" && tryExpandNoteSnippet(el)) {
        e.preventDefault();
        return;
      }

      // Otherwise Tab indents (Shift+Tab outdents) rather than moving focus
      // out of the editor. Cmd/Ctrl/Alt+Tab belong to the OS/browser.
      if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setMenu(null);
        const state = { value: el.value, selectionStart: el.selectionStart, selectionEnd: el.selectionEnd };
        applyIndentEdit(el, e.shiftKey ? outdentSelection(state) : indentSelection(state));
        return;
      }

      if (e.metaKey && !e.shiftKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setMenu(null);
        commit(wrapBold({ value: el.value, selectionStart: el.selectionStart, selectionEnd: el.selectionEnd }));
        return;
      }
      if (e.metaKey && !e.shiftKey && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault();
        setMenu(null);
        const level = Number(e.key) as 1 | 2 | 3;
        commit(insertHeading(level)({ value: el.value, selectionStart: el.selectionStart, selectionEnd: el.selectionEnd }));
        return;
      }
    },
    [menu, applySnippet, tryExpandNoteSnippet, applyIndentEdit, commit, stepHistory]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      // During an IME composition the text changes with every keystroke; the
      // whole composition is recorded as one step when it ends.
      if (composingRef.current) lastValueRef.current = e.target.value;
      else recordChange(e.target.value, false);
      onChange(e.target.value);
      updateAutocomplete(e.currentTarget);
      onCursorLineChange?.(lineNumberAt(e.target.value, e.currentTarget.selectionStart));
    },
    [onChange, updateAutocomplete, onCursorLineChange, recordChange]
  );

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
    compositionStartRef.current = lastValueRef.current;
    setMenu(null);
  }, []);

  const handleCompositionEnd = useCallback(
    (e: CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false;
      const start = compositionStartRef.current;
      compositionStartRef.current = null;
      if (start !== null && start !== e.currentTarget.value) {
        historyRef.current.record(start, e.currentTarget.value, { sealed: false });
        lastValueRef.current = e.currentTarget.value;
        scheduleHistorySave();
      }
      updateAutocomplete(e.currentTarget);
    },
    [updateAutocomplete, scheduleHistorySave]
  );

  return (
    <div className="relative h-full">
      <pre
        ref={highlightRef}
        aria-hidden="true"
        className="mn-editor-text mn-hl-layer pointer-events-none absolute inset-0 m-0 overflow-hidden p-4 font-mono text-[15px] leading-[1.7] text-neutral-900"
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={syncHighlightLayer}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onClick={() => setMenu(null)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="Start typing Markdown + math..."
        className="mn-editor-text mn-editor-input relative h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-[15px] leading-[1.7] text-transparent caret-neutral-900 outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
      />
      {menu && (
        <AutocompleteMenu
          suggestions={menu.suggestions}
          highlight={menu.highlight}
          top={menu.top}
          left={menu.left}
          onSelect={applySnippet}
        />
      )}
    </div>
  );
}
