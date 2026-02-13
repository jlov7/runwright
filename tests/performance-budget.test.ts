import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runTsxScript } from "./harness/runTsxScript.js";

type PerfBudgetConfig = {
  schemaVersion: "1.0";
  exportMs: number;
  verifyMs: number;
  toleranceFactor: number;
};

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runCli(
  args: string[],
  cwd: string,
  envOverrides?: Record<string, string>
): { status: number; stdout: string; stderr: string; elapsedMs: number } {
  const result = runTsxScript({
    scriptRelativePath: "src/cli.ts",
    args,
    cwd,
    envOverrides
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    elapsedMs: result.elapsedMs
  };
}

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? Math.round((ordered[mid - 1]! + ordered[mid]!) / 2)
    : ordered[mid]!;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("performance budget guards", () => {
  it("keeps export/verify bundle latencies within configured budgets", () => {
    const budgets = JSON.parse(
      readFileSync(join(process.cwd(), "tests", "fixtures", "perf-budgets.json"), "utf8")
    ) as PerfBudgetConfig;
    expect(budgets.schemaVersion).toBe("1.0");

    const toleranceFactor = Number(process.env.SKILLBASE_TEST_PERF_TOLERANCE_FACTOR ?? budgets.toleranceFactor);
    const exportBudgetMs = Number(process.env.SKILLBASE_TEST_BUDGET_EXPORT_MS ?? Math.round(budgets.exportMs * toleranceFactor));
    const verifyBudgetMs = Number(process.env.SKILLBASE_TEST_BUDGET_VERIFY_MS ?? Math.round(budgets.verifyMs * toleranceFactor));

    const projectDir = makeTempDir("skillbase-perf-budget-");
    for (let index = 0; index < 120; index += 1) {
      const skillName = `skill-${String(index).padStart(3, "0")}`;
      mkdirSync(join(projectDir, "skills", skillName), { recursive: true });
      writeFileSync(
        join(projectDir, "skills", skillName, "SKILL.md"),
        `---\nname: ${skillName}\ndescription: ${skillName}\n---\n\n# ${skillName}\n`,
        "utf8"
      );
    }
    writeFileSync(
      join(projectDir, "skillbase.yml"),
      `version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\napply:\n  useSkillsets: [base]\n`,
      "utf8"
    );

    const update = runCli(["update"], projectDir);
    expect(update.status).toBe(0);

    const exportDurations: number[] = [];
    const verifyDurations: number[] = [];
    const bundlePath = join(projectDir, "bundle.zip");
    const env = { SOURCE_DATE_EPOCH: "1704067200" };

    for (let iteration = 0; iteration < 3; iteration += 1) {
      const exported = runCli(["export", "--out", bundlePath, "--deterministic"], projectDir, env);
      expect(exported.status).toBe(0);
      exportDurations.push(exported.elapsedMs);

      const verified = runCli(["verify-bundle", "--bundle", bundlePath, "--json"], projectDir);
      expect(verified.status).toBe(0);
      verifyDurations.push(verified.elapsedMs);
    }

    const exportMedianMs = median(exportDurations);
    const verifyMedianMs = median(verifyDurations);

    expect(exportMedianMs).toBeLessThanOrEqual(exportBudgetMs);
    expect(verifyMedianMs).toBeLessThanOrEqual(verifyBudgetMs);
  });
});
