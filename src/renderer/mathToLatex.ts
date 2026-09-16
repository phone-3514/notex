import { MathNode } from "@/parser/ast";
import { parseMath } from "@/parser/parseMath";

// A LaTeX control word (\sin, \forall, \infty, ...) greedily consumes any
// letters that immediately follow it, so a literal space must be inserted
// whenever one would otherwise butt up against a plain letter. Backslash
// (start of another control word/symbol), digits, and braces are all safe.
function endsWithControlWord(s: string): boolean {
  return /\\[a-zA-Z]+$/.test(s);
}
function startsWithBareLetter(s: string): boolean {
  return /^[a-zA-Z]/.test(s);
}

// Symbols that always want a real visual gap around them, not just the bare
// minimum needed to stop a control word from swallowing the next letter.
// Quantifiers (\forall/\exists) and \text{s.t.} are "Ord"-class in TeX and
// get *no* automatic spacing from adjacent atoms; relations/connectives are
// "Rel"-class and TeX normally spaces those on its own, but we make it
// explicit here too so the source is unambiguous and doesn't rely on a
// human adding a comma just to force a gap. A literal " " is not enough —
// TeX ignores raw whitespace in math mode — so this uses "\ ", a real
// spacing command.
const SPACED_OPERATORS = new Set([
  "\\forall",
  "\\exists",
  "\\iff",
  "\\implies",
  "\\mapsto",
  "\\gets",
  "\\in",
  "\\notin",
  "\\text{s.t.}",
  "=",
  "<",
  ">",
  "\\leq",
  "\\geq",
  "\\neq",
  "\\mid",
]);

function joinTight(parts: string[]): string {
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (out) {
      if (SPACED_OPERATORS.has(parts[i - 1]) || SPACED_OPERATORS.has(part)) {
        out += "\\ ";
      } else if (endsWithControlWord(out) && startsWithBareLetter(part)) {
        out += " ";
      }
    }
    out += part;
  }
  return out;
}

function braces(s: string): string {
  return `{${s}}`;
}

// sum/prod's lower bound is an "=" Relation node (e.g. "n=1" from
// "sum n=1~oo ..."), but as a compact subscript binding it must stay tight —
// "\sum_{n=1}" is the standard convention, not "\sum_{n\ =\ 1}". This is the
// one place a Relation is rendered outside the general (now-spaced) policy.
function renderBigOpBound(node: MathNode): string {
  if (node.kind === "Relation" && node.op === "=") {
    return `${nodeToLatex(node.left)}=${nodeToLatex(node.right)}`;
  }
  return nodeToLatex(node);
}

export function nodeToLatex(node: MathNode): string {
  switch (node.kind) {
    case "Num":
      return node.value;
    case "Sym":
      return node.name;
    case "Row":
      return joinTight(node.items.map(nodeToLatex));
    case "Frac":
      return `\\frac${braces(nodeToLatex(node.num))}${braces(nodeToLatex(node.den))}`;
    case "Pow":
      return `${nodeToLatex(node.base)}^${braces(nodeToLatex(node.exp))}`;
    case "Sub":
      return `${nodeToLatex(node.base)}_${braces(nodeToLatex(node.sub))}`;
    case "Sqrt":
      return `\\sqrt${braces(nodeToLatex(node.arg))}`;
    case "Bold":
      return `\\boldsymbol${braces(nodeToLatex(node.arg))}`;
    case "Overline":
      return `\\overline${braces(nodeToLatex(node.arg))}`;
    case "Func": {
      const name = `\\${node.name}`;
      return node.arg ? joinTight([name, nodeToLatex(node.arg)]) : name;
    }
    case "Differential":
      return `\\,d${node.variable}`;
    case "BigOp": {
      const BIG_OP_COMMANDS: Record<typeof node.op, string> = {
        sum: "\\sum",
        prod: "\\prod",
        int: "\\int",
        bigcup: "\\bigcup",
        bigcap: "\\bigcap",
      };
      const cmd = BIG_OP_COMMANDS[node.op];
      let head = cmd;
      if (node.sub) head += `_${braces(renderBigOpBound(node.sub))}`;
      if (node.sup) head += `^${braces(nodeToLatex(node.sup))}`;
      return joinTight([head, nodeToLatex(node.body)]);
    }
    case "Lim": {
      const head = `\\lim_${braces(`${nodeToLatex(node.variable)}\\to${nodeToLatex(node.target)}`)}`;
      return joinTight([head, nodeToLatex(node.body)]);
    }
    case "Quantifier": {
      const cmd = node.op === "forall" ? "\\forall" : "\\exists";
      let out = joinTight([cmd, nodeToLatex(node.variable)]);
      if (node.constraintOp && node.constraintValue) {
        out = joinTight([out, node.constraintOp, nodeToLatex(node.constraintValue)]);
      }
      return out;
    }
    case "Group":
      return `(${nodeToLatex(node.inner)})`;
    case "ArgList":
      // Tight comma spacing, no gap: function args and tuples read as one
      // unit, unlike top-level "Sequence" clauses which get a "\;" gap.
      return `(${node.items.map(nodeToLatex).join(",")})`;
    case "Infix":
      if (node.op === "*") {
        return joinTight([nodeToLatex(node.left), "\\cdot", nodeToLatex(node.right)]);
      }
      return `${nodeToLatex(node.left)}${node.op}${nodeToLatex(node.right)}`;
    case "Relation":
      // joinTight (not raw concatenation) because multi-char relations like
      // \leq/\geq/\neq are LaTeX control words: butted directly against a
      // following letter (e.g. "x\leqy"), TeX tries to gobble it into the
      // macro name. Single-char ops (=, <, >) are unaffected either way.
      return joinTight([nodeToLatex(node.left), node.op, nodeToLatex(node.right)]);
    case "AbsoluteValue":
      return joinTight(["\\lvert", nodeToLatex(node.arg), "\\rvert"]);
    case "SetLiteral":
      // Tight comma spacing, matching ArgList — a finite set reads as one
      // unit. Bare "{}" (no braces in the LaTeX source) is invisible
      // grouping in TeX, so a literal set always needs the escaped
      // "\{"/"\}" delimiters to actually print.
      return `\\{${node.items.map(nodeToLatex).join(",")}\\}`;
    case "SetBuilder":
      // "\mid" (not the ":" some sources also use) is the semantically
      // correct, universally-recognized "such that" divider regardless of
      // which spelling ("{x | cond}" or "{x : cond}") the source used.
      return `\\{${joinTight([nodeToLatex(node.variable), "\\mid", nodeToLatex(node.condition)])}\\}`;
    case "Neg":
      return `-${nodeToLatex(node.arg)}`;
    case "Prime":
      // A literal "'" is valid KaTeX source on its own (renders as a prime
      // mark), and consecutive "'"s combine correctly — no \prime/braces
      // needed, unlike most postfix constructs here.
      return `${nodeToLatex(node.base)}${"'".repeat(node.count)}`;
    case "Vector": {
      // "vec" with exactly one item is the classic arrow-vector shorthand
      // (\vec{a}), left unchanged; everything else — "vec" with 2+ items, or
      // any "colvec" — is a row/column pmatrix.
      if (node.style === "vec" && node.items.length === 1) {
        return `\\vec${braces(nodeToLatex(node.items[0]))}`;
      }
      const sep = node.style === "colvec" ? "\\\\" : " & ";
      return `\\begin{pmatrix}${node.items.map(nodeToLatex).join(sep)}\\end{pmatrix}`;
    }
    case "Sequence":
      // Comma-separated clauses (e.g. chained quantifiers). The comma stays
      // real punctuation; "\;" is a moderate gap between clauses — not the
      // wide "\quad" a full paragraph break would use, and never applied to
      // ArgList/tuple/vector/matrix commas, which stay tight (see below).
      return node.items.map(nodeToLatex).join(",\\;");
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

// The full pipeline: raw shorthand text -> tokenizer -> parser -> LaTeX generator.
export function shorthandToLatex(raw: string): string {
  const ast = parseMath(raw);
  return nodeToLatex(ast);
}
