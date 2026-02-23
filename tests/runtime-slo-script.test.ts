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
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("runtime slo script", () => {
  it("writes SLO report and passes default thresholds", () => {
    const outDir = makeTempDir("runwright-runtime-slo-");
    const outPath = join(outDir, "runtime-slo.json");

    const result = runTsxScript({
      scriptRelativePath: "scripts/check_runtime_slo.ts",
      args: ["--out", outPath],
      cwd: process.cwd()
    });

    expect(result.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);

    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      ok: boolean;
      checks: Array<{ id: string; ok: boolean }>;
      metrics: { requests: { total: number; p95Ms: number } };
    };
    expect(report.ok).toBe(true);
    expect(report.metrics.requests.total).toBeGreaterThan(0);
    expect(report.metrics.requests.p95Ms).toBeGreaterThanOrEqual(0);
    expect(report.checks.some((check) => check.id === "global-p95")).toBe(true);
  });

  it("fails with impossible sample requirement", () => {
    const outDir = makeTempDir("runwright-runtime-slo-fail-");
    const outPath = join(outDir, "runtime-slo-fail.json");

    const result = runTsxScript({
      scriptRelativePath: "scripts/check_runtime_slo.ts",
      args: ["--out", outPath, "--min-sample-count", "500"],
      cwd: process.cwd()
    });

    expect(result.status).toBe(1);
    expect(existsSync(outPath)).toBe(true);

    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      ok: boolean;
      checks: Array<{ id: string; ok: boolean }>;
    };
    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.id === "sample-count" && !check.ok)).toBe(true);
  });
});
