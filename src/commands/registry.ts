// Single source of truth for the "Commands" reference (in-app modal and
// COMMANDS.md). Math rows are generated from the actual parser dictionaries
// and run through the real shorthandToLatex pipeline, so the reference can
// never drift from what the parser actually accepts.

import {
  GREEK_LETTERS,
  BLACKBOARD_LETTERS,
  WORD_KEYWORDS,
  FUNCTION_NAMES,
  RELATION_SYMBOLS,
} from "@/parser/dictionaries";
import { shorthandToLatex } from "@/renderer/mathToLatex";
import { MATH_SNIPPETS } from "@/editor/mathSnippets";
import { NOTE_SNIPPETS } from "@/editor/noteSnippets";

export interface CommandRow {
  kind: "math" | "snippet" | "shortcut";
  command: string;
  rendered: string; // LaTeX for math rows; a plain description/expansion otherwise
  latex: string; // raw LaTeX, or "—" when not applicable
  example: string;
  category: string;
}

function mathRow(command: string, example: string, category: string): CommandRow {
  const latex = shorthandToLatex(example);
  return { kind: "math", command, rendered: latex, latex, example, category };
}

// Structural constructs that need a real multi-token example to demonstrate
// (can't be derived from a flat dictionary lookup).
const STRUCTURAL_ROWS: CommandRow[] = [
  mathRow("sum", "sum n=1~oo 1/n", "Sums"),
  mathRow("prod", "prod n=1~oo n", "Products"),
  mathRow("int (definite)", "int 0~1 x^2 dx", "Integrals"),
  mathRow("int (indefinite)", "int f(x) dx", "Integrals"),
  mathRow("lim", "lim x->0 sinx/x", "Limits"),
  mathRow("sqrt", "sqrt(x+y)", "Roots"),
  mathRow("^ (power)", "x^2", "Powers & Subscripts"),
  mathRow("_ (subscript)", "x_1", "Powers & Subscripts"),
  mathRow("Xy (auto subscript)", "Mn(R)", "Powers & Subscripts"),
  mathRow("forall", "forall eps>0", "Quantifiers"),
  mathRow("exists", "exists delta>0", "Quantifiers"),
  mathRow("exists(x) (parenthesized variable)", "exists(n0)", "Quantifiers"),
  mathRow("exists ... in ... (membership constraint)", "exists n0 in NN", "Quantifiers"),
  mathRow(", (comma-separated sequence)", "forall eps>0, exists delta>0", "Sequences"),
  mathRow("| ... | (absolute value)", "|an-A|", "Absolute Value"),
  mathRow("n0 / an / eps0 (compact index shorthand)", "n0", "Compact Subscripts"),
  mathRow("Mn(R)", "Mn(R)", "Sets"),
  mathRow("vec(x) (arrow vector)", "vec(a)", "Vectors"),
  mathRow("vec(x,y,...) (row vector)", "vec(a,b,c)", "Vectors"),
  mathRow("colvec(x,y,...) (column vector)", "colvec(a,b,c)", "Vectors"),
  mathRow("bf(x) (bold vector/matrix, no arrow)", "bf(v)", "Vectors"),
  // "\X" escapes a letter-run out of every shorthand meaning (blackboard
  // sets, function names, Greek letters, compact subscripts) — e.g. plain
  // "N" is always \mathbb{N}, so a literal capital N needs "\N".
  mathRow('\\X (literal escape, e.g. "\\N")', "\\N", "Symbols"),
];

// Relational operators: the two-char ones (<=, >=, !=) are rendered as LaTeX
// control words, so the example's right-hand side is kept numeric — a
// letter there would run straight into the control word with no separator
// (a pre-existing renderer quirk, not something this registry works around
// by changing the renderer).
const RELATION_ROWS: CommandRow[] = Object.keys(RELATION_SYMBOLS).map((op) =>
  mathRow(op, `x${op}${op.length > 1 ? "1" : "y"}`, "Relations")
);

const GREEK_ROWS: CommandRow[] = Object.keys(GREEK_LETTERS).map((key) => mathRow(key, key, "Greek Letters"));

const BLACKBOARD_ROWS: CommandRow[] = Object.keys(BLACKBOARD_LETTERS).map((key) =>
  mathRow(key, key, "Blackboard Sets")
);

const FUNCTION_ROWS: CommandRow[] = FUNCTION_NAMES.map((name) => mathRow(name, `${name}x`, "Functions"));

// Not a dedicated command: "log" is a plain FUNCTION_NAME like any other, and
// "_" is the general subscript operator (see STRUCTURAL_ROWS above) — the two
// already compose, so a log with an explicit base is just "log" immediately
// followed by "_<base>". Listed explicitly here since that composition isn't
// obvious from the "log" row alone (which only shows the natural-log form).
const LOG_BASE_ROW: CommandRow[] = [mathRow("log_b(x) (log with an explicit base)", "log_10(100)", "Functions")];

// forall/exists are structural keywords (handled above with a richer
// example); everything else in WORD_KEYWORDS is a plain symbol lookup.
const WORD_KEYWORD_CATEGORY: Record<string, string> = {
  to: "Arrows",
  mapsto: "Arrows",
  in: "Sets",
  notin: "Sets",
  subset: "Sets",
  subseteq: "Sets",
  supset: "Sets",
  supseteq: "Sets",
  cup: "Sets",
  cap: "Sets",
  setminus: "Sets",
  emptyset: "Sets",
  cdot: "Operators",
  times: "Operators",
  pm: "Operators",
  mp: "Operators",
  infty: "Special",
  oo: "Special",
  partial: "Special",
  nabla: "Special",
  land: "Logic",
  lor: "Logic",
  lnot: "Logic",
  neg: "Logic",
  dots: "Dots",
  cdots: "Dots",
  vdots: "Dots",
  ddots: "Dots",
  approx: "Relations",
  equiv: "Relations",
  sim: "Relations",
  cong: "Relations",
  perp: "Relations",
  parallel: "Relations",
  angle: "Relations",
  triangle: "Relations",
  therefore: "Logic",
  because: "Logic",
  iff: "Logic",
  implies: "Logic",
  st: "Logic",
  "s.t.": "Logic",
  gets: "Arrows",
};

const WORD_KEYWORD_ROWS: CommandRow[] = Object.keys(WORD_KEYWORDS)
  .filter((key) => key !== "forall" && key !== "exists")
  .map((key) => mathRow(key, key, WORD_KEYWORD_CATEGORY[key] ?? "Symbols"));

const SNIPPET_ROWS: CommandRow[] = MATH_SNIPPETS.map((s) => {
  const latex = shorthandToLatex(s.referenceExample);
  return {
    kind: "math",
    command: s.trigger,
    rendered: latex,
    latex,
    example: s.referenceExample,
    category: "Autocomplete Snippet",
  };
});

const NOTE_SNIPPET_ROWS: CommandRow[] = NOTE_SNIPPETS.map((s) => ({
  kind: "snippet",
  command: s.trigger,
  rendered: s.expansion,
  latex: "—",
  example: `${s.trigger} + Tab`,
  category: "Note Snippet",
}));

const SHORTCUT_ROWS: CommandRow[] = [
  { command: "⌘B", rendered: "Wrap selection with **bold**" },
  { command: "⌘1", rendered: "Insert a level-1 heading (# ) on the current line" },
  { command: "⌘2", rendered: "Insert a level-2 heading (## ) on the current line" },
  { command: "⌘3", rendered: "Insert a level-3 heading (### ) on the current line" },
  { command: "⌘P", rendered: "Export the note as PDF (browser print)" },
  { command: "⌘S", rendered: "Save immediately (blocks the browser's Save Page dialog)" },
  { command: "⌘⇧P", rendered: "Switch to preview-only view" },
  { command: "⌘⇧E", rendered: "Switch to editor-only view" },
  { command: "⌘⇧S", rendered: "Return to split view" },
].map((s) => ({ kind: "shortcut" as const, command: s.command, rendered: s.rendered, latex: "—", example: s.rendered, category: "Shortcut" }));

export const COMMAND_ROWS: CommandRow[] = [
  ...STRUCTURAL_ROWS,
  ...RELATION_ROWS,
  ...GREEK_ROWS,
  ...BLACKBOARD_ROWS,
  ...FUNCTION_ROWS,
  ...LOG_BASE_ROW,
  ...WORD_KEYWORD_ROWS,
  ...SNIPPET_ROWS,
  ...NOTE_SNIPPET_ROWS,
  ...SHORTCUT_ROWS,
];
