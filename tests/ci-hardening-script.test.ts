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

describe("ci hardening verifier script", () => {
  it("writes a passing report on the repository workflows", () => {
    const outDir = makeTempDir("runwright-ci-hardening-");
    const outPath = join(outDir, "ci-hardening.json");
    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_ci_hardening.ts",
      args: ["--out", outPath],
      cwd: process.cwd()
    });
    expect(result.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);
    const payload = JSON.parse(readFileSync(outPath, "utf8")) as {
      schemaVersion: string;
      ok: boolean;
      workflows: Array<{ file: string; ok: boolean }>;
    };
    expect(payload.schemaVersion).toBe("1.0");
    expect(payload.ok).toBe(true);
    expect(payload.workflows.length).toBeGreaterThan(0);
  });

  it("fails when a required workflow is missing executable steps", () => {
    const repo = makeTempDir("runwright-ci-hardening-fixture-");
    const workflows = join(repo, ".github", "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "ci.yml"),
      [
        "name: CI",
        "on: [push]",
        "jobs:",
        "  broken:",
        "    runs-on: ubuntu-latest",
        "    steps: []",
        ""
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(workflows, "codeql.yml"),
      [
        "name: CodeQL",
        "on: [push]",
        "jobs:",
        "  analyze:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - run: echo analyze",
        ""
      ].join("\n"),
      "utf8"
    );
    const outPath = join(repo, "reports", "quality", "ci-hardening.json");
    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_ci_hardening.ts",
      args: ["--repo-root", repo, "--out", outPath],
      cwd: process.cwd()
    });
    expect(result.status).toBe(1);
    const payload = JSON.parse(readFileSync(outPath, "utf8")) as { ok: boolean; failures: string[] };
    expect(payload.ok).toBe(false);
    expect(payload.failures.join("\n")).toContain("no executable steps");
  });

  it("fails when CI workflow is not wired to push and pull_request automation", () => {
    const repo = makeTempDir("runwright-ci-trigger-fixture-");
    const workflows = join(repo, ".github", "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "ci.yml"),
      [
        "name: CI",
        "on:",
        "  workflow_dispatch:",
        "jobs:",
        "  verify:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - run: pnpm verify",
        ""
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(workflows, "codeql.yml"),
      [
        "name: CodeQL",
        "on:",
        "  push:",
        "    branches: [main]",
        "  pull_request:",
        "    branches: [main]",
        "  schedule:",
        "    - cron: '17 4 * * 1'",
        "jobs:",
        "  analyze:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - run: echo analyze",
        ""
      ].join("\n"),
      "utf8"
    );
    const outPath = join(repo, "reports", "quality", "ci-hardening.json");
    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_ci_hardening.ts",
      args: ["--repo-root", repo, "--out", outPath],
      cwd: process.cwd()
    });
    expect(result.status).toBe(1);
    const payload = JSON.parse(readFileSync(outPath, "utf8")) as { ok: boolean; failures: string[] };
    expect(payload.ok).toBe(false);
    expect(payload.failures.join("\n")).toContain("ci.yml must include both push and pull_request triggers");
  });

  it("fails when CodeQL workflow is missing automated scanning cadence", () => {
    const repo = makeTempDir("runwright-codeql-trigger-fixture-");
    const workflows = join(repo, ".github", "workflows");
    mkdirSync(workflows, { recursive: true });
    writeFileSync(
      join(workflows, "ci.yml"),
      [
        "name: CI",
        "on:",
        "  push:",
        "    branches: [main]",
        "  pull_request:",
        "    branches: [main]",
        "jobs:",
        "  verify:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - run: pnpm verify",
        ""
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(workflows, "codeql.yml"),
      [
        "name: CodeQL",
        "on:",
        "  workflow_dispatch:",
        "jobs:",
        "  analyze:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - run: echo analyze",
        ""
      ].join("\n"),
      "utf8"
    );
    const outPath = join(repo, "reports", "quality", "ci-hardening.json");
    const result = runTsxScript({
      scriptRelativePath: "scripts/verify_ci_hardening.ts",
      args: ["--repo-root", repo, "--out", outPath],
      cwd: process.cwd()
    });
    expect(result.status).toBe(1);
    const payload = JSON.parse(readFileSync(outPath, "utf8")) as { ok: boolean; failures: string[] };
    expect(payload.ok).toBe(false);
    expect(payload.failures.join("\n")).toContain(
      "codeql.yml must include push, pull_request, and schedule triggers"
    );
  });
});
