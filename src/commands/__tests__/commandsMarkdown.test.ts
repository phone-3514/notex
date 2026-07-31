import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMMAND_ROWS } from "@/commands/registry";
import { commandsToMarkdown } from "@/commands/markdownExport";

describe("commandsToMarkdown", () => {
  it("renders a heading per category and a row per command", () => {
    const md = commandsToMarkdown(COMMAND_ROWS);
    expect(md).toContain("# Notex Command Reference");
    expect(md).toContain("## Sums");
    expect(md).toContain("## Note Snippet");
    expect(md).toContain("## Shortcut");
    expect(md).toContain("`sum`");
    expect(md).toContain("`;thm`");
    expect(md).toContain("`⌘B`");
  });

  it("escapes pipes and newlines so the table doesn't break", () => {
    const md = commandsToMarkdown([
      { kind: "snippet", command: "a|b", rendered: "line1\nline2", latex: "—", example: "x", category: "Test" },
    ]);
    expect(md).toContain("a\\|b");
    expect(md).toContain("line1<br>line2");
  });

  // Regenerates COMMANDS.md from the live registry so the checked-in
  // reference can never drift from actual parser/editor behavior. Running
  // the full test suite keeps it up to date.
  it("regenerates COMMANDS.md at the project root from the live registry", () => {
    const markdown = commandsToMarkdown(COMMAND_ROWS);
    const path = resolve(process.cwd(), "COMMANDS.md");
    writeFileSync(path, markdown, "utf8");
    expect(markdown.length).toBeGreaterThan(0);
  });
});
