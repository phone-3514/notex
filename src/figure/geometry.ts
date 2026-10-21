import type { FigureShape } from "./types";

// Snapping, angle-constraining, hit-testing and moving — the pure geometry
// the drawing UI needs, kept free of React/DOM so it can be unit-tested.

export function snap(v: number, step: number): number {
  if (step <= 0) return Math.round(v * 100) / 100;
  return Math.round(v / step) * step;
}

// Constrains the segment start->end to the nearest multiple of 45° (Shift
// while dragging), preserving its length.
export function constrainAngle(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: x2, y: y2 };
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: x1 + Math.cos(angle) * len, y: y1 + Math.sin(angle) * len };
}

// Makes the rectangle start->end a square (Shift while dragging a rect).
export function constrainSquare(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  const size = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  return { x: x1 + Math.sign(x2 - x1 || 1) * size, y: y1 + Math.sign(y2 - y1 || 1) * size };
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Approximate width (grid units) of a text label, for hit-testing/selection.
export function textHalfWidth(text: string): number {
  return Math.max(0.3, text.length * 0.12);
}

// Distance from (px, py) to the nearest part of the shape's ink.
export function distanceToShape(s: FigureShape, px: number, py: number): number {
  switch (s.kind) {
    case "line":
    case "arrow":
      return distToSegment(px, py, s.x1, s.y1, s.x2, s.y2);
    case "rect": {
      const xa = Math.min(s.x1, s.x2);
      const xb = Math.max(s.x1, s.x2);
      const ya = Math.min(s.y1, s.y2);
      const yb = Math.max(s.y1, s.y2);
      return Math.min(
        distToSegment(px, py, xa, ya, xb, ya),
        distToSegment(px, py, xb, ya, xb, yb),
        distToSegment(px, py, xb, yb, xa, yb),
        distToSegment(px, py, xa, yb, xa, ya)
      );
    }
    case "circle":
      return Math.abs(Math.hypot(px - s.cx, py - s.cy) - s.r);
    case "point":
      return Math.hypot(px - s.x, py - s.y);
    case "axes":
      return Math.min(
        distToSegment(px, py, s.ox - s.left, s.oy, s.ox + s.right, s.oy),
        distToSegment(px, py, s.ox, s.oy - s.down, s.ox, s.oy + s.up)
      );
    case "text": {
      const dx = Math.max(0, Math.abs(px - s.x) - textHalfWidth(s.text));
      const dy = Math.max(0, Math.abs(py - s.y) - 0.3);
      return Math.hypot(dx, dy);
    }
  }
}

// Index of the topmost (last-drawn) shape within `tolerance` of the point, or -1.
export function hitTest(shapes: FigureShape[], px: number, py: number, tolerance: number): number {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (distanceToShape(shapes[i], px, py) <= tolerance) return i;
  }
  return -1;
}

export function moveShape(s: FigureShape, dx: number, dy: number): FigureShape {
  switch (s.kind) {
    case "line":
    case "arrow":
    case "rect":
      return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
    case "circle":
      return { ...s, cx: s.cx + dx, cy: s.cy + dy };
    case "point":
    case "text":
      return { ...s, x: s.x + dx, y: s.y + dy };
    case "axes":
      return { ...s, ox: s.ox + dx, oy: s.oy + dy };
  }
}
