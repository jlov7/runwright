import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

describe("performance scripts", () => {
  it("captures a performance snapshot artifact", () => {
    const dir = makeTempDir("skillbase-perf-snapshot-");
    const outPath = join(dir, "snapshot.json");
    const result = runTsxScript({
      scriptRelativePath: "scripts/capture_performance_snapshot.ts",
      args: ["--skills", "20", "--iterations", "2", "--out", outPath],
      cwd: process.cwd()
    });

    expect(result.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);

    const snapshot = JSON.parse(readFileSync(outPath, "utf8")) as {
      schemaVersion: string;
      sample: { skills: number; iterations: number };
      metrics: { updateMs: number; exportMedianMs: number; verifyMedianMs: number };
    };
    expect(snapshot.schemaVersion).toBe("1.0");
    expect(snapshot.sample.skills).toBe(20);
    expect(snapshot.sample.iterations).toBe(2);
    expect(snapshot.metrics.updateMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.metrics.exportMedianMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.metrics.verifyMedianMs).toBeGreaterThanOrEqual(0);
  });

  it("checks performance trend and fails on excessive regressions", () => {
    const dir = makeTempDir("skillbase-perf-trend-");
    const baselinePath = join(dir, "baseline.json");
    const currentPassPath = join(dir, "current-pass.json");
    const currentFailPath = join(dir, "current-fail.json");
    const reportPath = join(dir, "trend-report.json");
    const historyDir = join(dir, "history");

    writeFileSync(
      baselinePath,
      JSON.stringify({
        schemaVersion: "1.0",
        generatedAt: "2026-02-13T00:00:00.000Z",
        platform: "baseline",
        nodeVersion: "v20",
        sample: { skills: 120, iterations: 3 },
        metrics: { updateMs: 1000, exportMedianMs: 1000, verifyMedianMs: 1000 }
      }),
      "utf8"
    );
    writeFileSync(
      currentPassPath,
      JSON.stringify({
        schemaVersion: "1.0",
        generatedAt: "2026-02-13T00:00:00.000Z",
        platform: "current",
        nodeVersion: "v20",
        sample: { skills: 120, iterations: 3 },
        metrics: { updateMs: 1100, exportMedianMs: 1080, verifyMedianMs: 1050 }
      }),
      "utf8"
    );

    const passResult = runTsxScript({
      scriptRelativePath: "scripts/check_performance_trend.ts",
      args: [
        "--current",
        currentPassPath,
        "--baseline",
        baselinePath,
        "--max-regression-percent",
        "20",
        "--out",
        reportPath,
        "--history-dir",
        historyDir
      ],
      cwd: process.cwd()
    });

    expect(passResult.status).toBe(0);
    expect(existsSync(reportPath)).toBe(true);
    expect(existsSync(historyDir)).toBe(true);
    const passReport = JSON.parse(readFileSync(reportPath, "utf8")) as { ok: boolean };
    expect(passReport.ok).toBe(true);

    writeFileSync(
      currentFailPath,
      JSON.stringify({
        schemaVersion: "1.0",
        generatedAt: "2026-02-13T00:00:00.000Z",
        platform: "current",
        nodeVersion: "v20",
        sample: { skills: 120, iterations: 3 },
        metrics: { updateMs: 1500, exportMedianMs: 1400, verifyMedianMs: 1300 }
      }),
      "utf8"
    );

    const failResult = runTsxScript({
      scriptRelativePath: "scripts/check_performance_trend.ts",
      args: [
        "--current",
        currentFailPath,
        "--baseline",
        baselinePath,
        "--max-regression-percent",
        "20",
        "--out",
        reportPath,
        "--history-dir",
        historyDir
      ],
      cwd: process.cwd()
    });
    expect(failResult.status).toBe(1);
    const failReport = JSON.parse(readFileSync(reportPath, "utf8")) as { ok: boolean };
    expect(failReport.ok).toBe(false);
  });
});
