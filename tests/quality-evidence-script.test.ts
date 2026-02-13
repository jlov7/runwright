import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

describe("quality evidence verifier script", () => {
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
