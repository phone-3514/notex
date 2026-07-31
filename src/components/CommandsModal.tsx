"use client";

import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import { COMMAND_ROWS } from "@/commands/registry";

interface CommandsModalProps {
  open: boolean;
  onClose: () => void;
}

function renderCell(row: (typeof COMMAND_ROWS)[number]) {
  if (row.kind !== "math") {
    return <span className="whitespace-pre-wrap">{row.rendered}</span>;
  }
  const html = katex.renderToString(row.latex, { throwOnError: false });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function CommandsModal({ open, onClose }: CommandsModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMAND_ROWS;
    return COMMAND_ROWS.filter(
      (r) =>
        r.command.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.example.toLowerCase().includes(q)
    );
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-16"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command reference"
      >
        <div className="shrink-0 border-b border-neutral-200 p-2 dark:border-neutral-800">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            aria-label="Search commands"
            className="w-full border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none dark:border-neutral-700 dark:text-neutral-100"
          />
        </div>

        <div className="overflow-y-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="sticky top-0 border-b border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                <th className="px-2 py-1.5 font-medium">Command</th>
                <th className="px-2 py-1.5 font-medium">Result</th>
                <th className="px-2 py-1.5 font-medium">LaTeX</th>
                <th className="px-2 py-1.5 font-medium">Example</th>
                <th className="px-2 py-1.5 font-medium">Category</th>
                <th className="px-2 py-1.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={`${row.category}-${row.command}-${i}`} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                  <td className="px-2 py-1.5 font-mono">{row.command}</td>
                  <td className="px-2 py-1.5">{renderCell(row)}</td>
                  <td className="px-2 py-1.5 font-mono text-neutral-500 dark:text-neutral-400">{row.latex}</td>
                  <td className="px-2 py-1.5 font-mono">{row.example}</td>
                  <td className="px-2 py-1.5 text-neutral-500 dark:text-neutral-400">{row.category}</td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(row.example);
                      }}
                      className="border border-neutral-300 px-1.5 py-0.5 text-[11px] text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500"
                    >
                      Copy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="p-4 text-center text-xs text-neutral-400">No matching commands.</p>
          )}
        </div>
      </div>
    </div>
  );
}
