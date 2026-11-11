// AST produced by the math-shorthand parser. The renderer walks this tree to
// emit LaTeX; it never touches tokens or raw text directly.

export type MathNode =
  | { kind: "Num"; value: string }
  | { kind: "Sym"; name: string } // resolved literal LaTeX symbol/identifier text
  | { kind: "Row"; items: MathNode[] } // implicit juxtaposition (concatenation)
  | { kind: "Frac"; num: MathNode; den: MathNode }
  | { kind: "Pow"; base: MathNode; exp: MathNode }
  | { kind: "Sub"; base: MathNode; sub: MathNode }
  | { kind: "Sqrt"; arg: MathNode }
  | { kind: "Bold"; arg: MathNode } // bf(x): boldface vector/matrix notation (\boldsymbol), the non-arrow alternative to vec(x)
  | { kind: "Accent"; command: string; arg: MathNode } // tilde(x)/hat(x)/bar(x)/dot(x)...: accent over a symbol (command is the LaTeX control word, e.g. "\\tilde")
  | { kind: "Overline"; arg: MathNode } // closure(x): topological/algebraic closure, conjugate, etc. (\overline)
  | { kind: "Func"; name: string; arg: MathNode | null }
  | { kind: "Differential"; variable: string }
  | {
      kind: "BigOp";
      op: "sum" | "prod" | "int" | "bigcup" | "bigcap" | "bigoplus" | "bigotimes";
      sub: MathNode | null;
      sup: MathNode | null;
      body: MathNode;
    }
  | { kind: "Lim"; variable: MathNode; target: MathNode; body: MathNode }
  | {
      kind: "Quantifier";
      op: "forall" | "exists";
      variable: MathNode;
      constraintOp: string | null;
      constraintValue: MathNode | null;
    }
  | { kind: "Empty" } // a missing operand beside a relation or inside "()" — e.g. the left side of "= 9"; renders as nothing
  // Explicit brackets, rendered literally. `open`/`close` are set only when
  // they aren't the default "(" / ")": "[E(X)]^2" has open "[" and close "]",
  // and a half-open interval "[0,1)" has open "[" only. `unclosed`: no
  // closing bracket was typed.
  | { kind: "Group"; inner: MathNode; open?: "["; close?: "]"; unclosed?: boolean }
  // Bracketed comma list: f(x,y), (x,y), [a,b], F(x1,...,xn)
  | { kind: "ArgList"; items: MathNode[]; open?: "["; close?: "]"; unclosed?: boolean }
  | { kind: "Infix"; op: "+" | "-" | "*"; left: MathNode; right: MathNode }
  | { kind: "Neg"; arg: MathNode } // unary minus, e.g. the "-x" branch of a cases block
  | { kind: "Vector"; style: "vec" | "colvec"; items: MathNode[] } // vec(a,b,c) / colvec(a,b,c)
  | { kind: "Prime"; base: MathNode; count: number } // f'(x), f''(x), (f+g)'(x)
  | { kind: "Relation"; op: string; left: MathNode; right: MathNode }
  | { kind: "AbsoluteValue"; arg: MathNode } // |...|
  | { kind: "SetLiteral"; items: MathNode[] } // {a,b,c} / {} — a finite/literal set
  | { kind: "SetBuilder"; variable: MathNode; condition: MathNode } // {x | cond} / {x : cond}
  | { kind: "AngleGroup"; items: MathNode[] } // <a,b,c> — inner product / basis-span / generator notation
  | { kind: "Sequence"; items: MathNode[] }; // comma-separated clauses, e.g. quantifier chains
