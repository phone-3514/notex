import { describe, expect, it } from "vitest";
import { lineNumberAt } from "@/editor/cursorLine";

describe("lineNumberAt", () => {
  it("is 0 at the start of the document", () => {
    expect(lineNumberAt("hello world", 0)).toBe(0);
  });

  it("counts preceding newlines", () => {
    const value = "line0\nline1\nline2";
    expect(lineNumberAt(value, 0)).toBe(0);
    expect(lineNumberAt(value, 6)).toBe(1); // right after the first \n
    expect(lineNumberAt(value, 12)).toBe(2); // right after the second \n
  });

  it("does not count a newline exactly at the cursor position", () => {
    const value = "abc\ndef";
    expect(lineNumberAt(value, 3)).toBe(0); // cursor right before the \n
    expect(lineNumberAt(value, 4)).toBe(1); // cursor right after the \n
  });

  it("clamps sensibly at the end of the document", () => {
    const value = "a\nb\nc";
    expect(lineNumberAt(value, value.length)).toBe(2);
  });
});
