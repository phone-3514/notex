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

export function noteBlockLabel(type: string): string | undefined {
  return NOTE_BLOCK_LABELS[type];
}
