// Shared guard so IME composition (Japanese, Chinese, Korean input) never
// gets interrupted by autocomplete, snippet expansion, or shortcuts. Kept as
// a tiny pure predicate so the rule is unit-testable without mounting the
// actual textarea.

export function isComposingInput(composing: boolean, nativeEvent: { isComposing?: boolean }): boolean {
  return composing || nativeEvent.isComposing === true;
}
