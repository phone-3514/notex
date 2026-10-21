import { describe, expect, it } from "vitest";
import { constrainAngle, constrainSquare, distanceToShape, hitTest, moveShape, snap } from "../geometry";
import type { FigureShape } from "../types";

const base = { color: "black", dashed: false } as const;

describe("figure geometry", () => {
  it("snaps to the step, or just rounds when the step is 0", () => {
    expect(snap(1.3, 0.5)).toBe(1.5);
    expect(snap(1.2, 0.5)).toBe(1);
    expect(snap(2.6, 1)).toBe(3);
    expect(snap(1.2345, 0)).toBe(1.23);
  });

  it("constrains a segment to 45° multiples, keeping its length", () => {
    const flat = constrainAngle(0, 0, 5, 1);
    expect(flat.x).toBeCloseTo(Math.hypot(5, 1));
    expect(flat.y).toBeCloseTo(0);
    const diag = constrainAngle(0, 0, 3, 3.4);
    expect(diag.x).toBeCloseTo(diag.y);
    const vertical = constrainAngle(2, 2, 2.2, 6);
    expect(vertical.x).toBeCloseTo(2);
  });

  it("makes a rectangle square, in the drag direction", () => {
    expect(constrainSquare(0, 0, 4, 2)).toEqual({ x: 4, y: 4 });
    expect(constrainSquare(0, 0, -2, -4)).toEqual({ x: -4, y: -4 });
  });

  it("measures distance to each shape's ink", () => {
    const line: FigureShape = { kind: "line", x1: 0, y1: 0, x2: 4, y2: 0, ...base };
    expect(distanceToShape(line, 2, 1)).toBeCloseTo(1);
    expect(distanceToShape(line, 6, 0)).toBeCloseTo(2);
    const circle: FigureShape = { kind: "circle", cx: 0, cy: 0, r: 2, ...base };
    expect(distanceToShape(circle, 3, 0)).toBeCloseTo(1);
    expect(distanceToShape(circle, 0, 0)).toBeCloseTo(2);
    const rect: FigureShape = { kind: "rect", x1: 0, y1: 0, x2: 4, y2: 2, ...base };
    expect(distanceToShape(rect, 2, 1)).toBeCloseTo(1); // inside: distance to the border
    const axes: FigureShape = { kind: "axes", ox: 5, oy: 3, left: 2, right: 2, down: 1, up: 1, ...base };
    expect(distanceToShape(axes, 6, 3)).toBeCloseTo(0);
  });

  it("hit-tests the topmost shape within tolerance", () => {
    const shapes: FigureShape[] = [
      { kind: "line", x1: 0, y1: 0, x2: 4, y2: 0, ...base },
      { kind: "point", x: 2, y: 0.1, ...base },
    ];
    expect(hitTest(shapes, 2, 0.1, 0.35)).toBe(1);
    expect(hitTest(shapes, 3, 0.2, 0.35)).toBe(0);
    expect(hitTest(shapes, 3, 3, 0.35)).toBe(-1);
  });

  it("moves every kind of shape", () => {
    expect(moveShape({ kind: "line", x1: 0, y1: 0, x2: 1, y2: 1, ...base }, 2, 3)).toMatchObject({ x1: 2, y1: 3, x2: 3, y2: 4 });
    expect(moveShape({ kind: "circle", cx: 1, cy: 1, r: 2, ...base }, -1, 1)).toMatchObject({ cx: 0, cy: 2, r: 2 });
    expect(moveShape({ kind: "text", x: 1, y: 1, text: "a", ...base }, 1, 1)).toMatchObject({ x: 2, y: 2 });
    expect(moveShape({ kind: "axes", ox: 1, oy: 1, left: 1, right: 1, down: 1, up: 1, ...base }, 1, 0)).toMatchObject({ ox: 2, oy: 1 });
  });
});
