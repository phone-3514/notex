import { describe, expect, it } from "vitest";
import { computeScrollTarget, findBlockForLine } from "@/components/previewScroll";

describe("computeScrollTarget", () => {
  it("returns null when the block is already fully visible", () => {
    // viewport [0, 400), block at [50, 150)
    expect(computeScrollTarget(0, 400, 50, 100)).toBeNull();
  });

  it("scrolls down when the block is below the viewport", () => {
    // viewport [0, 400), block at [500, 600)
    expect(computeScrollTarget(0, 400, 500, 100)).toBe(500 - 24);
  });

  it("scrolls up when the block is above the viewport", () => {
    // viewport [800, 1200), block at [100, 200)
    expect(computeScrollTarget(800, 400, 100, 100)).toBe(100 - 24);
  });

  it("aligns to the block's top (not bottom) when it's taller than the viewport", () => {
    // A tall display equation: block [500, 2000), viewport height 400.
    expect(computeScrollTarget(0, 400, 500, 1500)).toBe(500 - 24);
  });

  it("never returns a negative scrollTop", () => {
    expect(computeScrollTarget(500, 400, 5, 50)).toBe(0);
  });
});

describe("findBlockForLine", () => {
  function makeContainer(lines: number[]): HTMLElement {
    const div = document.createElement("div");
    for (const line of lines) {
      const child = document.createElement("p");
      child.dataset.srcLine = String(line);
      div.appendChild(child);
    }
    return div;
  }

  it("finds the block starting exactly at the given line", () => {
    const container = makeContainer([0, 3, 7]);
    expect(findBlockForLine(container, 3)?.dataset.srcLine).toBe("3");
  });

  it("finds the closest preceding block for a line in between", () => {
    const container = makeContainer([0, 3, 7]);
    expect(findBlockForLine(container, 5)?.dataset.srcLine).toBe("3");
  });

  it("falls back to the last block when the line is past all of them", () => {
    const container = makeContainer([0, 3, 7]);
    expect(findBlockForLine(container, 100)?.dataset.srcLine).toBe("7");
  });

  it("returns null when the line is before every block", () => {
    const container = makeContainer([3, 7]);
    expect(findBlockForLine(container, 0)).toBeNull();
  });

  it("returns null when there are no tagged blocks", () => {
    const container = document.createElement("div");
    expect(findBlockForLine(container, 0)).toBeNull();
  });
});
