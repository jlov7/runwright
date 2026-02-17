import { describe, expect, it } from "vitest";
import { runTsxScript } from "./harness/runTsxScript.js";

function runRuntimeScript(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = runTsxScript({
    scriptRelativePath: "scripts/game_runtime.ts",
    args,
    cwd: process.cwd()
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

describe("game runtime script", () => {
  it("prints usage with --help", () => {
    const result = runRuntimeScript(["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: pnpm tsx scripts/game_runtime.ts");
    expect(result.stdout).toContain("--state-file");
  });

  it("fails on unknown args", () => {
    const result = runRuntimeScript(["--wat"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown argument: --wat");
  });
});
