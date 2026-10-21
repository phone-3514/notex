import { describe, expect, it } from "vitest";
import { renderFigureHtml, renderFigureCanvas, shapeSvg, UNIT } from "../renderFigure";
import type { Figure } from "../types";

const label = (t: string) => `<i>${t}</i>`;
const fig: Figure = {
  width: 10,
  height: 5,
  grid: false,
  shapes: [
    { kind: "line", x1: 0, y1: 0, x2: 10, y2: 0, color: "black", dashed: false },
    { kind: "arrow", x1: 1, y1: 1, x2: 4, y2: 1, color: "red", dashed: true },
    { kind: "text", x: 5, y: 2.5, text: "x_0", color: "blue", dashed: false },
  ],
};

describe("figure rendering", () => {
  it("flips y into SVG space (y-up figure coordinates)", () => {
    const svg = shapeSvg({ kind: "line", x1: 0, y1: 0, x2: 10, y2: 5, color: "black", dashed: false }, 5);
    expect(svg).toContain(`y1="${5 * UNIT}"`);
    expect(svg).toContain(`y2="0"`);
  });

  it("draws arrows as shaft + polygon head, dashed when asked, in the chosen colour", () => {
    const svg = shapeSvg(fig.shapes[1], 5);
    expect(svg).toContain("<polygon");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("#b91c1c");
  });

  it("draws axes with an arrowhead at each positive end", () => {
    const svg = shapeSvg({ kind: "axes", ox: 5, oy: 3, left: 4, right: 4, down: 2, up: 2, color: "black", dashed: false }, 8);
    expect(svg.match(/<polygon/g)).toHaveLength(2);
    expect(svg.match(/<line/g)).toHaveLength(2);
  });

  it("puts text labels in HTML over the SVG, positioned in percent", () => {
    const html = renderFigureCanvas(fig, label);
    expect(html).toContain('class="figure-svg"');
    expect(html).toContain('<span class="figure-label" style="left:50%;top:50%;');
    expect(html).toContain("<i>x_0</i>");
    expect(html).toContain(`viewBox="0 0 ${10 * UNIT} ${5 * UNIT}"`);
  });

  it("fills its container in the editor and caps at natural size otherwise", () => {
    expect(renderFigureCanvas(fig, label, { fill: true })).toContain("width:100%");
    expect(renderFigureCanvas(fig, label)).toContain(`max-width:${10 * UNIT}px`);
  });

  it("wraps the block with the line anchor and an edit button", () => {
    const html = renderFigureHtml(fig, 7, label);
    expect(html).toContain('data-src-line="7"');
    expect(html).toContain('data-fig-line="7"');
    expect(html).toContain("図を編集");
    expect(html).not.toContain("figure-empty");
  });

  it("offers 'draw' on an empty figure", () => {
    const html = renderFigureHtml({ ...fig, shapes: [] }, 0, label);
    expect(html).toContain("figure-empty");
    expect(html).toContain("図を描く");
  });
});
