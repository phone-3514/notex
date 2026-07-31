import { beforeEach, describe, expect, it } from "vitest";
import { loadNote, saveNote } from "@/storage/localStorage";

describe("localStorage note persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing is saved", () => {
    expect(loadNote()).toBeNull();
  });

  it("round-trips saved title and content", () => {
    saveNote("My Note", "# Hello");
    const loaded = loadNote();
    expect(loaded?.title).toBe("My Note");
    expect(loaded?.content).toBe("# Hello");
    expect(typeof loaded?.updatedAt).toBe("number");
  });

  it("ignores corrupted storage instead of throwing", () => {
    window.localStorage.setItem("mathnote:note:v1", "not json");
    expect(() => loadNote()).not.toThrow();
    expect(loadNote()).toBeNull();
  });
});
