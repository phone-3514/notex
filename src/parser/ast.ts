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
  | { kind: "Overline"; arg: MathNode } // closure(x): topological/algebraic closure, conjugate, etc. (\overline)
  | { kind: "Func"; name: string; arg: MathNode | null }
  | { kind: "Differential"; variable: string }
  | {
      kind: "BigOp";
      op: "sum" | "prod" | "int" | "bigcup" | "bigcap";
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
  | { kind: "Group"; inner: MathNode } // explicit parentheses, rendered literally
  | { kind: "ArgList"; items: MathNode[] } // parenthesized comma list: f(x,y), (x,y), F(x1,...,xn)
  | { kind: "Infix"; op: "+" | "-" | "*"; left: MathNode; right: MathNode }
  | { kind: "Neg"; arg: MathNode } // unary minus, e.g. the "-x" branch of a cases block
  | { kind: "Vector"; style: "vec" | "colvec"; items: MathNode[] } // vec(a,b,c) / colvec(a,b,c)
  | { kind: "Prime"; base: MathNode; count: number } // f'(x), f''(x), (f+g)'(x)
  | { kind: "Relation"; op: string; left: MathNode; right: MathNode }
  | { kind: "AbsoluteValue"; arg: MathNode } // |...|
  | { kind: "SetLiteral"; items: MathNode[] } // {a,b,c} / {} — a finite/literal set
  | { kind: "SetBuilder"; variable: MathNode; condition: MathNode } // {x | cond} / {x : cond}
  | { kind: "Sequence"; items: MathNode[] }; // comma-separated clauses, e.g. quantifier chains
