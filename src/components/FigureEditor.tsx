"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { renderInlineMath } from "@/renderer/markdown";
import { renderFigureCanvas, shapeSvg, UNIT } from "@/figure/renderFigure";
import { constrainAngle, constrainSquare, hitTest, moveShape, snap, textHalfWidth } from "@/figure/geometry";
import {
  MAX_FIGURE_SIZE,
  MIN_FIGURE_SIZE,
  type Figure,
  type FigureColor,
  type FigureShape,
  type FigureStyle,
} from "@/figure/types";

type Tool = "select" | "line" | "arrow" | "rect" | "circle" | "point" | "axes" | "text";

const TOOLS: { tool: Tool; label: string; hint: string }[] = [
  { tool: "select", label: "選択", hint: "クリックで選択、ドラッグで移動、Delete で削除" },
  { tool: "line", label: "直線", hint: "ドラッグで描く（Shift で 45° 刻み）" },
  { tool: "arrow", label: "矢印", hint: "ドラッグで描く（Shift で 45° 刻み）" },
  { tool: "axes", label: "座標軸", hint: "範囲をドラッグ（原点は中央。Shift で左下を原点に）" },
  { tool: "rect", label: "四角", hint: "ドラッグで描く（Shift で正方形）" },
  { tool: "circle", label: "円", hint: "中心から半径までドラッグ" },
  { tool: "point", label: "点", hint: "クリックで置く" },
  { tool: "text", label: "文字", hint: "クリックして入力。数式記法が使えます（x_0, alpha, y=x^2 など）" },
];

const COLORS: { color: FigureColor; label: string; css: string }[] = [
  { color: "black", label: "黒", css: "#171717" },
  { color: "red", label: "赤", css: "#b91c1c" },
  { color: "blue", label: "青", css: "#1d4ed8" },
];

const SNAPS: { step: number; label: string }[] = [
  { step: 0.5, label: "0.5" },
  { step: 1, label: "1" },
  { step: 0, label: "なし" },
];

const MIN_DRAG = 0.25; // grid units; smaller drags are treated as accidental clicks
const HIT_TOLERANCE = 0.35;
const EDITOR_SCALE = 1.5; // rendered px per natural figure px, when there is room

interface Drag {
  tool: Tool;
  startX: number; // snapped (draw tools) or raw (select tool)
  startY: number;
  index?: number; // select tool: the shape being moved
  base?: FigureShape[]; // select tool: shapes before the move began
}

function buildShape(
  tool: Tool,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: FigureStyle,
  shift: boolean,
  step: number
): FigureShape | null {
  switch (tool) {
    case "line":
    case "arrow": {
      const end = shift ? constrainAngle(x1, y1, x2, y2) : { x: x2, y: y2 };
      const ex = snap(end.x, step);
      const ey = snap(end.y, step);
      if (Math.hypot(ex - x1, ey - y1) < MIN_DRAG) return null;
      return { kind: tool, x1, y1, x2: ex, y2: ey, ...style };
    }
    case "rect": {
      const end = shift ? constrainSquare(x1, y1, x2, y2) : { x: x2, y: y2 };
      if (Math.abs(end.x - x1) < MIN_DRAG || Math.abs(end.y - y1) < MIN_DRAG) return null;
      return { kind: "rect", x1, y1, x2: end.x, y2: end.y, ...style };
    }
    case "circle": {
      const r = snap(Math.hypot(x2 - x1, y2 - y1), step);
      if (r < MIN_DRAG) return null;
      return { kind: "circle", cx: x1, cy: y1, r, ...style };
    }
    case "axes": {
      const xa = Math.min(x1, x2);
      const xb = Math.max(x1, x2);
      const ya = Math.min(y1, y2);
      const yb = Math.max(y1, y2);
      if (xb - xa < MIN_DRAG || yb - ya < MIN_DRAG) return null;
      if (shift) {
        return { kind: "axes", ox: xa, oy: ya, left: 0, right: xb - xa, down: 0, up: yb - ya, ...style };
      }
      const hw = (xb - xa) / 2;
      const hh = (yb - ya) / 2;
      return { kind: "axes", ox: xa + hw, oy: ya + hh, left: hw, right: hw, down: hh, up: hh, ...style };
    }
    default:
      return null;
  }
}

interface FigureEditorProps {
  initial: Figure;
  onSave: (figure: Figure) => void;
  onCancel: () => void;
}

export default function FigureEditor({ initial, onSave, onCancel }: FigureEditorProps) {
  const [width, setWidth] = useState(initial.width);
  const [height, setHeight] = useState(initial.height);
  const [grid, setGrid] = useState(initial.grid);
  const [shapes, setShapes] = useState<FigureShape[]>(initial.shapes);
  const [past, setPast] = useState<FigureShape[][]>([]);
  const [future, setFuture] = useState<FigureShape[][]>([]);
  const [tool, setTool] = useState<Tool>("line");
  const [color, setColor] = useState<FigureColor>("black");
  const [dashed, setDashed] = useState(false);
  const [step, setStep] = useState(0.5);
  const [selected, setSelected] = useState(-1);
  const [draft, setDraft] = useState<FigureShape | null>(null);
  const [pendingText, setPendingText] = useState<{ x: number; y: number; value: string } | null>(null);

  const overlayRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const style = useMemo<FigureStyle>(() => ({ color, dashed }), [color, dashed]);

  // Pushes the pre-edit shapes onto the undo stack and applies the edit.
  const commit = useCallback(
    (next: FigureShape[]) => {
      setPast((p) => [...p, shapes]);
      setFuture([]);
      setShapes(next);
    },
    [shapes]
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    setFuture((f) => [...f, shapes]);
    setShapes(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setSelected(-1);
  }, [past, shapes]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    setPast((p) => [...p, shapes]);
    setShapes(future[future.length - 1]);
    setFuture(future.slice(0, -1));
    setSelected(-1);
  }, [future, shapes]);

  const figure: Figure = useMemo(() => ({ width, height, grid, shapes }), [width, height, grid, shapes]);

  // Saving while a label is still being typed keeps that label.
  const save = useCallback(() => {
    const label = pendingText && pendingText.value.trim() !== "" ? pendingText : null;
    const finalShapes: FigureShape[] = label
      ? [...shapes, { kind: "text", x: label.x, y: label.y, text: label.value.trim(), color, dashed }]
      : shapes;
    onSave({ width, height, grid, shapes: finalShapes });
  }, [onSave, width, height, grid, shapes, pendingText, color, dashed]);

  const deleteSelected = useCallback(() => {
    if (selected < 0 || selected >= shapes.length) return;
    commit(shapes.filter((_, i) => i !== selected));
    setSelected(-1);
  }, [commit, selected, shapes]);

  // Window-level shortcuts (the modal is the only thing on screen).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        e.preventDefault();
        if (pendingText) setPendingText(null);
        else onCancel();
        return;
      }
      if (mod && e.key === "Enter") {
        e.preventDefault();
        save();
        return;
      }
      if (typing) return;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, onCancel, pendingText, redo, save, undo]);

  // Client pixel -> figure coordinates (grid units, y up).
  const toFigure = (e: { clientX: number; clientY: number }) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: height - ((e.clientY - rect.top) / rect.height) * height,
    };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const raw = toFigure(e);
    const sx = snap(raw.x, step);
    const sy = snap(raw.y, step);

    if (tool === "select") {
      const index = hitTest(shapes, raw.x, raw.y, HIT_TOLERANCE);
      setSelected(index);
      if (index >= 0) {
        dragRef.current = { tool, startX: raw.x, startY: raw.y, index, base: shapes };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (tool === "point") {
      commit([...shapes, { kind: "point", x: sx, y: sy, ...style }]);
      return;
    }
    if (tool === "text") {
      // The label input is created on pointer-up, not here: the browser moves
      // focus to the (non-focusable) canvas as part of this same mouse press,
      // which would immediately blur — and so dismiss — an input autofocused now.
      dragRef.current = { tool, startX: sx, startY: sy };
      return;
    }
    dragRef.current = { tool, startX: sx, startY: sy };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.tool === "text") return;
    const raw = toFigure(e);
    if (drag.tool === "select") {
      if (drag.index === undefined || !drag.base) return;
      const dx = snap(raw.x - drag.startX, step);
      const dy = snap(raw.y - drag.startY, step);
      setShapes(drag.base.map((s, i) => (i === drag.index ? moveShape(s, dx, dy) : s)));
      return;
    }
    setDraft(
      buildShape(drag.tool, drag.startX, drag.startY, snap(raw.x, step), snap(raw.y, step), style, e.shiftKey, step)
    );
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.tool === "text") {
      setPendingText({ x: drag.startX, y: drag.startY, value: "" });
      return;
    }
    if (drag.tool === "select") {
      // The move already updated `shapes` live; record the pre-move state for undo.
      if (drag.base && JSON.stringify(drag.base) !== JSON.stringify(shapes)) {
        setPast((p) => [...p, drag.base!]);
        setFuture([]);
      }
      return;
    }
    const raw = toFigure(e);
    const finished = buildShape(
      drag.tool,
      drag.startX,
      drag.startY,
      snap(raw.x, step),
      snap(raw.y, step),
      style,
      e.shiftKey,
      step
    );
    setDraft(null);
    if (finished) commit([...shapes, finished]);
  };

  const commitText = () => {
    if (pendingText && pendingText.value.trim() !== "") {
      commit([...shapes, { kind: "text", x: pendingText.x, y: pendingText.y, text: pendingText.value.trim(), ...style }]);
    }
    setPendingText(null);
  };

  // Changing colour/dash while a shape is selected restyles that shape too.
  const restyleSelected = (patch: Partial<FigureStyle>) => {
    if (selected < 0 || selected >= shapes.length) return;
    commit(shapes.map((s, i) => (i === selected ? { ...s, ...patch } : s)));
  };

  const committedHtml = useMemo(
    () => renderFigureCanvas(figure, renderInlineMath, { fill: true }),
    [figure]
  );

  const gridDots = useMemo(() => {
    const dots: { x: number; y: number }[] = [];
    for (let x = 0; x <= width; x++) for (let y = 0; y <= height; y++) dots.push({ x, y });
    return dots;
  }, [width, height]);

  const selectedShape = selected >= 0 ? shapes[selected] : undefined;
  const hint = TOOLS.find((t) => t.tool === tool)?.hint ?? "";
  const clampSize = (v: number) => Math.min(MAX_FIGURE_SIZE, Math.max(MIN_FIGURE_SIZE, Math.round(v) || MIN_FIGURE_SIZE));

  const btn = (active: boolean) =>
    `px-2.5 py-1 text-xs border ${
      active
        ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
        : "border-neutral-300 bg-transparent text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="presentation">
      <div
        role="dialog"
        aria-label="図の編集"
        className="flex max-h-full w-full max-w-[1000px] flex-col gap-2 overflow-auto border border-neutral-300 bg-white p-3 text-neutral-900 shadow-lg dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-1" role="toolbar" aria-label="ツール">
            {TOOLS.map((t) => (
              <button
                key={t.tool}
                type="button"
                aria-pressed={tool === t.tool}
                className={btn(tool === t.tool)}
                onClick={() => setTool(t.tool)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="色">
            {COLORS.map((c) => (
              <button
                key={c.color}
                type="button"
                title={c.label}
                aria-label={c.label}
                aria-pressed={color === c.color}
                onClick={() => {
                  setColor(c.color);
                  restyleSelected({ color: c.color });
                }}
                className={`fig-swatch-${c.color} h-6 w-6 border-2 ${color === c.color ? "border-neutral-900 dark:border-neutral-100" : "border-transparent"}`}
                style={{ background: c.css }}
              />
            ))}
            <label className="ml-2 flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={dashed}
                onChange={(e) => {
                  setDashed(e.target.checked);
                  restyleSelected({ dashed: e.target.checked });
                }}
              />
              破線
            </label>
          </div>
          <div className="flex items-center gap-1 text-xs" role="group" aria-label="吸着">
            <span>吸着</span>
            {SNAPS.map((s) => (
              <button
                key={s.label}
                type="button"
                aria-pressed={step === s.step}
                className={btn(step === s.step)}
                onClick={() => setStep(s.step)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <button type="button" className={btn(false)} onClick={undo} disabled={past.length === 0}>
            元に戻す
          </button>
          <button type="button" className={btn(false)} onClick={redo} disabled={future.length === 0}>
            やり直す
          </button>
          <button type="button" className={btn(false)} onClick={deleteSelected} disabled={!selectedShape}>
            選択を削除
          </button>
          <button
            type="button"
            className={btn(false)}
            onClick={() => {
              if (shapes.length === 0) return;
              commit([]);
              setSelected(-1);
            }}
            disabled={shapes.length === 0}
          >
            全消去
          </button>
          <label className="flex items-center gap-1">
            幅
            <input
              type="number"
              min={MIN_FIGURE_SIZE}
              max={MAX_FIGURE_SIZE}
              value={width}
              onChange={(e) => setWidth(clampSize(+e.target.value))}
              className="w-14 border border-neutral-300 bg-transparent px-1 dark:border-neutral-700"
            />
          </label>
          <label className="flex items-center gap-1">
            高さ
            <input
              type="number"
              min={MIN_FIGURE_SIZE}
              max={MAX_FIGURE_SIZE}
              value={height}
              onChange={(e) => setHeight(clampSize(+e.target.value))}
              className="w-14 border border-neutral-300 bg-transparent px-1 dark:border-neutral-700"
            />
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />
            図にグリッドを表示
          </label>
        </div>

        <div className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</div>

        <div className="flex justify-center overflow-auto bg-neutral-100 p-2 dark:bg-neutral-900">
          <div
            className="relative bg-white dark:bg-[#0f1217]"
            style={{ width: `min(100%, ${width * UNIT * EDITOR_SCALE}px)`, aspectRatio: `${width} / ${height}` }}
          >
            <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: committedHtml }} />
            <svg
              ref={overlayRef}
              className="absolute inset-0 h-full w-full touch-none"
              style={{ cursor: tool === "select" ? "default" : "crosshair" }}
              viewBox={`0 0 ${width * UNIT} ${height * UNIT}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                dragRef.current = null;
                setDraft(null);
              }}
            >
              <rect x={0} y={0} width={width * UNIT} height={height * UNIT} fill="transparent" stroke="#d4d4d4" />
              {gridDots.map((d) => (
                <circle key={`${d.x},${d.y}`} cx={d.x * UNIT} cy={(height - d.y) * UNIT} r={1.4} fill="#a3a3a3" />
              ))}
              {draft && <g opacity={0.6} dangerouslySetInnerHTML={{ __html: shapeSvg(draft, height) }} />}
              {selectedShape && selectedShape.kind !== "text" && (
                <g opacity={0.3} dangerouslySetInnerHTML={{ __html: selectionHalo(selectedShape, height) }} />
              )}
              {selectedShape && selectedShape.kind === "text" && (
                <rect
                  x={(selectedShape.x - textHalfWidth(selectedShape.text)) * UNIT}
                  y={(height - selectedShape.y - 0.3) * UNIT}
                  width={textHalfWidth(selectedShape.text) * 2 * UNIT}
                  height={0.6 * UNIT}
                  fill="none"
                  stroke="#2563eb"
                  strokeDasharray="4 3"
                />
              )}
            </svg>
            {pendingText && (
              <input
                autoFocus
                value={pendingText.value}
                placeholder="例: x_0, alpha, y=x^2"
                onChange={(e) => setPendingText({ ...pendingText, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    commitText();
                  }
                }}
                onBlur={commitText}
                className="absolute z-10 w-40 -translate-x-1/2 -translate-y-1/2 border border-blue-500 bg-white px-1 py-0.5 text-sm text-neutral-900 dark:border-blue-400 dark:bg-neutral-950 dark:text-neutral-100"
                style={{
                  left: `${(pendingText.x / width) * 100}%`,
                  top: `${((height - pendingText.y) / height) * 100}%`,
                }}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 text-xs">
          <span className="mr-auto text-neutral-500 dark:text-neutral-400">⌘Z 元に戻す ・ ⌘Enter 保存 ・ Esc キャンセル</span>
          <button type="button" className={btn(false)} onClick={onCancel}>
            キャンセル
          </button>
          <button
            type="button"
            onClick={save}
            className="border border-blue-600 bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 dark:border-green-500 dark:bg-green-500 dark:text-neutral-950 dark:hover:bg-green-400"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// A wide translucent blue copy of the shape, drawn behind/over it to show selection.
function selectionHalo(s: FigureShape, height: number): string {
  return shapeSvg({ ...s, color: "blue", dashed: false } as FigureShape, height).replace(
    /stroke-width="[\d.]+"/g,
    'stroke-width="9"'
  );
}
