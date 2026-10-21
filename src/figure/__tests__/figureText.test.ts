import { describe, expect, it } from "vitest";
import {
  FIGURE_OPEN_RE,
  findFigureBlock,
  parseFigure,
  replaceFigureBlock,
  serializeFigure,
  serializeShape,
} from "../figureText";
import type { Figure } from "../types";

describe("figure text format", () => {
  it("recognises the open line with and without a size", () => {
    expect(FIGURE_OPEN_RE.exec(":::fig")).not.toBeNull();
    expect(FIGURE_OPEN_RE.exec(":::fig 12x8")).toMatchObject({ 1: "12", 2: "8" });
    expect(FIGURE_OPEN_RE.test(":::figure")).toBe(false);
    expect(FIGURE_OPEN_RE.test(":::fig abc")).toBe(false);
  });

  it("parses every shape kind with styles", () => {
    const fig = parseFigure("10", "6", [
      "grid",
      "line 1,1 5,1",
      "arrow 0,0 3,2.5 red",
      "rect 1,1 4,3 dashed",
      "circle 5,3 1.5 blue dashed",
      "point 2,2",
      "axes 5,3 4 4 2 2",
      'text 3,3 "x_0" red',
    ]);
    expect(fig).toMatchObject({ width: 10, height: 6, grid: true });
    expect(fig.shapes.map((s) => s.kind)).toEqual(["line", "arrow", "rect", "circle", "point", "axes", "text"]);
    expect(fig.shapes[1]).toMatchObject({ kind: "arrow", x2: 3, y2: 2.5, color: "red", dashed: false });
    expect(fig.shapes[3]).toMatchObject({ kind: "circle", r: 1.5, color: "blue", dashed: true });
    expect(fig.shapes[6]).toMatchObject({ kind: "text", text: "x_0", color: "red" });
  });

  it("defaults the size and clamps an out-of-range one", () => {
    expect(parseFigure(undefined, undefined, [])).toMatchObject({ width: 12, height: 8 });
    expect(parseFigure("99", "1", [])).toMatchObject({ width: 30, height: 3 });
  });

  it("skips unrecognised or malformed lines instead of failing", () => {
    const fig = parseFigure(undefined, undefined, ["line 1,1", "blob 1,2", "line 0,0 1,1 purple", "", "point 1,1"]);
    expect(fig.shapes).toHaveLength(1);
    expect(fig.shapes[0].kind).toBe("point");
  });

  it("round-trips through serializeFigure", () => {
    const fig: Figure = {
      width: 12,
      height: 8,
      grid: true,
      shapes: [
        { kind: "line", x1: 1, y1: 1, x2: 5.5, y2: 1, color: "black", dashed: false },
        { kind: "arrow", x1: 0, y1: 0, x2: 3, y2: 2, color: "red", dashed: true },
        { kind: "axes", ox: 5, oy: 3, left: 4, right: 4, down: 2, up: 2, color: "black", dashed: false },
        { kind: "text", x: 3, y: 3, text: "y=x^2", color: "blue", dashed: false },
      ],
    };
    const text = serializeFigure(fig);
    expect(text.split("\n")[0]).toBe(":::fig 12x8");
    expect(text.split("\n").at(-1)).toBe(":::");
    const lines = text.split("\n");
    const open = FIGURE_OPEN_RE.exec(lines[0])!;
    expect(parseFigure(open[1], open[2], lines.slice(1, -1))).toEqual(fig);
  });

  it("omits default style words and rounds noisy numbers", () => {
    expect(serializeShape({ kind: "point", x: 1.00001, y: 2.499999, color: "black", dashed: false })).toBe("point 1,2.5");
    expect(serializeShape({ kind: "text", x: 1, y: 1, text: 'say "hi"', color: "black", dashed: false })).toBe(
      "text 1,1 \"say 'hi'\""
    );
  });
});

describe("finding and replacing a figure block in a note", () => {
  const note = "# タイトル\n:::fig 6x4\nline 1,1 3,1\n:::\n\n後ろの文章";

  it("finds the block by its open line and reports the line range", () => {
    const found = findFigureBlock(note, 1)!;
    expect(found.startLine).toBe(1);
    expect(found.endLine).toBe(3);
    expect(found.figure.shapes).toHaveLength(1);
    expect(findFigureBlock(note, 0)).toBeNull();
  });

  it("replaces only that block", () => {
    const next = replaceFigureBlock(note, 1, {
      width: 6,
      height: 4,
      grid: false,
      shapes: [{ kind: "point", x: 2, y: 2, color: "black", dashed: false }],
    })!;
    expect(next).toBe("# タイトル\n:::fig 6x4\npoint 2,2\n:::\n\n後ろの文章");
  });

  it("handles an unterminated block by closing it", () => {
    const open = ":::fig\nline 0,0 1,1";
    const next = replaceFigureBlock(open, 0, { width: 12, height: 8, grid: false, shapes: [] })!;
    expect(next).toBe(":::fig 12x8\n:::");
  });
});
