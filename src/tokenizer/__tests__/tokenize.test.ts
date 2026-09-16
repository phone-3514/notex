import { describe, expect, it } from "vitest";
import { tokenize } from "@/tokenizer/tokenize";
import { MathSyntaxError } from "@/tokenizer/types";

describe("tokenize", () => {
  it("splits a known function name away from its argument", () => {
    const tokens = tokenize("sinx");
    expect(tokens.map((t) => t.value)).toEqual(["sin", "x", ""]);
  });

  it("keeps whole-word keywords intact", () => {
    const tokens = tokenize("forall");
    expect(tokens[0]).toMatchObject({ type: "IDENT", value: "forall" });
  });

  it("recognizes -> as a single ARROW token", () => {
    const tokens = tokenize("x->0");
    expect(tokens.map((t) => t.type)).toEqual(["IDENT", "ARROW", "NUMBER", "EOF"]);
  });

  it("recognizes multi-char relops", () => {
    const tokens = tokenize("a<=b>=c!=d");
    expect(tokens.filter((t) => t.type === "RELOP").map((t) => t.value)).toEqual([
      "<=",
      ">=",
      "!=",
    ]);
  });

  it("parses decimals", () => {
    const tokens = tokenize("3.14");
    expect(tokens[0]).toMatchObject({ type: "NUMBER", value: "3.14" });
  });

  it("throws MathSyntaxError on unsupported characters", () => {
    expect(() => tokenize("x@y")).toThrow(MathSyntaxError);
  });

  it("tokenizes | as its own symbol", () => {
    const tokens = tokenize("|x|");
    expect(tokens.map((t) => [t.type, t.value])).toEqual([
      ["SYMBOL", "|"],
      ["IDENT", "x"],
      ["SYMBOL", "|"],
      ["EOF", ""],
    ]);
  });

  it("tokenizes commas as their own symbol", () => {
    const tokens = tokenize("a,b");
    expect(tokens.map((t) => t.type)).toEqual(["IDENT", "SYMBOL", "IDENT", "EOF"]);
  });

  it("splits forallX / existsX when the remainder starts uppercase", () => {
    expect(tokenize("forallA").map((t) => t.value)).toEqual(["forall", "A", ""]);
    expect(tokenize("existsN").map((t) => t.value)).toEqual(["exists", "N", ""]);
  });

  it("does not split a word that merely begins with a keyword-like prefix", () => {
    // Lowercase continuation => not a separate identifier, left intact.
    expect(tokenize("forallish").map((t) => t.value)).toEqual(["forallish", ""]);
  });

  it("keeps doubled-letter blackboard aliases as single tokens", () => {
    for (const word of ["RR", "CC", "NN", "ZZ", "QQ"]) {
      expect(tokenize(word).map((t) => t.value)).toEqual([word, ""]);
    }
  });

  it("tokenizes : as its own symbol", () => {
    const tokens = tokenize("f: A");
    expect(tokens.map((t) => [t.type, t.value])).toEqual([
      ["IDENT", "f"],
      ["SYMBOL", ":"],
      ["IDENT", "A"],
      ["EOF", ""],
    ]);
  });

  it("special-cases the literal 's.t.' sequence as one IDENT token", () => {
    const tokens = tokenize("s.t.");
    expect(tokens.map((t) => [t.type, t.value])).toEqual([
      ["IDENT", "s.t."],
      ["EOF", ""],
    ]);
  });

  it("tokenizes the new logic/arrow keywords as whole words", () => {
    for (const word of ["therefore", "because", "iff", "implies", "gets", "st"]) {
      expect(tokenize(word).map((t) => t.value)).toEqual([word, ""]);
    }
  });

  it("does not tokenize a bare '.' outside a decimal or 's.t.'", () => {
    expect(() => tokenize("a.b")).toThrow(MathSyntaxError);
  });

  it('tokenizes a "\\"-escaped letter-run as a single LITERAL token', () => {
    expect(tokenize("\\N").map((t) => [t.type, t.value])).toEqual([
      ["LITERAL", "N"],
      ["EOF", ""],
    ]);
    expect(tokenize("\\log").map((t) => [t.type, t.value])).toEqual([
      ["LITERAL", "log"],
      ["EOF", ""],
    ]);
  });

  it('throws MathSyntaxError on a trailing "\\" with no letter after it', () => {
    expect(() => tokenize("\\")).toThrow(MathSyntaxError);
    expect(() => tokenize("\\1")).toThrow(MathSyntaxError);
  });

  it("tokenizes { and } as their own symbols (set literal/set-builder braces)", () => {
    expect(tokenize("{x}").map((t) => [t.type, t.value])).toEqual([
      ["SYMBOL", "{"],
      ["IDENT", "x"],
      ["SYMBOL", "}"],
      ["EOF", ""],
    ]);
  });
});
