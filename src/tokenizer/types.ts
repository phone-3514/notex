export type TokenType =
  | "NUMBER"
  | "IDENT"
  | "LITERAL" // "\"-escaped letter-run: renders as-is, bypassing every dictionary lookup
  | "TEXT_LITERAL" // "text(...)"'s raw, unparsed inner content — upright (\text) prose inside math
  | "SYMBOL" // single-char structural symbols: ( ) { } ^ _ + - * / , !
  | "RELOP" // = < > <= >= !=
  | "ARROW" // ->
  | "TILDE" // ~ (bounds separator for sum/int)
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

export class MathSyntaxError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.name = "MathSyntaxError";
    this.pos = pos;
  }
}
