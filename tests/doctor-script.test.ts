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

describe("doctor script", () => {
  it("writes a machine-readable doctor report", () => {
    const outDir = makeTempDir("runwright-doctor-");
    const outPath = join(outDir, "doctor.json");
    const result = runTsxScript({
      scriptRelativePath: "scripts/doctor.ts",
      args: ["--out", outPath, "--only", "lint"],
      cwd: process.cwd(),
      envOverrides: {
        RUNWRIGHT_DOCTOR_MOCK_STATUS: "0"
      }
    });

    expect(result.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);

    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      schemaVersion: string;
      overall: { ok: boolean; total: number; succeeded: number; failed: number };
      checks: Array<{ id: string; ok: boolean; status: number }>;
    };
    expect(report.schemaVersion).toBe("1.0");
    expect(report.overall.ok).toBe(true);
    expect(report.overall.total).toBe(1);
    expect(report.overall.succeeded).toBe(1);
    expect(report.overall.failed).toBe(0);
    expect(report.checks[0]?.id).toBe("lint");
    expect(report.checks[0]?.ok).toBe(true);
    expect(report.checks[0]?.status).toBe(0);
  });
});
