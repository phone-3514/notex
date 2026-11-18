// Pure text transforms for editor keyboard shortcuts. Kept free of DOM/React
// so they're trivially testable; the caller (Editor.tsx) is responsible for
// reading the textarea's current state and committing the result back.

export interface TextState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function wrapBold(state: TextState): TextState {
  const { value, selectionStart, selectionEnd } = state;
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);
  const newValue = `${before}**${selected}**${after}`;

  if (selected.length === 0) {
    // No selection: drop the cursor between the markers, ready to type.
    const caret = selectionStart + 2;
    return { value: newValue, selectionStart: caret, selectionEnd: caret };
  }
  // Selection existed: keep the same text selected, just shifted by "**".
  return {
    value: newValue,
    selectionStart: selectionStart + 2,
    selectionEnd: selectionEnd + 2,
  };
}

function startOfLine(value: string, pos: number): number {
  return value.lastIndexOf("\n", pos - 1) + 1;
}

export function insertHeading(level: 1 | 2 | 3) {
  const marker = "#".repeat(level) + " ";
  return (state: TextState): TextState => {
    const { value, selectionStart, selectionEnd } = state;
    const lineStart = startOfLine(value, selectionStart);
    const newValue = value.slice(0, lineStart) + marker + value.slice(lineStart);
    return {
      value: newValue,
      selectionStart: selectionStart + marker.length,
      selectionEnd: selectionEnd + marker.length,
    };
  };
}

// ---- Tab / Shift+Tab indentation -------------------------------------------
//
// Like a code editor (or Word): Tab indents instead of moving focus out of the
// textarea. With a selection it indents every line the selection touches; with
// just a caret it inserts one indent unit at the caret. Shift+Tab removes one
// unit from the start of each touched line (or the caret's line).

export const INDENT_UNIT = "    ";

// A transform's result: the new text state, plus the single contiguous range of
// the *original* value that was replaced (`from`..`to` -> `text`), so the
// caller can apply it as one undoable edit instead of replacing the document.
export interface IndentEdit extends TextState {
  from: number;
  to: number;
  text: string;
}

// The lines a selection touches, as [from, to) in `value`: from the start of
// the first line to the end of the last. A selection that ends exactly at the
// start of a line doesn't include that line (the usual editor convention).
function touchedLines(value: string, start: number, end: number): { from: number; to: number } {
  const from = startOfLine(value, start);
  const last = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const nl = value.indexOf("\n", last);
  return { from, to: nl === -1 ? value.length : nl };
}

export function indentSelection(state: TextState, unit = INDENT_UNIT): IndentEdit {
  const { value, selectionStart: start, selectionEnd: end } = state;
  if (start === end) {
    return {
      value: value.slice(0, start) + unit + value.slice(end),
      selectionStart: start + unit.length,
      selectionEnd: start + unit.length,
      from: start,
      to: start,
      text: unit,
    };
  }
  const { from, to } = touchedLines(value, start, end);
  const lines = value.slice(from, to).split("\n");
  let indented = 0;
  const text = lines
    .map((line) => {
      if (line === "") return line; // leave blank lines blank
      indented++;
      return unit + line;
    })
    .join("\n");
  const firstShift = lines[0] === "" ? 0 : unit.length;
  return {
    value: value.slice(0, from) + text + value.slice(to),
    selectionStart: start + firstShift,
    selectionEnd: end + indented * unit.length,
    from,
    to,
    text,
  };
}

// How much leading whitespace outdenting removes from `line`: one tab, or up to
// one indent unit of spaces.
function outdentAmount(line: string, unit: string): number {
  if (line.startsWith("\t")) return 1;
  let n = 0;
  while (n < unit.length && line[n] === " ") n++;
  return n;
}

export function outdentSelection(state: TextState, unit = INDENT_UNIT): IndentEdit {
  const { value, selectionStart: start, selectionEnd: end } = state;
  const { from, to } = touchedLines(value, start, end);
  const lines = value.slice(from, to).split("\n");
  const removed = lines.map((line) => outdentAmount(line, unit));
  const text = lines.map((line, i) => line.slice(removed[i])).join("\n");

  // Where an original position lands once the leading whitespace is gone:
  // shifted left by everything removed on earlier lines, plus however much of
  // its own line's removed run lies before it (never past the line start).
  const lineStarts: number[] = [];
  let offset = from;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  const mapPos = (pos: number): number => {
    if (pos < from) return pos;
    if (pos > to) return pos - removed.reduce((a, b) => a + b, 0);
    let shift = 0;
    for (let i = 0; i < lines.length; i++) {
      const isLast = i === lines.length - 1 || pos < lineStarts[i + 1];
      if (isLast) {
        shift += Math.min(removed[i], pos - lineStarts[i]);
        break;
      }
      shift += removed[i];
    }
    return pos - shift;
  };

  return {
    value: value.slice(0, from) + text + value.slice(to),
    selectionStart: mapPos(start),
    selectionEnd: mapPos(end),
    from,
    to,
    text,
  };
}
