import { describe, expect, it } from "vitest";
import { runTsxScript } from "./harness/runTsxScript.js";

function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = runTsxScript({
    scriptRelativePath: "src/cli.ts",
    args,
    cwd: process.cwd()
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

describe("help UX", () => {
  it("prints onboarding-first global help", () => {
    const result = runCli(["help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Start here:");
    expect(result.stdout).toContain("skillbase init");
    expect(result.stdout).toContain("skillbase help <command>");
  });

  it("supports command-scoped help via --help", () => {
    const result = runCli(["apply", "--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("skillbase apply");
    expect(result.stdout).toContain("Examples:");
    expect(result.stdout).toContain("--dry-run");
  });

  it("returns nonzero for unknown help topics", () => {
    const result = runCli(["help", "not-a-command"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Unknown help topic: not-a-command");
  });
});
