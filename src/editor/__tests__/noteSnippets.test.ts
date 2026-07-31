import { describe, expect, it } from "vitest";
import { NOTE_SNIPPETS, matchNoteSnippet } from "@/editor/noteSnippets";

describe("matchNoteSnippet", () => {
  it("matches known triggers exactly", () => {
    expect(matchNoteSnippet(";thm")?.expansion).toBe(":::theorem\n\n:::");
    expect(matchNoteSnippet(";def")?.expansion).toBe(":::definition\n\n:::");
    expect(matchNoteSnippet(";lem")?.expansion).toBe(":::lemma\n\n:::");
    expect(matchNoteSnippet(";prop")?.expansion).toBe(":::proposition\n\n:::");
    expect(matchNoteSnippet(";cor")?.expansion).toBe(":::corollary\n\n:::");
    expect(matchNoteSnippet(";proof")?.expansion).toBe(":::proof\n\n:::");
    expect(matchNoteSnippet(";rem")?.expansion).toBe(":::remark\n\n:::");
    expect(matchNoteSnippet(";ex")?.expansion).toBe(":::example\n\n:::");
    expect(matchNoteSnippet(";pf")?.expansion).toBe("## 証明");
    expect(matchNoteSnippet(";remark")?.expansion).toBe("## 注意");
    expect(matchNoteSnippet(";qed")?.expansion).toBe("□");
    expect(matchNoteSnippet(";lecture")?.expansion).toBe("# 講義タイトル\n日付：\n## 要点");
    expect(matchNoteSnippet(";m")?.expansion).toBe("= ");
    expect(matchNoteSnippet(";i")?.expansion).toBe("@@");
    expect(matchNoteSnippet(";align")?.expansion).toBe("= align\n\nend");
    expect(matchNoteSnippet(";matrix")?.expansion).toBe("= matrix\n\nend");
  });

  it("theorem-block snippets place the cursor on the empty body line", () => {
    for (const trigger of [";thm", ";def", ";lem", ";prop", ";cor", ";proof", ";rem", ";ex"]) {
      const s = matchNoteSnippet(trigger)!;
      const offset = s.cursorOffset!;
      expect(s.expansion[offset - 1], trigger).toBe("\n");
      expect(s.expansion[offset], trigger).toBe("\n");
    }
  });

  it(";m has no explicit cursorOffset (defaults to end, right after the space)", () => {
    const m = matchNoteSnippet(";m")!;
    expect(m.cursorOffset).toBeUndefined();
    expect(m.expansion.length).toBe(2); // "= " — end of expansion == after the space
  });

  it(";i places the cursor between the two @ signs", () => {
    const i = matchNoteSnippet(";i")!;
    expect(i.cursorOffset).toBe(1);
    expect(i.expansion.slice(0, i.cursorOffset)).toBe("@");
    expect(i.expansion.slice(i.cursorOffset)).toBe("@");
  });

  it(";align and ;matrix place the cursor on the empty row line", () => {
    for (const trigger of [";align", ";matrix"]) {
      const s = matchNoteSnippet(trigger)!;
      const offset = s.cursorOffset!;
      expect(s.expansion[offset - 1], trigger).toBe("\n");
      expect(s.expansion[offset], trigger).toBe("\n");
    }
  });

  it("does not match partial prefixes", () => {
    expect(matchNoteSnippet(";th")).toBeUndefined();
    expect(matchNoteSnippet(";")).toBeUndefined();
  });

  it("does not match unknown triggers", () => {
    expect(matchNoteSnippet(";nope")).toBeUndefined();
  });

  it("has no duplicate triggers", () => {
    const triggers = NOTE_SNIPPETS.map((s) => s.trigger);
    expect(new Set(triggers).size).toBe(triggers.length);
  });
});
