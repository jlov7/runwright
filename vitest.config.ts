import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      "dist/**",
      ".stryker-tmp/**",
      ".fuzz-artifacts/**",
      "reports/**"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "reports/coverage",
      include: ["apps/web/src/**/*.ts", "src/game/**/*.ts"],
      exclude: ["**/types.ts"],
      thresholds: {
        lines: 75,
        functions: 85,
        branches: 60,
        statements: 75
      }
    }
  }
});
