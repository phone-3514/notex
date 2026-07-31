"use client";

import type { MathSnippet } from "@/editor/mathSnippets";

interface AutocompleteMenuProps {
  suggestions: MathSnippet[];
  highlight: number;
  top: number;
  left: number;
  onSelect: (snippet: MathSnippet) => void;
}

export default function AutocompleteMenu({ suggestions, highlight, top, left, onSelect }: AutocompleteMenuProps) {
  return (
    <ul
      role="listbox"
      aria-label="Math suggestions"
      className="absolute z-20 max-h-48 min-w-[10rem] max-w-[18rem] overflow-y-auto border border-neutral-300 bg-white text-xs dark:border-neutral-700 dark:bg-neutral-900"
      style={{ top, left }}
    >
      {suggestions.map((s, i) => (
        <li
          key={s.trigger}
          role="option"
          aria-selected={i === highlight}
          // onMouseDown (not onClick) + preventDefault keeps focus on the
          // textarea so the selection/cursor state isn't lost before we act.
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(s);
          }}
          className={`flex cursor-pointer items-baseline gap-2 px-2 py-1 font-mono ${
            i === highlight
              ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "text-neutral-700 dark:text-neutral-300"
          }`}
        >
          <span className="font-semibold">{s.trigger}</span>
          <span className={i === highlight ? "opacity-70" : "text-neutral-400 dark:text-neutral-500"}>
            {s.insertText}
          </span>
        </li>
      ))}
    </ul>
  );
}
