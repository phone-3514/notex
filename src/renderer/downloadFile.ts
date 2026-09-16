// Triggers a browser download of in-memory text content — the standard
// Blob + object-URL + synthetic-click pattern (no server round-trip needed).
export function downloadTextFile(filename: string, content: string, mimeType = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// A note's title is free-form (spaces, punctuation, "/" etc. from an
// unrelated math shorthand context are all valid title text), so it isn't
// automatically a safe filename — strip characters that are illegal or
// awkward across common filesystems, matching Untitled Note's own fallback.
export function sanitizeFilename(title: string, fallback = "note"): string {
  const cleaned = title.trim().replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ");
  return cleaned || fallback;
}
