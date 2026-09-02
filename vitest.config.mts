import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The toDateInputValue test distinguishes local-calendar from UTC dates,
    // which is only observable in a zone offset from UTC. Without pinning,
    // the test still passes on a UTC runner but stops discriminating —
    // silently ceasing to guard the bug it exists for.
    env: { TZ: "Africa/Cairo" },
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
