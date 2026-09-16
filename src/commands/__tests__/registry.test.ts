import { describe, expect, it } from "vitest";
import { COMMAND_ROWS } from "@/commands/registry";

describe("COMMAND_ROWS", () => {
  it("is non-empty and every row has all fields populated", () => {
    expect(COMMAND_ROWS.length).toBeGreaterThan(40);
    for (const row of COMMAND_ROWS) {
      expect(row.command).toBeTruthy();
      expect(row.rendered).toBeTruthy();
      expect(row.latex).toBeTruthy();
      expect(row.example).toBeTruthy();
      expect(row.category).toBeTruthy();
    }
  });

  it("includes every requested category of command", () => {
    const commands = COMMAND_ROWS.map((r) => r.command);
    for (const expected of [
      "sum",
      "prod",
      "int (definite)",
      "int (indefinite)",
      "lim",
      "sqrt",
      "^ (power)",
      "_ (subscript)",
      "forall",
      "exists",
      "Mn(R)",
      "oo",
      "alpha",
      "R",
      "sin",
      "to",
      "RR",
      "NN",
      "ZZ",
      "QQ",
      "CC",
      "| ... | (absolute value)",
      "exists ... in ... (membership constraint)",
      ", (comma-separated sequence)",
      "therefore",
      "because",
      "st",
      "s.t.",
      "iff",
      "implies",
      "gets",
      "mapsto",
      "notin",
    ]) {
      expect(commands, expected).toContain(expected);
    }
  });

  it("includes all math autocomplete snippets", () => {
    const snippetCommands = COMMAND_ROWS.filter((r) => r.category === "Autocomplete Snippet").map((r) => r.command);
    expect(snippetCommands.sort()).toEqual(
      [
        "su",
        "int",
        "lim",
        "sq",
        "frac",
        "prod",
        "eps",
        "alpha",
        "forall",
        "exists",
        "Mn",
        "therefore",
        "because",
        "st",
        "iff",
        "implies",
        "gets",
        "mapsto",
        "notin",
        "vec",
      ].sort()
    );
  });

  it("includes all note snippets with their expansion", () => {
    const noteRows = COMMAND_ROWS.filter((r) => r.category === "Note Snippet");
    expect(noteRows.map((r) => r.command).sort()).toEqual(
      [
        ";thm",
        ";def",
        ";lem",
        ";prop",
        ";cor",
        ";proof",
        ";rem",
        ";ex",
        ";box",
        ";pf",
        ";remark",
        ";qed",
        ";lecture",
        ";m",
        ";i",
        ";align",
        ";matrix",
      ].sort()
    );
    const thm = noteRows.find((r) => r.command === ";thm")!;
    expect(thm.rendered).toBe(":::theorem\n\n:::");
    expect(thm.latex).toBe("—");

    const box = noteRows.find((r) => r.command === ";box")!;
    expect(box.rendered).toBe(":::box \n\n:::");

    const m = noteRows.find((r) => r.command === ";m")!;
    expect(m.rendered).toBe("= ");
    const i = noteRows.find((r) => r.command === ";i")!;
    expect(i.rendered).toBe("@@");
  });

  it("includes all keyboard shortcuts", () => {
    const shortcutCommands = COMMAND_ROWS.filter((r) => r.category === "Shortcut").map((r) => r.command);
    expect(shortcutCommands.sort()).toEqual(
      ["⌘B", "⌘1", "⌘2", "⌘3", "⌘P", "⌘S", "⌘⇧P", "⌘⇧E", "⌘⇧S"].sort()
    );
  });

  it("has no duplicate (command, category) pairs", () => {
    const keys = COMMAND_ROWS.map((r) => `${r.category}::${r.command}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
