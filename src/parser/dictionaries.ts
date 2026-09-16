// Static lookup tables shared by the tokenizer and the LaTeX generator.
// Keeping these as data (not scattered regexes) is what makes the pipeline extendable.

export const GREEK_LETTERS: Record<string, string> = {
  alpha: "\\alpha",
  beta: "\\beta",
  gamma: "\\gamma",
  delta: "\\delta",
  epsilon: "\\epsilon",
  eps: "\\varepsilon",
  varepsilon: "\\varepsilon",
  zeta: "\\zeta",
  eta: "\\eta",
  theta: "\\theta",
  iota: "\\iota",
  kappa: "\\kappa",
  lambda: "\\lambda",
  mu: "\\mu",
  nu: "\\nu",
  xi: "\\xi",
  pi: "\\pi",
  rho: "\\rho",
  sigma: "\\sigma",
  tau: "\\tau",
  upsilon: "\\upsilon",
  phi: "\\phi",
  varphi: "\\varphi",
  chi: "\\chi",
  psi: "\\psi",
  omega: "\\omega",
  Gamma: "\\Gamma",
  Delta: "\\Delta",
  Theta: "\\Theta",
  Lambda: "\\Lambda",
  Xi: "\\Xi",
  Pi: "\\Pi",
  Sigma: "\\Sigma",
  Upsilon: "\\Upsilon",
  Phi: "\\Phi",
  Psi: "\\Psi",
  Omega: "\\Omega",
};

export const BLACKBOARD_LETTERS: Record<string, string> = {
  R: "\\mathbb{R}",
  N: "\\mathbb{N}",
  Z: "\\mathbb{Z}",
  Q: "\\mathbb{Q}",
  C: "\\mathbb{C}",
  H: "\\mathbb{H}",
  // Doubled-letter aliases (common shorthand for typing blackboard sets
  // without special characters): RR = R, etc.
  RR: "\\mathbb{R}",
  NN: "\\mathbb{N}",
  ZZ: "\\mathbb{Z}",
  QQ: "\\mathbb{Q}",
  CC: "\\mathbb{C}",
};

// Functions rendered with a LaTeX named-operator escape, e.g. \sin.
export const FUNCTION_NAMES = [
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "ln",
  "log",
  "exp",
  "det",
  "dim",
  "ker",
  "gcd",
  "min",
  "max",
  "sup",
  "inf",
] as const;

// Multi-letter keywords recognized as whole identifiers (checked before generic ident rules).
export const WORD_KEYWORDS: Record<string, string> = {
  in: "\\in",
  notin: "\\notin",
  subset: "\\subset",
  subseteq: "\\subseteq",
  supset: "\\supset",
  supseteq: "\\supseteq",
  cup: "\\cup",
  cap: "\\cap",
  setminus: "\\setminus",
  cdot: "\\cdot",
  times: "\\times",
  pm: "\\pm",
  mp: "\\mp",
  to: "\\to",
  mapsto: "\\mapsto",
  infty: "\\infty",
  oo: "\\infty",
  partial: "\\partial",
  nabla: "\\nabla",
  emptyset: "\\emptyset",
  forall: "\\forall",
  exists: "\\exists",
  land: "\\land",
  lor: "\\lor",
  lnot: "\\lnot",
  neg: "\\neg",
  dots: "\\dots",
  cdots: "\\cdots",
  vdots: "\\vdots",
  ddots: "\\ddots",
  approx: "\\approx",
  equiv: "\\equiv",
  sim: "\\sim",
  cong: "\\cong",
  perp: "\\perp",
  parallel: "\\parallel",
  angle: "\\angle",
  triangle: "\\triangle",
  therefore: "\\therefore",
  because: "\\because",
  iff: "\\iff",
  implies: "\\implies",
  gets: "\\gets",
  // "st" and "s.t." ("such that") are two spellings of the same symbol; the
  // tokenizer special-cases the literal "s.t." sequence (see tokenize.ts)
  // since "." isn't otherwise a valid math-shorthand character.
  st: "\\text{s.t.}",
  "s.t.": "\\text{s.t.}",
  // Ellipsis inside argument lists (the tokenizer special-cases the literal
  // "..." sequence, see tokenize.ts, for the same reason as "s.t.").
  "...": "\\ldots",

  // Set theory / order theory.
  top: "\\top",
  bot: "\\bot",
  aleph: "\\aleph",
  varnothing: "\\varnothing",
  nsubseteq: "\\nsubseteq",
  nsupseteq: "\\nsupseteq",
  subsetneq: "\\subsetneq",
  supsetneq: "\\supsetneq",
  prec: "\\prec",
  preceq: "\\preceq",
  succ: "\\succ",
  succeq: "\\succeq",
  ll: "\\ll",
  gg: "\\gg",
  propto: "\\propto",
  simeq: "\\simeq",
  // Word form of the "|" mid-divider (see parseMath.ts's parseRel) for
  // spelling it out explicitly, e.g. in a set-builder body.
  mid: "\\mid",
  nmid: "\\nmid",

  // Topology / order-theoretic (quotient/product order) relations and
  // operations — "circ" also composes with the existing "^" grammar for
  // interior notation ("A^circ" -> "A^{\circ}"), so no separate "interior"
  // command is needed.
  sqcup: "\\sqcup",
  sqcap: "\\sqcap",
  sqsubset: "\\sqsubset",
  sqsubseteq: "\\sqsubseteq",
  sqsupset: "\\sqsupset",
  sqsupseteq: "\\sqsupseteq",
  circ: "\\circ",

  // Algebra (direct sums/products, group theory).
  oplus: "\\oplus",
  otimes: "\\otimes",
  ominus: "\\ominus",
  odot: "\\odot",
  wr: "\\wr",
  bullet: "\\bullet",
  star: "\\star",
  ast: "\\ast",

  // Logic (proof theory / model theory).
  vdash: "\\vdash",
  dashv: "\\dashv",
  models: "\\models",
  Vdash: "\\Vdash",

  // Arrows beyond the existing "to"/"mapsto"/"gets".
  hookrightarrow: "\\hookrightarrow",
  twoheadrightarrow: "\\twoheadrightarrow",
  Rightarrow: "\\Rightarrow",
  Leftarrow: "\\Leftarrow",
  Leftrightarrow: "\\Leftrightarrow",
};

// Prefix keywords that trigger special AST nodes (handled explicitly by the parser).
export const STRUCTURAL_KEYWORDS = new Set([
  "sum",
  "prod",
  "int",
  "bigcup",
  "bigcap",
  "lim",
  "sqrt",
  "forall",
  "exists",
  "vec",
  "colvec",
  "bf",
  "closure",
]);

export const RELATION_SYMBOLS: Record<string, string> = {
  "=": "=",
  "<": "<",
  ">": ">",
  "<=": "\\leq",
  ">=": "\\geq",
  "!=": "\\neq",
};
