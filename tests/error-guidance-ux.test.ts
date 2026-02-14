import { mkdtempSync, rmSync } from "node:fs";
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

function runCli(args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  const result = runTsxScript({
    scriptRelativePath: "src/cli.ts",
    args,
    cwd
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("error guidance UX", () => {
  it("suggests nearest command for unknown command invocations", () => {
    const projectDir = makeTempDir("skillbase-ux-unknown-cmd-");
    const result = runCli(["updat"], projectDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown command: updat");
    expect(result.stderr).toContain("Did you mean: runwright update");
    expect(result.stderr).toContain("runwright help");
  });

  it("returns nonzero and suggests nearest command for unknown --help topics", () => {
    const projectDir = makeTempDir("skillbase-ux-unknown-help-");
    const result = runCli(["updat", "--help"], projectDir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Unknown help topic: updat");
    expect(result.stdout).toContain("Did you mean: runwright help update");
  });

  it("includes a recovery next step for missing manifest errors", () => {
    const projectDir = makeTempDir("skillbase-ux-missing-manifest-");
    const result = runCli(["scan"], projectDir);
    expect(result.status).toBe(10);
    expect(result.stderr).toContain("No runwright.yml/runwright.json found");
    expect(result.stderr).toContain("Next:");
    expect(result.stderr).toContain("runwright init");
    expect(result.stderr).toContain("runwright journey");
  });
});
