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
