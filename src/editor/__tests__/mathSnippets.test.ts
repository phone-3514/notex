import { describe, expect, it } from "vitest";
import { MATH_SNIPPETS, matchMathSnippets, isNoteSnippetContext } from "@/editor/mathSnippets";
import { shorthandToLatex } from "@/renderer/mathToLatex";

describe("matchMathSnippets", () => {
  it("matches by prefix, case-sensitively", () => {
    expect(matchMathSnippets("s").map((s) => s.trigger)).toEqual(
      expect.arrayContaining(["su", "sq"])
    );
    expect(matchMathSnippets("mn")).toEqual([]); // "Mn" is capitalized on purpose
    expect(matchMathSnippets("Mn").map((s) => s.trigger)).toEqual(["Mn"]);
  });

  it("returns nothing for an empty or non-matching word", () => {
    expect(matchMathSnippets("")).toEqual([]);
    expect(matchMathSnippets("zzz")).toEqual([]);
  });

  it("ranks an exact match first", () => {
    const matches = matchMathSnippets("su");
    expect(matches[0].trigger).toBe("su");
  });

  it("places the cursor between empty parens for sqrt", () => {
    const sq = MATH_SNIPPETS.find((s) => s.trigger === "sq")!;
    expect(sq.insertText).toBe("sqrt()");
    expect(sq.selectStart).toBe(sq.selectEnd);
    expect(sq.insertText.slice(0, sq.selectStart)).toBe("sqrt(");
  });

  it("places the cursor inside the first parens for frac", () => {
    const frac = MATH_SNIPPETS.find((s) => s.trigger === "frac")!;
    expect(frac.insertText).toBe("()/()");
    expect(frac.selectStart).toBe(1);
    expect(frac.selectStart).toBe(frac.selectEnd);
  });

  it("selects the bound placeholder for int and lim", () => {
    const intSnippet = MATH_SNIPPETS.find((s) => s.trigger === "int")!;
    expect(intSnippet.insertText).toBe("int a~b f(x) dx");
    expect(intSnippet.insertText.slice(intSnippet.selectStart, intSnippet.selectEnd)).toBe("a");

    const lim = MATH_SNIPPETS.find((s) => s.trigger === "lim")!;
    expect(lim.insertText).toBe("lim x->a");
    expect(lim.insertText.slice(lim.selectStart, lim.selectEnd)).toBe("a");
  });

  it("selects the set placeholder for Mn(R)", () => {
    const mn = MATH_SNIPPETS.find((s) => s.trigger === "Mn")!;
    expect(mn.insertText).toBe("Mn(R)");
    expect(mn.insertText.slice(mn.selectStart, mn.selectEnd)).toBe("R");
  });

  it("every reference example is valid, parseable math shorthand", () => {
    for (const s of MATH_SNIPPETS) {
      expect(() => shorthandToLatex(s.referenceExample), s.trigger).not.toThrow();
    }
  });

  it("has autocomplete entries for the new logic/arrow tokens", () => {
    const triggers = MATH_SNIPPETS.map((s) => s.trigger);
    for (const t of ["therefore", "because", "st", "iff", "implies", "gets", "mapsto", "notin"]) {
      expect(triggers, t).toContain(t);
    }
  });

  it("matches the new triggers by prefix", () => {
    expect(matchMathSnippets("ther").map((s) => s.trigger)).toEqual(["therefore"]);
    expect(matchMathSnippets("imp").map((s) => s.trigger)).toEqual(["implies"]);
  });

  it("no new trigger silently shadows an existing one", () => {
    const triggers = MATH_SNIPPETS.map((s) => s.trigger);
    expect(new Set(triggers).size).toBe(triggers.length);
  });
});

describe("isNoteSnippetContext", () => {
  it("is true when the word is right after a semicolon (';i', ';m', ...)", () => {
    const value = ";i";
    expect(isNoteSnippetContext(value, value.indexOf("i"))).toBe(true);
  });

  it("is false for ordinary math autocomplete contexts", () => {
    const value = "int";
    expect(isNoteSnippetContext(value, 0)).toBe(false);
  });

  it("is false at the very start of the document", () => {
    expect(isNoteSnippetContext("i", 0)).toBe(false);
  });
});
