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

describe("ship gate script", () => {
  it("runs a narrowed gate and writes consolidated artifacts", () => {
    const outDir = makeTempDir("skillbase-ship-gate-");
    const result = runTsxScript({
      scriptRelativePath: "scripts/run_ship_gate.ts",
      args: ["--only", "audit", "--out-dir", outDir],
      cwd: process.cwd()
    });

    expect(result.status).toBe(0);

    const summaryPath = join(outDir, "ship-gate.summary.json");
    const scorecardPath = join(outDir, "ship-gate.scorecard.json");
    const evidencePath = join(outDir, "ship-gate.evidence.verify.json");
    const stageLogsPath = join(outDir, "ship-gate.stage-logs.json");

    expect(existsSync(summaryPath)).toBe(true);
    expect(existsSync(scorecardPath)).toBe(true);
    expect(existsSync(evidencePath)).toBe(true);
    expect(existsSync(stageLogsPath)).toBe(true);

    const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as {
      overall: { ok: boolean; total: number };
      stages: Array<{ id: string }>;
    };
    expect(summary.overall.ok).toBe(true);
    expect(summary.overall.total).toBe(1);
    expect(summary.stages[0]?.id).toBe("audit");

    const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as { ok: boolean };
    expect(evidence.ok).toBe(true);

    const stageLogs = JSON.parse(readFileSync(stageLogsPath, "utf8")) as {
      schemaVersion: string;
      stages: Array<{ id: string }>;
    };
    expect(stageLogs.schemaVersion).toBe("1.0");
    expect(stageLogs.stages[0]?.id).toBe("audit");
  });
});
