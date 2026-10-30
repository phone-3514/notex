import { describe, expect, it } from "vitest";
import { parseStoredTheme, themeClasses, THEMES } from "../theme";

describe("theme config", () => {
  it("offers light, dark and terminal", () => {
    expect(THEMES.map((t) => t.theme)).toEqual(["light", "dark", "terminal"]);
  });

  it("reads a stored theme, including values saved before the terminal theme existed", () => {
    expect(parseStoredTheme("light", true)).toBe("light");
    expect(parseStoredTheme("dark", false)).toBe("dark");
    expect(parseStoredTheme("terminal", false)).toBe("terminal");
  });

  it("falls back to the OS preference when nothing valid is stored", () => {
    expect(parseStoredTheme(null, true)).toBe("dark");
    expect(parseStoredTheme(null, false)).toBe("light");
    expect(parseStoredTheme("neon", true)).toBe("dark");
  });

  it("puts both dark-ish themes under the `dark` class, and only terminal under `theme-terminal`", () => {
    expect(themeClasses("light")).toEqual({ dark: false, terminal: false });
    expect(themeClasses("dark")).toEqual({ dark: true, terminal: false });
    expect(themeClasses("terminal")).toEqual({ dark: true, terminal: true });
  });
});
