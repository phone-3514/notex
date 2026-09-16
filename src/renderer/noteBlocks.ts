// Theorem-style note blocks: ":::theorem 2.5 ... :::" fenced regions,
// rendered as a bordered block with a Japanese title. The type->label
// mapping is the single source used by both the renderer and the note
// snippets that insert these blocks.

export const NOTE_BLOCK_LABELS: Record<string, string> = {
  theorem: "定理",
  definition: "定義",
  lemma: "補題",
  proposition: "命題",
  corollary: "系",
  proof: "証明",
  remark: "注意",
  example: "例",
};

export const NOTE_BLOCK_OPEN_RE = /^:::(\w+)(?:\s+(.*))?$/;
export const NOTE_BLOCK_CLOSE = ":::";

// ":::box <title>" is the escape hatch for a box outside the fixed
// vocabulary above: instead of a looked-up Japanese label, the text after
// "box" is used verbatim as the title — e.g. ":::box よく使う不等式" renders
// a block titled exactly "よく使う不等式". Unlike the fixed types, a title is
// required (an untitled box has nothing to show and isn't rendered as one).
const CUSTOM_BLOCK_TYPE = "box";

// The single place both the HTML preview (markdown.ts) and the Markdown
// export (exportMarkdown.ts) resolve a ":::type[ suffix]" open line to its
// rendered title, so the two stay in sync. Returns undefined when `type`
// isn't recognized (fixed type or "box") — the caller then leaves the line
// as ordinary text instead of starting a block.
export function resolveNoteBlockTitle(type: string, titleSuffix: string | undefined): string | undefined {
  if (type === CUSTOM_BLOCK_TYPE) {
    return titleSuffix || undefined;
  }
  const label = NOTE_BLOCK_LABELS[type];
  if (!label) return undefined;
  return titleSuffix ? `${label} ${titleSuffix}` : label;
}
