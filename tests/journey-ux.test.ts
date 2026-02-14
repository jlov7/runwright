import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

describe("journey UX", () => {
  it("recommends init when project is not initialized", () => {
    const projectDir = makeTempDir("skillbase-journey-empty-");
    const result = runCli(["journey"], projectDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Skillbase Onboarding Journey");
    expect(result.stdout).toContain("Next best action");
    expect(result.stdout).toContain("skillbase init");
  });

  it("recommends scan after lockfile exists but no scan evidence", () => {
    const projectDir = makeTempDir("skillbase-journey-lockfile-");

    const init = runCli(["init"], projectDir);
    expect(init.status).toBe(0);

    mkdirSync(join(projectDir, "skills", "safe"), { recursive: true });
    writeFileSync(
      join(projectDir, "skills", "safe", "SKILL.md"),
      `---\nname: safe\ndescription: safe skill\n---\n\n# Safe\n`,
      "utf8"
    );

    const update = runCli(["update", "--json"], projectDir);
    expect(update.status).toBe(0);

    const result = runCli(["journey"], projectDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Next best action");
    expect(result.stdout).toContain("skillbase scan --format json");
  });

  it("supports machine-readable journey output", () => {
    const projectDir = makeTempDir("skillbase-journey-json-");
    const result = runCli(["journey", "--json"], projectDir);
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.schemaVersion).toBe("1.0");
    expect(Array.isArray(payload.steps)).toBe(true);
    expect(payload.steps.length).toBeGreaterThan(0);
    expect(payload.nextAction).toEqual(
      expect.objectContaining({
        command: expect.any(String),
        reason: expect.any(String)
      })
    );
  });
});
