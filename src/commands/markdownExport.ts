import type { CommandRow } from "./registry";

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function groupByCategory(rows: CommandRow[]): Map<string, CommandRow[]> {
  const groups = new Map<string, CommandRow[]>();
  for (const row of rows) {
    const list = groups.get(row.category) ?? [];
    list.push(row);
    groups.set(row.category, list);
  }
  return groups;
}

// Static prose, not a second source of command data — describes the math
// boundary syntax (src/renderer/markdown.ts) and the shape of the expression
// grammar the boundaries hand off to (src/parser/parseMath.ts).
const GRAMMAR_NOTES = `## Math boundaries

Notex never guesses that a line of text is "probably math" — only these explicit boundaries invoke the parser:

- \`= expression\` — a line starting with exactly \`=\` followed by a space is **display math**. The \`= \` prefix itself never appears in the preview. \`=\` with no following space (e.g. \`x=1\`) is left as plain text.
- \`@expression@\` — a pair of single \`@\` signs is **inline math**, usable any number of times within a paragraph. This is the current syntax; use it in new notes.
- \`$$expression$$\` — **legacy** display math, kept only for backward compatibility.
- \`$expression$\` — **deprecated** legacy inline math, kept only for backward compatibility. Prefer \`@expression@\`.

Everything between the boundary markers is parsed by the same shorthand DSL described below, regardless of which boundary was used.

Precedence, low to high: comma-sequences → quantifiers (\`forall\`/\`exists\`, each owning only its own constraint) → relations/membership (\`=\` \`<\` \`>\` \`<=\` \`>=\` \`!=\` \`in\`) → addition/subtraction → multiplication/division → powers/subscripts → atoms (numbers, identifiers, function calls, parentheses (comma-separated for multi-arg calls and tuples, e.g. \`f(x,y)\`, \`(x,y)\`), \`|...|\`, \`sqrt\`, \`sum\`/\`prod\`/\`int\`, \`lim\`).

## Piecewise / cases blocks

A multiline block for piecewise-defined functions, e.g.:

\`\`\`
= f(x)=cases
x^2, x>=0
-x, x<0
end
\`\`\`

renders as \`f(x)=\\begin{cases}x^2 & x\\geq 0\\\\-x & x<0\\end{cases}\`. Rules:

- \`= <lhs>=cases\` opens the block; a line that is exactly \`end\` closes it. The whole block is one display-math node with a single \`data-src-line\`, anchored at the opening line.
- Each line in between is one branch: \`expression, condition\`, split on the **final** comma on the line — so an expression that itself contains a comma (e.g. \`f(x,y), x>=0\`) still splits correctly.
- \`otherwise\` as a condition renders as \`\\text{otherwise}\`.
- At least two branches are required.
- A missing \`end\`, a branch with no comma, or a branch with an empty expression/condition all show a clear \`math-error\` rather than crashing.

## Align blocks

A multiline block for chained/aligned equations, e.g.:

\`\`\`
= align
f(x)
= x^2+2x+1
= (x+1)^2
end
\`\`\`

renders as \`\\begin{aligned}f(x)\\\\&= x^2+2x+1\\\\&= (x+1)^2\\end{aligned}\`. Rules:

- \`= align\` opens the block; \`end\` closes it.
- The first non-empty row is the left-hand starting expression.
- A later row starting with \`=\` aligns at the equals sign (\`&=\`).
- A row that's an ordinary full equation (e.g. \`f(x)=x+1\`) is also split and aligned at its \`=\` — this works on any row, including the first.
- A missing \`end\`, an empty block, or a non-first row that's neither a \`=\`-prefixed continuation nor a full equation all show a clear \`math-error\`.

## Matrix blocks

\`\`\`
= matrix
1, 2
3, 4
end
\`\`\`

renders as \`\\begin{pmatrix}1 & 2\\\\3 & 4\\end{pmatrix}\`. \`matrix\`/\`pmatrix\` both mean \`pmatrix\`; \`bmatrix\` and \`vmatrix\` select those bracket styles instead, same row/column syntax. Newlines separate rows; each cell is parsed by the same shorthand DSL.

An optional prefix expression before the keyword, separated by \`=\`, is rendered ahead of the matrix — \`= A=matrix\` (or \`B=bmatrix\`, \`det(A)=vmatrix\`, ...) renders as \`A=\\begin{pmatrix}...\\end{pmatrix}\`; a bare \`= matrix\` (no prefix) keeps working unchanged.

Commas separate columns, but only at the **top level** of the cell — a cell that itself contains a comma via a grouping construct the DSL already recognizes (e.g. \`f(x,y)\`) still counts as one cell, not several. This reuses the parser's own comma-list handling (the same one \`f(x,y)\`/\`vec(a,b)\` go through), not a raw string split. Rows with an inconsistent cell count, or an empty cell, show a clear \`math-error\` rather than crashing.

Inside a matrix cell only, a bare \`...\` renders as \`\\cdots\` (the horizontal-omission convention for matrix rows) instead of the \`\\ldots\` it means everywhere else, e.g. \`F(x1,...,xn)\`. \`vdots\`/\`ddots\` render as \`\\vdots\`/\`\\ddots\` the same as elsewhere. A general n×n matrix:

\`\`\`
= A=matrix
a11, a12, ..., a1n
a21, a22, ..., a2n
vdots, vdots, ddots, vdots
an1, an2, ..., ann
end
\`\`\`

## Vectors

\`vec(a,b,c)\` and \`colvec(a,b,c)\` are inline shorthand for row/column vectors — usable anywhere in the expression grammar, not just inside \`= \`. \`vec(a,b,c)\` renders as \`\\begin{pmatrix}a & b & c\\end{pmatrix}\`; \`colvec(a,b,c)\` stacks the same items with \`\\\\\` instead. \`vec\` with a single argument (\`vec(a)\`) keeps its original meaning — the arrow shorthand \`\\vec{a}\` — unchanged.

## Comma spacing

Commas are spaced by context, never uniformly:

- Function-call arguments, tuples, and vector/matrix cells (\`f(x,y)\`, \`(eps,n0)\`, \`vec(a,b)\`) stay tight — plain \`,\` with no extra gap.
- Top-level comma-separated clauses (e.g. chained quantifiers) get a moderate \`,\\;\` gap, not the wide \`,\\quad\` a paragraph break would use.

## Inline math delimiter rules

- A lone \`@\` opens inline math; the next unescaped \`@\` closes it.
- \`@@\` (two \`@\` signs) is an escaped literal \`@\` — it never opens or closes math, and renders as a single \`@\` character in prose.
- An inline span cannot cross a newline — the closing \`@\` must be on the same line as the opening one.
- Colons and backslashes are never a math signal; they're always plain text, everywhere.
- An unterminated span (no closing \`@\` before the end of the line) leaves the opening \`@\` as literal text rather than consuming the rest of the line.

Intentionally unsupported / ambiguous forms:

- Compact subscripts (\`an\` -> a_n, \`xn\` -> x_n) only apply *inside* recognized math — i.e. inside one of the boundaries above. They are never rewritten in ordinary prose.
- Unspaced keyword+identifier splitting (\`forallA\` -> \`forall A\`) is supported only for \`forall\`/\`exists\`, and only when the remainder starts uppercase. It is deliberately NOT extended to \`sum\`/\`prod\`/\`int\`/\`lim\`/\`sqrt\` — \`int\` in particular is a common prefix of unrelated words ("integral", "interval", "into"), so splitting it the same way would silently corrupt those.
- \`= \` is only recognized at the start of a paragraph line, not inside a list item or heading — use \`@...@\` there instead.
- Colons are not a math signal. Notes written with the old \`:expression:\` syntax render as plain text (not as math, not as an error).
- Backslashes are not a math signal either. Notes written with the older \`\\...\\\` syntax also render as plain text, the same way — a stray backslash is now ordinary punctuation, so old spans (including the backslashes) simply display as plain text rather than rendering as math.
- Norm syntax (double bars) is not implemented.
`;

// Renders the command registry as a readable Markdown reference. Pure
// string-building so it can be unit-tested without touching the filesystem.
export function commandsToMarkdown(rows: CommandRow[]): string {
  const lines: string[] = [
    "# Notex Command Reference",
    "",
    "Generated from the live parser dictionaries, autocomplete snippets, note snippets, and keyboard shortcuts. Reflects current behavior — see `src/commands/registry.ts`.",
    "",
    GRAMMAR_NOTES,
  ];

  for (const [category, categoryRows] of groupByCategory(rows)) {
    lines.push(`## ${category}`, "", "| Command | Result | LaTeX | Example |", "| --- | --- | --- | --- |");
    for (const row of categoryRows) {
      lines.push(
        `| \`${escapeCell(row.command)}\` | ${escapeCell(row.rendered)} | \`${escapeCell(row.latex)}\` | \`${escapeCell(row.example)}\` |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
