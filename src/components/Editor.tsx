"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type CompositionEvent,
} from "react";
import { matchMathSnippets, isNoteSnippetContext, type MathSnippet } from "@/editor/mathSnippets";
import { matchNoteSnippet } from "@/editor/noteSnippets";
import { wrapBold, insertHeading, type TextState } from "@/editor/shortcuts";
import { isComposingInput } from "@/editor/composition";
import { getCaretCoordinates } from "@/editor/caretCoordinates";
import { lineNumberAt } from "@/editor/cursorLine";
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

export default function Editor({ value, onChange, onCursorLineChange }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const [menu, setMenu] = useState<MenuState | null>(null);

  // Writes the result of a text transform back into both React state and the
  // live DOM node, so the caret lands in the right place without waiting for
  // a re-render (the same trick that already keeps the cursor stable during
  // normal typing).
  const commit = useCallback(
    (state: TextState) => {
      onChange(state.value);
      const el = textareaRef.current;
      if (el) {
        el.value = state.value;
        el.setSelectionRange(state.selectionStart, state.selectionEnd);
      }
      onCursorLineChange?.(lineNumberAt(state.value, state.selectionStart));
    },
    [onChange, onCursorLineChange]
  );

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
    [menu, applySnippet, tryExpandNoteSnippet, commit]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      updateAutocomplete(e.currentTarget);
      onCursorLineChange?.(lineNumberAt(e.target.value, e.currentTarget.selectionStart));
    },
    [onChange, updateAutocomplete, onCursorLineChange]
  );

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
    setMenu(null);
  }, []);

  const handleCompositionEnd = useCallback(
    (e: CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false;
      updateAutocomplete(e.currentTarget);
    },
    [updateAutocomplete]
  );

  return (
    <div className="relative h-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onClick={() => setMenu(null)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="Start typing Markdown + math..."
        className="h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-[17px] leading-[1.7] text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-600"
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
