import { describe, expect, it } from "vitest";
import { UndoHistory, diffPatch, fingerprint } from "@/editor/undoHistory";

// Simulates typing `text` one character at a time, `gap` ms apart.
function type(history: UndoHistory, doc: string, text: string, startTime: number, gap = 50): { doc: string; time: number } {
  let time = startTime;
  for (const ch of text) {
    history.record(doc, doc + ch, { now: time });
    doc += ch;
    time += gap;
  }
  return { doc, time };
}

describe("diffPatch", () => {
  it("finds the single replaced span between common prefix and suffix", () => {
    expect(diffPatch("hello world", "hello brave world")).toEqual({ at: 6, removed: "", inserted: "brave " });
    expect(diffPatch("hello brave world", "hello world")).toEqual({ at: 6, removed: "brave ", inserted: "" });
    expect(diffPatch("abcdef", "abXYef")).toEqual({ at: 2, removed: "cd", inserted: "XY" });
    expect(diffPatch("same", "same")).toEqual({ at: 4, removed: "", inserted: "" });
  });

  it("never splits a surrogate pair", () => {
    const patch = diffPatch("a😀b", "a😁b");
    expect(patch.removed).toBe("😀");
    expect(patch.inserted).toBe("😁");
  });
});

describe("UndoHistory", () => {
  it("undoes and redoes a single edit, with the caret after the restored text", () => {
    const h = new UndoHistory();
    h.record("hello", "hello world", { now: 0 });
    const undone = h.undo("hello world")!;
    expect(undone).toEqual({ value: "hello", caret: 5 });
    const redone = h.redo("hello")!;
    expect(redone).toEqual({ value: "hello world", caret: 11 });
  });

  it("merges a quick typing burst into one step", () => {
    const h = new UndoHistory();
    const { doc } = type(h, "", "hello world", 0);
    expect(doc).toBe("hello world");
    expect(h.undoCount).toBe(1);
    expect(h.undo(doc)!.value).toBe("");
  });

  it("starts a new step after a pause", () => {
    const h = new UndoHistory();
    const first = type(h, "", "one", 0);
    const { doc } = type(h, first.doc, "two", first.time + 2000);
    expect(h.undoCount).toBe(2);
    expect(h.undo(doc)!.value).toBe("one");
  });

  it("a newline ends a typing burst", () => {
    const h = new UndoHistory();
    const first = type(h, "", "ab", 0);
    h.record(first.doc, first.doc + "\n", { now: first.time });
    type(h, first.doc + "\n", "cd", first.time + 50);
    expect(h.undoCount).toBe(3);
  });

  it("merges a run of backspaces, and of forward deletes", () => {
    const back = new UndoHistory();
    back.record("hello", "hell", { now: 0 });
    back.record("hell", "hel", { now: 50 });
    back.record("hel", "he", { now: 100 });
    expect(back.undoCount).toBe(1);
    expect(back.undo("he")!.value).toBe("hello");

    const fwd = new UndoHistory();
    fwd.record("hello", "ello", { now: 0 });
    fwd.record("ello", "llo", { now: 50 });
    expect(fwd.undoCount).toBe(1);
    expect(fwd.undo("llo")!.value).toBe("hello");
  });

  it("sealed (programmatic) edits stay separate steps and never merge", () => {
    const h = new UndoHistory();
    h.record("", ";thm", { now: 0 });
    h.record(";thm", ":::theorem\n\n:::", { now: 10, sealed: true });
    h.record(":::theorem\n\n:::", ":::theorem\n\n:::x", { now: 20 });
    expect(h.undoCount).toBe(3);
    expect(h.undo(":::theorem\n\n:::x")!.value).toBe(":::theorem\n\n:::");
    expect(h.undo(":::theorem\n\n:::")!.value).toBe(";thm");
  });

  it("walks all the way back step by step, then forward again", () => {
    const h = new UndoHistory();
    const states = ["", "a", "ab", "abc", "abcd"];
    for (let i = 1; i < states.length; i++) h.record(states[i - 1], states[i], { now: i * 5000, sealed: true });
    let doc = states[4];
    for (let i = 3; i >= 0; i--) {
      doc = h.undo(doc)!.value;
      expect(doc).toBe(states[i]);
    }
    expect(h.undo(doc)).toBeNull();
    for (let i = 1; i <= 4; i++) {
      doc = h.redo(doc)!.value;
      expect(doc).toBe(states[i]);
    }
    expect(h.redo(doc)).toBeNull();
  });

  it("a new edit discards the redo stack", () => {
    const h = new UndoHistory();
    h.record("", "a", { now: 0, sealed: true });
    h.record("a", "ab", { now: 5000, sealed: true });
    const doc = h.undo("ab")!.value;
    expect(h.redoCount).toBe(1);
    h.record(doc, "ax", { now: 9000, sealed: true });
    expect(h.redoCount).toBe(0);
  });

  it("keeps only the most recent 100 steps", () => {
    const h = new UndoHistory(100);
    let doc = "";
    for (let i = 0; i < 150; i++) {
      h.record(doc, doc + "x", { now: i * 5000, sealed: true });
      doc += "x";
    }
    expect(h.undoCount).toBe(100);
    let steps = 0;
    while (h.undo(doc)) {
      doc = doc.slice(0, -1);
      steps++;
    }
    expect(steps).toBe(100);
    expect(doc.length).toBe(50); // the oldest 50 edits can't be undone any more
  });

  it("gives up cleanly (and clears) if the history no longer matches the text", () => {
    const h = new UndoHistory();
    h.record("abc", "abcdef", { now: 0 });
    expect(h.undo("something else entirely")).toBeNull();
    expect(h.undoCount).toBe(0);
  });

  it("ignores a no-op record", () => {
    const h = new UndoHistory();
    h.record("same", "same");
    expect(h.undoCount).toBe(0);
  });
});

describe("saving and restoring history", () => {
  it("round-trips for the same document", () => {
    const h = new UndoHistory();
    h.record("", "hello", { now: 0, sealed: true });
    h.record("hello", "hello world", { now: 5000, sealed: true });
    const json = h.serialize("hello world");
    const restored = UndoHistory.restore(json, "hello world");
    expect(restored.undoCount).toBe(2);
    expect(restored.undo("hello world")!.value).toBe("hello");
    expect(restored.undo("hello")!.value).toBe("");
  });

  it("is discarded when the saved text is a different document", () => {
    const h = new UndoHistory();
    h.record("", "hello", { now: 0, sealed: true });
    const json = h.serialize("hello");
    expect(UndoHistory.restore(json, "hello!").undoCount).toBe(0);
  });

  it("ignores missing or garbage data", () => {
    expect(UndoHistory.restore(null, "x").undoCount).toBe(0);
    expect(UndoHistory.restore("not json", "x").undoCount).toBe(0);
    expect(UndoHistory.restore('{"v":2}', "x").undoCount).toBe(0);
    expect(UndoHistory.restore(JSON.stringify({ v: 1, doc: fingerprint("x"), entries: [{ at: "no" }] }), "x").undoCount).toBe(0);
  });

  it("drops the oldest steps first when the saved data would be too large", () => {
    const h = new UndoHistory();
    let doc = "";
    for (let i = 0; i < 100; i++) {
      const next = doc + "word ".repeat(20);
      h.record(doc, next, { now: i * 5000, sealed: true });
      doc = next;
    }
    const json = h.serialize(doc, 3000);
    expect(json.length).toBeLessThanOrEqual(3000);
    const restored = UndoHistory.restore(json, doc);
    expect(restored.undoCount).toBeGreaterThan(0);
    expect(restored.undoCount).toBeLessThan(100);
  });
});
