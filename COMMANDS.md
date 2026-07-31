# Notex Command Reference

Generated from the live parser dictionaries, autocomplete snippets, note snippets, and keyboard shortcuts. Reflects current behavior — see `src/commands/registry.ts`.

## Math boundaries

Notex never guesses that a line of text is "probably math" — only these explicit boundaries invoke the parser:

- `= expression` — a line starting with exactly `=` followed by a space is **display math**. The `= ` prefix itself never appears in the preview. `=` with no following space (e.g. `x=1`) is left as plain text.
- `@expression@` — a pair of single `@` signs is **inline math**, usable any number of times within a paragraph. This is the current syntax; use it in new notes.
- `$$expression$$` — **legacy** display math, kept only for backward compatibility.
- `$expression$` — **deprecated** legacy inline math, kept only for backward compatibility. Prefer `@expression@`.

Everything between the boundary markers is parsed by the same shorthand DSL described below, regardless of which boundary was used.

Precedence, low to high: comma-sequences → quantifiers (`forall`/`exists`, each owning only its own constraint) → relations/membership (`=` `<` `>` `<=` `>=` `!=` `in`) → addition/subtraction → multiplication/division → powers/subscripts → atoms (numbers, identifiers, function calls, parentheses (comma-separated for multi-arg calls and tuples, e.g. `f(x,y)`, `(x,y)`), `|...|`, `sqrt`, `sum`/`prod`/`int`, `lim`).

## Piecewise / cases blocks

A multiline block for piecewise-defined functions, e.g.:

```
= f(x)=cases
x^2, x>=0
-x, x<0
end
```

renders as `f(x)=\begin{cases}x^2 & x\geq 0\\-x & x<0\end{cases}`. Rules:

- `= <lhs>=cases` opens the block; a line that is exactly `end` closes it. The whole block is one display-math node with a single `data-src-line`, anchored at the opening line.
- Each line in between is one branch: `expression, condition`, split on the **final** comma on the line — so an expression that itself contains a comma (e.g. `f(x,y), x>=0`) still splits correctly.
- `otherwise` as a condition renders as `\text{otherwise}`.
- At least two branches are required.
- A missing `end`, a branch with no comma, or a branch with an empty expression/condition all show a clear `math-error` rather than crashing.

## Align blocks

A multiline block for chained/aligned equations, e.g.:

```
= align
f(x)
= x^2+2x+1
= (x+1)^2
end
```

renders as `\begin{aligned}f(x)\\&= x^2+2x+1\\&= (x+1)^2\end{aligned}`. Rules:

- `= align` opens the block; `end` closes it.
- The first non-empty row is the left-hand starting expression.
- A later row starting with `=` aligns at the equals sign (`&=`).
- A row that's an ordinary full equation (e.g. `f(x)=x+1`) is also split and aligned at its `=` — this works on any row, including the first.
- A missing `end`, an empty block, or a non-first row that's neither a `=`-prefixed continuation nor a full equation all show a clear `math-error`.

## Matrix blocks

```
= matrix
1, 2
3, 4
end
```

renders as `\begin{pmatrix}1 & 2\\3 & 4\end{pmatrix}`. `matrix`/`pmatrix` both mean `pmatrix`; `bmatrix` and `vmatrix` select those bracket styles instead, same row/column syntax. Newlines separate rows; each cell is parsed by the same shorthand DSL.

An optional prefix expression before the keyword, separated by `=`, is rendered ahead of the matrix — `= A=matrix` (or `B=bmatrix`, `det(A)=vmatrix`, ...) renders as `A=\begin{pmatrix}...\end{pmatrix}`; a bare `= matrix` (no prefix) keeps working unchanged.

Commas separate columns, but only at the **top level** of the cell — a cell that itself contains a comma via a grouping construct the DSL already recognizes (e.g. `f(x,y)`) still counts as one cell, not several. This reuses the parser's own comma-list handling (the same one `f(x,y)`/`vec(a,b)` go through), not a raw string split. Rows with an inconsistent cell count, or an empty cell, show a clear `math-error` rather than crashing.

Inside a matrix cell only, a bare `...` renders as `\cdots` (the horizontal-omission convention for matrix rows) instead of the `\ldots` it means everywhere else, e.g. `F(x1,...,xn)`. `vdots`/`ddots` render as `\vdots`/`\ddots` the same as elsewhere. A general n×n matrix:

```
= A=matrix
a11, a12, ..., a1n
a21, a22, ..., a2n
vdots, vdots, ddots, vdots
an1, an2, ..., ann
end
```

## Vectors

`vec(a,b,c)` and `colvec(a,b,c)` are inline shorthand for row/column vectors — usable anywhere in the expression grammar, not just inside `= `. `vec(a,b,c)` renders as `\begin{pmatrix}a & b & c\end{pmatrix}`; `colvec(a,b,c)` stacks the same items with `\\` instead. `vec` with a single argument (`vec(a)`) keeps its original meaning — the arrow shorthand `\vec{a}` — unchanged.

## Comma spacing

Commas are spaced by context, never uniformly:

- Function-call arguments, tuples, and vector/matrix cells (`f(x,y)`, `(eps,n0)`, `vec(a,b)`) stay tight — plain `,` with no extra gap.
- Top-level comma-separated clauses (e.g. chained quantifiers) get a moderate `,\;` gap, not the wide `,\quad` a paragraph break would use.

## Inline math delimiter rules

- A lone `@` opens inline math; the next unescaped `@` closes it.
- `@@` (two `@` signs) is an escaped literal `@` — it never opens or closes math, and renders as a single `@` character in prose.
- An inline span cannot cross a newline — the closing `@` must be on the same line as the opening one.
- Colons and backslashes are never a math signal; they're always plain text, everywhere.
- An unterminated span (no closing `@` before the end of the line) leaves the opening `@` as literal text rather than consuming the rest of the line.

Intentionally unsupported / ambiguous forms:

- Compact subscripts (`an` -> a_n, `xn` -> x_n) only apply *inside* recognized math — i.e. inside one of the boundaries above. They are never rewritten in ordinary prose.
- Unspaced keyword+identifier splitting (`forallA` -> `forall A`) is supported only for `forall`/`exists`, and only when the remainder starts uppercase. It is deliberately NOT extended to `sum`/`prod`/`int`/`lim`/`sqrt` — `int` in particular is a common prefix of unrelated words ("integral", "interval", "into"), so splitting it the same way would silently corrupt those.
- `= ` is only recognized at the start of a paragraph line, not inside a list item or heading — use `@...@` there instead.
- Colons are not a math signal. Notes written with the old `:expression:` syntax render as plain text (not as math, not as an error).
- Backslashes are not a math signal either. Notes written with the older `\...\` syntax also render as plain text, the same way — a stray backslash is now ordinary punctuation, so old spans (including the backslashes) simply display as plain text rather than rendering as math.
- Norm syntax (double bars) is not implemented.

## Sums

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `sum` | \sum_{n=1}^{\infty}\frac{1}{n} | `\sum_{n=1}^{\infty}\frac{1}{n}` | `sum n=1~oo 1/n` |

## Products

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `prod` | \prod_{n=1}^{\infty}n | `\prod_{n=1}^{\infty}n` | `prod n=1~oo n` |

## Integrals

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `int (definite)` | \int_{0}^{1}x^{2}\,dx | `\int_{0}^{1}x^{2}\,dx` | `int 0~1 x^2 dx` |
| `int (indefinite)` | \int f(x)\,dx | `\int f(x)\,dx` | `int f(x) dx` |

## Limits

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `lim` | \lim_{x\to0}\frac{\sin x}{x} | `\lim_{x\to0}\frac{\sin x}{x}` | `lim x->0 sinx/x` |

## Roots

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `sqrt` | \sqrt{x+y} | `\sqrt{x+y}` | `sqrt(x+y)` |

## Powers & Subscripts

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `^ (power)` | x^{2} | `x^{2}` | `x^2` |
| `_ (subscript)` | x_{1} | `x_{1}` | `x_1` |
| `Xy (auto subscript)` | M_{n}(\mathbb{R}) | `M_{n}(\mathbb{R})` | `Mn(R)` |

## Quantifiers

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `forall` | \forall\ \varepsilon\ >\ 0 | `\forall\ \varepsilon\ >\ 0` | `forall eps>0` |
| `exists` | \exists\ \delta\ >\ 0 | `\exists\ \delta\ >\ 0` | `exists delta>0` |
| `exists(x) (parenthesized variable)` | \exists\ n_{0} | `\exists\ n_{0}` | `exists(n0)` |
| `exists ... in ... (membership constraint)` | \exists\ n_{0}\ \in\ \mathbb{N} | `\exists\ n_{0}\ \in\ \mathbb{N}` | `exists n0 in NN` |

## Sequences

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `, (comma-separated sequence)` | \forall\ \varepsilon\ >\ 0,\;\exists\ \delta\ >\ 0 | `\forall\ \varepsilon\ >\ 0,\;\exists\ \delta\ >\ 0` | `forall eps>0, exists delta>0` |

## Absolute Value

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `\| ... \| (absolute value)` | \lvert a_{n}-A\rvert | `\lvert a_{n}-A\rvert` | `\|an-A\|` |

## Compact Subscripts

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `n0 / an / eps0 (compact index shorthand)` | n_{0} | `n_{0}` | `n0` |

## Sets

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `Mn(R)` | M_{n}(\mathbb{R}) | `M_{n}(\mathbb{R})` | `Mn(R)` |
| `in` | \in | `\in` | `in` |
| `notin` | \notin | `\notin` | `notin` |
| `subset` | \subset | `\subset` | `subset` |
| `subseteq` | \subseteq | `\subseteq` | `subseteq` |
| `supset` | \supset | `\supset` | `supset` |
| `supseteq` | \supseteq | `\supseteq` | `supseteq` |
| `cup` | \cup | `\cup` | `cup` |
| `cap` | \cap | `\cap` | `cap` |
| `setminus` | \setminus | `\setminus` | `setminus` |
| `emptyset` | \emptyset | `\emptyset` | `emptyset` |

## Vectors

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `vec(x) (arrow vector)` | \vec{a} | `\vec{a}` | `vec(a)` |
| `vec(x,y,...) (row vector)` | \begin{pmatrix}a & b & c\end{pmatrix} | `\begin{pmatrix}a & b & c\end{pmatrix}` | `vec(a,b,c)` |
| `colvec(x,y,...) (column vector)` | \begin{pmatrix}a\\b\\c\end{pmatrix} | `\begin{pmatrix}a\\b\\c\end{pmatrix}` | `colvec(a,b,c)` |

## Relations

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `=` | x\ =\ y | `x\ =\ y` | `x=y` |
| `<` | x\ <\ y | `x\ <\ y` | `x<y` |
| `>` | x\ >\ y | `x\ >\ y` | `x>y` |
| `<=` | x\ \leq\ 1 | `x\ \leq\ 1` | `x<=1` |
| `>=` | x\ \geq\ 1 | `x\ \geq\ 1` | `x>=1` |
| `!=` | x\ \neq\ 1 | `x\ \neq\ 1` | `x!=1` |
| `approx` | \approx | `\approx` | `approx` |
| `equiv` | \equiv | `\equiv` | `equiv` |
| `sim` | \sim | `\sim` | `sim` |
| `cong` | \cong | `\cong` | `cong` |
| `perp` | \perp | `\perp` | `perp` |
| `parallel` | \parallel | `\parallel` | `parallel` |
| `angle` | \angle | `\angle` | `angle` |
| `triangle` | \triangle | `\triangle` | `triangle` |

## Greek Letters

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `alpha` | \alpha | `\alpha` | `alpha` |
| `beta` | \beta | `\beta` | `beta` |
| `gamma` | \gamma | `\gamma` | `gamma` |
| `delta` | \delta | `\delta` | `delta` |
| `epsilon` | \epsilon | `\epsilon` | `epsilon` |
| `eps` | \varepsilon | `\varepsilon` | `eps` |
| `varepsilon` | \varepsilon | `\varepsilon` | `varepsilon` |
| `zeta` | \zeta | `\zeta` | `zeta` |
| `eta` | \eta | `\eta` | `eta` |
| `theta` | \theta | `\theta` | `theta` |
| `iota` | \iota | `\iota` | `iota` |
| `kappa` | \kappa | `\kappa` | `kappa` |
| `lambda` | \lambda | `\lambda` | `lambda` |
| `mu` | \mu | `\mu` | `mu` |
| `nu` | \nu | `\nu` | `nu` |
| `xi` | \xi | `\xi` | `xi` |
| `pi` | \pi | `\pi` | `pi` |
| `rho` | \rho | `\rho` | `rho` |
| `sigma` | \sigma | `\sigma` | `sigma` |
| `tau` | \tau | `\tau` | `tau` |
| `upsilon` | \upsilon | `\upsilon` | `upsilon` |
| `phi` | \phi | `\phi` | `phi` |
| `varphi` | \varphi | `\varphi` | `varphi` |
| `chi` | \chi | `\chi` | `chi` |
| `psi` | \psi | `\psi` | `psi` |
| `omega` | \omega | `\omega` | `omega` |
| `Gamma` | \Gamma | `\Gamma` | `Gamma` |
| `Delta` | \Delta | `\Delta` | `Delta` |
| `Theta` | \Theta | `\Theta` | `Theta` |
| `Lambda` | \Lambda | `\Lambda` | `Lambda` |
| `Xi` | \Xi | `\Xi` | `Xi` |
| `Pi` | \Pi | `\Pi` | `Pi` |
| `Sigma` | \Sigma | `\Sigma` | `Sigma` |
| `Upsilon` | \Upsilon | `\Upsilon` | `Upsilon` |
| `Phi` | \Phi | `\Phi` | `Phi` |
| `Psi` | \Psi | `\Psi` | `Psi` |
| `Omega` | \Omega | `\Omega` | `Omega` |

## Blackboard Sets

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `R` | \mathbb{R} | `\mathbb{R}` | `R` |
| `N` | \mathbb{N} | `\mathbb{N}` | `N` |
| `Z` | \mathbb{Z} | `\mathbb{Z}` | `Z` |
| `Q` | \mathbb{Q} | `\mathbb{Q}` | `Q` |
| `C` | \mathbb{C} | `\mathbb{C}` | `C` |
| `H` | \mathbb{H} | `\mathbb{H}` | `H` |
| `RR` | \mathbb{R} | `\mathbb{R}` | `RR` |
| `NN` | \mathbb{N} | `\mathbb{N}` | `NN` |
| `ZZ` | \mathbb{Z} | `\mathbb{Z}` | `ZZ` |
| `QQ` | \mathbb{Q} | `\mathbb{Q}` | `QQ` |
| `CC` | \mathbb{C} | `\mathbb{C}` | `CC` |

## Functions

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `arcsin` | \arcsin x | `\arcsin x` | `arcsinx` |
| `arccos` | \arccos x | `\arccos x` | `arccosx` |
| `arctan` | \arctan x | `\arctan x` | `arctanx` |
| `sinh` | \sinh x | `\sinh x` | `sinhx` |
| `cosh` | \cosh x | `\cosh x` | `coshx` |
| `tanh` | \tanh x | `\tanh x` | `tanhx` |
| `sin` | \sin x | `\sin x` | `sinx` |
| `cos` | \cos x | `\cos x` | `cosx` |
| `tan` | \tan x | `\tan x` | `tanx` |
| `cot` | \cot x | `\cot x` | `cotx` |
| `sec` | \sec x | `\sec x` | `secx` |
| `csc` | \csc x | `\csc x` | `cscx` |
| `ln` | \ln x | `\ln x` | `lnx` |
| `log` | \log x | `\log x` | `logx` |
| `exp` | \exp x | `\exp x` | `expx` |
| `det` | \det x | `\det x` | `detx` |
| `dim` | \dim x | `\dim x` | `dimx` |
| `ker` | \ker x | `\ker x` | `kerx` |
| `gcd` | \gcd x | `\gcd x` | `gcdx` |
| `min` | \min x | `\min x` | `minx` |
| `max` | \max x | `\max x` | `maxx` |
| `sup` | \sup x | `\sup x` | `supx` |
| `inf` | \inf x | `\inf x` | `infx` |

## Operators

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `cdot` | \cdot | `\cdot` | `cdot` |
| `times` | \times | `\times` | `times` |
| `pm` | \pm | `\pm` | `pm` |
| `mp` | \mp | `\mp` | `mp` |

## Arrows

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `to` | \to | `\to` | `to` |
| `mapsto` | \mapsto | `\mapsto` | `mapsto` |
| `gets` | \gets | `\gets` | `gets` |

## Special

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `infty` | \infty | `\infty` | `infty` |
| `oo` | \infty | `\infty` | `oo` |
| `partial` | \partial | `\partial` | `partial` |
| `nabla` | \nabla | `\nabla` | `nabla` |

## Logic

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `land` | \land | `\land` | `land` |
| `lor` | \lor | `\lor` | `lor` |
| `lnot` | \lnot | `\lnot` | `lnot` |
| `neg` | \neg | `\neg` | `neg` |
| `therefore` | \therefore | `\therefore` | `therefore` |
| `because` | \because | `\because` | `because` |
| `iff` | \iff | `\iff` | `iff` |
| `implies` | \implies | `\implies` | `implies` |
| `st` | \text{s.t.} | `\text{s.t.}` | `st` |
| `s.t.` | \text{s.t.} | `\text{s.t.}` | `s.t.` |

## Dots

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `dots` | \dots | `\dots` | `dots` |
| `cdots` | \cdots | `\cdots` | `cdots` |
| `vdots` | \vdots | `\vdots` | `vdots` |
| `ddots` | \ddots | `\ddots` | `ddots` |

## Symbols

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `...` | \ldots | `\ldots` | `...` |

## Autocomplete Snippet

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `su` | \sum_{n=1}^{\infty}\frac{1}{n} | `\sum_{n=1}^{\infty}\frac{1}{n}` | `sum n=1~oo 1/n` |
| `int` | \int_{a}^{b}f(x)\,dx | `\int_{a}^{b}f(x)\,dx` | `int a~b f(x) dx` |
| `lim` | \lim_{x\toa}f(x) | `\lim_{x\toa}f(x)` | `lim x->a f(x)` |
| `sq` | \sqrt{x+y} | `\sqrt{x+y}` | `sqrt(x+y)` |
| `frac` | \frac{(a+b)}{(c+d)} | `\frac{(a+b)}{(c+d)}` | `(a+b)/(c+d)` |
| `prod` | \prod_{n=1}^{\infty}n | `\prod_{n=1}^{\infty}n` | `prod n=1~oo n` |
| `eps` | \varepsilon\ >\ 0 | `\varepsilon\ >\ 0` | `eps>0` |
| `alpha` | \alpha | `\alpha` | `alpha` |
| `forall` | \forall\ \varepsilon\ >\ 0 | `\forall\ \varepsilon\ >\ 0` | `forall eps>0` |
| `exists` | \exists\ \delta\ >\ 0 | `\exists\ \delta\ >\ 0` | `exists delta>0` |
| `Mn` | M_{n}(\mathbb{R}) | `M_{n}(\mathbb{R})` | `Mn(R)` |
| `therefore` | \therefore P | `\therefore P` | `therefore P` |
| `because` | \because P | `\because P` | `because P` |
| `st` | \exists\ x\ \in\ \mathbb{R}\ \text{s.t.}\ x\ >\ 0 | `\exists\ x\ \in\ \mathbb{R}\ \text{s.t.}\ x\ >\ 0` | `exists x in RR st x>0` |
| `iff` | P\ \iff\ T | `P\ \iff\ T` | `P iff T` |
| `implies` | P\ \implies\ T | `P\ \implies\ T` | `P implies T` |
| `gets` | x\ \gets\ y | `x\ \gets\ y` | `x gets y` |
| `mapsto` | f:A\ \mapsto\ B | `f:A\ \mapsto\ B` | `f: A mapsto B` |
| `notin` | x\ \notin\ S | `x\ \notin\ S` | `x notin S` |
| `vec` | \begin{pmatrix}a & b & c\end{pmatrix} | `\begin{pmatrix}a & b & c\end{pmatrix}` | `vec(a,b,c)` |

## Note Snippet

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `;thm` | :::theorem<br><br>::: | `—` | `;thm + Tab` |
| `;def` | :::definition<br><br>::: | `—` | `;def + Tab` |
| `;lem` | :::lemma<br><br>::: | `—` | `;lem + Tab` |
| `;prop` | :::proposition<br><br>::: | `—` | `;prop + Tab` |
| `;cor` | :::corollary<br><br>::: | `—` | `;cor + Tab` |
| `;proof` | :::proof<br><br>::: | `—` | `;proof + Tab` |
| `;rem` | :::remark<br><br>::: | `—` | `;rem + Tab` |
| `;ex` | :::example<br><br>::: | `—` | `;ex + Tab` |
| `;pf` | ## 証明 | `—` | `;pf + Tab` |
| `;remark` | ## 注意 | `—` | `;remark + Tab` |
| `;qed` | □ | `—` | `;qed + Tab` |
| `;lecture` | # 講義タイトル<br>日付：<br>## 要点 | `—` | `;lecture + Tab` |
| `;m` | =  | `—` | `;m + Tab` |
| `;i` | @@ | `—` | `;i + Tab` |
| `;align` | = align<br><br>end | `—` | `;align + Tab` |
| `;matrix` | = matrix<br><br>end | `—` | `;matrix + Tab` |

## Shortcut

| Command | Result | LaTeX | Example |
| --- | --- | --- | --- |
| `⌘B` | Wrap selection with **bold** | `—` | `Wrap selection with **bold**` |
| `⌘1` | Insert a level-1 heading (# ) on the current line | `—` | `Insert a level-1 heading (# ) on the current line` |
| `⌘2` | Insert a level-2 heading (## ) on the current line | `—` | `Insert a level-2 heading (## ) on the current line` |
| `⌘3` | Insert a level-3 heading (### ) on the current line | `—` | `Insert a level-3 heading (### ) on the current line` |
| `⌘P` | Export the note as PDF (browser print) | `—` | `Export the note as PDF (browser print)` |
| `⌘S` | Save immediately (blocks the browser's Save Page dialog) | `—` | `Save immediately (blocks the browser's Save Page dialog)` |
| `⌘⇧P` | Switch to preview-only view | `—` | `Switch to preview-only view` |
| `⌘⇧E` | Switch to editor-only view | `—` | `Switch to editor-only view` |
| `⌘⇧S` | Return to split view | `—` | `Return to split view` |
