import { describe, expect, it } from "vitest";
import { noteToMarkdown } from "@/renderer/exportMarkdown";

describe("noteToMarkdown", () => {
  it("passes headings through unchanged", () => {
    expect(noteToMarkdown("# Title")).toBe("# Title\n");
    expect(noteToMarkdown("### Sub")).toBe("### Sub\n");
  });

  it("converts inline math ('@...@') to standard '$...$' LaTeX", () => {
    expect(noteToMarkdown("Suppose @eps>0@.")).toBe("Suppose $\\varepsilon\\ >\\ 0$.\n");
  });

  it("converts legacy inline math ('$...$') to standard '$...$' LaTeX", () => {
    expect(noteToMarkdown("Suppose $eps>0$.")).toBe("Suppose $\\varepsilon\\ >\\ 0$.\n");
  });

  it("converts '= expression' display math to '$$...$$'", () => {
    expect(noteToMarkdown("= sum n=1~oo 1/n")).toBe("$$\\sum_{n=1}^{\\infty}\\frac{1}{n}$$\n");
  });

  it("converts legacy '$$...$$' display math to standard '$$...$$' LaTeX", () => {
    expect(noteToMarkdown("$$sqrt(x+y)$$")).toBe("$$\\sqrt{x+y}$$\n");
  });

  it("passes bold text and lists through unchanged (already standard Markdown)", () => {
    expect(noteToMarkdown("**hi**")).toBe("**hi**\n");
    expect(noteToMarkdown("- a\n- b")).toBe("- a\n- b\n");
    expect(noteToMarkdown("1. a\n2. b")).toBe("1. a\n2. b\n");
  });

  it("preserves the original list marker and numbering", () => {
    expect(noteToMarkdown("* a\n* b")).toBe("* a\n* b\n");
    expect(noteToMarkdown("5. a\n6. b")).toBe("5. a\n6. b\n");
  });

  it("converts a cases block to a single '$$...\\begin{cases}...$$' block", () => {
    const md = noteToMarkdown("= f(x)=cases\nx^2, x>=0\n-x, x<0\nend");
    expect(md).toBe("$$f(x)=\\begin{cases}x^{2} & x\\ \\geq\\ 0\\\\-x & x\\ <\\ 0\\end{cases}$$\n");
  });

  it("converts an align block to '$$\\begin{aligned}...$$'", () => {
    const md = noteToMarkdown("= align\nf(x)=x+1\n= x-1\nend");
    expect(md).toBe("$$\\begin{aligned}f(x) &= x+1\\\\&= x-1\\end{aligned}$$\n");
  });

  it("converts a matrix block to '$$\\begin{pmatrix}...$$'", () => {
    const md = noteToMarkdown("= matrix\na, b\nc, d\nend");
    expect(md).toBe("$$\\begin{pmatrix}a & b\\\\c & d\\end{pmatrix}$$\n");
  });

  it("converts a theorem-style note block to a bold label paragraph plus body", () => {
    const md = noteToMarkdown(":::theorem 2.5\nSome @a<b@ statement.\n:::");
    expect(md).toBe("**定理 2.5.**\n\nSome $a\\ <\\ b$ statement.\n");
  });

  it("converts a ':::box <title>' custom block to its own bold title verbatim", () => {
    const md = noteToMarkdown(":::box よく使う不等式\n本文\n:::");
    expect(md).toBe("**よく使う不等式.**\n\n本文\n");
  });

  it("leaves an untitled ':::box' block as literal text (nothing to name it)", () => {
    const md = noteToMarkdown(":::box\n本文\n:::");
    expect(md).toBe(":::box\n本文\n:::\n");
  });

  it("flags an invalid inline expression without crashing or emitting fake LaTeX", () => {
    const md = noteToMarkdown("Bad @)(@ here.");
    expect(md).toContain("math error");
    expect(md).not.toMatch(/\$\)\(\$/);
  });

  it("uses standard LaTeX only — no Notex-only macros leak into the output", () => {
    const md = noteToMarkdown("@\\N in NN@ and @bf(v)@ and @log_10(100)@");
    expect(md).toBe("$N\\ \\in\\ \\mathbb{N}$ and $\\boldsymbol{v}$ and $\\log_{10}(100)$\n");
  });

  it("renders a full sample note (heading, prose, inline and display math) in reading order", () => {
    const note = [
      "# Landau notation",
      "",
      "Suppose @f(n)@ is @O(g(n))@ for @n>=N@.",
      "",
      "= sum n=1~oo 1/n",
    ].join("\n");
    const md = noteToMarkdown(note);
    expect(md).toBe(
      [
        "# Landau notation",
        "",
        "Suppose $f(n)$ is $O(g(n))$ for $n\\ \\geq\\ \\mathbb{N}$.",
        "",
        "$$\\sum_{n=1}^{\\infty}\\frac{1}{n}$$",
        "",
      ].join("\n")
    );
  });
});
