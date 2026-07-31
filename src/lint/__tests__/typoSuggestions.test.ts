import { describe, expect, it } from "vitest";
import { applySuggestion, getTypoSuggestions } from "@/lint/typoSuggestions";

describe("getTypoSuggestions", () => {
  it("suggests 'matrix' for 'matirx'", () => {
    const s = getTypoSuggestions("= matirx\n1, 2\n3, 4\nend");
    expect(s.some((x) => x.message.includes('"matrix"') && x.line === 0)).toBe(true);
  });

  it("suggests 'align' for 'aling'", () => {
    const s = getTypoSuggestions("= aling\nf(x)\n= x+1\nend");
    expect(s.some((x) => x.message.includes('"align"') && x.line === 0)).toBe(true);
  });

  it("suggests 'end' for 'ends'", () => {
    const s = getTypoSuggestions("= matrix\n1, 2\n3, 4\nends");
    expect(s.some((x) => x.message.includes('"end"') && x.line === 3)).toBe(true);
  });

  it("flags a missing 'end' at the opening line", () => {
    const s = getTypoSuggestions("= matrix\n1, 2\n3, 4");
    expect(s.some((x) => x.message.includes("Missing") && x.line === 0)).toBe(true);
  });

  it("flags inconsistent matrix columns", () => {
    const s = getTypoSuggestions("= matrix\n1, 2\n3\nend");
    expect(s.some((x) => x.message.includes("Inconsistent") && x.line === 2)).toBe(true);
  });

  it("does not flag a well-formed matrix", () => {
    const s = getTypoSuggestions("= matrix\n1, 2\n3, 4\nend");
    expect(s).toEqual([]);
  });

  it("flags an unmatched '@'", () => {
    const s = getTypoSuggestions("open @eps>0 with no close");
    expect(s.some((x) => x.message.includes('Unmatched "@"'))).toBe(true);
  });

  it("does not flag a matched '@...@' pair", () => {
    const s = getTypoSuggestions("prose @eps>0@ more prose");
    expect(s).toEqual([]);
  });

  it("does not flag '@@' (escaped literal @)", () => {
    const s = getTypoSuggestions("me@@example.com");
    expect(s).toEqual([]);
  });

  it("does not flag ordinary prose or valid content", () => {
    const s = getTypoSuggestions("# Title\n\nJust some ordinary text about matrices and alignment.");
    expect(s).toEqual([]);
  });

  it("does not flag a valid pair plus one '@' mentioned as a literal character (odd count, not a mistake)", () => {
    const s = getTypoSuggestions('wrap an expression like @eps>0@ in "@" signs for inline math');
    expect(s).toEqual([]);
  });

  it("flags a misplaced apostrophe right after an operator", () => {
    const s = getTypoSuggestions("= x+'y");
    expect(s.some((x) => x.message.includes("Misplaced apostrophe") && x.line === 0)).toBe(true);
  });

  it("flags a leading apostrophe right after '='", () => {
    const s = getTypoSuggestions("= 'x");
    expect(s.some((x) => x.message.includes("Misplaced apostrophe") && x.line === 0)).toBe(true);
  });

  it("does not flag valid prime notation", () => {
    for (const line of ["= f'(x)=2x", "= g'(x,y)", "= (f+g)'(x)", "@f''(x)@"]) {
      expect(getTypoSuggestions(line), line).toEqual([]);
    }
  });

  it("does not flag prose apostrophes", () => {
    const s = getTypoSuggestions("Don't confuse f'(x) with the function's value; it's not the same.");
    expect(s).toEqual([]);
  });

  it("does not flag a valid cases block", () => {
    const s = getTypoSuggestions("= f(x)=cases\nx^2, x>=0\n-x, x<0\nend");
    expect(s).toEqual([]);
  });
});

describe("applySuggestion", () => {
  it("replaces the find text on the target line only", () => {
    const source = "= matirx\n1, 2\nend";
    const [s] = getTypoSuggestions(source);
    expect(applySuggestion(source, s)).toBe("= matrix\n1, 2\nend");
  });

  it("is a no-op for a suggestion with no safe single-line fix", () => {
    const source = "= matrix\n1, 2\n3, 4";
    const suggestions = getTypoSuggestions(source);
    const missingEnd = suggestions.find((x) => x.message.includes("Missing"))!;
    expect(applySuggestion(source, missingEnd)).toBe(source);
  });
});
