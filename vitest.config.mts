import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // jsdom's JSDOM constructor hangs indefinitely in this environment
    // (verified: a bare `new JSDOM()` in a plain Node script never returns),
    // which starves every Vitest worker before it can even report ready —
    // happy-dom provides the same DOM globals without that hang.
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
