// 0-indexed line number of a character offset within a text value. Shared by
// Editor (reports the cursor's line while typing) and anything that needs to
// map an editor position to a source line.
export function lineNumberAt(value: string, pos: number): number {
  let line = 0;
  for (let i = 0; i < pos && i < value.length; i++) {
    if (value.charCodeAt(i) === 10 /* \n */) line++;
  }
  return line;
}
