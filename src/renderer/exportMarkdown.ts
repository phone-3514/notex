// Converts a note's raw shorthand source directly to a single, standard
// Markdown document — no HTML/KaTeX in the pipeline at all — so it can be
// fed to an LLM or any other text-based tool without the PDF text layer's
// glyph/reading-order problems (see markdown.ts's renderKatex comment).
//
// This deliberately mirrors renderMarkdownToHtml's block/inline scanning
// (same regexes and cases/align/matrix builders, imported from markdown.ts)
// rather than sharing a single code path with it: the two outputs need
// genuinely different leaf rendering (a real KaTeX DOM tree vs. a bare
// "$...$"/"$$...$$" LaTeX string; an HTML note-block <div> vs. a bold label
// line), so unifying them would mean threading an HTML-vs-Markdown branch
// through every leaf of the existing renderer instead of just reusing its
// already-exported building blocks.
//
// No Notex-only macros need normalizing here: shorthandToLatex/nodeToLatex
// (src/renderer/mathToLatex.ts) only ever emit standard LaTeX/amsmath
// commands (\frac, \sqrt, \sum, \boldsymbol, \mathbb, \begin{cases}, ...) —
// there is no `macros: {...}` passed to KaTeX and no custom command defined
// anywhere in the parser/renderer. The shorthand (Notex's own input syntax)
// is fully resolved to standard LaTeX by shorthandToLatex before it ever
// reaches this file, so the LaTeX embedded in the exported Markdown is the
// same "standard" source KaTeX itself renders on screen.
import { shorthandToLatex } from "./mathToLatex";
import {
  DISPLAY_LEGACY_RE,
  DISPLAY_PREFIX_RE,
  CASES_OPEN_RE,
  ALIGN_OPEN_RE,
  MATRIX_OPEN_RE,
  HEADING_RE,
  UNORDERED_RE,
  ORDERED_RE,
  buildCasesLatex,
  buildAlignLatex,
  buildMatrixLatex,
  collectBlockRows,
} from "./markdown";
import { resolveNoteBlockTitle, NOTE_BLOCK_OPEN_RE, NOTE_BLOCK_CLOSE } from "./noteBlocks";

function inlineMath(latex: string): string {
  return `$${latex}$`;
}
function displayMath(latex: string): string {
  return `$$${latex}$$`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Invalid math syntax";
}

// A bad expression becomes a visibly-flagged inline note (not silently
// dropped, and not emitted as if it were valid LaTeX) so a single typo can't
// corrupt the rest of the export.
function inlineMathError(err: unknown, raw: string): string {
  return `\`[math error: ${errorMessage(err)}]\` (${raw.trim()})`;
}
function blockMathError(err: unknown, raw: string): string {
  const quoted = raw
    .trim()
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  return `> **math error:** ${errorMessage(err)}\n>\n${quoted}`;
}

// Mirrors renderInline() in markdown.ts, but the "plain" segments need no
// escaping (Markdown, unlike HTML, doesn't need "<"/"&" escaped) and "**"
// bold is already valid Markdown as typed — this only has to swap out the
// math spans.
function exportInline(text: string): string {
  let out = "";
  let plainStart = 0;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (ch === "$") {
      const close = text.indexOf("$", i + 1);
      if (close !== -1) {
        out += text.slice(plainStart, i);
        const raw = text.slice(i + 1, close);
        try {
          out += inlineMath(shorthandToLatex(raw.trim()));
        } catch (err) {
          out += inlineMathError(err, raw);
        }
        i = close + 1;
        plainStart = i;
        continue;
      }
      i++;
      continue;
    }

    if (ch === "@") {
      if (text[i + 1] === "@") {
        out += text.slice(plainStart, i);
        out += "@";
        i += 2;
        plainStart = i;
        continue;
      }
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
        i++;
        continue;
      }
      out += text.slice(plainStart, i);
      const raw = text.slice(i + 1, closeAt);
      try {
        out += inlineMath(shorthandToLatex(raw.trim()));
      } catch (err) {
        out += inlineMathError(err, raw);
      }
      i = closeAt + 1;
      plainStart = i;
      continue;
    }

    i++;
  }
  out += text.slice(plainStart);
  return out;
}

// A list item's marker ("-", "*", "+", or "<n>.") is captured separately
// from UNORDERED_RE/ORDERED_RE's content-only group, so the original marker
// (and any digits) survives into the exported Markdown unchanged.
const LIST_ITEM_RE = /^(?:([-*+])|(\d+)\.)\s+(.*)$/;

function exportMarkdownBlocks(chunk: string): string {
  const lines = chunk.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      out.push("");
      i++;
      continue;
    }

    // Theorem-style block -> a bold Japanese label paragraph, then the body
    // (recursed through this same function, so headings/lists/math inside it
    // all still work).
    const blockOpen = NOTE_BLOCK_OPEN_RE.exec(line);
    const title = blockOpen ? resolveNoteBlockTitle(blockOpen[1], blockOpen[2]?.trim()) : undefined;
    if (blockOpen && title) {
      i++;
      const bodyStart = i;
      while (i < lines.length && lines[i].trim() !== NOTE_BLOCK_CLOSE) {
        i++;
      }
      const bodyLines = lines.slice(bodyStart, i);
      if (i < lines.length) i++;
      out.push(`**${title}.**`);
      out.push("");
      out.push(exportMarkdownBlocks(bodyLines.join("\n")));
      continue;
    }

    // Cases/align/matrix blocks: same multi-line detection as
    // renderMarkdownBlocks, but the LaTeX these builders produce is emitted
    // directly as "$$...$$" instead of being handed to KaTeX.
    const displayLine = DISPLAY_PREFIX_RE.exec(line);
    const casesOpen = displayLine ? CASES_OPEN_RE.exec(displayLine[1]) : null;
    if (casesOpen) {
      const prefixExpr = casesOpen[1];
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
      try {
        if (!hasEnd) throw new Error('Missing "end" to close the cases block');
        out.push(displayMath(buildCasesLatex(prefixExpr, branchLines)));
      } catch (err) {
        out.push(blockMathError(err, rawText));
      }
      continue;
    }

    const alignOpen = displayLine ? ALIGN_OPEN_RE.exec(displayLine[1]) : null;
    if (alignOpen) {
      const openLineIdx = i;
      i++;
      const { rows, hasEnd, endIdx } = collectBlockRows(lines, i);
      const rawText = lines.slice(openLineIdx, endIdx).join("\n");
      i = endIdx;
      try {
        if (!hasEnd) throw new Error('Missing "end" to close the align block');
        out.push(displayMath(buildAlignLatex(rows)));
      } catch (err) {
        out.push(blockMathError(err, rawText));
      }
      continue;
    }

    const matrixOpen = displayLine ? MATRIX_OPEN_RE.exec(displayLine[1]) : null;
    if (matrixOpen) {
      const prefixExpr = matrixOpen[1] ?? "";
      const kind = matrixOpen[2];
      const openLineIdx = i;
      i++;
      const { rows, hasEnd, endIdx } = collectBlockRows(lines, i);
      const rawText = lines.slice(openLineIdx, endIdx).join("\n");
      i = endIdx;
      try {
        if (!hasEnd) throw new Error(`Missing "end" to close the ${kind} block`);
        out.push(displayMath(buildMatrixLatex(kind, prefixExpr, rows)));
      } catch (err) {
        out.push(blockMathError(err, rawText));
      }
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      out.push(`${heading[1]} ${exportInline(heading[2])}`);
      i++;
      continue;
    }

    if (UNORDERED_RE.test(line) || ORDERED_RE.test(line)) {
      const re = ORDERED_RE.test(line) ? ORDERED_RE : UNORDERED_RE;
      while (i < lines.length && re.test(lines[i])) {
        const item = LIST_ITEM_RE.exec(lines[i])!;
        const marker = item[1] ? `${item[1]} ` : `${item[2]}. `;
        out.push(`${marker}${exportInline(item[3])}`);
        i++;
      }
      out.push("");
      continue;
    }

    // Paragraph: consecutive non-blank, non-heading, non-list lines. A line
    // starting with exactly "= " becomes its own "$$...$$" equation.
    const paraLines: string[] = [];
    const flushParagraph = () => {
      if (paraLines.length > 0) {
        out.push(paraLines.join("\n"));
        out.push("");
        paraLines.length = 0;
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
        try {
          out.push(displayMath(shorthandToLatex(display[1].trim())));
        } catch (err) {
          out.push(blockMathError(err, currentLine));
        }
        out.push("");
      } else {
        paraLines.push(exportInline(currentLine));
      }
      i++;
    }
    flushParagraph();
  }

  return out.join("\n");
}

// The full pipeline: raw note source -> standard Markdown (headings/lists
// preserved verbatim, math as "$...$"/"$$...$$" standard LaTeX). Independent
// of the PDF/HTML preview pipeline — nothing here touches katex or the DOM.
export function noteToMarkdown(source: string): string {
  const segments: Array<{ type: "text" | "displayMath"; content: string }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  DISPLAY_LEGACY_RE.lastIndex = 0;
  while ((m = DISPLAY_LEGACY_RE.exec(source))) {
    segments.push({ type: "text", content: source.slice(lastIndex, m.index) });
    segments.push({ type: "displayMath", content: m[1] });
    lastIndex = DISPLAY_LEGACY_RE.lastIndex;
  }
  segments.push({ type: "text", content: source.slice(lastIndex) });

  const rendered = segments.map((seg) => {
    if (seg.type === "displayMath") {
      try {
        return displayMath(shorthandToLatex(seg.content.trim()));
      } catch (err) {
        return blockMathError(err, seg.content);
      }
    }
    return exportMarkdownBlocks(seg.content);
  });

  // Collapse the blank-line bookkeeping above into standard single-blank-line
  // paragraph spacing, and end with exactly one trailing newline.
  return `${rendered.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
