import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runTsxScript } from "./harness/runTsxScript.js";

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

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

describe("compatibility replay", () => {
  it("replays v1 safe scan fixture exactly", () => {
    const fixtureDir = join(process.cwd(), "tests", "fixtures", "compat", "v1-safe");
    const result = runCli(["scan", "--format", "json", "--json"], fixtureDir);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const expected = readJson(join(fixtureDir, "scan.expected.json"));
    const actual = JSON.parse(result.stdout) as unknown;
    expect(actual).toEqual(expected);
  });

  it("replays v1 missing-manifest scan failure fixture exactly", () => {
    const fixtureDir = join(process.cwd(), "tests", "fixtures", "compat", "v1-missing-manifest");
    const result = runCli(["scan", "--format", "json", "--json"], fixtureDir);

    expect(result.status).toBe(10);
    expect(result.stderr).toBe("");

    const expected = readJson(join(fixtureDir, "scan.expected.json"));
    const actual = JSON.parse(result.stdout) as unknown;
    expect(actual).toEqual(expected);
  });
});
