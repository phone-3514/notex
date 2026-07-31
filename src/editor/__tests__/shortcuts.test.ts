import { describe, expect, it } from "vitest";
import { wrapBold, insertHeading } from "@/editor/shortcuts";

describe("wrapBold", () => {
  it("wraps a selection and preserves it (shifted by the markers)", () => {
    const result = wrapBold({ value: "hello world", selectionStart: 6, selectionEnd: 11 });
    expect(result.value).toBe("hello **world**");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("world");
  });

  it("drops the cursor between markers when nothing is selected", () => {
    const result = wrapBold({ value: "hello ", selectionStart: 6, selectionEnd: 6 });
    expect(result.value).toBe("hello ****");
    expect(result.selectionStart).toBe(result.selectionEnd);
    expect(result.value.slice(0, result.selectionStart)).toBe("hello **");
  });
});

describe("insertHeading", () => {
  it("prefixes the current line and shifts the cursor by the marker length", () => {
    const state = { value: "hello world", selectionStart: 6, selectionEnd: 6 };
    const result = insertHeading(1)(state);
    expect(result.value).toBe("# hello world");
    expect(result.selectionStart).toBe(8); // 6 + "# ".length
  });

  it("finds the start of the current line in a multi-line document", () => {
    const state = { value: "line one\nline two", selectionStart: 13, selectionEnd: 13 };
    const result = insertHeading(2)(state);
    expect(result.value).toBe("line one\n## line two");
    expect(result.selectionStart).toBe(13 + 3);
  });

  it("uses the right number of hashes per level", () => {
    const state = { value: "x", selectionStart: 0, selectionEnd: 0 };
    expect(insertHeading(1)(state).value).toBe("# x");
    expect(insertHeading(2)(state).value).toBe("## x");
    expect(insertHeading(3)(state).value).toBe("### x");
  });

  it("preserves a non-collapsed selection's length", () => {
    const state = { value: "abc def", selectionStart: 4, selectionEnd: 7 };
    const result = insertHeading(1)(state);
    expect(result.value).toBe("# abc def");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("def");
  });
});
