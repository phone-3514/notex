import type { Figure, FigureColor, FigureShape } from "./types";

// Grid unit -> SVG user units. The SVG scales to its container via viewBox;
// 40 makes a typical 12x8 figure a comfortable 480x320 at 1:1.
export const UNIT = 40;
const STROKE = 2;
const ARROW_LEN = 11;
const ARROW_HALF_WIDTH = 4.5;
const DASH = "6 5";

// "black" is the figure's default ink: currentColor, so it follows the
// surrounding text colour (near-black on the page and in the PDF, themed on
// screen) instead of being a fixed hex.
const COLOR_HEX: Record<FigureColor, string> = {
  black: "currentColor",
  red: "#b91c1c",
  blue: "#1d4ed8",
};

function n(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function strokeAttrs(color: FigureColor, dashed: boolean, width = STROKE): string {
  return `stroke="${COLOR_HEX[color]}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"${dashed ? ` stroke-dasharray="${DASH}"` : ""}`;
}

// Arrowhead as a filled triangle (not an SVG <marker>, so it needs no
// document-unique id and prints identically everywhere): tip at (tx, ty),
// pointing along the direction (dx, dy) in SVG space.
function arrowHead(tx: number, ty: number, dx: number, dy: number, color: FigureColor): string {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = tx - ux * ARROW_LEN;
  const by = ty - uy * ARROW_LEN;
  const px = -uy * ARROW_HALF_WIDTH;
  const py = ux * ARROW_HALF_WIDTH;
  return `<polygon points="${n(tx)},${n(ty)} ${n(bx + px)},${n(by + py)} ${n(bx - px)},${n(by - py)}" fill="${COLOR_HEX[color]}" stroke="none"/>`;
}

// SVG markup (no labels — those are HTML, see renderFigureHtml) for one
// shape, in a figure `height` grid units tall. y is flipped here: figure
// coordinates are y-up, SVG's are y-down.
export function shapeSvg(s: FigureShape, height: number): string {
  const X = (x: number) => x * UNIT;
  const Y = (y: number) => (height - y) * UNIT;
  switch (s.kind) {
    case "line":
      return `<line x1="${n(X(s.x1))}" y1="${n(Y(s.y1))}" x2="${n(X(s.x2))}" y2="${n(Y(s.y2))}" ${strokeAttrs(s.color, s.dashed)}/>`;
    case "arrow": {
      const x1 = X(s.x1);
      const y1 = Y(s.y1);
      const x2 = X(s.x2);
      const y2 = Y(s.y2);
      // The shaft stops at the arrowhead's base so a thick line doesn't poke through the tip.
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const back = Math.min(ARROW_LEN - 1, len);
      const sx = x2 - ((x2 - x1) / len) * back;
      const sy = y2 - ((y2 - y1) / len) * back;
      return (
        `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(sx)}" y2="${n(sy)}" ${strokeAttrs(s.color, s.dashed)}/>` +
        arrowHead(x2, y2, x2 - x1, y2 - y1, s.color)
      );
    }
    case "rect": {
      const x = Math.min(X(s.x1), X(s.x2));
      const y = Math.min(Y(s.y1), Y(s.y2));
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.abs(X(s.x2) - X(s.x1)))}" height="${n(Math.abs(Y(s.y2) - Y(s.y1)))}" ${strokeAttrs(s.color, s.dashed)}/>`;
    }
    case "circle":
      return `<circle cx="${n(X(s.cx))}" cy="${n(Y(s.cy))}" r="${n(s.r * UNIT)}" ${strokeAttrs(s.color, s.dashed)}/>`;
    case "point":
      return `<circle cx="${n(X(s.x))}" cy="${n(Y(s.y))}" r="4" fill="${COLOR_HEX[s.color]}" stroke="none"/>`;
    case "axes": {
      const ox = X(s.ox);
      const oy = Y(s.oy);
      const xEnd = X(s.ox + s.right);
      const yEnd = Y(s.oy + s.up);
      return (
        `<line x1="${n(X(s.ox - s.left))}" y1="${n(oy)}" x2="${n(xEnd - ARROW_LEN + 1)}" y2="${n(oy)}" ${strokeAttrs(s.color, s.dashed)}/>` +
        arrowHead(xEnd, oy, 1, 0, s.color) +
        `<line x1="${n(ox)}" y1="${n(Y(s.oy - s.down))}" x2="${n(ox)}" y2="${n(yEnd + ARROW_LEN - 1)}" ${strokeAttrs(s.color, s.dashed)}/>` +
        arrowHead(ox, yEnd, 0, -1, s.color)
      );
    }
    case "text":
      return ""; // HTML label
  }
}

function gridSvg(fig: Figure): string {
  let d = "";
  for (let x = 1; x < fig.width; x++) d += `M${x * UNIT},0V${fig.height * UNIT}`;
  for (let y = 1; y < fig.height; y++) d += `M0,${y * UNIT}H${fig.width * UNIT}`;
  return `<path d="${d}" stroke="#d4d4d4" stroke-width="1" fill="none"/>`;
}

export function figureSvgInner(fig: Figure): string {
  return (fig.grid ? gridSvg(fig) : "") + fig.shapes.map((s) => shapeSvg(s, fig.height)).join("");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Text labels are HTML positioned over the SVG (percentages of the figure's
// box, so they track its scaling), because they hold KaTeX output that SVG
// can't host reliably — and as real text they extract cleanly from the PDF.
// `renderLabel` turns the label's math shorthand into HTML; it's injected
// so this module doesn't depend on the markdown renderer (which depends on it).
export function figureLabelsHtml(fig: Figure, renderLabel: (text: string) => string): string {
  return fig.shapes
    .map((s) => {
      if (s.kind !== "text") return "";
      const left = (s.x / fig.width) * 100;
      const top = ((fig.height - s.y) / fig.height) * 100;
      const color = s.color === "black" ? "" : `;color:${COLOR_HEX[s.color]}`;
      return `<span class="figure-label" style="left:${n(left)}%;top:${n(top)}%${color}">${renderLabel(s.text)}</span>`;
    })
    .join("");
}

// The figure itself (no edit button): a box with the SVG and its labels.
// `fill` stretches it to its container (the editor); otherwise it is capped at
// its natural size (UNIT px per grid cell) and shrinks below that. The box is
// a size container ("cqw" units) so label text scales with the drawing.
export function renderFigureCanvas(
  fig: Figure,
  renderLabel: (text: string) => string,
  options: { fill?: boolean } = {}
): string {
  const w = fig.width * UNIT;
  const h = fig.height * UNIT;
  const sizing = options.fill ? "width:100%" : `max-width:${w}px`;
  return (
    `<div class="figure-canvas" style="${sizing};aspect-ratio:${fig.width}/${fig.height};--fig-w:${w}">` +
    `<svg class="figure-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="figure">${figureSvgInner(fig)}</svg>` +
    figureLabelsHtml(fig, renderLabel) +
    `</div>`
  );
}

// The block as it appears in the preview/PDF: the canvas plus an edit button
// (hidden when printing). `data-fig-line` tells the UI which note block to edit.
export function renderFigureHtml(fig: Figure, startLine: number, renderLabel: (text: string) => string): string {
  const empty = fig.shapes.length === 0;
  return (
    `<div class="figure-block${empty ? " figure-empty" : ""}" data-src-line="${startLine}">` +
    renderFigureCanvas(fig, renderLabel) +
    `<button type="button" class="figure-edit-btn" data-fig-line="${startLine}" aria-label="${escapeAttr("図を編集")}">${empty ? "図を描く" : "図を編集"}</button>` +
    `</div>`
  );
}
