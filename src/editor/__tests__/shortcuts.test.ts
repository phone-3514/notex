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

import { indentSelection, outdentSelection, INDENT_UNIT } from "@/editor/shortcuts";

describe("indentSelection (Tab)", () => {
  it("inserts one indent unit at the caret when nothing is selected", () => {
    const r = indentSelection({ value: "abc def", selectionStart: 3, selectionEnd: 3 });
    expect(r.value).toBe(`abc${INDENT_UNIT} def`);
    expect(r.selectionStart).toBe(3 + INDENT_UNIT.length);
    expect(r.selectionEnd).toBe(r.selectionStart);
    expect(r).toMatchObject({ from: 3, to: 3, text: INDENT_UNIT });
  });

  it("indents the whole line for a selection inside one line, keeping the same text selected", () => {
    const r = indentSelection({ value: "hello world", selectionStart: 6, selectionEnd: 11 });
    expect(r.value).toBe(`${INDENT_UNIT}hello world`);
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("world");
  });

  it("indents every line a multi-line selection touches", () => {
    const value = "one\ntwo\nthree\nfour";
    const r = indentSelection({ value, selectionStart: 5, selectionEnd: 10 }); // "wo\nth"
    expect(r.value).toBe(`one\n${INDENT_UNIT}two\n${INDENT_UNIT}three\nfour`);
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("wo\n" + INDENT_UNIT + "th");
    expect(r.from).toBe(4);
    expect(r.to).toBe(13);
  });

  it("does not indent the line a selection merely ends at the start of", () => {
    const value = "one\ntwo\nthree";
    const r = indentSelection({ value, selectionStart: 0, selectionEnd: 8 }); // "one\ntwo\n"
    expect(r.value).toBe(`${INDENT_UNIT}one\n${INDENT_UNIT}two\nthree`);
  });

  it("leaves blank lines blank", () => {
    const r = indentSelection({ value: "a\n\nb", selectionStart: 0, selectionEnd: 4 });
    expect(r.value).toBe(`${INDENT_UNIT}a\n\n${INDENT_UNIT}b`);
  });
});

describe("outdentSelection (Shift+Tab)", () => {
  it("removes one indent unit from the caret's line and moves the caret back with it", () => {
    const value = `${INDENT_UNIT}abc`;
    const r = outdentSelection({ value, selectionStart: INDENT_UNIT.length + 2, selectionEnd: INDENT_UNIT.length + 2 });
    expect(r.value).toBe("abc");
    expect(r.selectionStart).toBe(2);
  });

  it("removes only as much as there is, up to one unit", () => {
    expect(outdentSelection({ value: "  ab", selectionStart: 3, selectionEnd: 3 }).value).toBe("ab");
    expect(outdentSelection({ value: `${INDENT_UNIT}  ab`, selectionStart: 0, selectionEnd: 0 }).value).toBe("  ab");
  });

  it("removes a leading tab", () => {
    expect(outdentSelection({ value: "\tab", selectionStart: 2, selectionEnd: 2 }).value).toBe("ab");
  });

  it("does nothing to an unindented line", () => {
    const r = outdentSelection({ value: "abc", selectionStart: 1, selectionEnd: 1 });
    expect(r.value).toBe("abc");
    expect(r.selectionStart).toBe(1);
  });

  it("outdents every touched line of a multi-line selection and keeps the selection on the same text", () => {
    const value = `${INDENT_UNIT}one\n${INDENT_UNIT}two\n${INDENT_UNIT}three`;
    const start = INDENT_UNIT.length + 1; // inside "one"
    const end = value.length - 2; // inside "three"
    const r = outdentSelection({ value, selectionStart: start, selectionEnd: end });
    expect(r.value).toBe("one\ntwo\nthree");
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe(value.slice(start, end).replaceAll(INDENT_UNIT, ""));
  });

  it("a caret inside the removed whitespace lands at the line start", () => {
    const r = outdentSelection({ value: `${INDENT_UNIT}x`, selectionStart: 2, selectionEnd: 2 });
    expect(r.selectionStart).toBe(0);
  });

  it("is the inverse of indenting", () => {
    const value = "one\ntwo\nthree";
    const state = { value, selectionStart: 2, selectionEnd: 10 };
    const indented = indentSelection(state);
    const back = outdentSelection(indented);
    expect(back.value).toBe(value);
    expect(back.selectionStart).toBe(2);
    expect(back.selectionEnd).toBe(10);
  });
});
