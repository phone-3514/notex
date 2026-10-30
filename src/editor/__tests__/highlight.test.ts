import { describe, expect, it } from "vitest";
import { highlightNote, highlightToHtml, type Span } from "../highlight";

const text = (spans: Span[]) => spans.map((s) => s.text).join("");
const clsOf = (spans: Span[], piece: string) => spans.find((s) => s.text === piece)?.cls;

const SAMPLE = [
  "# 講義タイトル <第五回>",
  "",
  "日付：10/26 と **太字** と ==重要== と @x^2+1@ と $a_n$",
  "- 項目 @sum n=1~oo 1/n@",
  "1. 番号付き",
  ":::theorem 2.5",
  "@forall x in RR, x>=0@",
  ":::",
  ":::math",
  "# 見出し",
  "pibot の値 O(n log n) text(ただし) x<y",
  "= align",
  "f(x)",
  "= x^2+2x+1",
  "end",
  ":::",
  ":::fig 8x5",
  "grid",
  'text 3,3 "y=x^2" red',
  "arrow 1,1 3,1.5 blue dashed",
  ":::",
  "= int 0~1 x^2 dx",
  ";thm と ;box",
  "",
].join("\n");

describe("highlightNote", () => {
  it("never loses or reorders a character (the colour layer must align with the textarea)", () => {
    expect(text(highlightNote(SAMPLE))).toBe(SAMPLE);
    for (const src of ["", "\n", "x", "@", "@@", "$", "text(", "**", "==", ":::", ":::fig", "= ", "= align", "\n\n\n", "日本語", "(< oo)"]) {
      expect(text(highlightNote(src)), JSON.stringify(src)).toBe(src);
    }
  });

  it("never throws on arbitrary junk", () => {
    expect(() => highlightNote("@@@ $$ ::: ==== **** text( \\ \\\\ <<>> ))((")).not.toThrow();
  });

  it("colours headings, inline math delimiters and the formula inside", () => {
    const spans = highlightNote("# タイトル @x^2@");
    expect(clsOf(spans, "# ")).toBe("hl-heading-mark");
    expect(spans.some((s) => s.cls === "hl-heading" && s.text.includes("タイトル"))).toBe(true);
    expect(spans.filter((s) => s.cls === "hl-delim")).toHaveLength(2);
    expect(clsOf(spans, "x")).toBe("hl-math");
    expect(clsOf(spans, "^")).toBe("hl-sub");
    expect(clsOf(spans, "2")).toBe("hl-num");
  });

  it("separates ordinary text (base colour) from formulas", () => {
    const spans = highlightNote("普通の文章 @a=b@");
    expect(spans[0]).toEqual({ text: "普通の文章 ", cls: undefined });
    expect(clsOf(spans, "=")).toBe("hl-op");
  });

  it("classifies keywords, functions and symbols in formulas", () => {
    const spans = highlightNote("= sum n=1~oo sin x + alpha in RR");
    expect(clsOf(spans, "sum")).toBe("hl-kw");
    expect(clsOf(spans, "sin")).toBe("hl-fn");
    expect(clsOf(spans, "oo")).toBe("hl-sym");
    expect(clsOf(spans, "alpha")).toBe("hl-sym");
    expect(clsOf(spans, "in")).toBe("hl-sym");
    expect(clsOf(spans, "RR")).toBe("hl-sym");
    expect(clsOf(spans, "= ")).toBe("hl-delim");
  });

  it("splits a function name off a following variable, like the tokenizer", () => {
    const spans = highlightNote("= sinx");
    expect(clsOf(spans, "sin")).toBe("hl-fn");
    expect(clsOf(spans, "x")).toBe("hl-math");
  });

  it("marks text(...) and \\X escapes as strings, and prose inside formulas as base text", () => {
    const spans = highlightNote("= text(ただし) \\N 計算量 x");
    expect(clsOf(spans, "text(ただし)")).toBe("hl-str");
    expect(clsOf(spans, "\\N")).toBe("hl-str");
    expect(spans.find((s) => s.text.includes("計算量"))?.cls).toBeUndefined();
  });

  it("colours bold, highlight, list markers and snippet triggers", () => {
    const spans = highlightNote("- 項目 **強** ==要== ;thm");
    expect(clsOf(spans, "- ")).toBe("hl-list");
    expect(clsOf(spans, "強")).toBe("hl-bold");
    expect(clsOf(spans, "要")).toBe("hl-mark");
    expect(clsOf(spans, ";thm")).toBe("hl-snippet");
  });

  it("colours block fences, types and titles; the body stays ordinary note text", () => {
    const spans = highlightNote(":::theorem 2.5\nbody @x@\n:::");
    expect(clsOf(spans, ":::")).toBe("hl-fence");
    expect(clsOf(spans, "theorem")).toBe("hl-fence-type");
    expect(spans.some((s) => s.cls === "hl-fence-title" && s.text.includes("2.5"))).toBe(true);
  });

  it("reads plain lines inside :::math as formulas, but headings and '@' lines as note text", () => {
    const spans = highlightNote(":::math\n# 見出し\nx+1\n@y@ と文章\n:::\nx+1");
    expect(spans.some((s) => s.cls === "hl-heading-mark")).toBe(true);
    // Inside the region "x" is a formula (hl-math); after ":::" it's ordinary text.
    const xs = spans.filter((s) => s.text === "x");
    expect(xs[0].cls).toBe("hl-math");
    expect(spans.at(-1)).toEqual({ text: "\nx+1", cls: undefined });
  });

  it("treats rows of '= align' / '= cases' blocks as formulas until 'end'", () => {
    const spans = highlightNote("= align\nf(x)\n= x^2\nend\nplain x");
    expect(clsOf(spans, "align")).toBe("hl-kw");
    expect(clsOf(spans, "end")).toBe("hl-kw");
    expect(spans.at(-1)).toEqual({ text: "\nplain x", cls: undefined });
  });

  it("highlights ':::fig' shape lines", () => {
    const spans = highlightNote(':::fig 8x5\narrow 1,1 3,1.5 red dashed\ntext 3,3 "y=x^2" blue\n:::');
    expect(clsOf(spans, "arrow")).toBe("hl-kw");
    expect(clsOf(spans, "1.5")).toBe("hl-num");
    expect(clsOf(spans, "red")).toBe("hl-red");
    expect(clsOf(spans, "dashed")).toBe("hl-kw");
    expect(clsOf(spans, '"y=x^2"')).toBe("hl-str");
    expect(clsOf(spans, "blue")).toBe("hl-blue");
    // Inside the figure, "x^2" isn't parsed as math.
    expect(spans.some((s) => s.cls === "hl-sub")).toBe(false);
  });
});

describe("highlightToHtml", () => {
  it("escapes HTML in the source and wraps classified spans", () => {
    const html = highlightToHtml("a <b> & @x@");
    expect(html).toContain("&lt;b&gt; &amp; ");
    expect(html).toContain('<span class="hl-delim">@</span>');
    expect(html).not.toContain("<b>");
  });
});
