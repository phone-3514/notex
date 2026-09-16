import {
  STRUCTURAL_KEYWORDS,
  WORD_KEYWORDS,
  GREEK_LETTERS,
  BLACKBOARD_LETTERS,
  FUNCTION_NAMES,
} from "@/parser/dictionaries";
import { MathSyntaxError, Token } from "./types";

// Any letter-run that exactly matches one of these is kept as a single token
// instead of being split by the function-name heuristic below.
const WHOLE_WORD_TOKENS = new Set<string>([
  ...STRUCTURAL_KEYWORDS,
  ...Object.keys(WORD_KEYWORDS),
  ...Object.keys(GREEK_LETTERS),
  ...Object.keys(BLACKBOARD_LETTERS),
  ...FUNCTION_NAMES,
]);

// Longest-prefix-first so "arcsin" is tried before "sin".
const SORTED_FUNCTION_NAMES = [...FUNCTION_NAMES].sort((a, b) => b.length - a.length);

// Only these two structural keywords are split off an immediately-adjacent
// identifier (e.g. "forallA" -> "forall" + "A"). Function names get the same
// treatment for every entry because they're short and rarely a prefix of an
// unrelated word; "forall"/"exists" are long and distinctive enough to be
// safe too, but other structural keywords are NOT included here — "int" in
// particular is a common prefix of unrelated words ("integral", "interval",
// "into"), so splitting it the same way would silently corrupt those.
const PREFIX_SPLITTABLE_KEYWORDS = ["forall", "exists"] as const;

function isLetter(ch: string) {
  return /[a-zA-Z]/.test(ch);
}
function isDigit(ch: string) {
  return /[0-9]/.test(ch);
}

/**
 * Splits a raw letter-run into tokens, applying the "known function name is
 * its own token" rule so `sinx` becomes `sin` + `x` (i.e. \sin x).
 */
function splitLetterRun(raw: string, startPos: number, out: Token[]) {
  if (raw.length === 0) return;
  if (WHOLE_WORD_TOKENS.has(raw)) {
    out.push({ type: "IDENT", value: raw, pos: startPos });
    return;
  }
  // Conservative: only split when the remainder starts with an uppercase
  // letter — a strong signal it's a separate variable name, not the
  // continuation of an unrelated lowercase word.
  for (const kw of PREFIX_SPLITTABLE_KEYWORDS) {
    if (raw.startsWith(kw) && raw.length > kw.length && /^[A-Z]/.test(raw[kw.length])) {
      out.push({ type: "IDENT", value: kw, pos: startPos });
      splitLetterRun(raw.slice(kw.length), startPos + kw.length, out);
      return;
    }
  }
  for (const fn of SORTED_FUNCTION_NAMES) {
    if (raw.startsWith(fn) && raw.length > fn.length) {
      out.push({ type: "IDENT", value: fn, pos: startPos });
      splitLetterRun(raw.slice(fn.length), startPos + fn.length, out);
      return;
    }
  }
  out.push({ type: "IDENT", value: raw, pos: startPos });
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // A "\"-escaped letter-run (e.g. "\N", "\log") always renders as its bare
    // letters, skipping every dictionary lookup — the escape hatch for the
    // (common, since single/double letters are reserved for blackboard sets
    // and function names) case where a shorthand meaning isn't wanted, e.g.
    // "N" (sample size) instead of "\mathbb{N}".
    if (ch === "\\") {
      const start = i;
      i++;
      let raw = "";
      while (i < n && isLetter(input[i])) raw += input[i++];
      if (raw.length === 0) {
        throw new MathSyntaxError('Expected a letter after "\\" (e.g. "\\N")', start);
      }
      tokens.push({ type: "LITERAL", value: raw, pos: start });
      continue;
    }

    // "s.t." ("such that") is special-cased as a literal 4-character match:
    // "." isn't otherwise a valid math-shorthand character (it only appears
    // inside decimal numbers), so it can't be tokenized by the normal
    // letter-run path. Checked before the letter branch so "s" doesn't get
    // consumed as its own token first.
    if (input.startsWith("s.t.", i)) {
      tokens.push({ type: "IDENT", value: "s.t.", pos: i });
      i += 4;
      continue;
    }

    // Ellipsis inside argument lists, e.g. "F(x1,...,xn)". Same rationale as
    // "s.t." above: "." isn't otherwise a valid shorthand character outside
    // decimals, so it needs its own literal match before the digit/letter
    // branches.
    if (input.startsWith("...", i)) {
      tokens.push({ type: "IDENT", value: "...", pos: i });
      i += 3;
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      let numStr = "";
      while (i < n && isDigit(input[i])) numStr += input[i++];
      if (input[i] === "." && isDigit(input[i + 1] ?? "")) {
        numStr += input[i++];
        while (i < n && isDigit(input[i])) numStr += input[i++];
      }
      tokens.push({ type: "NUMBER", value: numStr, pos: start });
      continue;
    }

    if (isLetter(ch)) {
      const start = i;
      let raw = "";
      while (i < n && isLetter(input[i])) raw += input[i++];
      splitLetterRun(raw, start, tokens);
      continue;
    }

    // Two-character operators first.
    const two = input.slice(i, i + 2);
    if (two === "->") {
      tokens.push({ type: "ARROW", value: "->", pos: i });
      i += 2;
      continue;
    }
    if (two === "<=" || two === ">=" || two === "!=") {
      tokens.push({ type: "RELOP", value: two, pos: i });
      i += 2;
      continue;
    }

    if (ch === "=" || ch === "<" || ch === ">") {
      tokens.push({ type: "RELOP", value: ch, pos: i });
      i++;
      continue;
    }

    if (ch === "~") {
      tokens.push({ type: "TILDE", value: ch, pos: i });
      i++;
      continue;
    }

    if ("()^_+-*/,!|:'".includes(ch)) {
      tokens.push({ type: "SYMBOL", value: ch, pos: i });
      i++;
      continue;
    }

    throw new MathSyntaxError(`Unexpected character "${ch}"`, i);
  }

  tokens.push({ type: "EOF", value: "", pos: n });
  return tokens;
}
