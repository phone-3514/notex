import katex from "katex";
import { nodeToLatex, shorthandToLatex } from "./mathToLatex";
import { parseMath } from "@/parser/parseMath";
import type { MathNode } from "@/parser/ast";
import { noteBlockLabel, NOTE_BLOCK_OPEN_RE, NOTE_BLOCK_CLOSE } from "./noteBlocks";

// Explicit math boundaries only — nothing here ever guesses that a line of
// plain text is "probably math". A line becomes math only via:
//   - a line starting with exactly "= " (display math)
//   - a paired "@...@" span (inline math)
//   - "$$...$$" / "$...$" (legacy, kept for backward compatibility only)
export const DISPLAY_PREFIX_RE = /^= (.*)$/;
export const DISPLAY_LEGACY_RE = /\$\$([\s\S]+?)\$\$/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Chrome's print-to-PDF backend writes the text of any CSS-positioned
// element (position:relative/absolute — which KaTeX's HTML output relies on
// internally for virtually every non-trivial construct: fractions, roots,
// sub/superscripts, the accessibility MathML tree) to the *end* of its
// stacking context in the PDF's content stream, regardless of where it sits
// on the page (verified directly: a plain `position:relative` span always
// ends up last in the extracted text, even though it's positioned correctly
// on screen). That's the actual cause of the reported bug — it's not
// specific to Japanese text, KaTeX's DOM structure, or the OCR/AI layer,
// which Notex doesn't have — it's Chromium's print pipeline reordering any
// positioned run's text relative to plain in-flow text (like normal prose)
// in the same block. Naive/"raw" text extraction (many simple PDF-to-text
// tools, e.g. PyPDF2/pypdf, and evidently whatever tool produced the
// scrambled example in the bug report) walk that content stream in order and
// see prose first, then every formula on the page clumped together
// afterward; geometry-reconstructing extractors (poppler's default/-layout
// modes) largely paper over it already.
//
// `output: "html"` drops the (also position:absolute, also always-last)
// MathML accessibility tree, which was never visible on screen (KaTeX hides
// it with a 1x1 clip) and only added a second, redundant out-of-order copy.
// The raw TeX source is then placed as an ordinary (non-positioned) inline
// run right next to the visual rendering — a plain run's text is never
// reordered — so a "raw" extractor now reads it exactly where it visually
// sits. It stays invisible (`display:none` normally, `color:transparent`
// only under @media print — see globals.css) and print-only, so on-screen
// layout, selection, and copy/paste are unaffected either way.
function renderKatex(latex: string, displayMode: boolean): string {
  const visual = katex.renderToString(latex, { throwOnError: true, displayMode, output: "html" });
  const fallback = `<span class="katex-pdf-text" aria-hidden="true">${escapeHtml(latex)}</span>`;
  return `${fallback}${visual}`;
}

function renderMath(raw: string, displayMode: boolean): string {
  const trimmed = raw.trim();
  try {
    const latex = shorthandToLatex(trimmed);
    return renderKatex(latex, displayMode);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid math syntax";
    const tag = displayMode ? "div" : "span";
    return `<${tag} class="math-error" title="${escapeHtml(message)}">${escapeHtml(trimmed)}</${tag}>`;
  }
}

// Piecewise/cases block: "<lhs>=cases\n<expr>, <condition>\n...\nend". Each
// branch is delegated to shorthandToLatex individually (same DSL, same
// precedence rules), so this only needs to own the block-structure and the
// "\begin{cases}" assembly — not a second math grammar.
export const CASES_OPEN_RE = /^(.*)=cases\s*$/;

export function buildCasesLatex(prefixExpr: string, branchLines: string[]): string {
  const prefix = prefixExpr.trim();
  const prefixLatex = prefix ? `${shorthandToLatex(prefix)}=` : "";
  if (branchLines.length < 2) {
    throw new Error("A cases block needs at least two branches");
  }
  const branches = branchLines.map((line) => {
    // The FINAL comma on the line separates expression from condition, so
    // an expression that itself contains a comma (e.g. "f(x,y), x>=0")
    // still splits in the right place.
    const idx = line.lastIndexOf(",");
    if (idx === -1) {
      throw new Error(`Malformed cases branch (expected "expression, condition"): "${line.trim()}"`);
    }
    const exprPart = line.slice(0, idx).trim();
    const condPart = line.slice(idx + 1).trim();
    if (!exprPart || !condPart) {
      throw new Error(`Malformed cases branch (expected "expression, condition"): "${line.trim()}"`);
    }
    const exprLatex = shorthandToLatex(exprPart);
    const condLatex = condPart === "otherwise" ? "\\text{otherwise}" : shorthandToLatex(condPart);
    return `${exprLatex} & ${condLatex}`;
  });
  return `${prefixLatex}\\begin{cases}${branches.join("\\\\")}\\end{cases}`;
}

function renderCasesBlock(prefixExpr: string, branchLines: string[], hasEnd: boolean, rawText: string): string {
  try {
    if (!hasEnd) {
      throw new Error('Missing "end" to close the cases block');
    }
    const latex = buildCasesLatex(prefixExpr, branchLines);
    return renderKatex(latex, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid cases syntax";
    return `<div class="math-error" title="${escapeHtml(message)}">${escapeHtml(rawText)}</div>`;
  }
}

// "align" and matrix ("matrix"/"pmatrix"/"bmatrix"/"vmatrix") blocks: like
// cases above, opened by a keyword on its own "= " line and closed by a line
// that is exactly "end". Matrix blocks additionally accept an optional
// "<prefix>=" before the keyword (e.g. "A=matrix"); align does not.
export const ALIGN_OPEN_RE = /^align\s*$/;
export const MATRIX_OPEN_RE = /^(?:(.*)=)?(matrix|pmatrix|bmatrix|vmatrix)\s*$/;

export function buildAlignLatex(rows: string[]): string {
  if (rows.length === 0) {
    throw new Error("An align block needs at least one row");
  }
  const rendered = rows.map((row, i) => {
    const trimmed = row.trim();
    // A row starting with "=" is a continuation aligned at the equals sign.
    const continuation = /^=\s*(.*)$/.exec(trimmed);
    if (continuation) {
      return `&= ${shorthandToLatex(continuation[1])}`;
    }
    // Otherwise parse the whole row; a top-level "=" relation (an ordinary
    // full equation, e.g. "f(x)=x+1") is split and aligned the same way.
    // Splitting via the AST (not a raw string search for "=") avoids
    // mistaking the "=" inside "<=" / ">=" / "!=" for the alignment point.
    const ast = parseMath(trimmed);
    if (ast.kind === "Relation" && ast.op === "=") {
      return `${nodeToLatex(ast.left)} &= ${nodeToLatex(ast.right)}`;
    }
    if (i === 0) {
      return nodeToLatex(ast);
    }
    throw new Error(`Malformed align row (expected "= expression" or a full "lhs=rhs" equation): "${trimmed}"`);
  });
  return `\\begin{aligned}${rendered.join("\\\\")}\\end{aligned}`;
}

function renderAlignBlock(rows: string[], hasEnd: boolean, rawText: string): string {
  try {
    if (!hasEnd) {
      throw new Error('Missing "end" to close the align block');
    }
    const latex = buildAlignLatex(rows);
    return renderKatex(latex, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid align syntax";
    return `<div class="math-error" title="${escapeHtml(message)}">${escapeHtml(rawText)}</div>`;
  }
}

const MATRIX_ENV: Record<string, "pmatrix" | "bmatrix" | "vmatrix"> = {
  matrix: "pmatrix",
  pmatrix: "pmatrix",
  bmatrix: "bmatrix",
  vmatrix: "vmatrix",
};

// Splits a matrix row into cells on top-level commas only — reuses the
// parser's own comma-list handling (the same one ArgList/vec/colvec go
// through) by wrapping the row in parens and parsing it, rather than a raw
// string split. This is what makes a cell like "f(x,y)" count as one cell,
// not three: the parser already tracks (), |...|, etc. correctly, so there's
// no separate bracket-depth scanner to keep in sync with the grammar.
function splitMatrixRow(row: string): MathNode[] {
  const wrapped = parseMath(`(${row.trim()})`);
  if (wrapped.kind === "ArgList") return wrapped.items;
  if (wrapped.kind === "Group") return [wrapped.inner];
  return [wrapped];
}

// Matrix convention: a bare "..." cell means the horizontal omission dots
// ("\cdots"), not the "\ldots" it renders as everywhere else (e.g. inside an
// ordinary ArgList like "F(x1,...,xn)"). Special-cased only here, at the top
// of each matrix cell, so ordinary "..." behavior is otherwise unchanged.
// "vdots"/"ddots" already render correctly via WORD_KEYWORDS and need no
// override.
function renderMatrixCell(node: MathNode): string {
  if (node.kind === "Sym" && node.name === "\\ldots") {
    return "\\cdots";
  }
  return nodeToLatex(node);
}

export function buildMatrixLatex(kind: string, prefixExpr: string, rows: string[]): string {
  const env = MATRIX_ENV[kind];
  if (rows.length === 0) {
    throw new Error(`A ${kind} block needs at least one row`);
  }
  const cellRows = rows.map(splitMatrixRow);
  const colCount = cellRows[0].length;
  for (const cells of cellRows) {
    if (cells.length !== colCount) {
      throw new Error(`Inconsistent ${kind} row (expected ${colCount} comma-separated cell(s) per row)`);
    }
  }
  const body = cellRows.map((cells) => cells.map(renderMatrixCell).join(" & ")).join("\\\\");
  const prefix = prefixExpr.trim();
  const prefixLatex = prefix ? `${shorthandToLatex(prefix)}=` : "";
  return `${prefixLatex}\\begin{${env}}${body}\\end{${env}}`;
}

function renderMatrixBlock(kind: string, prefixExpr: string, rows: string[], hasEnd: boolean, rawText: string): string {
  try {
    if (!hasEnd) {
      throw new Error(`Missing "end" to close the ${kind} block`);
    }
    const latex = buildMatrixLatex(kind, prefixExpr, rows);
    return renderKatex(latex, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid matrix syntax";
    return `<div class="math-error" title="${escapeHtml(message)}">${escapeHtml(rawText)}</div>`;
  }
}

// Shared row-collection for align/matrix blocks: consume lines through a
// line that is exactly "end" (or to the end of the chunk, non-crashing),
// dropping blank lines. Mirrors the cases-block collection above.
export function collectBlockRows(lines: string[], start: number): { rows: string[]; hasEnd: boolean; endIdx: number } {
  let i = start;
  while (i < lines.length && lines[i].trim() !== "end") {
    i++;
  }
  const hasEnd = i < lines.length;
  const rows = lines.slice(start, i).filter((l) => l.trim() !== "");
  const endIdx = hasEnd ? i + 1 : i;
  return { rows, hasEnd, endIdx };
}

// Bold + plain text, HTML-escaped. Applied to text that has already had
// inline math segments removed.
function renderBoldAndEscape(segment: string): string {
  const regex = /\*\*([^*]+)\*\*/g;
  let out = "";
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(segment))) {
    out += escapeHtml(segment.slice(lastIndex, m.index));
    out += `<strong>${escapeHtml(m[1])}</strong>`;
    lastIndex = regex.lastIndex;
  }
  out += escapeHtml(segment.slice(lastIndex));
  return out;
}

// Bold + inline math, applied within a single line of text. Supports both
// "@...@" (current syntax) and "$...$" (deprecated) in the same line, each
// matched in whichever order they occur. A hand-rolled scanner (not a single
// regex) because "@@" needs to escape to a literal "@" rather than open/close
// math — colons and backslashes are never special here, they're always
// plain text.
function renderInline(text: string): string {
  let out = "";
  let plainStart = 0;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    // Legacy inline math: $...$ (kept for backward compatibility only).
    if (ch === "$") {
      const close = text.indexOf("$", i + 1);
      if (close !== -1) {
        out += renderBoldAndEscape(text.slice(plainStart, i));
        out += renderMath(text.slice(i + 1, close), false);
        i = close + 1;
        plainStart = i;
        continue;
      }
      i++;
      continue;
    }

    if (ch === "@") {
      // "@@" is an escaped literal "@" — never opens/closes math.
      if (text[i + 1] === "@") {
        out += renderBoldAndEscape(text.slice(plainStart, i));
        out += "@";
        i += 2;
        plainStart = i;
        continue;
      }
      // Genuine opening delimiter: scan for the next "@" that is itself a
      // genuine delimiter ("@@" is skipped as an escape) — never crossing a
      // newline, since inline spans cannot span multiple lines.
      let j = i + 1;
      let closeAt = -1;
      while (j < n && text[j] !== "\n") {
        if (text[j] === "@") {
          if (text[j + 1] === "@") {
            j += 2;
            continue;
          }
          closeAt = j;
          break;
        }
        j++;
      }
      if (closeAt === -1) {
        // No closing delimiter on this line — leave the "@" as literal text
        // rather than silently consuming the rest of the line.
        i++;
        continue;
      }
      out += renderBoldAndEscape(text.slice(plainStart, i));
      out += renderMath(text.slice(i + 1, closeAt), false);
      i = closeAt + 1;
      plainStart = i;
      continue;
    }

    i++;
  }
  out += renderBoldAndEscape(text.slice(plainStart));
  return out;
}

export const UNORDERED_RE = /^[-*+]\s+(.*)$/;
export const ORDERED_RE = /^\d+\.\s+(.*)$/;
export const HEADING_RE = /^(#{1,6})\s+(.*)$/;

// `baseLine` is the 0-indexed source line the chunk starts at, so every
// emitted block can be tagged with `data-src-line` — the anchor the preview
// scroll-sync (SplitView/Preview) uses to map the editor cursor to a block.
function renderMarkdownBlocks(chunk: string, baseLine: number): string {
  const lines = chunk.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Theorem-style block: ":::theorem 2.5\n...\n:::". The body is rendered
    // by recursing into this same function, so headings/lists/paragraphs,
    // "= " display math, and "@...@" inline math all work inside it exactly
    // as they do at the top level — and each get their own data-src-line.
    const blockOpen = NOTE_BLOCK_OPEN_RE.exec(line);
    const label = blockOpen ? noteBlockLabel(blockOpen[1]) : undefined;
    if (blockOpen && label) {
      const type = blockOpen[1];
      const titleSuffix = blockOpen[2]?.trim();
      const startLine = baseLine + i;
      i++;
      const bodyStart = i;
      while (i < lines.length && lines[i].trim() !== NOTE_BLOCK_CLOSE) {
        i++;
      }
      const bodyLines = lines.slice(bodyStart, i);
      if (i < lines.length) i++; // consume the closing ":::" (if present — an
      // unterminated block just runs to the end of the chunk, non-crashing)
      const title = titleSuffix ? `${label} ${titleSuffix}` : label;
      const innerHtml = renderMarkdownBlocks(bodyLines.join("\n"), baseLine + bodyStart);
      out.push(
        `<div class="note-block note-block-${type}" data-src-line="${startLine}"><div class="note-block-title">${escapeHtml(title)}</div><div class="note-block-body">${innerHtml}</div></div>`
      );
      continue;
    }

    // Piecewise/cases block: "= <lhs>=cases\n<branch>\n...\nend". Multi-line,
    // so (like the theorem-block above) it's detected at the top of the main
    // loop rather than inside the single-line paragraph scan below; the
    // whole block becomes one display-math node.
    const displayLine = DISPLAY_PREFIX_RE.exec(line);
    const casesOpen = displayLine ? CASES_OPEN_RE.exec(displayLine[1]) : null;
    if (casesOpen) {
      const prefixExpr = casesOpen[1];
      const startLine = baseLine + i;
      const openLineIdx = i;
      i++;
      const branchStart = i;
      while (i < lines.length && lines[i].trim() !== "end") {
        i++;
      }
      const hasEnd = i < lines.length;
      const branchLines = lines.slice(branchStart, i).filter((l) => l.trim() !== "");
      const blockEndIdx = hasEnd ? i + 1 : i;
      const rawText = lines.slice(openLineIdx, blockEndIdx).join("\n");
      i = blockEndIdx;
      const html = renderCasesBlock(prefixExpr, branchLines, hasEnd, rawText);
      out.push(`<div class="math-display" data-src-line="${startLine}">${html}</div>`);
      continue;
    }

    // "align" block: "= align\n...\nend". Same multi-line, top-of-loop
    // detection as the cases block above.
    const alignOpen = displayLine ? ALIGN_OPEN_RE.exec(displayLine[1]) : null;
    if (alignOpen) {
      const startLine = baseLine + i;
      const openLineIdx = i;
      i++;
      const { rows, hasEnd, endIdx } = collectBlockRows(lines, i);
      const rawText = lines.slice(openLineIdx, endIdx).join("\n");
      i = endIdx;
      const html = renderAlignBlock(rows, hasEnd, rawText);
      out.push(`<div class="math-display" data-src-line="${startLine}">${html}</div>`);
      continue;
    }

    // Matrix block: "= matrix\n...\nend", or with an optional prefix before
    // the keyword, "= <prefix>=matrix\n...\nend" (also pmatrix/bmatrix/vmatrix).
    const matrixOpen = displayLine ? MATRIX_OPEN_RE.exec(displayLine[1]) : null;
    if (matrixOpen) {
      const prefixExpr = matrixOpen[1] ?? "";
      const kind = matrixOpen[2];
      const startLine = baseLine + i;
      const openLineIdx = i;
      i++;
      const { rows, hasEnd, endIdx } = collectBlockRows(lines, i);
      const rawText = lines.slice(openLineIdx, endIdx).join("\n");
      i = endIdx;
      const html = renderMatrixBlock(kind, prefixExpr, rows, hasEnd, rawText);
      out.push(`<div class="math-display" data-src-line="${startLine}">${html}</div>`);
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level} data-src-line="${baseLine + i}">${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (UNORDERED_RE.test(line) || ORDERED_RE.test(line)) {
      const ordered = ORDERED_RE.test(line);
      const re = ordered ? ORDERED_RE : UNORDERED_RE;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) {
        const match = re.exec(lines[i])!;
        items.push(`<li data-src-line="${baseLine + i}">${renderInline(match[1])}</li>`);
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    // Paragraph: consecutive non-blank, non-heading, non-list lines. A line
    // starting with exactly "= " (the display-math boundary) becomes its own
    // equation instead of plain paragraph text; everything else is prose,
    // with "@...@" (or legacy "$...$") handled inline by renderInline.
    let paraLines: string[] = [];
    let paraStartLine = -1;
    const flushParagraph = () => {
      if (paraLines.length > 0) {
        out.push(`<p data-src-line="${paraStartLine}">${paraLines.join("<br />")}</p>`);
        paraLines = [];
        paraStartLine = -1;
      }
    };
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !HEADING_RE.test(lines[i]) &&
      !UNORDERED_RE.test(lines[i]) &&
      !ORDERED_RE.test(lines[i])
    ) {
      const currentLine = lines[i];
      const display = DISPLAY_PREFIX_RE.exec(currentLine);
      if (display) {
        flushParagraph();
        out.push(`<div class="math-display" data-src-line="${baseLine + i}">${renderMath(display[1], true)}</div>`);
      } else {
        if (paraStartLine === -1) paraStartLine = baseLine + i;
        paraLines.push(renderInline(currentLine));
      }
      i++;
    }
    flushParagraph();
  }

  return out.join("\n");
}

function countLines(s: string): number {
  return (s.match(/\n/g) ?? []).length;
}

export function renderMarkdownToHtml(source: string): string {
  const segments: Array<{ type: "text" | "displayMath"; content: string; line: number }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  DISPLAY_LEGACY_RE.lastIndex = 0;
  while ((m = DISPLAY_LEGACY_RE.exec(source))) {
    segments.push({ type: "text", content: source.slice(lastIndex, m.index), line: countLines(source.slice(0, lastIndex)) });
    segments.push({ type: "displayMath", content: m[1], line: countLines(source.slice(0, m.index)) });
    lastIndex = DISPLAY_LEGACY_RE.lastIndex;
  }
  segments.push({ type: "text", content: source.slice(lastIndex), line: countLines(source.slice(0, lastIndex)) });

  return segments
    .map((seg) =>
      seg.type === "displayMath"
        ? `<div class="math-display" data-src-line="${seg.line}">${renderMath(seg.content, true)}</div>`
        : renderMarkdownBlocks(seg.content, seg.line)
    )
    .join("\n");
}
