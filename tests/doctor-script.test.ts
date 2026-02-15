import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("fails when a value-bearing flag is missing its value", () => {
    const result = runTsxScript({
      scriptRelativePath: "scripts/doctor.ts",
      args: ["--out"],
      cwd: process.cwd(),
      envOverrides: {
        RUNWRIGHT_DOCTOR_MOCK_STATUS: "0"
      }
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing value for --out");
  });

  it("writes policy explain artifact when manifest exists", () => {
    const dir = makeTempDir("runwright-doctor-policy-");
    mkdirSync(join(dir, "skills", "safe"), { recursive: true });
    writeFileSync(
      join(dir, "skills", "safe", "SKILL.md"),
      `---\nname: safe\ndescription: safe skill\n---\n`,
      "utf8"
    );
    writeFileSync(
      join(dir, "runwright.yml"),
      [
        "version: 1",
        "defaults:",
        "  policy:",
        "    rules:",
        "      - id: warn-clean",
        "        when:",
        "          hasUntrustedSources: false",
        "        action: warn",
        "        message: clean trust state",
        "skillsets:",
        "  base:",
        "    skills:",
        "      - source: local:./skills",
        "apply:",
        "  useSkillsets: [base]",
        ""
      ].join("\n"),
      "utf8"
    );

    const outPath = join(dir, "doctor.json");
    const result = runTsxScript({
      scriptRelativePath: "scripts/doctor.ts",
      args: ["--out", outPath, "--only", "policy:explain"],
      cwd: dir
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      checks: Array<{ id: string; ok: boolean; status: number }>;
    };
    expect(report.checks[0]?.id).toBe("policy:explain");
    expect(report.checks[0]?.ok).toBe(true);
    expect(report.checks[0]?.status).toBe(0);
    const explainPath = join(dir, "reports", "policy", "policy-explain.json");
    expect(existsSync(explainPath)).toBe(true);
    const explain = JSON.parse(readFileSync(explainPath, "utf8")) as { policy?: { trace?: unknown[] } };
    expect(Array.isArray(explain.policy?.trace)).toBe(true);
  });

  it("fails on unknown arguments", () => {
    const result = runTsxScript({
      scriptRelativePath: "scripts/doctor.ts",
      args: ["--bogus"],
      cwd: process.cwd(),
      envOverrides: {
        RUNWRIGHT_DOCTOR_MOCK_STATUS: "0"
      }
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown doctor argument '--bogus'");
  });

  it("prints help usage with --help", () => {
    const result = runTsxScript({
      scriptRelativePath: "scripts/doctor.ts",
      args: ["--help"],
      cwd: process.cwd()
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: pnpm tsx scripts/doctor.ts [options]");
    expect(result.stdout).toContain("--only <check>");
    expect(result.stdout).toContain("Checks:");
  });
});
