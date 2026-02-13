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

describe("ship gate soak script", () => {
  it("runs repeated ship-gate checks and emits a consistency report", () => {
    const outDir = makeTempDir("skillbase-ship-gate-soak-");
    const result = runTsxScript({
      scriptRelativePath: "scripts/soak_ship_gate.ts",
      args: ["--iterations", "2", "--only", "audit", "--out-dir", outDir],
      cwd: process.cwd()
    });
    expect(result.status).toBe(0);

    const reportPath = join(outDir, "ship-gate-soak.report.json");
    expect(existsSync(reportPath)).toBe(true);

    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      schemaVersion: string;
      iterations: number;
      consistent: boolean;
      runs: Array<{ status: number; artifactHashes?: Record<string, string> }>;
    };
    expect(report.schemaVersion).toBe("1.0");
    expect(report.iterations).toBe(2);
    expect(report.consistent).toBe(true);
    expect(report.runs).toHaveLength(2);
    expect(report.runs.every((run) => run.status === 0)).toBe(true);
    expect(report.runs.every((run) => Boolean(run.artifactHashes))).toBe(true);
  });
});
