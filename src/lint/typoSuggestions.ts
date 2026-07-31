// Deterministic, rule-based typo/structure suggestions for the shorthand
// DSL — runs before (and independent of) any future AI-assisted correction.
// Pure functions only: never mutates the note; callers decide whether/when
// to apply a suggestion (Apply/Dismiss in the UI), so mathematical content
// is never silently rewritten.

export interface TypoSuggestion {
  id: string;
  line: number; // 0-indexed source line the suggestion applies to
  message: string;
  // Apply replaces the first occurrence of `find` on `line` with `replace`.
  // Both empty means "no safe single-line fix" (e.g. a missing "end" —
  // the user decides where to insert it).
  find: string;
  replace: string;
  source: "rule"; // reserved discriminant; a future "ai" provider can be
  // merged in via [...getTypoSuggestions(text), ...getAiSuggestions(text)]
  // without changing this shape or any existing caller.
}

const BLOCK_KEYWORDS = ["align", "cases", "matrix", "pmatrix", "bmatrix", "vmatrix"];
const DISPLAY_PREFIX_RE = /^= (.*)$/;
const MAX_KEYWORD_DISTANCE = 2;
const MAX_END_DISTANCE = 2;

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Nearest candidate within maxDist, or null on an exact match / no match —
// used both for block keywords (matrix/align/cases/...) and for "end".
function closest(word: string, candidates: string[], maxDist: number): string | null {
  let best: string | null = null;
  let bestDist = maxDist + 1;
  for (const candidate of candidates) {
    if (candidate === word) return null;
    const dist = levenshtein(word, candidate);
    if (dist <= maxDist && dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

// Top-level (paren-depth 0) comma split — a light heuristic (not the real
// parser) used only to flag likely column mismatches; never throws, so it
// stays safe to run on arbitrary, possibly-malformed, in-progress text.
function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

// True only for the unambiguous case: exactly one real "@" delimiter
// (ignoring the "@@" literal-@ escape) on the line, with no partner at all.
// A line with 3+ real "@"s is deliberately NOT flagged even when the count
// is odd — that's ambiguous (N/2 legitimate pairs plus one "@" mentioned as
// a literal character, e.g. in prose describing the syntax itself) rather
// than a clear mistake, and a wrong suggestion is worse than a missed one.
function hasUnmatchedAt(line: string): boolean {
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "@") continue;
    if (line[i + 1] === "@") {
      i++;
      continue;
    }
    count++;
  }
  return count === 1;
}

// A "'" directly preceded (ignoring whitespace) by an operator or "=" can
// never be valid — primes only ever follow a name, function call, or
// parenthesized expression (see parseFactor in parseMath.ts), so this is
// unambiguous, not a heuristic guess. Deliberately does NOT include ")" —
// "(f+g)'(x)" is valid — or letters/digits, which is what keeps ordinary
// prose ("don't", "it's") from ever matching.
const MISPLACED_PRIME_RE = /[+\-*/^_,(=]\s*'/;

export function getTypoSuggestions(source: string): TypoSuggestion[] {
  const lines = source.split("\n");
  const suggestions: TypoSuggestion[] = [];
  let open: { kind: string; line: number; cols: number | null } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (MISPLACED_PRIME_RE.test(raw)) {
      suggestions.push({
        id: `prime-${i}`,
        line: i,
        message: "Misplaced apostrophe — a prime (') must follow a name, function call, or parenthesized expression.",
        find: "",
        replace: "",
        source: "rule",
      });
    }

    if (open) {
      if (trimmed === "end") {
        open = null;
        continue;
      }
      if (trimmed === "") continue;

      // A short, alphabetic, non-"end" line where "end" was likely meant.
      if (/^[a-zA-Z]+$/.test(trimmed) && trimmed.length <= 5) {
        const dist = levenshtein(trimmed.toLowerCase(), "end");
        if (dist > 0 && dist <= MAX_END_DISTANCE) {
          suggestions.push({
            id: `end-${i}`,
            line: i,
            message: `Did you mean "end"?`,
            find: trimmed,
            replace: "end",
            source: "rule",
          });
          continue;
        }
      }

      // Column-count check, matrix-family blocks only.
      if (open.kind !== "align" && open.kind !== "cases") {
        const cols = splitTopLevelCommas(trimmed).length;
        if (open.cols === null) {
          open.cols = cols;
        } else if (cols !== open.cols) {
          suggestions.push({
            id: `cols-${i}`,
            line: i,
            message: `Inconsistent ${open.kind} row: expected ${open.cols} comma-separated cell(s), found ${cols}.`,
            find: "",
            replace: "",
            source: "rule",
          });
        }
      }
      continue;
    }

    // A block-opener attempt: "= <word>" or "= <prefix>=<word>".
    const display = DISPLAY_PREFIX_RE.exec(raw);
    if (display) {
      const body = display[1].trim();
      const afterPrefix = body.includes("=") ? body.slice(body.lastIndexOf("=") + 1).trim() : body;
      if (/^[a-zA-Z]+$/.test(afterPrefix)) {
        if (BLOCK_KEYWORDS.includes(afterPrefix)) {
          open = { kind: afterPrefix, line: i, cols: null };
        } else {
          const suggestion = closest(afterPrefix, BLOCK_KEYWORDS, MAX_KEYWORD_DISTANCE);
          if (suggestion) {
            suggestions.push({
              id: `kw-${i}`,
              line: i,
              message: `Did you mean "${suggestion}"?`,
              find: afterPrefix,
              replace: suggestion,
              source: "rule",
            });
            open = { kind: suggestion, line: i, cols: null };
          }
        }
      }
    }

    if (hasUnmatchedAt(raw)) {
      suggestions.push({
        id: `at-${i}`,
        line: i,
        message: 'Unmatched "@" — inline math needs a closing "@" on the same line.',
        find: "",
        replace: "",
        source: "rule",
      });
    }
  }

  if (open) {
    suggestions.push({
      id: `missing-end-${open.line}`,
      line: open.line,
      message: `Missing "end" to close this "${open.kind}" block.`,
      find: "",
      replace: "",
      source: "rule",
    });
  }

  return suggestions;
}

// Applies a suggestion's find/replace on its target line only. A no-op
// (returns source unchanged) when the suggestion has no safe single-line
// fix (find === "") — the UI should treat that case as "informational only".
export function applySuggestion(source: string, suggestion: TypoSuggestion): string {
  if (!suggestion.find) return source;
  const lines = source.split("\n");
  const target = lines[suggestion.line];
  if (target === undefined) return source;
  const idx = target.indexOf(suggestion.find);
  if (idx === -1) return source;
  lines[suggestion.line] = target.slice(0, idx) + suggestion.replace + target.slice(idx + suggestion.find.length);
  return lines.join("\n");
}
