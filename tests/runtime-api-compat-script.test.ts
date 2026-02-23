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

describe("runtime api compatibility script", () => {
  it("passes compatibility checks for current runtime contract", () => {
    const outDir = makeTempDir("runwright-runtime-api-compat-");
    const outPath = join(outDir, "runtime-api-compat.json");

    const result = runTsxScript({
      scriptRelativePath: "scripts/check_runtime_api_compatibility.ts",
      args: ["--out", outPath],
      cwd: process.cwd()
    });

    expect(result.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);

    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      ok: boolean;
      observed: { apiVersion: string; apiVersionHeader: string };
      checks: Array<{ id: string; ok: boolean }>;
    };
    expect(report.ok).toBe(true);
    expect(report.observed.apiVersion).toBe("1.0");
    expect(report.observed.apiVersionHeader).toBe("1.0");
    expect(report.checks.some((check) => check.id === "version-endpoint")).toBe(true);
  });

  it("fails when expected major version is incompatible", () => {
    const outDir = makeTempDir("runwright-runtime-api-compat-fail-");
    const outPath = join(outDir, "runtime-api-compat-fail.json");

    const result = runTsxScript({
      scriptRelativePath: "scripts/check_runtime_api_compatibility.ts",
      args: ["--out", outPath, "--expected-major", "2"],
      cwd: process.cwd()
    });

    expect(result.status).toBe(1);
    expect(existsSync(outPath)).toBe(true);
    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      ok: boolean;
      checks: Array<{ id: string; ok: boolean }>;
    };
    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.id === "major-version" && !check.ok)).toBe(true);
  });
});
