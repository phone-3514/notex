import { describe, expect, it } from "vitest";
import {
  buildPageCssRule,
  DEFAULT_PAGE_SETTINGS,
  getPageDimensionsMm,
  isPageSettings,
  parseStoredPageSettings,
  type PageSettings,
} from "@/config/pageSettings";

describe("getPageDimensionsMm", () => {
  it("A3 portrait is 297mm x 420mm", () => {
    expect(getPageDimensionsMm({ size: "A3", orientation: "portrait" })).toEqual({ width: 297, height: 420 });
  });

  it("A2 portrait is 420mm x 594mm", () => {
    expect(getPageDimensionsMm({ size: "A2", orientation: "portrait" })).toEqual({ width: 420, height: 594 });
  });

  it("landscape swaps width and height", () => {
    expect(getPageDimensionsMm({ size: "A3", orientation: "landscape" })).toEqual({ width: 420, height: 297 });
    expect(getPageDimensionsMm({ size: "A2", orientation: "landscape" })).toEqual({ width: 594, height: 420 });
  });

  it("defaults to A3 landscape", () => {
    expect(DEFAULT_PAGE_SETTINGS).toEqual({ size: "A3", orientation: "landscape" });
    expect(getPageDimensionsMm(DEFAULT_PAGE_SETTINGS)).toEqual({ width: 420, height: 297 });
  });
});

describe("isPageSettings", () => {
  it("accepts every valid size/orientation combination", () => {
    for (const size of ["A3", "A2"] as const) {
      for (const orientation of ["portrait", "landscape"] as const) {
        expect(isPageSettings({ size, orientation })).toBe(true);
      }
    }
  });

  it("rejects malformed values", () => {
    expect(isPageSettings(null)).toBe(false);
    expect(isPageSettings(undefined)).toBe(false);
    expect(isPageSettings("A3")).toBe(false);
    expect(isPageSettings({ size: "A4", orientation: "portrait" })).toBe(false);
    expect(isPageSettings({ size: "A3", orientation: "sideways" })).toBe(false);
    expect(isPageSettings({ size: "A3" })).toBe(false);
  });
});

describe("parseStoredPageSettings (persisted page settings)", () => {
  it("falls back to the default when nothing is stored", () => {
    expect(parseStoredPageSettings(null)).toEqual(DEFAULT_PAGE_SETTINGS);
  });

  it("round-trips a previously persisted setting", () => {
    const settings: PageSettings = { size: "A2", orientation: "portrait" };
    const stored = JSON.stringify(settings);
    expect(parseStoredPageSettings(stored)).toEqual(settings);
  });

  it("falls back to the default for invalid JSON, without throwing", () => {
    expect(() => parseStoredPageSettings("not json")).not.toThrow();
    expect(parseStoredPageSettings("not json")).toEqual(DEFAULT_PAGE_SETTINGS);
  });

  it("falls back to the default for well-formed JSON that isn't a valid PageSettings", () => {
    expect(parseStoredPageSettings(JSON.stringify({ size: "A4" }))).toEqual(DEFAULT_PAGE_SETTINGS);
    expect(parseStoredPageSettings(JSON.stringify(42))).toEqual(DEFAULT_PAGE_SETTINGS);
  });
});

describe("buildPageCssRule (PDF page selection)", () => {
  it("emits an '@page' rule matching the selected size and orientation", () => {
    expect(buildPageCssRule({ size: "A3", orientation: "landscape" })).toBe("@page { size: 420mm 297mm; }");
    expect(buildPageCssRule({ size: "A3", orientation: "portrait" })).toBe("@page { size: 297mm 420mm; }");
    expect(buildPageCssRule({ size: "A2", orientation: "landscape" })).toBe("@page { size: 594mm 420mm; }");
    expect(buildPageCssRule({ size: "A2", orientation: "portrait" })).toBe("@page { size: 420mm 594mm; }");
  });
});
