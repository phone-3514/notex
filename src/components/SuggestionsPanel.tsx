"use client";

import { useMemo, useState } from "react";
import { applySuggestion, getTypoSuggestions } from "@/lint/typoSuggestions";

interface SuggestionsPanelProps {
  content: string;
  onChange: (value: string) => void;
}

// Deterministic, rule-based suggestions only (see src/lint/typoSuggestions.ts)
// — never applied automatically. Renders nothing when the note is clean, so
// it stays out of the way until there's something concrete to say.
export default function SuggestionsPanel({ content, onChange }: SuggestionsPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const suggestions = useMemo(() => getTypoSuggestions(content), [content]);
  const visible = suggestions.filter((s) => !dismissed.has(s.id));

  if (visible.length === 0) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 flex-col gap-1 border-b border-neutral-200 bg-amber-50 px-3 py-1.5 text-xs dark:border-neutral-800 dark:bg-amber-950/30 print:hidden"
    >
      {visible.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <span className="text-neutral-600 dark:text-neutral-400">Line {s.line + 1}:</span>
          <span className="text-neutral-800 dark:text-neutral-200">{s.message}</span>
          {s.find && (
            <button
              type="button"
              onClick={() => onChange(applySuggestion(content, s))}
              className="border border-neutral-300 px-1.5 py-0.5 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300"
            >
              Apply
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed((prev) => new Set(prev).add(s.id))}
            className="border border-neutral-300 px-1.5 py-0.5 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
