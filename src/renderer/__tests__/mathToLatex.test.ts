import { describe, expect, it } from "vitest";
import katex from "katex";
import { shorthandToLatex } from "@/renderer/mathToLatex";
import { MathSyntaxError } from "@/tokenizer/types";

describe("shorthandToLatex — MVP syntax examples", () => {
  it("sum", () => {
    expect(shorthandToLatex("sum n=1~oo 1/n")).toBe("\\sum_{n=1}^{\\infty}\\frac{1}{n}");
  });

  it("integral with differential", () => {
    expect(shorthandToLatex("int 0~1 x^2 dx")).toBe("\\int_{0}^{1}x^{2}\\,dx");
  });

  it("limit", () => {
    expect(shorthandToLatex("lim x->0 sinx/x")).toBe("\\lim_{x\\to0}\\frac{\\sin x}{x}");
  });

  it("square root", () => {
    expect(shorthandToLatex("sqrt(x+y)")).toBe("\\sqrt{x+y}");
  });

  it("blackboard set membership with subscript shorthand", () => {
    expect(shorthandToLatex("A in Mn(R)")).toBe("A\\ \\in\\ M_{n}(\\mathbb{R})");
  });

  it("quantifier chain", () => {
    expect(shorthandToLatex("forall eps>0 exists delta>0")).toBe(
      "\\forall\\ \\varepsilon\\ >\\ 0\\exists\\ \\delta\\ >\\ 0"
    );
  });
});

describe("shorthandToLatex — additional MVP coverage", () => {
  it("plain fraction", () => {
    expect(shorthandToLatex("1/2")).toBe("\\frac{1}{2}");
  });

  it("power", () => {
    expect(shorthandToLatex("x^2")).toBe("x^{2}");
  });

  it("subscript", () => {
    expect(shorthandToLatex("x_1")).toBe("x_{1}");
  });

  it("nested fraction inside parens for exponent", () => {
    expect(shorthandToLatex("x^(n+1)")).toBe("x^{n+1}");
  });

  it("product (subscript bound stays tight, like sum)", () => {
    expect(shorthandToLatex("prod k=1~n k")).toBe("\\prod_{k=1}^{n}k");
  });

  it("indefinite integral (no bounds)", () => {
    expect(shorthandToLatex("int f(x) dx")).toBe("\\int f(x)\\,dx");
  });

  it("greek letters", () => {
    expect(shorthandToLatex("alpha+beta")).toBe("\\alpha+\\beta");
  });

  it("implicit multiplication", () => {
    expect(shorthandToLatex("2x")).toBe("2x");
  });

  it("explicit multiplication", () => {
    expect(shorthandToLatex("2*x")).toBe("2\\cdot x");
  });

  it("set membership gets semantic spacing", () => {
    expect(shorthandToLatex("x in R")).toBe("x\\ \\in\\ \\mathbb{R}");
  });

  it("infty alias oo", () => {
    expect(shorthandToLatex("oo")).toBe("\\infty");
  });

  it("throws a clear, catchable error on malformed input instead of crashing", () => {
    expect(() => shorthandToLatex("1/")).toThrow(MathSyntaxError);
    expect(() => shorthandToLatex("sqrt(x+y")).toThrow(MathSyntaxError);
    expect(() => shorthandToLatex("lim x 0")).toThrow(MathSyntaxError);
  });
});

// Comparisons (=, <, >, <=, >=, !=) now always get real semantic spacing
// ("\ ", a genuine LaTeX spacing command — a bare " " character is invisible
// in math mode) rather than just the minimum needed to stop a control word
// from swallowing the next letter. The old gobbling bug this section
// originally guarded against is still covered: these examples would have
// produced an invalid merged macro (e.g. "x\leqy") before that fix.
describe("shorthandToLatex — comparison operator spacing", () => {
  it("multi-char relations get real spacing on both sides", () => {
    expect(shorthandToLatex("x<=y")).toBe("x\\ \\leq\\ y");
    expect(shorthandToLatex("x>=y")).toBe("x\\ \\geq\\ y");
    expect(shorthandToLatex("x!=y")).toBe("x\\ \\neq\\ y");
  });

  it("spacing is unconditional — unlike the old gobbling-only fix, it no longer depends on what follows", () => {
    expect(shorthandToLatex("x<=1")).toBe("x\\ \\leq\\ 1");
    expect(shorthandToLatex("x<=(y+1)")).toBe("x\\ \\leq\\ (y+1)");
  });

  it("single-char relations are spaced too", () => {
    expect(shorthandToLatex("x=y")).toBe("x\\ =\\ y");
    expect(shorthandToLatex("x<y")).toBe("x\\ <\\ y");
    expect(shorthandToLatex("x>y")).toBe("x\\ >\\ y");
  });

  it("quantifier constraints (a Relation-shaped field, not a Relation node) get the same spacing", () => {
    expect(shorthandToLatex("forall x<=y")).toBe("\\forall\\ x\\ \\leq\\ y");
    expect(shorthandToLatex("forall eps>0")).toBe("\\forall\\ \\varepsilon\\ >\\ 0");
  });

  it("sum/prod's own '=' bound stays tight — standard \\sum_{n=1} convention, not a general comparison", () => {
    expect(shorthandToLatex("sum n=1~oo n")).toBe("\\sum_{n=1}^{\\infty}n");
  });

  it("produces LaTeX that KaTeX actually accepts (not a mis-parsed macro)", () => {
    for (const example of ["x<=y", "x>=y", "x!=y", "forall x<=y"]) {
      const latex = shorthandToLatex(example);
      expect(() => katex.renderToString(latex, { throwOnError: true }), example).not.toThrow();
    }
  });
});

describe("shorthandToLatex — general expression DSL (quantifiers, membership, absolute value)", () => {
  it("renders the full target expression", () => {
    expect(shorthandToLatex("forall eps>0, exists n0 in NN, forall n>=n0, |an-A|<eps")).toBe(
      "\\forall\\ \\varepsilon\\ >\\ 0,\\;\\exists\\ n_{0}\\ \\in\\ \\mathbb{N},\\;\\forall\\ n\\ \\geq\\ n_{0},\\;\\lvert a_{n}-A\\rvert\\ <\\ \\varepsilon"
    );
  });

  it("KaTeX actually accepts the full target expression", () => {
    const latex = shorthandToLatex("forall eps>0, exists n0 in NN, forall n>=n0, |an-A|<eps");
    expect(() => katex.renderToString(latex, { throwOnError: true })).not.toThrow();
  });

  it("quantifier with an 'in' constraint", () => {
    expect(shorthandToLatex("exists n0 in NN")).toBe("\\exists\\ n_{0}\\ \\in\\ \\mathbb{N}");
  });

  it("exists(n0) parenthesized form is equivalent to exists n0", () => {
    expect(shorthandToLatex("exists(n0)")).toBe(shorthandToLatex("exists n0"));
  });

  it("compact index shorthand", () => {
    expect(shorthandToLatex("n0")).toBe("n_{0}");
    expect(shorthandToLatex("a1")).toBe("a_{1}");
    expect(shorthandToLatex("an")).toBe("a_{n}");
    expect(shorthandToLatex("xn")).toBe("x_{n}");
    expect(shorthandToLatex("eps0")).toBe("\\varepsilon_{0}");
  });

  it("doubled-letter blackboard aliases", () => {
    expect(shorthandToLatex("RR")).toBe("\\mathbb{R}");
    expect(shorthandToLatex("CC")).toBe("\\mathbb{C}");
    expect(shorthandToLatex("NN")).toBe("\\mathbb{N}");
    expect(shorthandToLatex("ZZ")).toBe("\\mathbb{Z}");
    expect(shorthandToLatex("QQ")).toBe("\\mathbb{Q}");
  });

  it("absolute value (bars themselves stay tight; a trailing comparison is spaced)", () => {
    expect(shorthandToLatex("|x|")).toBe("\\lvert x\\rvert");
    expect(shorthandToLatex("|an-A|")).toBe("\\lvert a_{n}-A\\rvert");
    expect(shorthandToLatex("|an-A|<eps")).toBe("\\lvert a_{n}-A\\rvert\\ <\\ \\varepsilon");
  });

  it("a top-level factor starting with '|' parses (needed for 'implies |x|' etc.)", () => {
    expect(() => shorthandToLatex("P implies |x|")).not.toThrow();
    expect(shorthandToLatex("P implies |x|")).toBe("P\\ \\implies\\ \\lvert x\\rvert");
  });

  it("rejects an unmatched bar with a clear, non-crashing error", () => {
    expect(() => shorthandToLatex("|x")).toThrow(MathSyntaxError);
    expect(() => shorthandToLatex("x|")).toThrow(MathSyntaxError);
  });

  it("comma-separated sequence: comma stays real punctuation, \\; creates a moderate gap", () => {
    expect(shorthandToLatex("forall eps>0, exists delta>0")).toBe(
      "\\forall\\ \\varepsilon\\ >\\ 0,\\;\\exists\\ \\delta\\ >\\ 0"
    );
  });

  it("forallA / existsN split conservatively when the remainder is uppercase", () => {
    expect(shorthandToLatex("forallA")).toBe(shorthandToLatex("forall A"));
  });

  it("does not regress backward-compatible syntax", () => {
    expect(shorthandToLatex("sum n=1~oo 1/n")).toBe("\\sum_{n=1}^{\\infty}\\frac{1}{n}");
    expect(shorthandToLatex("int a~b f(x) dx")).toBe("\\int_{a}^{b}f(x)\\,dx");
    expect(shorthandToLatex("lim x->0 sinx/x")).toBe("\\lim_{x\\to0}\\frac{\\sin x}{x}");
    expect(shorthandToLatex("sqrt(x+y)")).toBe("\\sqrt{x+y}");
    expect(shorthandToLatex("alpha+beta")).toBe("\\alpha+\\beta");
    expect(shorthandToLatex("x^2")).toBe("x^{2}");
    expect(shorthandToLatex("x_1")).toBe("x_{1}");
  });
});

describe("shorthandToLatex — logic/arrow connectives", () => {
  it("therefore / because (unchanged — not part of the semantic-spacing rules)", () => {
    expect(shorthandToLatex("therefore P")).toBe("\\therefore P");
    expect(shorthandToLatex("because P")).toBe("\\because P");
  });

  it("iff / implies get spacing on both sides", () => {
    expect(shorthandToLatex("P iff T")).toBe("P\\ \\iff\\ T");
    expect(shorthandToLatex("P implies T")).toBe("P\\ \\implies\\ T");
  });

  it("gets spacing on both sides", () => {
    expect(shorthandToLatex("x gets y")).toBe("x\\ \\gets\\ y");
  });

  it("mapsto gets spacing on both sides", () => {
    expect(shorthandToLatex("f: A mapsto B")).toBe("f:A\\ \\mapsto\\ B");
  });

  it("notin gets spacing on both sides", () => {
    expect(shorthandToLatex("x notin S")).toBe("x\\ \\notin\\ S");
  });

  it("st and s.t. are two spellings of the same 'such that' symbol", () => {
    expect(shorthandToLatex("st")).toBe("\\text{s.t.}");
    expect(shorthandToLatex("s.t.")).toBe("\\text{s.t.}");
    expect(shorthandToLatex("st")).toBe(shorthandToLatex("s.t."));
  });

  it("st gets spacing before and after, composed with quantifiers and membership", () => {
    expect(shorthandToLatex("exists x in RR st x>0")).toBe(
      "\\exists\\ x\\ \\in\\ \\mathbb{R}\\ \\text{s.t.}\\ x\\ >\\ 0"
    );
  });

  it("all new tokens produce LaTeX that KaTeX actually accepts", () => {
    const examples = [
      "therefore P",
      "because P",
      "P iff T",
      "P implies T",
      "x gets y",
      "f: A mapsto B",
      "x notin S",
      "st",
      "s.t.",
      "exists x in RR st x>0",
    ];
    for (const example of examples) {
      const latex = shorthandToLatex(example);
      expect(() => katex.renderToString(latex, { throwOnError: true }), example).not.toThrow();
    }
  });

  it("does not throw for any of the new tokens (clear, catchable errors only for genuinely malformed input)", () => {
    expect(() => shorthandToLatex("therefore")).not.toThrow(); // valid: bare \therefore
    expect(() => shorthandToLatex("iff")).not.toThrow(); // valid: bare \iff
  });
});

describe("shorthandToLatex — commas are no longer needed just for visual spacing", () => {
  it("a single clause with no comma still gets full semantic spacing around every operator", () => {
    const latex = shorthandToLatex("forall eps>0 exists n0 in NN");
    expect(latex).not.toBe("\\forall\\varepsilon>0\\exists n_{0}\\in\\mathbb{N}"); // the old tight form
    expect(latex).toContain("\\forall\\ \\varepsilon\\ >\\ 0");
    expect(latex).toContain("\\in\\ \\mathbb{N}");
  });

  it("KaTeX renders the same visual result whether or not a comma separates two clauses", () => {
    // Both must be valid, independently — the comma is punctuation, not the
    // thing creating the gaps around individual operators.
    for (const example of ["forall eps>0, exists delta>0", "forall eps>0 exists delta>0"]) {
      const latex = shorthandToLatex(example);
      expect(() => katex.renderToString(latex, { throwOnError: true }), example).not.toThrow();
    }
  });
});

describe("shorthandToLatex — comma-separated argument lists (ArgList)", () => {
  it("two-argument function call", () => {
    expect(shorthandToLatex("f(x,y)")).toBe("f(x,y)");
  });

  it("three-argument function call", () => {
    expect(shorthandToLatex("f(x,y,z)")).toBe("f(x,y,z)");
  });

  it("bare tuple / ordered pair used with membership", () => {
    expect(shorthandToLatex("(x,y) in RR^2")).toBe("(x,y)\\ \\in\\ \\mathbb{R}^{2}");
  });

  it("ellipsis inside an argument list", () => {
    expect(shorthandToLatex("F(x1,...,xn)")).toBe("F(x_{1},\\ldots,x_{n})");
  });

  it("comma spacing inside an argument list is tight, unlike top-level Sequence commas", () => {
    expect(shorthandToLatex("f(x,y)")).not.toContain("\\quad");
  });

  it("a single parenthesized expression is unaffected (still a plain Group, not ArgList)", () => {
    expect(shorthandToLatex("(x+y)")).toBe("(x+y)");
    expect(shorthandToLatex("sqrt(x+y)")).toBe("\\sqrt{x+y}");
  });

  it("nested argument lists", () => {
    expect(shorthandToLatex("f(g(x,y),z)")).toBe("f(g(x,y),z)");
  });

  it("every ArgList example produces LaTeX that KaTeX actually accepts", () => {
    const examples = ["f(x,y)", "f(x,y,z)", "(x,y) in RR^2", "F(x1,...,xn)", "f(g(x,y),z)"];
    for (const example of examples) {
      const latex = shorthandToLatex(example);
      expect(() => katex.renderToString(latex, { throwOnError: true }), example).not.toThrow();
    }
  });
});

describe("shorthandToLatex — leading unary minus", () => {
  it("a bare leading minus", () => {
    expect(shorthandToLatex("-x")).toBe("-x");
  });

  it("unary minus binds tighter than the following power", () => {
    expect(shorthandToLatex("-x^2")).toBe("-x^{2}");
  });

  it("unary minus after a binary operator", () => {
    expect(shorthandToLatex("x-1")).toBe("x-1");
  });

  it("does not regress ordinary binary subtraction", () => {
    expect(shorthandToLatex("a-b")).toBe("a-b");
  });
});

describe("shorthandToLatex — negative exponents", () => {
  it("a bare negative exponent", () => {
    expect(shorthandToLatex("x^-2")).toBe("x^{-2}");
  });

  it("a negative exponent on a parenthesized base", () => {
    expect(shorthandToLatex("(x+1)^-2")).toBe("(x+1)^{-2}");
  });

  it("a negative, parenthesized exponent expression", () => {
    expect(shorthandToLatex("a^-(n+1)")).toBe("a^{-(n+1)}");
  });

  it("does not regress a positive parenthesized exponent (still unwraps the redundant parens)", () => {
    expect(shorthandToLatex("x^(n+1)")).toBe("x^{n+1}");
  });

  it("does not regress juxtaposition after a positive exponent", () => {
    // "x^2y" -> Pow(x,2) followed by a juxtaposed "y", not Pow(x, "2y").
    expect(shorthandToLatex("x^2y")).toBe("x^{2}y");
  });

  it("every negative-exponent example produces LaTeX that KaTeX actually accepts", () => {
    const examples = ["x^-2", "(x+1)^-2", "a^-(n+1)"];
    for (const example of examples) {
      const latex = shorthandToLatex(example);
      expect(() => katex.renderToString(latex, { throwOnError: true }), example).not.toThrow();
    }
  });
});

describe("shorthandToLatex — vectors", () => {
  it("vec with a single argument keeps the arrow-vector shorthand unchanged", () => {
    expect(shorthandToLatex("vec(a)")).toBe("\\vec{a}");
  });

  it("vec with 2+ arguments renders a row vector", () => {
    expect(shorthandToLatex("vec(a,b,c)")).toBe("\\begin{pmatrix}a & b & c\\end{pmatrix}");
  });

  it("colvec renders a column vector", () => {
    expect(shorthandToLatex("colvec(a,b,c)")).toBe("\\begin{pmatrix}a\\\\b\\\\c\\end{pmatrix}");
  });

  it("colvec with a single argument is a trivial one-row column, not the arrow shorthand", () => {
    expect(shorthandToLatex("colvec(a)")).toBe("\\begin{pmatrix}a\\end{pmatrix}");
  });

  it("vector cells are parsed by the full shorthand DSL", () => {
    expect(shorthandToLatex("vec(x^2,y_1)")).toBe("\\begin{pmatrix}x^{2} & y_{1}\\end{pmatrix}");
  });

  it("every vector example produces LaTeX that KaTeX actually accepts", () => {
    const examples = ["vec(a)", "vec(a,b,c)", "colvec(a,b,c)", "colvec(a)"];
    for (const example of examples) {
      const latex = shorthandToLatex(example);
      expect(() => katex.renderToString(latex, { throwOnError: true }), example).not.toThrow();
    }
  });
});

describe("shorthandToLatex — contextual comma spacing", () => {
  it("never uses \\quad for comma-separated sequences anymore", () => {
    expect(shorthandToLatex("forall eps>0, exists delta>0")).not.toContain("\\quad");
  });

  it("ArgList/tuple commas stay tight (no gap at all)", () => {
    expect(shorthandToLatex("f(x,y)")).toBe("f(x,y)");
    expect(shorthandToLatex("(eps,n0)")).toBe("(\\varepsilon,n_{0})");
  });

  it("vector commas stay tight", () => {
    expect(shorthandToLatex("vec(a,b)")).not.toContain("\\quad");
    expect(shorthandToLatex("vec(a,b)")).not.toContain("\\;");
  });

  it("top-level Sequence commas use a moderate \\; gap", () => {
    expect(shorthandToLatex("forall eps>0, exists delta>0")).toContain(",\\;");
  });
});

describe("shorthandToLatex — derivative prime notation", () => {
  it("single, double, and triple primes on an identifier", () => {
    expect(shorthandToLatex("f'")).toBe("f'");
    expect(shorthandToLatex("f''")).toBe("f''");
    expect(shorthandToLatex("f'''")).toBe("f'''");
  });

  it("prime applied then called with an argument", () => {
    expect(shorthandToLatex("f'(x)")).toBe("f'(x)");
    expect(shorthandToLatex("f''(x)")).toBe("f''(x)");
    expect(shorthandToLatex("f'''(x)")).toBe("f'''(x)");
  });

  it("prime on a multi-arg call", () => {
    expect(shorthandToLatex("g'(x,y)")).toBe("g'(x,y)");
  });

  it("prime on a parenthesized expression", () => {
    expect(shorthandToLatex("(f+g)'(x)")).toBe("(f+g)'(x)");
  });

  it("nth-derivative order notation keeps its parens: f^(n)(x) -> f^{(n)}(x)", () => {
    expect(shorthandToLatex("f^(n)(x)")).toBe("f^{(n)}(x)");
  });

  it("does not regress an ordinary parenthesized exponent with no following call", () => {
    expect(shorthandToLatex("x^(n+1)")).toBe("x^{n+1}");
  });

  it("a bare apostrophe with nothing before it is a clear, non-crashing parse error", () => {
    expect(() => shorthandToLatex("'x")).toThrow();
  });

  it("every prime-notation example produces LaTeX that KaTeX actually accepts", () => {
    const examples = ["f'(x)", "f''(x)", "f'''(x)", "g'(x,y)", "(f+g)'(x)", "f^(n)(x)"];
    for (const example of examples) {
      const latex = shorthandToLatex(example);
      expect(() => katex.renderToString(latex, { throwOnError: true }), example).not.toThrow();
    }
  });
});
