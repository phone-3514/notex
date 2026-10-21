import {
  DEFAULT_FIGURE_HEIGHT,
  DEFAULT_FIGURE_WIDTH,
  MAX_FIGURE_SIZE,
  MIN_FIGURE_SIZE,
  type Figure,
  type FigureColor,
  type FigureShape,
  type FigureStyle,
} from "./types";

// ":::fig" or ":::fig 12x8" — the optional size is the figure's extent in grid units.
export const FIGURE_OPEN_RE = /^:::fig(?:\s+(\d+)x(\d+))?\s*$/;
export const FIGURE_CLOSE = ":::";

const COLORS: FigureColor[] = ["black", "red", "blue"];
const NUM = "-?\\d+(?:\\.\\d+)?";
const PT = `(${NUM}),(${NUM})`;

function clampSize(n: number): number {
  return Math.min(MAX_FIGURE_SIZE, Math.max(MIN_FIGURE_SIZE, n));
}

// Trailing style words ("red", "dashed", in any order) after a shape's numbers.
function parseStyle(rest: string): FigureStyle | null {
  const style: FigureStyle = { color: "black", dashed: false };
  for (const word of rest.split(/\s+/).filter(Boolean)) {
    if (word === "dashed") style.dashed = true;
    else if ((COLORS as string[]).includes(word)) style.color = word as FigureColor;
    else return null;
  }
  return style;
}

const LINE_RE = new RegExp(`^(line|arrow|rect)\\s+${PT}\\s+${PT}(.*)$`);
const CIRCLE_RE = new RegExp(`^circle\\s+${PT}\\s+(${NUM})(.*)$`);
const POINT_RE = new RegExp(`^point\\s+${PT}(.*)$`);
const AXES_RE = new RegExp(`^axes\\s+${PT}\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})(.*)$`);
const TEXT_RE = new RegExp(`^text\\s+${PT}\\s+"(.*)"(.*)$`);

function parseShape(line: string): FigureShape | null {
  let m: RegExpExecArray | null;
  if ((m = LINE_RE.exec(line))) {
    const style = parseStyle(m[6]);
    if (!style) return null;
    return { kind: m[1] as "line" | "arrow" | "rect", x1: +m[2], y1: +m[3], x2: +m[4], y2: +m[5], ...style };
  }
  if ((m = CIRCLE_RE.exec(line))) {
    const style = parseStyle(m[4]);
    return style ? { kind: "circle", cx: +m[1], cy: +m[2], r: +m[3], ...style } : null;
  }
  if ((m = POINT_RE.exec(line))) {
    const style = parseStyle(m[3]);
    return style ? { kind: "point", x: +m[1], y: +m[2], ...style } : null;
  }
  if ((m = AXES_RE.exec(line))) {
    const style = parseStyle(m[7]);
    return style
      ? { kind: "axes", ox: +m[1], oy: +m[2], left: +m[3], right: +m[4], down: +m[5], up: +m[6], ...style }
      : null;
  }
  if ((m = TEXT_RE.exec(line))) {
    const style = parseStyle(m[4]);
    return style ? { kind: "text", x: +m[1], y: +m[2], text: m[3], ...style } : null;
  }
  return null;
}

// Parses the lines between ":::fig" and ":::". Unrecognised lines are
// skipped rather than rejected, so a half-typed line never blanks the figure.
export function parseFigure(sizeW: string | undefined, sizeH: string | undefined, bodyLines: string[]): Figure {
  const figure: Figure = {
    width: sizeW ? clampSize(+sizeW) : DEFAULT_FIGURE_WIDTH,
    height: sizeH ? clampSize(+sizeH) : DEFAULT_FIGURE_HEIGHT,
    grid: false,
    shapes: [],
  };
  for (const raw of bodyLines) {
    const line = raw.trim();
    if (line === "") continue;
    if (line === "grid") {
      figure.grid = true;
      continue;
    }
    const shape = parseShape(line);
    if (shape) figure.shapes.push(shape);
  }
  return figure;
}

function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function styleSuffix(s: FigureStyle): string {
  return `${s.color === "black" ? "" : ` ${s.color}`}${s.dashed ? " dashed" : ""}`;
}

export function serializeShape(s: FigureShape): string {
  switch (s.kind) {
    case "line":
    case "arrow":
    case "rect":
      return `${s.kind} ${num(s.x1)},${num(s.y1)} ${num(s.x2)},${num(s.y2)}${styleSuffix(s)}`;
    case "circle":
      return `circle ${num(s.cx)},${num(s.cy)} ${num(s.r)}${styleSuffix(s)}`;
    case "point":
      return `point ${num(s.x)},${num(s.y)}${styleSuffix(s)}`;
    case "axes":
      return `axes ${num(s.ox)},${num(s.oy)} ${num(s.left)} ${num(s.right)} ${num(s.down)} ${num(s.up)}${styleSuffix(s)}`;
    case "text":
      // A double quote would end the label early; swap it for a prime.
      return `text ${num(s.x)},${num(s.y)} "${s.text.replace(/"/g, "'")}"${styleSuffix(s)}`;
  }
}

// The whole ":::fig ... :::" block as note text.
export function serializeFigure(figure: Figure): string {
  const body = figure.shapes.map(serializeShape);
  if (figure.grid) body.unshift("grid");
  return [`:::fig ${figure.width}x${figure.height}`, ...body, FIGURE_CLOSE].join("\n");
}

// Locates the figure block whose ":::fig" line is at `startLine` (0-indexed)
// and returns its parsed contents plus the inclusive line range to replace.
export function findFigureBlock(
  content: string,
  startLine: number
): { figure: Figure; startLine: number; endLine: number } | null {
  const lines = content.split("\n");
  const open = FIGURE_OPEN_RE.exec(lines[startLine] ?? "");
  if (!open) return null;
  let end = startLine + 1;
  while (end < lines.length && lines[end].trim() !== FIGURE_CLOSE) end++;
  const figure = parseFigure(open[1], open[2], lines.slice(startLine + 1, end));
  return { figure, startLine, endLine: Math.min(end, lines.length - 1) };
}

// Replaces the figure block at `startLine` with `figure`'s serialization.
export function replaceFigureBlock(content: string, startLine: number, figure: Figure): string | null {
  const found = findFigureBlock(content, startLine);
  if (!found) return null;
  const lines = content.split("\n");
  lines.splice(found.startLine, found.endLine - found.startLine + 1, ...serializeFigure(figure).split("\n"));
  return lines.join("\n");
}
