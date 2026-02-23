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
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("frontend copy consistency script", () => {
  it("passes against current runtime shell copy", () => {
    const outDir = makeTempDir("runwright-copy-consistency-");
    const outPath = join(outDir, "copy-report.json");

    const result = runTsxScript({
      scriptRelativePath: "scripts/check_frontend_copy_consistency.ts",
      args: ["--out", outPath],
      cwd: process.cwd()
    });

    expect(result.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);

    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      ok: boolean;
      checks: Array<{ id: string; ok: boolean }>;
    };
    expect(report.ok).toBe(true);
    expect(report.checks.some((check) => check.id === "required-html-labels")).toBe(true);
  });

  it("fails when required labels/copy are missing", () => {
    const dir = makeTempDir("runwright-copy-consistency-fail-");
    const htmlPath = join(dir, "index.html");
    const appPath = join(dir, "app.js");
    const outPath = join(dir, "copy-report.fail.json");
    writeFileSync(htmlPath, "<html><body><button>Click here</button></body></html>\n", "utf8");
    writeFileSync(appPath, "export const copy = 'stuff';\n", "utf8");

    const result = runTsxScript({
      scriptRelativePath: "scripts/check_frontend_copy_consistency.ts",
      args: ["--out", outPath, "--html", htmlPath, "--app", appPath],
      cwd: process.cwd()
    });

    expect(result.status).toBe(1);
    expect(existsSync(outPath)).toBe(true);
    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      ok: boolean;
      checks: Array<{ id: string; ok: boolean }>;
    };
    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.id === "required-html-labels" && !check.ok)).toBe(true);
  });
});
