// Note-structure snippets: full-word commands (prefixed with `;`) that
// expand only on an exact match + Tab. Separate from math autocomplete,
// which fuzzy-matches on prefixes and shows a menu while typing.

export interface NoteSnippet {
  trigger: string;
  expansion: string;
  // Cursor offset within the expansion after insertion. Defaults to the end
  // of the expansion (e.g. ";m" -> "= ", cursor right after the space, ready
  // to type the expression). ";i" overrides this to land between the "@"s.
  cursorOffset?: number;
}

// Inserts a ":::type\n\n:::" theorem-style block (see renderer/noteBlocks.ts)
// with the cursor left on the empty body line.
function noteBlockSnippet(trigger: string, type: string): NoteSnippet {
  const open = `:::${type}`;
  return { trigger, expansion: `${open}\n\n:::`, cursorOffset: open.length + 1 };
}

// Inserts a "= <keyword>\n\nend" multiline math block (align/cases/matrix,
// see renderer/markdown.ts) with the cursor left on the empty row line.
function mathBlockSnippet(trigger: string, keyword: string): NoteSnippet {
  const open = `= ${keyword}`;
  return { trigger, expansion: `${open}\n\nend`, cursorOffset: open.length + 1 };
}

export const NOTE_SNIPPETS: NoteSnippet[] = [
  noteBlockSnippet(";thm", "theorem"),
  noteBlockSnippet(";def", "definition"),
  noteBlockSnippet(";lem", "lemma"),
  noteBlockSnippet(";prop", "proposition"),
  noteBlockSnippet(";cor", "corollary"),
  noteBlockSnippet(";proof", "proof"),
  noteBlockSnippet(";rem", "remark"),
  noteBlockSnippet(";ex", "example"),
  { trigger: ";pf", expansion: "## 証明" },
  { trigger: ";remark", expansion: "## 注意" },
  { trigger: ";qed", expansion: "□" },
  { trigger: ";lecture", expansion: "# 講義タイトル\n日付：\n## 要点" },
  { trigger: ";m", expansion: "= " },
  { trigger: ";i", expansion: "@@", cursorOffset: 1 },
  mathBlockSnippet(";align", "align"),
  mathBlockSnippet(";matrix", "matrix"),
];

export function matchNoteSnippet(trigger: string): NoteSnippet | undefined {
  return NOTE_SNIPPETS.find((s) => s.trigger === trigger);
}
