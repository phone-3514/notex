import {
  STRUCTURAL_KEYWORDS,
  WORD_KEYWORDS,
  GREEK_LETTERS,
  BLACKBOARD_LETTERS,
  FUNCTION_NAMES,
} from "@/parser/dictionaries";
import { FIGURE_OPEN_RE } from "@/figure/figureText";
import { NOTE_BLOCK_OPEN_RE } from "@/renderer/noteBlocks";
import {
  DISPLAY_PREFIX_RE,
  CASES_OPEN_RE,
  ALIGN_OPEN_RE,
  MATRIX_OPEN_RE,
  HEADING_RE,
  UNORDERED_RE,
  ORDERED_RE,
} from "@/renderer/markdown";

// Syntax highlighting for the editor: splits the note source into spans
// tagged with a CSS class (hl-*, coloured in globals.css). It mirrors how the
// renderer reads a note — headings, ":::" blocks (including the ":::math"
// region where plain lines are formulas and ":::fig" where they are shape
// descriptions), "= " display lines with their multi-line align/cases/matrix
// blocks, and inline "@...@" math — but it is purely cosmetic and never
// throws: unrecognised text just stays in the editor's base colour. The
// spans always concatenate back to exactly the input, which the editor
// relies on to keep its colour layer aligned with the textarea.

export interface Span {
  text: string;
  cls?: string; // undefined = base editor text colour
}

function push(out: Span[], text: string, cls?: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.cls === cls) last.text += text;
  else out.push({ text, cls });
}

const FUNCTION_PREFIXES = [...FUNCTION_NAMES].sort((a, b) => b.length - a.length);
// Words that open/close the multi-line math blocks ("= align ... end").
const BLOCK_WORDS = new Set(["align", "cases", "matrix", "pmatrix", "bmatrix", "vmatrix", "end"]);

function wordClass(word: string): string | undefined {
  if (STRUCTURAL_KEYWORDS.has(word) || BLOCK_WORDS.has(word)) return "hl-kw";
  if ((FUNCTION_NAMES as readonly string[]).includes(word)) return "hl-fn";
  if (word in WORD_KEYWORDS || word in GREEK_LETTERS || word in BLACKBOARD_LETTERS) return "hl-sym";
  return undefined;
}

const isLetter = (ch: string | undefined) => !!ch && /[A-Za-z]/.test(ch);
const isDigit = (ch: string | undefined) => !!ch && /[0-9]/.test(ch);
const isNonAscii = (ch: string) => ch.charCodeAt(0) > 0x7f;

const TWO_CHAR_OPS = ["<=", ">=", "!=", "->"];

// A formula in the shorthand DSL. `base` colours everything not otherwise classified.
function highlightMath(out: Span[], text: string, base = "hl-math") {
  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text[i];

    if (ch === "t" && text.startsWith("text(", i) && !isLetter(text[i - 1])) {
      let depth = 0;
      let j = i + 4;
      do {
        if (text[j] === "(") depth++;
        else if (text[j] === ")") depth--;
        j++;
      } while (depth > 0 && j < n);
      push(out, text.slice(i, j), "hl-str");
      i = j;
      continue;
    }

    // Japanese etc.: prose inside a formula, shown in the base text colour.
    if (isNonAscii(ch)) {
      let j = i;
      while (j < n && isNonAscii(text[j])) j++;
      push(out, text.slice(i, j));
      i = j;
      continue;
    }

    if (ch === "\\") {
      let j = i + 1;
      while (isLetter(text[j])) j++;
      push(out, text.slice(i, j), "hl-str");
      i = j;
      continue;
    }

    if (isDigit(ch)) {
      let j = i;
      while (isDigit(text[j])) j++;
      if (text[j] === "." && isDigit(text[j + 1])) {
        j++;
        while (isDigit(text[j])) j++;
      }
      push(out, text.slice(i, j), "hl-num");
      i = j;
      continue;
    }

    if (isLetter(ch)) {
      let j = i;
      while (isLetter(text[j])) j++;
      const word = text.slice(i, j);
      const cls = wordClass(word);
      if (cls) {
        push(out, word, cls);
      } else {
        // "sinx" -> function name + variable, like the tokenizer splits it.
        const fn = FUNCTION_PREFIXES.find((f) => word.startsWith(f) && word.length > f.length);
        if (fn) {
          push(out, fn, "hl-fn");
          push(out, word.slice(fn.length), base);
        } else {
          push(out, word, base);
        }
      }
      i = j;
      continue;
    }

    if (text.startsWith("...", i)) {
      push(out, "...", "hl-sym");
      i += 3;
      continue;
    }
    const two = TWO_CHAR_OPS.find((op) => text.startsWith(op, i));
    if (two) {
      push(out, two, "hl-op");
      i += 2;
      continue;
    }
    if ("=<>~+-*/".includes(ch)) {
      push(out, ch, "hl-op");
    } else if (ch === "^" || ch === "_") {
      push(out, ch, "hl-sub");
    } else if ("(){}[],:|'!".includes(ch)) {
      push(out, ch, "hl-punc");
    } else {
      push(out, ch, base);
    }
    i++;
  }
}

// Ordinary note text: "@...@" / "$...$" math, **bold**, ==highlight==, ";snippet" triggers.
function highlightInline(out: Span[], text: string, plain?: string) {
  const n = text.length;
  let i = 0;
  let plainStart = 0;
  const flush = (end: number) => push(out, text.slice(plainStart, end), plain);
  while (i < n) {
    const ch = text[i];
    if (ch === "@" || ch === "$") {
      const close = text.indexOf(ch, i + 1);
      if (close > i) {
        flush(i);
        push(out, ch, "hl-delim");
        highlightMath(out, text.slice(i + 1, close));
        push(out, ch, "hl-delim");
        i = close + 1;
        plainStart = i;
        continue;
      }
    }
    if (ch === "*" && text.startsWith("**", i)) {
      const close = text.indexOf("**", i + 2);
      if (close > i + 2) {
        flush(i);
        push(out, "**", "hl-dim");
        push(out, text.slice(i + 2, close), "hl-bold");
        push(out, "**", "hl-dim");
        i = close + 2;
        plainStart = i;
        continue;
      }
    }
    if (ch === "=" && text.startsWith("==", i)) {
      const close = text.indexOf("==", i + 2);
      if (close > i + 2) {
        flush(i);
        push(out, "==", "hl-dim");
        push(out, text.slice(i + 2, close), "hl-mark");
        push(out, "==", "hl-dim");
        i = close + 2;
        plainStart = i;
        continue;
      }
    }
    if (ch === ";" && (i === 0 || /\s/.test(text[i - 1]))) {
      const m = /^;[a-zA-Z]+/.exec(text.slice(i));
      if (m) {
        flush(i);
        push(out, m[0], "hl-snippet");
        i += m[0].length;
        plainStart = i;
        continue;
      }
    }
    i++;
  }
  flush(n);
}

const FIG_KEYWORDS = new Set(["line", "arrow", "rect", "circle", "point", "axes", "text", "grid", "dashed"]);

// A shape line inside ":::fig": "arrow 1,7 3,7 red", 'text 4,7 "x_0" blue'.
function highlightFigureLine(out: Span[], line: string) {
  const re = /"[^"]*"?|-?\d+(?:\.\d+)?|[A-Za-z]+|,|\s+|./g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const tok = m[0];
    if (tok.startsWith('"')) push(out, tok, "hl-str");
    else if (/^-?\d/.test(tok)) push(out, tok, "hl-num");
    else if (tok === ",") push(out, tok, "hl-punc");
    else if (tok === "red") push(out, tok, "hl-red");
    else if (tok === "blue") push(out, tok, "hl-blue");
    else if (FIG_KEYWORDS.has(tok)) push(out, tok, "hl-kw");
    else push(out, tok);
  }
}

type Mode = "normal" | "math" | "fig";

export function highlightNote(source: string): Span[] {
  const out: Span[] = [];
  const lines = source.split("\n");
  let mode: Mode = "normal";
  let inBlock = false; // inside "= align|cases|matrix ... end"
  let blockReturn: Mode = "normal";

  lines.forEach((line, index) => {
    highlightLine(line);
    if (index < lines.length - 1) push(out, "\n");
  });
  return out;

  function highlightLine(line: string) {
    const trimmed = line.trim();

    if (inBlock) {
      if (trimmed === "end") {
        const lead = line.slice(0, line.indexOf("end"));
        push(out, lead);
        push(out, "end", "hl-kw");
        push(out, line.slice(lead.length + 3));
        inBlock = false;
        mode = blockReturn;
      } else {
        highlightMath(out, line);
      }
      return;
    }

    if (trimmed === ":::") {
      push(out, line, "hl-fence");
      mode = "normal";
      return;
    }

    if (mode === "fig") {
      highlightFigureLine(out, line);
      return;
    }

    const fig = FIGURE_OPEN_RE.exec(line);
    if (fig) {
      push(out, ":::", "hl-fence");
      push(out, "fig", "hl-fence-type");
      push(out, line.slice(6), "hl-num");
      mode = "fig";
      return;
    }

    const open = NOTE_BLOCK_OPEN_RE.exec(line);
    if (open) {
      const type = open[1];
      push(out, ":::", "hl-fence");
      push(out, type, "hl-fence-type");
      const rest = line.slice(3 + type.length);
      highlightInline(out, rest, "hl-fence-title");
      if (type === "math") mode = "math";
      return;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      const markLen = line.length - heading[2].length;
      push(out, line.slice(0, markLen), "hl-heading-mark");
      highlightInline(out, heading[2], "hl-heading");
      return;
    }

    const display = DISPLAY_PREFIX_RE.exec(line);
    if (display) {
      push(out, "= ", "hl-delim");
      highlightMath(out, display[1]);
      const expr = display[1];
      if (CASES_OPEN_RE.test(expr) || ALIGN_OPEN_RE.test(expr) || MATRIX_OPEN_RE.test(expr)) {
        inBlock = true;
        blockReturn = mode;
      }
      return;
    }

    if (mode === "math") {
      // Plain lines in a ":::math" region are formulas — unless they carry
      // their own "@...@" spans, in which case they're read as prose.
      if (line.includes("@")) highlightInline(out, line);
      else highlightMath(out, line);
      return;
    }

    const list = UNORDERED_RE.test(line) || ORDERED_RE.test(line) ? /^(\s*(?:[-*+]|\d+\.)\s+)/.exec(line) : null;
    if (list) {
      push(out, list[1], "hl-list");
      highlightInline(out, line.slice(list[1].length));
      return;
    }

    highlightInline(out, line);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The spans as an HTML string (text escaped), for the editor's colour layer.
export function highlightToHtml(source: string): string {
  return highlightNote(source)
    .map((s) => (s.cls ? `<span class="${s.cls}">${escapeHtml(s.text)}</span>` : escapeHtml(s.text)))
    .join("");
}
