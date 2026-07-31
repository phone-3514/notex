# PDF export: manual verification checklist

Notex's "Export PDF" (⌘P) calls `window.print()` directly on the live DOM —
no screenshot, canvas, or rasterization step. Body text is real text, and
KaTeX renders math as real HTML/MathML (not an image), so the browser's
print-to-PDF path produces vector, selectable output by construction. This
checklist is for confirming that holds up in practice, since it depends on
the browser's PDF writer, not just Notex's own code.

Run through this after any change to `globals.css`'s `@media print` block,
`Preview.tsx`, or the KaTeX version pin.

## Setup

1. Open Notex, write a note with: a heading, a paragraph with inline math
   (`@f(x)=x^2@`), a display equation (`= sum n=1~oo 1/n`), and a matrix
   (`= matrix\n1, 2\n3, 4\nend`).
2. ⌘P → "Save as PDF" (macOS print dialog), not a screenshot tool.

## Checks

- [ ] **Selection**: drag-select across a paragraph in the PDF (Preview.app
      or Chrome's PDF viewer) — text highlights per-character, not as one
      opaque image block.
- [ ] **Search**: ⌘F in the PDF viewer for a word from the note's prose —
      it's found and highlighted.
- [ ] **Copy**: copy a sentence containing inline math and paste into a
      plain-text editor — the prose comes through as real characters (math
      glyph copy-paste fidelity is a KaTeX/browser limitation, see below).
- [ ] **Zoom**: zoom the PDF to 400% — text and math stay crisp (vector),
      no visible pixelation/blur.
- [ ] **File size**: sanity-check the PDF isn't suspiciously large for its
      page count (a rasterized page is typically hundreds of KB–MB per
      page; vector text is usually tens of KB).
- [ ] **AI/PDF ingestion**: run the PDF through a text-extraction tool (e.g.
      `pdftotext`, or paste into an LLM that reads PDFs) — prose extracts
      cleanly. Math extraction may be imperfect (see below) but must not be
      empty/garbled into unrelated characters.
- [ ] **Fonts**: no missing-glyph boxes (□) anywhere, including Greek
      letters and blackboard-bold symbols.
- [ ] **Paper size**: exported page matches the selected size (A3/A2) and
      orientation from the toolbar.

## Known limitation (not a bug to "fix" here)

KaTeX lays out math using many nested, sometimes visually-reordered spans
(e.g. a fraction's numerator/denominator, or a subscript) for correct visual
positioning. Selecting/copying **inside a complex expression** can yield
text in a different order than it displays, or partial glyphs — this is a
KaTeX/browser rendering limitation shared by every KaTeX-based site, not
something Notex's print pipeline introduces. Plain prose and simple math
(single symbols, short inline expressions) select and search reliably.
