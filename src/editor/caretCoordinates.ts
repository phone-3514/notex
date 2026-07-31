// Measures where a given text offset sits inside a <textarea>, so the
// autocomplete menu can be positioned right under the caret. Standard
// "mirror div" technique — no editor library involved.

const MIRRORED_PROPERTIES = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

export interface CaretPosition {
  top: number;
  left: number;
  height: number;
}

export function getCaretCoordinates(el: HTMLTextAreaElement, position: number): CaretPosition {
  const div = document.createElement("div");
  const computed = window.getComputedStyle(el);

  const style = div.style;
  style.position = "absolute";
  style.visibility = "hidden";
  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";
  style.overflowWrap = "break-word";
  for (const prop of MIRRORED_PROPERTIES) {
    style[prop] = computed[prop];
  }

  document.body.appendChild(div);
  div.textContent = el.value.slice(0, position);
  const span = document.createElement("span");
  span.textContent = el.value.slice(position) || ".";
  div.appendChild(span);

  const top = span.offsetTop - el.scrollTop;
  const left = span.offsetLeft - el.scrollLeft;
  const height = span.offsetHeight || parseInt(computed.lineHeight || "16", 10);

  document.body.removeChild(div);
  return { top, left, height };
}
