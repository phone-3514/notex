// Figure blocks: ":::fig 12x8 ... :::" regions holding a small vector
// drawing (lines, arrows, axes, circles, labels…) on a snapped grid. The
// note stores the drawing as a short, human-editable text description — see
// figureText.ts — so it lives in the same plain-text source as everything
// else (diffable, exported to Markdown as-is, tiny in localStorage).
//
// Coordinates are in grid units with the origin at the bottom-left and y
// pointing up, i.e. ordinary math orientation.

export type FigureColor = "black" | "red" | "blue";

export interface FigureStyle {
  color: FigureColor;
  dashed: boolean;
}

export type FigureShape =
  | ({ kind: "line" | "arrow" | "rect"; x1: number; y1: number; x2: number; y2: number } & FigureStyle)
  | ({ kind: "circle"; cx: number; cy: number; r: number } & FigureStyle)
  | ({ kind: "point"; x: number; y: number } & FigureStyle)
  // Axes cross at (ox, oy) and extend left/right/down/up by the given
  // number of units, with an arrowhead at the right and top ends.
  | ({ kind: "axes"; ox: number; oy: number; left: number; right: number; down: number; up: number } & FigureStyle)
  // `text` is math shorthand (same DSL as "@...@"), centred on (x, y).
  | ({ kind: "text"; x: number; y: number; text: string } & FigureStyle);

export interface Figure {
  width: number; // grid units
  height: number;
  grid: boolean; // draw a faint grid in the rendered figure
  shapes: FigureShape[];
}

export const DEFAULT_FIGURE_WIDTH = 12;
export const DEFAULT_FIGURE_HEIGHT = 8;
export const MIN_FIGURE_SIZE = 3;
export const MAX_FIGURE_SIZE = 30;
