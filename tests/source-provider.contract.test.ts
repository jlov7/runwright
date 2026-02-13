import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseManifest } from "../src/manifest.js";
import { resolveSkillUnits, type RemoteResolution } from "../src/resolver.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createValidRemoteRoot(projectDir: string): string {
  const root = join(projectDir, ".skillbase", "store", "sources", "github", "acme", "repo", "sha-live");
  mkdirSync(join(root, "safe"), { recursive: true });
  writeFileSync(join(root, "safe", "SKILL.md"), "---\nname: safe\ndescription: safe\n---\n", "utf8");
  return root;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("source-provider contract harness", () => {
  it("accepts a valid remote provider response", () => {
    const projectDir = makeTempDir("skillbase-source-provider-valid-");
    const remoteRoot = createValidRemoteRoot(projectDir);
    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: acme/repo\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    const result = resolveSkillUnits(manifest, projectDir, {
      remoteResolver: () => ({
        rootPath: remoteRoot,
        type: "github",
        resolvedRef: "commit",
        resolvedValue: "sha-live"
      })
    });

    expect(result.units.map((unit) => unit.skillName)).toEqual(["safe"]);
    expect(result.sourceMetadata["acme/repo"]?.resolvedValue).toBe("sha-live");
  });

  it("rejects invalid remote provider responses", () => {
    const projectDir = makeTempDir("skillbase-source-provider-invalid-");
    const remoteRoot = createValidRemoteRoot(projectDir);
    const outsideRoot = join(projectDir, "outside");
    mkdirSync(join(outsideRoot, "poison"), { recursive: true });
    writeFileSync(join(outsideRoot, "poison", "SKILL.md"), "---\nname: poison\ndescription: poison\n---\n", "utf8");

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: acme/repo\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    const invalidCases: Array<{ name: string; resolution: RemoteResolution; expected: RegExp }> = [
      {
        name: "invalid ref",
        resolution: {
          rootPath: remoteRoot,
          type: "github",
          resolvedRef: "local",
          resolvedValue: "sha-live"
        } as unknown as RemoteResolution,
        expected: /invalid/
      },
      {
        name: "empty resolved value",
        resolution: {
          rootPath: remoteRoot,
          type: "github",
          resolvedRef: "commit",
          resolvedValue: ""
        },
        expected: /revision is invalid/
      },
      {
        name: "invalid forced pick",
        resolution: {
          rootPath: remoteRoot,
          type: "github",
          resolvedRef: "commit",
          resolvedValue: "sha-live",
          forcedPick: ""
        },
        expected: /forced pick is invalid/
      },
      {
        name: "outside managed store",
        resolution: {
          rootPath: outsideRoot,
          type: "github",
          resolvedRef: "commit",
          resolvedValue: "sha-live"
        },
        expected: /outside managed store/
      },
      {
        name: "type mismatch",
        resolution: {
          rootPath: remoteRoot,
          type: "skills.sh",
          resolvedRef: "commit",
          resolvedValue: "sha-live"
        },
        expected: /type mismatch/
      },
      {
        name: "missing path",
        resolution: {
          rootPath: join(projectDir, ".skillbase", "store", "sources", "github", "acme", "repo", "missing"),
          type: "github",
          resolvedRef: "commit",
          resolvedValue: "sha-live"
        },
        expected: /does not exist/
      }
    ];

    for (const invalidCase of invalidCases) {
      expect(() =>
        resolveSkillUnits(manifest, projectDir, {
          remoteResolver: () => invalidCase.resolution,
          refreshSources: true
        })
      ).toThrow(invalidCase.expected);
    }
  });
});
