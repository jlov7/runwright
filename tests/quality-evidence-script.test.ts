import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SHIP_GATE_STAGES } from "../src/quality/ship-gate.js";
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

describe("quality evidence verifier script", () => {
  it("uses default scorecard and output paths when args are omitted", () => {
    const dir = makeTempDir("skillbase-quality-evidence-defaults-");
    const reportsDir = join(dir, "reports", "quality");
    const scorecardPath = join(reportsDir, "ship-gate.scorecard.json");
    const outPath = join(reportsDir, "evidence-verification.json");

    rmSync(reportsDir, { recursive: true, force: true });
    mkdirSync(reportsDir, { recursive: true });
    writeFileSync(
      scorecardPath,
      JSON.stringify({
        overall: { pass: true },
        checks: DEFAULT_SHIP_GATE_STAGES.map((stage) => ({ name: stage.id, result: "success" }))
      }),
      "utf8"
    );

    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_quality_evidence.ts",
      args: [],
      cwd: dir
    });

    expect(result.status).toBe(0);
    const summary = JSON.parse(readFileSync(outPath, "utf8")) as { ok: boolean };
    expect(summary.ok).toBe(true);
  });

  it("fails with actionable guidance when default scorecard is missing", () => {
    const dir = makeTempDir("skillbase-quality-evidence-missing-scorecard-");

    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_quality_evidence.ts",
      args: [],
      cwd: dir
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Run `pnpm ship:gate` first");
    expect(result.stderr).toContain("ship-gate.scorecard.json");
  });

  it("fails when a flag that requires a value is missing its value", () => {
    const dir = makeTempDir("skillbase-quality-evidence-missing-arg-value-");

    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_quality_evidence.ts",
      args: ["--scorecard"],
      cwd: dir
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing value for --scorecard");
  });

  it("fails on unknown arguments", () => {
    const dir = makeTempDir("skillbase-quality-evidence-unknown-arg-");

    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_quality_evidence.ts",
      args: ["--bogus"],
      cwd: dir
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown argument '--bogus'");
  });

  it("prints help usage with --help", () => {
    const dir = makeTempDir("skillbase-quality-evidence-help-");

    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_quality_evidence.ts",
      args: ["--help"],
      cwd: dir
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: pnpm tsx scripts/verify_quality_evidence.ts [options]");
    expect(result.stdout).toContain("--allow-scorecard-fail");
    expect(result.stdout).toContain("--min-mutation-score <num>");
  });

  it("succeeds and writes verification output when evidence passes", () => {
    const dir = makeTempDir("skillbase-quality-evidence-pass-");
    const scorecardPath = join(dir, "scorecard.json");
    const sbomPath = join(dir, "bom.json");
    const mutationPath = join(dir, "mutation.json");
    const outPath = join(dir, "verify.json");

    writeFileSync(
      scorecardPath,
      JSON.stringify({ overall: { pass: true }, checks: [{ name: "verify", result: "success" }] }),
      "utf8"
    );
    writeFileSync(sbomPath, JSON.stringify({ bomFormat: "CycloneDX", components: [{ name: "skillbase" }] }), "utf8");
    writeFileSync(
      mutationPath,
      JSON.stringify({ files: { "src/demo.ts": { mutants: [{ status: "Killed" }, { status: "Survived" }] } } }),
      "utf8"
    );

    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_quality_evidence.ts",
      args: [
        "--scorecard",
        scorecardPath,
        "--require-check",
        "verify",
        "--mutation-report",
        mutationPath,
        "--min-mutation-score",
        "40",
        "--sbom",
        sbomPath,
        "--out",
        outPath
      ],
      cwd: process.cwd()
    });

    expect(result.status).toBe(0);
    const summary = JSON.parse(readFileSync(outPath, "utf8")) as { ok: boolean };
    expect(summary.ok).toBe(true);
  });

  it("fails when required check is not successful", () => {
    const dir = makeTempDir("skillbase-quality-evidence-fail-");
    const scorecardPath = join(dir, "scorecard.json");
    const outPath = join(dir, "verify.json");

    writeFileSync(
      scorecardPath,
      JSON.stringify({ overall: { pass: true }, checks: [{ name: "verify", result: "failure" }] }),
      "utf8"
    );

    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_quality_evidence.ts",
      args: ["--scorecard", scorecardPath, "--require-check", "verify", "--out", outPath],
      cwd: process.cwd()
    });

    expect(result.status).toBe(1);
    const summary = JSON.parse(readFileSync(outPath, "utf8")) as { ok: boolean };
    expect(summary.ok).toBe(false);
  });
});
