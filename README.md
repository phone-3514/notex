# Notex

A fast, local-first Markdown + math note editor for university-level math.
Type a lightweight shorthand (`sum n=1~oo 1/n`, `f'(x)`, `= matrix ... end`)
and see it live-rendered as KaTeX — no LaTeX syntax required. Installable as
a desktop PWA; exports notes as vector, searchable PDFs.

## Local setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Commands

```bash
npm test          # vitest
npx tsc --noEmit   # type check
npm run lint       # eslint
npm run build      # production build
npm start          # serve the production build
```

## Persistence

Notes are stored **only in the browser's `localStorage`** — there is no
server, account, or sync. Clearing site data, using a different browser, or
switching devices loses your notes. Export to PDF (⌘P) for durable copies.

## Stack

Next.js (App Router) · TypeScript · Tailwind · KaTeX · a custom shorthand
parser (`src/tokenizer`, `src/parser`, `src/renderer`).
