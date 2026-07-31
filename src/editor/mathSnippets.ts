// Editor-level autocomplete for math shorthand. Deliberately separate from
// the math parser: these triggers are typing shortcuts that expand into
// shorthand text, not part of the shorthand grammar itself.

export interface MathSnippet {
  trigger: string;
  insertText: string;
  // Cursor/selection placed at this offset range (relative to the start of
  // insertText) after the snippet is inserted — e.g. between empty parens,
  // or over a placeholder the user is expected to overwrite.
  selectStart: number;
  selectEnd: number;
  // A complete, independently-parseable example used for the command
  // reference (insertText alone is often a fragment, e.g. "sum n=1~oo" with
  // no body yet).
  referenceExample: string;
}

function snippet(trigger: string, prefix: string, target: string, suffix: string, referenceExample: string): MathSnippet {
  return {
    trigger,
    insertText: prefix + target + suffix,
    selectStart: prefix.length,
    selectEnd: prefix.length + target.length,
    referenceExample,
  };
}

export const MATH_SNIPPETS: MathSnippet[] = [
  snippet("su", "sum n=1~oo", "", "", "sum n=1~oo 1/n"),
  snippet("int", "int ", "a", "~b f(x) dx", "int a~b f(x) dx"),
  snippet("lim", "lim x->", "a", "", "lim x->a f(x)"),
  snippet("sq", "sqrt(", "", ")", "sqrt(x+y)"),
  snippet("frac", "(", "", ")/()", "(a+b)/(c+d)"),
  snippet("prod", "prod n=1~oo", "", "", "prod n=1~oo n"),
  snippet("eps", "eps", "", "", "eps>0"),
  snippet("alpha", "alpha", "", "", "alpha"),
  snippet("forall", "forall", "", "", "forall eps>0"),
  snippet("exists", "exists", "", "", "exists delta>0"),
  snippet("Mn", "Mn(", "R", ")", "Mn(R)"),
  snippet("therefore", "therefore", "", "", "therefore P"),
  snippet("because", "because", "", "", "because P"),
  // "s.t." (with dots) can't be an autocomplete trigger — the word-detection
  // in Editor.tsx only matches letters — but the parser accepts both
  // spellings; see dictionaries.ts.
  snippet("st", "st", "", "", "exists x in RR st x>0"),
  snippet("iff", "iff", "", "", "P iff T"),
  snippet("implies", "implies", "", "", "P implies T"),
  snippet("gets", "gets", "", "", "x gets y"),
  snippet("mapsto", "mapsto", "", "", "f: A mapsto B"),
  snippet("notin", "notin", "", "", "x notin S"),
  snippet("vec", "vec(", "", ")", "vec(a,b,c)"),
];

/**
 * True when the word starting at `wordStart` is immediately preceded by
 * ";" — i.e. it belongs to a note-snippet trigger (";i", ";m", ...), not
 * math autocomplete. Without this check, typing ";i" would open the "int"
 * math suggestion (a valid prefix match on "i") and shadow the note snippet
 * on Tab.
 */
export function isNoteSnippetContext(value: string, wordStart: number): boolean {
  return value[wordStart - 1] === ";";
}

/**
 * Returns snippets whose trigger starts with `word` (case-sensitive — "Mn"
 * is intentionally capitalized to match the parser's own subscript
 * heuristic), ordered so an exact match comes first, then shortest triggers.
 */
export function matchMathSnippets(word: string): MathSnippet[] {
  if (!word) return [];
  const matches = MATH_SNIPPETS.filter((s) => s.trigger.startsWith(word));
  return matches.sort((a, b) => {
    const aExact = a.trigger === word ? 0 : 1;
    const bExact = b.trigger === word ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    if (a.trigger.length !== b.trigger.length) return a.trigger.length - b.trigger.length;
    return a.trigger.localeCompare(b.trigger);
  });
}
