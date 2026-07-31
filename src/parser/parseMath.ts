import { tokenize } from "@/tokenizer/tokenize";
import { MathSyntaxError, Token } from "@/tokenizer/types";
import { MathNode } from "./ast";
import {
  STRUCTURAL_KEYWORDS,
  WORD_KEYWORDS,
  GREEK_LETTERS,
  BLACKBOARD_LETTERS,
  FUNCTION_NAMES,
  RELATION_SYMBOLS,
} from "./dictionaries";

const FUNCTION_NAME_SET = new Set<string>(FUNCTION_NAMES);

class Parser {
  private tokens: Token[];
  private pos = 0;
  // Tracks nesting inside an already-open "|...|" so its own content parser
  // doesn't mistake the closing bar for the start of a nested absolute
  // value — only a "|" seen outside any open bar begins a new one.
  private absDepth = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  parse(): MathNode {
    const node = this.parseSequence();
    const trailing = this.peek();
    if (trailing.type !== "EOF") {
      throw new MathSyntaxError(`Unexpected token "${trailing.value}"`, trailing.pos);
    }
    return node;
  }

  // Comma-separated clauses, e.g. chained quantifiers:
  // "forall eps>0, exists n0 in NN". Lowest precedence, above relations —
  // each clause is independently a full relational expression (which may
  // itself bottom out in a quantifier atom).
  private parseSequence(): MathNode {
    const items = [this.parseRel()];
    while (this.isSymbol(",")) {
      this.next();
      items.push(this.parseRel());
    }
    return items.length === 1 ? items[0] : { kind: "Sequence", items };
  }

  // Relational chain: a=b, eps>0, etc.
  private parseRel(): MathNode {
    let left = this.parseAdd();
    while (this.peek().type === "RELOP") {
      const opTok = this.next();
      const right = this.parseAdd();
      left = { kind: "Relation", op: RELATION_SYMBOLS[opTok.value] ?? opTok.value, left, right };
    }
    return left;
  }

  private parseAdd(): MathNode {
    let left = this.parseUnary();
    while (this.isSymbol("+") || this.isSymbol("-")) {
      const op = this.next().value as "+" | "-";
      const right = this.parseUnary();
      left = { kind: "Infix", op, left, right };
    }
    return left;
  }

  // Leading "-" (e.g. the "-x" branch of a cases block, or "-x^2"): a term
  // by itself doesn't start with an operator, so this sits between parseAdd
  // and parseTerm and only ever consumes a single unary minus — "--x" is not
  // collapsed, it parses as Neg(Neg(x)), which is fine since it's rare and
  // still renders correctly.
  private parseUnary(): MathNode {
    if (this.isSymbol("-")) {
      this.next();
      return { kind: "Neg", arg: this.parseUnary() };
    }
    return this.parseTerm();
  }

  private parseTerm(): MathNode {
    let left = this.parseFactor();
    while (true) {
      if (this.isSymbol("*")) {
        this.next();
        const right = this.parseFactor();
        left = { kind: "Infix", op: "*", left, right };
        continue;
      }
      if (this.isSymbol("/")) {
        this.next();
        const right = this.parseFactor();
        left = { kind: "Frac", num: left, den: right };
        continue;
      }
      if (this.startsFactor(this.peek())) {
        const right = this.parseFactor();
        left =
          left.kind === "Row"
            ? { kind: "Row", items: [...left.items, right] }
            : { kind: "Row", items: [left, right] };
        continue;
      }
      break;
    }
    return left;
  }

  private startsFactor(t: Token): boolean {
    if (t.type === "NUMBER" || t.type === "IDENT") return true;
    if (t.type === "SYMBOL" && (t.value === "(" || t.value === ":")) return true;
    if (t.type === "SYMBOL" && t.value === "|" && this.absDepth === 0) return true;
    return false;
  }

  private parseFactor(): MathNode {
    let atom = this.parseAtom();
    while (true) {
      if (this.isSymbol("^")) {
        this.next();
        const exp = this.parseExponentArg();
        // "f^(n)(x)" (nth-derivative order notation) keeps its parens —
        // "f^{(n)}(x)", not the usual redundant-parens unwrap — but only
        // when a call immediately follows; "x^(n+1)" alone still unwraps.
        const isDerivativeOrder = exp.kind === "Group" && this.isSymbol("(");
        atom = { kind: "Pow", base: atom, exp: isDerivativeOrder ? exp : this.unwrapGroup(exp) };
        continue;
      }
      if (this.isSymbol("_")) {
        this.next();
        atom = { kind: "Sub", base: atom, sub: this.unwrapGroup(this.parseAtom()) };
        continue;
      }
      if (this.isSymbol("'")) {
        let count = 0;
        while (this.isSymbol("'")) {
          this.next();
          count++;
        }
        atom = { kind: "Prime", base: atom, count };
        continue;
      }
      break;
    }
    return atom;
  }

  // An exponent's argument: an optional single leading "-" (e.g. "x^-2",
  // "a^-(n+1)") wrapping a single atom. Deliberately a plain atom, not a full
  // parseUnary()/parseTerm() — "x^2y" must still parse as Pow(x,2) followed
  // by a juxtaposed "y" (Row[Pow(x,2), y]), not as Pow(x, "2y").
  private parseExponentArg(): MathNode {
    if (this.isSymbol("-")) {
      this.next();
      return { kind: "Neg", arg: this.parseExponentArg() };
    }
    return this.parseAtom();
  }

  private parseAtom(): MathNode {
    const t = this.peek();

    if (t.type === "NUMBER") {
      this.next();
      return { kind: "Num", value: t.value };
    }

    if (t.type === "SYMBOL" && t.value === "(") {
      return this.parseParenGroup();
    }

    if (t.type === "SYMBOL" && t.value === "|") {
      return this.parseAbsoluteValue();
    }

    // Literal punctuation, e.g. "f: A mapsto B" (function signature colon).
    // Not an operator — just an atom rendered as itself.
    if (t.type === "SYMBOL" && t.value === ":") {
      this.next();
      return { kind: "Sym", name: ":" };
    }

    if (t.type === "IDENT") {
      return this.parseIdentAtom();
    }

    throw new MathSyntaxError(
      t.type === "EOF" ? "Unexpected end of expression" : `Unexpected token "${t.value}"`,
      t.pos
    );
  }

  // A single item stays a plain "Group" (redundant-parens semantics, used by
  // unwrapGroup for exponents/subscripts/sqrt args/bounds); two or more
  // comma-separated items become an "ArgList" — function calls with
  // multiple args, tuples, and comma-separated expression lists like
  // "f(x,y)", "(x,y)", "F(x1,...,xn)".
  private parseParenGroup(): MathNode {
    this.next(); // '('
    const items = [this.parseRel()];
    while (this.isSymbol(",")) {
      this.next();
      items.push(this.parseRel());
    }
    const close = this.peek();
    if (!(close.type === "SYMBOL" && close.value === ")")) {
      throw new MathSyntaxError('Missing closing ")"', close.pos);
    }
    this.next();
    return items.length === 1 ? { kind: "Group", inner: items[0] } : { kind: "ArgList", items };
  }

  private parseAbsoluteValue(): MathNode {
    this.next(); // '|'
    this.absDepth++;
    const inner = this.parseAdd();
    this.absDepth--;
    const close = this.peek();
    if (!(close.type === "SYMBOL" && close.value === "|")) {
      throw new MathSyntaxError('Missing closing "|"', close.pos);
    }
    this.next();
    return { kind: "AbsoluteValue", arg: inner };
  }

  private parseIdentAtom(): MathNode {
    const t = this.next();
    const word = t.value;

    if (STRUCTURAL_KEYWORDS.has(word)) {
      switch (word) {
        case "sqrt":
          return this.parseSqrt();
        case "sum":
        case "prod":
          return this.parseBigOp(word);
        case "int":
          return this.parseBigOp("int");
        case "lim":
          return this.parseLim();
        case "forall":
        case "exists":
          return this.parseQuantifier(word);
        case "vec":
        case "colvec":
          return this.parseVector(word);
      }
    }

    if (WORD_KEYWORDS[word]) {
      return { kind: "Sym", name: WORD_KEYWORDS[word] };
    }

    if (FUNCTION_NAME_SET.has(word)) {
      const arg = this.startsFactor(this.peek()) ? this.parseAtom() : null;
      return { kind: "Func", name: word, arg };
    }

    const diffMatch = /^d([a-zA-Z])$/.exec(word);
    if (diffMatch) {
      return { kind: "Differential", variable: diffMatch[1] };
    }

    return this.resolveIdentSymbol(t);
  }

  // Resolves a bare identifier (not a structural/function/word keyword) into
  // a symbol node: Greek letters, blackboard-bold letters, the `Xy` -> X_y
  // subscript shorthand, or a literal symbol — optionally followed by an
  // implicit compact subscript (see tryConsumeAdjacentSubscript).
  private resolveIdentSymbol(token: Token): MathNode {
    const word = token.value;
    if (GREEK_LETTERS[word]) {
      return this.tryConsumeAdjacentSubscript({ kind: "Sym", name: GREEK_LETTERS[word] }, token);
    }
    if (BLACKBOARD_LETTERS[word]) {
      return { kind: "Sym", name: BLACKBOARD_LETTERS[word] };
    }
    // Heuristic: "Mn" -> M_n (single uppercase base letter + lowercase subscript
    // letters), the common shorthand for indexed families like M_n(R).
    const subMatch = /^([A-Z])([a-z]+)$/.exec(word);
    if (subMatch) {
      return {
        kind: "Sub",
        base: { kind: "Sym", name: subMatch[1] },
        sub: { kind: "Sym", name: subMatch[2] },
      };
    }
    // Compact lowercase index shorthand: "an" -> a_n, "xn" -> x_n. Exactly
    // two letters only (the tokenizer keeps contiguous letters as one token,
    // so unlike "n0" there's no separate adjacent token to detect here);
    // three or more would risk mangling ordinary short words, and anything
    // reaching this point is already known not to be a reserved keyword.
    const lowerSubMatch = /^([a-z])([a-z])$/.exec(word);
    if (lowerSubMatch) {
      return {
        kind: "Sub",
        base: { kind: "Sym", name: lowerSubMatch[1] },
        sub: { kind: "Sym", name: lowerSubMatch[2] },
      };
    }
    const base: MathNode = { kind: "Sym", name: word };
    // Compact index shorthand (n0 -> n_0, eps0 -> \varepsilon_0) only applies
    // to a single bare letter — anything longer is left alone.
    return word.length === 1 ? this.tryConsumeAdjacentSubscript(base, token) : base;
  }

  // Implements the "n0" -> n_0 / "an" -> a_n / "eps0" -> \varepsilon_0
  // compact-subscript shorthand: if the very next token butts up against
  // this one with no whitespace gap (checked via source position, since the
  // tokenizer already splits letters and digits into separate tokens) and is
  // a number or a single unreserved letter, treat it as an implicit
  // subscript instead of falling through to plain juxtaposition.
  private tryConsumeAdjacentSubscript(base: MathNode, afterToken: Token): MathNode {
    const next = this.peek();
    if (next.pos !== afterToken.pos + afterToken.value.length) return base;
    if (next.type === "NUMBER") {
      this.next();
      return { kind: "Sub", base, sub: { kind: "Num", value: next.value } };
    }
    if (next.type === "IDENT" && next.value.length === 1 && !this.isReservedWord(next.value)) {
      this.next();
      return { kind: "Sub", base, sub: { kind: "Sym", name: next.value } };
    }
    return base;
  }

  private isReservedWord(word: string): boolean {
    return (
      STRUCTURAL_KEYWORDS.has(word) ||
      !!WORD_KEYWORDS[word] ||
      !!GREEK_LETTERS[word] ||
      !!BLACKBOARD_LETTERS[word] ||
      FUNCTION_NAME_SET.has(word)
    );
  }

  // Explicit parentheses used purely for grouping (exponents, subscripts,
  // sqrt args, bounds) are redundant once wrapped in LaTeX braces, so we
  // unwrap them; parens used as literal displayed text (e.g. `f(x)`) are
  // left as Group nodes elsewhere and rendered as-is.
  private unwrapGroup(node: MathNode): MathNode {
    return node.kind === "Group" ? node.inner : node;
  }

  private parseSqrt(): MathNode {
    return { kind: "Sqrt", arg: this.unwrapGroup(this.parseAtom()) };
  }

  // vec(a,b,c) / colvec(a,b,c): reuses parseParenGroup's comma-list parsing.
  // A single item keeps the classic arrow-vector shorthand ("vec(a)" ->
  // \vec{a}, the pre-existing notation this must not disturb — see the
  // renderer); two or more items become a row/column vector.
  private parseVector(kind: "vec" | "colvec"): MathNode {
    if (!this.isSymbol("(")) {
      throw new MathSyntaxError(`Expected "(" after "${kind}"`, this.peek().pos);
    }
    const group = this.parseParenGroup();
    const items = group.kind === "ArgList" ? group.items : group.kind === "Group" ? [group.inner] : [group];
    return { kind: "Vector", style: kind, items };
  }

  private parseBigOp(op: "sum" | "prod" | "int"): MathNode {
    let sub: MathNode | null = null;
    let sup: MathNode | null = null;

    if (op === "int") {
      if (this.startsFactor(this.peek())) {
        const cp = this.pos;
        const lower = this.unwrapGroup(this.parseAtom());
        if (this.peek().type === "TILDE") {
          this.next();
          sub = lower;
          sup = this.unwrapGroup(this.parseAtom());
        } else {
          this.pos = cp;
        }
      }
    } else if (this.peek().type === "IDENT" && this.isRelopEquals(this.peek(1))) {
      const varTok = this.next();
      this.next(); // '='
      const lower = this.unwrapGroup(this.parseAtom());
      sub = { kind: "Relation", op: "=", left: this.resolveIdentSymbol(varTok), right: lower };
      if (this.peek().type !== "TILDE") {
        throw new MathSyntaxError(`Expected "~" after ${op} lower bound`, this.peek().pos);
      }
      this.next();
      sup = this.unwrapGroup(this.parseAtom());
    }

    const body = this.parseAdd();
    return { kind: "BigOp", op, sub, sup, body };
  }

  private isRelopEquals(t: Token | undefined): boolean {
    return !!t && t.type === "RELOP" && t.value === "=";
  }

  private parseLim(): MathNode {
    const varTok = this.peek();
    if (varTok.type !== "IDENT") {
      throw new MathSyntaxError('Expected a variable after "lim"', varTok.pos);
    }
    this.next();
    const variable = this.resolveIdentSymbol(varTok);
    if (this.peek().type !== "ARROW") {
      throw new MathSyntaxError('Expected "->" in lim, e.g. "lim x->0 ..."', this.peek().pos);
    }
    this.next();
    const target = this.parseAtom();
    const body = this.parseAdd();
    return { kind: "Lim", variable, target, body };
  }

  private parseQuantifier(op: "forall" | "exists"): MathNode {
    // "exists(n0)" is accepted the same as "exists n0".
    const parenthesized = this.isSymbol("(");
    if (parenthesized) this.next();

    const varTok = this.peek();
    if (varTok.type !== "IDENT") {
      throw new MathSyntaxError(`Expected a variable after "${op}"`, varTok.pos);
    }
    this.next();
    const variable = this.resolveIdentSymbol(varTok);

    if (parenthesized) {
      const close = this.peek();
      if (!(close.type === "SYMBOL" && close.value === ")")) {
        throw new MathSyntaxError('Missing closing ")"', close.pos);
      }
      this.next();
    }

    let constraintOp: string | null = null;
    let constraintValue: MathNode | null = null;
    if (this.peek().type === "RELOP") {
      const opTok = this.next();
      constraintOp = RELATION_SYMBOLS[opTok.value] ?? opTok.value;
      constraintValue = this.parseAdd();
    } else if (this.peek().type === "IDENT" && (this.peek().value === "in" || this.peek().value === "notin")) {
      const opTok = this.next();
      constraintOp = WORD_KEYWORDS[opTok.value];
      constraintValue = this.parseAdd();
    }

    return { kind: "Quantifier", op, variable, constraintOp, constraintValue };
  }

  private isSymbol(value: string): boolean {
    const t = this.peek();
    return t.type === "SYMBOL" && t.value === value;
  }
}

export function parseMath(input: string): MathNode {
  const tokens = tokenize(input);
  return new Parser(tokens).parse();
}
