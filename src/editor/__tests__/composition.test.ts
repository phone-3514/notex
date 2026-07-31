import { describe, expect, it } from "vitest";
import { isComposingInput } from "@/editor/composition";

describe("isComposingInput", () => {
  it("is true when local composition state is true", () => {
    expect(isComposingInput(true, {})).toBe(true);
  });

  it("is true when the native event reports isComposing", () => {
    expect(isComposingInput(false, { isComposing: true })).toBe(true);
  });

  it("is false when neither signal is set", () => {
    expect(isComposingInput(false, { isComposing: false })).toBe(false);
    expect(isComposingInput(false, {})).toBe(false);
  });
});
