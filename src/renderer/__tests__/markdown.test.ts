import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "@/renderer/markdown";

describe("renderMarkdownToHtml", () => {
  it("renders headings", () => {
    expect(renderMarkdownToHtml("# Title")).toMatch(/<h1[^>]*>Title<\/h1>/);
    expect(renderMarkdownToHtml("### Sub")).toMatch(/<h3[^>]*>Sub<\/h3>/);
  });

  it("renders unordered and ordered lists", () => {
    expect(renderMarkdownToHtml("- a\n- b")).toBe(
      '<ul><li data-src-line="0">a</li><li data-src-line="1">b</li></ul>'
    );
    expect(renderMarkdownToHtml("1. a\n2. b")).toBe(
      '<ol><li data-src-line="0">a</li><li data-src-line="1">b</li></ol>'
    );
  });

  it("renders bold text", () => {
    expect(renderMarkdownToHtml("**hi**")).toBe('<p data-src-line="0"><strong>hi</strong></p>');
  });

  it("tags blocks with their source line for preview scroll-sync", () => {
    const html = renderMarkdownToHtml("# Title\n\nsecond paragraph\n\nthird paragraph");
    expect(html).toContain('data-src-line="0"'); // heading
    expect(html).toContain('data-src-line="2"'); // second paragraph
    expect(html).toContain('data-src-line="4"'); // third paragraph
  });

  it("preserves Japanese text", () => {
    expect(renderMarkdownToHtml("# 数値解析\n\n**極限**の定義")).toContain("数値解析");
  });

  it("escapes HTML in plain text", () => {
    expect(renderMarkdownToHtml("<script>alert(1)</script>")).not.toContain("<script>");
  });

  describe("display math: a line starting with exactly '= '", () => {
    it("renders '= expression' as display math", () => {
      const html = renderMarkdownToHtml("= sum n=1~oo 1/n");
      expect(html).toContain('class="math-display"');
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("renders the full quantifier/membership/absolute-value expression", () => {
      const html = renderMarkdownToHtml("= forall eps>0, exists n0 in NN, forall n>=n0, |an-A|<eps");
      expect(html).toContain('class="math-display"');
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("renders the st/implies chained form with a comma no longer needed for spacing", () => {
      const html = renderMarkdownToHtml(
        "= forall eps>0, exists n0 in NN st n>=n0 implies |an-A|<eps"
      );
      expect(html).toContain('class="math-display"');
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("never leaks the '= ' prefix into the preview", () => {
      const html = renderMarkdownToHtml("= sum n=1~oo 1/n");
      expect(html).not.toMatch(/>\s*=\s*sum/);
      expect(html).not.toContain("data-src-line=\"0\">= ");
    });

    it("requires the space — bare '=' or 'x=1' stays plain text", () => {
      const bareEquals = renderMarkdownToHtml("=oo");
      expect(bareEquals).not.toContain("math-display");
      expect(bareEquals).toContain("=oo");

      const assignment = renderMarkdownToHtml("x=1");
      expect(assignment).not.toContain("math-display");
      expect(assignment).not.toContain("math-error");
      expect(assignment).toContain("x=1");
    });

    it("renders multiple '= ' equations, each its own block", () => {
      const html = renderMarkdownToHtml("= sum n=1~oo 1/n\n\n= int 0~1 x^2 dx");
      expect(html.match(/class="math-display"/g)).toHaveLength(2);
    });

    it("mixes ordinary prose paragraphs with '= ' equations", () => {
      const html = renderMarkdownToHtml(
        "Here is a classic result:\n\n= sum n=1~oo 1/n\n\nThat converges nicely."
      );
      expect(html).toContain("<p");
      expect(html).toContain("Here is a classic result");
      expect(html).toContain("That converges nicely");
      expect(html.match(/class="math-display"/g)).toHaveLength(1);
    });

    it("does not crash on malformed '= ' math and shows a clear error", () => {
      expect(() => renderMarkdownToHtml("= lim x 0")).not.toThrow();
      expect(renderMarkdownToHtml("= lim x 0")).toContain("math-error");
    });

    it("tags the display block with its source line", () => {
      const html = renderMarkdownToHtml("prose\n\n= sum n=1~oo 1/n");
      expect(html).toContain('data-src-line="2"');
    });
  });

  describe("inline math: @expression@", () => {
    it("renders a single inline expression", () => {
      const html = renderMarkdownToHtml("任意の @eps>0@ に対して");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("任意の");
      expect(html).toContain("に対して");
    });

    it("the paragraph containing inline math still carries data-src-line for scroll-sync", () => {
      const html = renderMarkdownToHtml("prose\n\n任意の @eps>0@ に対して");
      expect(html).toMatch(/<p data-src-line="2">[^<]*任意の/);
    });

    it("renders an absolute-value comparison inline", () => {
      const html = renderMarkdownToHtml("@|an-A|<eps@");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("supports multiple inline expressions in the same paragraph", () => {
      const html = renderMarkdownToHtml("任意の @eps>0@ に対して、@|an-A|<eps@ が成り立つ。");
      expect(html.match(/class="katex"/g)?.length).toBeGreaterThanOrEqual(2);
      expect(html).not.toContain("math-error");
      expect(html).toContain("任意の");
      expect(html).toContain("に対して");
      expect(html).toContain("が成り立つ");
    });

    it("leaves Japanese text surrounding inline math completely untouched", () => {
      const html = renderMarkdownToHtml("数列の収束：@eps>0@ が与えられたとする。");
      expect(html).toContain("数列の収束");
      expect(html).toContain("が与えられたとする");
    });

    it("matches the spec's worked example: several inline spans in one prose line", () => {
      const html = renderMarkdownToHtml("z=@f(x,y)@の偏導関数は @f_x(x,y)@ と @f_y(x,y)@");
      expect(html.match(/class="katex"/g)?.length).toBe(3);
      expect(html).not.toContain("math-error");
      expect(html).toContain("の偏導関数は");
    });

    it("shows a clear, non-crashing error for malformed content inside a math span", () => {
      expect(() => renderMarkdownToHtml("bad @1/@ math")).not.toThrow();
      expect(renderMarkdownToHtml("bad @1/@ math")).toContain("math-error");
    });

    it("does not crash on an unterminated span (no closing @) and leaves it as text", () => {
      expect(() => renderMarkdownToHtml("open @eps>0 with no close")).not.toThrow();
      const html = renderMarkdownToHtml("open @eps>0 with no close");
      expect(html).not.toContain("katex");
      expect(html).toContain("with no close");
    });

    it("an inline span cannot cross a newline — an unmatched @ before a newline stays plain text", () => {
      const html = renderMarkdownToHtml("open @eps>0\nnext line has no opener either");
      expect(html).not.toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("next line has no opener either");
    });

    it('"@@" is an escaped literal "@", not a delimiter', () => {
      const html = renderMarkdownToHtml("me@@example.com is not math");
      expect(html).not.toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("me@example.com is not math");
    });

    it("an unmatched single @ remains plain text", () => {
      const html = renderMarkdownToHtml("just an @ sign");
      expect(html).not.toContain("katex");
      expect(html).toContain("just an @ sign");
    });
  });

  describe("legacy ':...:' and '\\...\\' delimiters are no longer math signals", () => {
    it("renders old ':...:' notes as plain text, not math, without crashing", () => {
      expect(() => renderMarkdownToHtml("任意の :eps>0: に対して")).not.toThrow();
      const html = renderMarkdownToHtml("任意の :eps>0: に対して");
      expect(html).not.toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain(":eps&gt;0:");
    });

    it("does not crash on an unmatched colon", () => {
      expect(() => renderMarkdownToHtml("Note: this has just one colon")).not.toThrow();
      const html = renderMarkdownToHtml("Note: this has just one colon");
      expect(html).not.toContain("katex");
      expect(html).toContain("Note: this has just one colon");
    });

    it("renders old '\\...\\' notes as plain text, not math, without crashing", () => {
      expect(() => renderMarkdownToHtml("任意の \\ eps>0\\ に対して")).not.toThrow();
      const html = renderMarkdownToHtml("任意の \\ eps>0\\ に対して");
      expect(html).not.toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("\\ eps&gt;0\\");
    });

    it("does not crash on a bare backslash", () => {
      expect(() => renderMarkdownToHtml("a stray \\ backslash")).not.toThrow();
      const html = renderMarkdownToHtml("a stray \\ backslash");
      expect(html).not.toContain("katex");
      expect(html).toContain("a stray \\ backslash");
    });
  });

  describe("prose stays plain text (no automatic math detection)", () => {
    it("does not promote bare structural-command lines anymore", () => {
      for (const line of ["sum n=1~oo 1/n", "sqrt(x+y)"]) {
        const html = renderMarkdownToHtml(line);
        expect(html, line).not.toContain("math-display");
        expect(html, line).toContain(line);
      }
      // ">" is HTML-escaped in plain text, so check content rather than the raw string.
      const html = renderMarkdownToHtml("forall eps>0 exists delta>0");
      expect(html).not.toContain("math-display");
      expect(html).toContain("forall eps");
      expect(html).toContain("exists delta");
    });

    it("keeps ordinary English/Japanese sentences mentioning math words as text", () => {
      const jp = renderMarkdownToHtml("任意の eps>0 に対して…");
      expect(jp).not.toContain("math-display");
      expect(jp).toContain("任意の eps");
      expect(jp).toContain("に対して…");

      expect(renderMarkdownToHtml('ここで forall は "for all" を意味する。')).toContain("for all");
      expect(renderMarkdownToHtml("A in NN と仮定する。")).toContain("A in NN と仮定する。");
    });

    it("keeps Japanese prose as text", () => {
      const html = renderMarkdownToHtml("数値解析における極限の定義");
      expect(html).not.toContain("math-display");
      expect(html).toContain("数値解析における極限の定義");
    });
  });

  describe("legacy $ / $$ (backward compatibility)", () => {
    it("still renders legacy inline $...$", () => {
      const html = renderMarkdownToHtml("Euler: $e^ipi+1=0$");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("still renders legacy display $$...$$", () => {
      const html = renderMarkdownToHtml("$$sum n=1~oo 1/n$$");
      expect(html).toContain('class="math-display"');
      expect(html).toContain("katex");
    });

    it("shows a clear, non-crashing error for malformed legacy inline math", () => {
      expect(() => renderMarkdownToHtml("bad: $1/$ math")).not.toThrow();
      expect(renderMarkdownToHtml("bad: $1/$ math")).toContain("math-error");
    });

    it("supports $...$ and @...@ mixed in the same document", () => {
      const html = renderMarkdownToHtml("Legacy $x^2$ and current @x^2@ both work.");
      expect(html.match(/class="katex"/g)?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("new logic/arrow tokens (therefore, because, st/s.t., iff, implies, gets, mapsto, notin)", () => {
    it("render inside '= ' display math", () => {
      for (const line of [
        "= therefore P",
        "= because P",
        "= exists x in RR st x>0",
        "= P iff T",
        "= f: A mapsto B",
      ]) {
        const html = renderMarkdownToHtml(line);
        expect(html, line).toContain('class="math-display"');
        expect(html, line).toContain("katex");
        expect(html, line).not.toContain("math-error");
      }
    });

    it("render inside @...@ inline math", () => {
      const html = renderMarkdownToHtml("結論として @therefore P@ が導かれる。");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("結論として");
      expect(html).toContain("が導かれる");
    });

    it("stay as plain, unstyled prose outside any math boundary", () => {
      for (const line of [
        "therefore P",
        "because P",
        "P implies T",
        "x notin S",
      ]) {
        const html = renderMarkdownToHtml(line);
        expect(html, line).not.toContain("math-display");
        expect(html, line).not.toContain("katex");
      }
    });
  });

  describe("theorem-style note blocks (:::type ... :::)", () => {
    it("renders a titled, bordered block for each type", () => {
      const labels: Record<string, string> = {
        theorem: "定理",
        definition: "定義",
        lemma: "補題",
        proposition: "命題",
        corollary: "系",
        proof: "証明",
        remark: "注意",
        example: "例",
      };
      for (const [type, label] of Object.entries(labels)) {
        const html = renderMarkdownToHtml(`:::${type}\n本文\n:::`);
        expect(html, type).toContain(`class="note-block note-block-${type}"`);
        expect(html, type).toContain(`<div class="note-block-title">${label}</div>`);
        expect(html, type).toContain("本文");
      }
    });

    it("shows the optional suffix in the title, e.g. '定理 2.5'", () => {
      const html = renderMarkdownToHtml(":::theorem 2.5\n本文\n:::");
      expect(html).toContain('<div class="note-block-title">定理 2.5</div>');
    });

    it("the ':::' prefix and type keyword never leak into the preview", () => {
      const html = renderMarkdownToHtml(":::theorem 2.5\n本文\n:::");
      expect(html).not.toContain(":::");
      expect(html).not.toContain(">theorem<");
    });

    it("allows '@...@' inline math inside the block", () => {
      const html = renderMarkdownToHtml(":::theorem\n任意の @eps>0@ に対して成り立つ。\n:::");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("任意の");
      expect(html).toContain("に対して成り立つ");
    });

    it("allows '= ' display math inside the block", () => {
      const html = renderMarkdownToHtml(":::theorem\n= sum n=1~oo 1/n\n:::");
      expect(html).toContain('class="math-display"');
      expect(html).toContain("katex");
    });

    it("tags the block and its inner content with data-src-line for scroll-sync", () => {
      const html = renderMarkdownToHtml("prose\n\n:::theorem 2.5\n本文\n:::");
      expect(html).toContain('data-src-line="2"'); // the ":::theorem 2.5" line
      expect(html).toContain('data-src-line="3"'); // the "本文" paragraph inside
    });

    it("supports multiple blocks in one document, each independent", () => {
      const html = renderMarkdownToHtml(":::theorem\nA\n:::\n\n:::proof\nB\n:::");
      expect(html.match(/note-block-title/g)).toHaveLength(2);
      expect(html).toContain("note-block-theorem");
      expect(html).toContain("note-block-proof");
    });

    it("does not crash on an unterminated block (missing closing ':::')", () => {
      expect(() => renderMarkdownToHtml(":::theorem\n本文なし終端")).not.toThrow();
      const html = renderMarkdownToHtml(":::theorem\n本文なし終端");
      expect(html).toContain("note-block-theorem");
      expect(html).toContain("本文なし終端");
    });

    it("does not treat an unknown block type as a theorem block", () => {
      const html = renderMarkdownToHtml(":::randomtype\ntext\n:::");
      expect(html).not.toContain("note-block");
    });

    it("still recognizes ordinary Markdown (headings, lists, bold) inside the block", () => {
      const html = renderMarkdownToHtml(":::theorem\n## 小見出し\n- a\n- b\n**強調**\n:::");
      expect(html).toMatch(/<h2[^>]*>小見出し<\/h2>/);
      expect(html).toContain("<li");
      expect(html).toContain("<strong>強調</strong>");
    });
  });

  describe("piecewise/cases blocks: '= <lhs>=cases ... end'", () => {
    it("renders two branches as one display-math node", () => {
      const html = renderMarkdownToHtml("= f(x)=cases\nx^2, x>=0\n-x, x<0\nend");
      expect(html.match(/class="math-display"/g)).toHaveLength(1);
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("\\begin{cases}");
      expect(html).toContain("\\end{cases}");
    });

    it("renders three branches", () => {
      const html = renderMarkdownToHtml(
        "= f(x)=cases\nx^2, x>0\n0, x=0\n-x^2, x<0\nend"
      );
      expect(html.match(/class="math-display"/g)).toHaveLength(1);
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("renders 'otherwise' as \\text{otherwise}", () => {
      const html = renderMarkdownToHtml("= f(x)=cases\nx^2, x>=0\n0, otherwise\nend");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("\\text{otherwise}");
    });

    it("splits each branch on the FINAL comma, so a nested comma-bearing expression still works", () => {
      const html = renderMarkdownToHtml("= f(x)=cases\nf(x,y), x>=0\n0, otherwise\nend");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("f(x,y)");
    });

    it("shows a clear, non-crashing error for a malformed branch (missing comma)", () => {
      expect(() => renderMarkdownToHtml("= f(x)=cases\nx^2 x>=0\n-x, x<0\nend")).not.toThrow();
      const html = renderMarkdownToHtml("= f(x)=cases\nx^2 x>=0\n-x, x<0\nend");
      expect(html).toContain("math-error");
      expect(html).toContain("Malformed cases branch");
    });

    it("shows a clear, non-crashing error for a missing 'end'", () => {
      expect(() => renderMarkdownToHtml("= f(x)=cases\nx^2, x>=0\n-x, x<0")).not.toThrow();
      const html = renderMarkdownToHtml("= f(x)=cases\nx^2, x>=0\n-x, x<0");
      expect(html).toContain("math-error");
      expect(html).toContain("Missing");
    });

    it("requires at least two branches", () => {
      const html = renderMarkdownToHtml("= f(x)=cases\nx^2, x>=0\nend");
      expect(html).toContain("math-error");
    });

    it("tags the whole block with a single data-src-line, at its opening line", () => {
      const html = renderMarkdownToHtml("prose\n\n= f(x)=cases\nx^2, x>=0\n-x, x<0\nend");
      expect(html).toContain('data-src-line="2"');
      expect(html.match(/data-src-line/g)).toHaveLength(2); // the prose paragraph + the cases block
    });

    it("does not affect an ordinary single-line '= ' equation", () => {
      const html = renderMarkdownToHtml("= sum n=1~oo 1/n");
      expect(html).toContain('class="math-display"');
      expect(html).not.toContain("math-error");
    });
  });

  describe("align blocks: '= align ... end'", () => {
    it("renders the spec's worked example as one display-math node", () => {
      const html = renderMarkdownToHtml("= align\nf(x)\n= x^2+2x+1\n= (x+1)^2\nend");
      expect(html.match(/class="math-display"/g)).toHaveLength(1);
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("\\begin{aligned}");
      expect(html).toContain("\\end{aligned}");
    });

    it("supports an ordinary full equation as a row, split at its own '='", () => {
      const html = renderMarkdownToHtml("= align\nf(x)=x+1\nend");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("does not mistake '<=' / '>=' for the alignment '='", () => {
      const html = renderMarkdownToHtml("= align\nf(x)\n= x<=1\nend");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("shows a clear, non-crashing error for a missing 'end'", () => {
      expect(() => renderMarkdownToHtml("= align\nf(x)\n= x+1")).not.toThrow();
      const html = renderMarkdownToHtml("= align\nf(x)\n= x+1");
      expect(html).toContain("math-error");
      expect(html).toContain("Missing");
    });

    it("shows a clear, non-crashing error for a malformed non-first row", () => {
      expect(() => renderMarkdownToHtml("= align\nf(x)\nx+1\nend")).not.toThrow();
      const html = renderMarkdownToHtml("= align\nf(x)\nx+1\nend");
      expect(html).toContain("math-error");
      expect(html).toContain("Malformed align row");
    });

    it("shows a clear, non-crashing error for an empty block", () => {
      const html = renderMarkdownToHtml("= align\nend");
      expect(html).toContain("math-error");
    });

    it("tags the whole block with a single data-src-line, at its opening line", () => {
      const html = renderMarkdownToHtml("prose\n\n= align\nf(x)\n= x+1\nend");
      expect(html).toContain('data-src-line="2"');
      expect(html.match(/data-src-line/g)).toHaveLength(2);
    });
  });

  describe("matrix blocks: '= matrix/pmatrix/bmatrix/vmatrix ... end'", () => {
    it("renders 'matrix' as pmatrix", () => {
      const html = renderMarkdownToHtml("= matrix\n1, 2\n3, 4\nend");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("\\begin{pmatrix}1 &amp; 2\\\\3 &amp; 4\\end{pmatrix}");
    });

    it("renders 'pmatrix' the same as 'matrix'", () => {
      const html = renderMarkdownToHtml("= pmatrix\n1, 2\n3, 4\nend");
      expect(html).toContain("\\begin{pmatrix}1 &amp; 2\\\\3 &amp; 4\\end{pmatrix}");
    });

    it("renders 'bmatrix' with square brackets", () => {
      const html = renderMarkdownToHtml("= bmatrix\n1, 2\n3, 4\nend");
      expect(html).toContain("\\begin{bmatrix}1 &amp; 2\\\\3 &amp; 4\\end{bmatrix}");
    });

    it("renders 'vmatrix' with bars", () => {
      const html = renderMarkdownToHtml("= vmatrix\na, b\nc, d\nend");
      expect(html).toContain("\\begin{vmatrix}a &amp; b\\\\c &amp; d\\end{vmatrix}");
    });

    it("each cell is parsed by the full shorthand DSL", () => {
      const html = renderMarkdownToHtml("= matrix\nx^2, eps\nend");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("shows a clear, non-crashing error for an inconsistent row length", () => {
      expect(() => renderMarkdownToHtml("= matrix\n1, 2\n3\nend")).not.toThrow();
      const html = renderMarkdownToHtml("= matrix\n1, 2\n3\nend");
      expect(html).toContain("math-error");
      expect(html).toContain("Inconsistent matrix row");
    });

    it("shows a clear, non-crashing error for a missing 'end'", () => {
      const html = renderMarkdownToHtml("= matrix\n1, 2\n3, 4");
      expect(html).toContain("math-error");
      expect(html).toContain("Missing");
    });

    it("does not affect an ordinary single-line '= ' equation", () => {
      const html = renderMarkdownToHtml("= sqrt(x+y)");
      expect(html).toContain('class="math-display"');
      expect(html).not.toContain("math-error");
    });

    it("tags the whole block with a single data-src-line, at its opening line", () => {
      const html = renderMarkdownToHtml("prose\n\n= A=matrix\n0, 4\n1, 10\nend");
      expect(html).toContain('data-src-line="2"');
      expect(html.match(/data-src-line/g)).toHaveLength(2);
    });

    it("splits cells on TOP-LEVEL commas only — a cell with its own comma stays one cell", () => {
      // Regression: a naive row.split(",") would cut "f(x,y)" into three
      // bogus cells ("f(x", "y)", " 0"); this must render as a clean 2x2.
      const html = renderMarkdownToHtml("= M=matrix\nf(x,y), 0\n0, g(x,y)\nend");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("\\begin{pmatrix}f(x,y) &amp; 0\\\\0 &amp; g(x,y)\\end{pmatrix}");
    });

    it("supports a prefix expression before the matrix keyword, rendered as 'prefix='", () => {
      const html = renderMarkdownToHtml("= A=matrix\n0, 4, 10\n1, 10, 34\nend");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
      expect(html).toContain("A=\\begin{pmatrix}0 &amp; 4 &amp; 10\\\\1 &amp; 10 &amp; 34\\end{pmatrix}");
    });

    it("supports a prefix on bmatrix and vmatrix too", () => {
      const bHtml = renderMarkdownToHtml("= B=bmatrix\n1, 2\n3, 4\nend");
      expect(bHtml).toContain("B=\\begin{bmatrix}1 &amp; 2\\\\3 &amp; 4\\end{bmatrix}");
      expect(bHtml).not.toContain("math-error");

      const vHtml = renderMarkdownToHtml("= det(A)=vmatrix\na, b\nc, d\nend");
      expect(vHtml).toContain("det(A)=\\begin{vmatrix}a &amp; b\\\\c &amp; d\\end{vmatrix}");
      expect(vHtml).not.toContain("math-error");
    });

    it("'= matrix' with no prefix keeps working (backward compatibility)", () => {
      const html = renderMarkdownToHtml("= matrix\n1, 2\n3, 4\nend");
      expect(html).not.toContain("math-error");
      expect(html).not.toMatch(/=\\begin\{pmatrix\}/);
    });

    it("shows a clear, non-crashing error for an empty cell", () => {
      expect(() => renderMarkdownToHtml("= matrix\n1, 2\n3, \nend")).not.toThrow();
      const html = renderMarkdownToHtml("= matrix\n1, 2\n3, \nend");
      expect(html).toContain("math-error");
    });

    describe("omission symbols ('...', vdots, ddots)", () => {
      it("renders the general n x n matrix example without crashing or erroring", () => {
        const source =
          "= A=matrix\na11, a12, ..., a1n\na21, a22, ..., a2n\nvdots, vdots, ddots, vdots\nan1, an2, ..., ann\nend";
        expect(() => renderMarkdownToHtml(source)).not.toThrow();
        const html = renderMarkdownToHtml(source);
        expect(html).toContain("katex");
        expect(html).not.toContain("math-error");
      });

      it("a bare '...' cell renders as \\cdots (not \\ldots) inside a matrix", () => {
        const html = renderMarkdownToHtml("= matrix\n1, ...\n...,  1\nend");
        expect(html).toContain("\\cdots");
        expect(html).not.toContain("\\ldots");
        expect(html).not.toContain("math-error");
      });

      it("'vdots' and 'ddots' cells render as \\vdots / \\ddots", () => {
        const html = renderMarkdownToHtml("= matrix\nvdots, ddots\nend");
        expect(html).toContain("\\vdots");
        expect(html).toContain("\\ddots");
        expect(html).not.toContain("math-error");
      });

      it("ordinary '...' outside a matrix still means \\ldots, unchanged", () => {
        const html = renderMarkdownToHtml("@F(x1,...,xn)@");
        expect(html).toContain("\\ldots");
        expect(html).not.toContain("\\cdots");
        expect(html).not.toContain("math-error");
      });
    });
  });

  describe("derivative prime notation", () => {
    it("renders f'(x) inside display math", () => {
      const html = renderMarkdownToHtml("= f'(x)=2x");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("renders f''(x) inside inline math", () => {
      const html = renderMarkdownToHtml("The second derivative @f''(x)@ is positive.");
      expect(html).toContain("katex");
      expect(html).not.toContain("math-error");
    });

    it("does not treat prose apostrophes as derivatives — plain text, no math, no error", () => {
      const html = renderMarkdownToHtml("Don't confuse f'(x) with the function's value; it's not the same.");
      expect(html).not.toContain("math-error");
      expect(html).toContain("Don&#39;t confuse");
      expect(html).toContain("function&#39;s value");
    });
  });
});
