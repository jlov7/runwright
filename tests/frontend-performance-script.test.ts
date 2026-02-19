import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runTsxScript } from "./harness/runTsxScript.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("frontend performance budget script", () => {
  it("writes budget report and passes with default thresholds", () => {
    const outDir = makeTempDir("runwright-frontend-perf-");
    const outPath = join(outDir, "frontend-budget.json");

    const result = runTsxScript({
      scriptRelativePath: "scripts/check_frontend_performance.ts",
      args: ["--out", outPath, "--iterations", "3"],
      cwd: process.cwd()
    });

    expect(result.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);

    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      ok: boolean;
      checks: Array<{ id: string; ok: boolean }>;
      metrics: { html: { sizeKb: number }; css: { sizeKb: number } };
    };
    expect(report.ok).toBe(true);
    expect(report.checks.some((check) => check.id === "combined-size")).toBe(true);
    expect(report.metrics.html.sizeKb).toBeGreaterThan(1);
    expect(report.metrics.css.sizeKb).toBeGreaterThan(1);
  });

  it("fails when budgets are stricter than actual shell size", () => {
    const outDir = makeTempDir("runwright-frontend-perf-fail-");
    const outPath = join(outDir, "frontend-budget.fail.json");

    const result = runTsxScript({
      scriptRelativePath: "scripts/check_frontend_performance.ts",
      args: [
        "--out",
        outPath,
        "--max-html-kb",
        "1",
        "--max-css-kb",
        "1",
        "--max-combined-kb",
        "1",
        "--iterations",
        "2"
      ],
      cwd: process.cwd()
    });

    expect(result.status).toBe(1);
    expect(existsSync(outPath)).toBe(true);

    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      ok: boolean;
      checks: Array<{ id: string; ok: boolean }>;
    };
    expect(report.ok).toBe(false);
    expect(report.checks.filter((check) => !check.ok).length).toBeGreaterThan(0);
  });
});
