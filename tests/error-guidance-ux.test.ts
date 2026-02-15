import { createHash } from "node:crypto";
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

function cacheFilenameForSource(source: string): string {
  const sanitized = source.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "source";
  const digest = createHash("sha256").update(source).digest("hex").slice(0, 16);
  return `${sanitized}-${digest}.json`;
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
    expect(result.stderr).toContain("runwright journey");
  });

  it("returns nonzero and suggests nearest command for unknown --help topics", () => {
    const projectDir = makeTempDir("skillbase-ux-unknown-help-");
    const result = runCli(["updat", "--help"], projectDir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Unknown help topic: updat");
    expect(result.stdout).toContain("Did you mean: runwright help update");
    expect(result.stdout).toContain("Run `runwright help` to list supported commands.");
  });

  it("includes a recovery next step for missing manifest errors", () => {
    const projectDir = makeTempDir("skillbase-ux-missing-manifest-");
    const result = runCli(["scan"], projectDir);
    expect(result.status).toBe(10);
    expect(result.stderr).toContain("No runwright.yml/runwright.json found");
    expect(result.stderr).toContain("Next:");
    expect(result.stderr).toContain("runwright init");
    expect(result.stderr).toContain("runwright journey");
    expect(result.stderr).toContain("Help:");
    expect(result.stderr).toContain("docs/help/troubleshooting.md");
  });

  it("validates semantic apply flags before manifest loading", () => {
    const projectDir = makeTempDir("skillbase-ux-semantic-flags-");
    const result = runCli(["apply", "--scan-security", "severe"], projectDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid security mode: severe");
    expect(result.stderr).toContain("runwright apply --help");
    expect(result.stderr).not.toContain("No runwright.yml/runwright.json found");
  });

  it("renders lockfile failure guidance in text mode without success copy", () => {
    const projectDir = makeTempDir("skillbase-ux-lockfile-text-");
    expect(runCli(["init"], projectDir).status).toBe(0);
    mkdirSync(join(projectDir, "skills", "safe"), { recursive: true });
    writeFileSync(
      join(projectDir, "skills", "safe", "SKILL.md"),
      `---\nname: safe\ndescription: safe skill\n---\n\n# Safe\n`,
      "utf8"
    );

    const result = runCli(["apply", "--frozen-lockfile"], projectDir);
    expect(result.status).toBe(11);
    expect(result.stdout).toContain("Apply Failed");
    expect(result.stdout).toContain("No skillbase.lock.json found for frozen mode.");
    expect(result.stdout).not.toContain("Confirm target paths and installed skills");
  });

  it("renders human-readable verify-bundle failures without requiring --json", () => {
    const projectDir = makeTempDir("skillbase-ux-verify-text-");
    const result = runCli(["verify-bundle"], projectDir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Bundle Verification Failed");
    expect(result.stdout).toContain("Code: missing-bundle");
    expect(result.stdout).toContain("runwright verify-bundle --bundle <bundle.zip> --json");
  });

  it("surfaces trust verification failures with recovery guidance", () => {
    const projectDir = makeTempDir("skillbase-ux-trust-");
    const source = "acme/repo";
    const sha = "abc123";
    const sourceRoot = join(
      projectDir,
      ".skillbase",
      "store",
      "sources",
      "github",
      "acme",
      "repo",
      sha
    );
    const skillDir = join(sourceRoot, "safe");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), `---\nname: safe\ndescription: safe\n---\n`, "utf8");

    const cacheRoot = join(projectDir, ".skillbase", "store", "source-cache");
    mkdirSync(cacheRoot, { recursive: true });
    const cachePath = join(cacheRoot, cacheFilenameForSource(source));
    writeFileSync(
      cachePath,
      JSON.stringify({
        fetchedAt: new Date().toISOString(),
        resolution: {
          rootPath: sourceRoot,
          type: "github",
          resolvedRef: "commit",
          resolvedValue: sha
        }
      }),
      "utf8"
    );

    writeFileSync(
      join(projectDir, "runwright.yml"),
      [
        "version: 1",
        "defaults:",
        "  trust:",
        "    mode: required",
        "skillsets:",
        "  base:",
        "    skills:",
        "      - source: acme/repo",
        "apply:",
        "  useSkillsets: [base]",
        ""
      ].join("\n"),
      "utf8"
    );

    const result = runCli(["scan"], projectDir);
    expect(result.status).toBe(12);
    expect(result.stderr).toContain("Trust verification failed for acme/repo");
    expect(result.stderr).toContain("Next:");
    expect(result.stderr).toContain("defaults.trust");
    expect(result.stderr).toContain("runwright scan --refresh-sources");
  });
});
