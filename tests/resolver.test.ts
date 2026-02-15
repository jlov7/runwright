import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign as signData } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { parseManifest } from "../src/manifest.js";
import { resolveSkillUnits } from "../src/resolver.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function remoteStoreRoot(
  projectDir: string,
  type: "github" | "skills.sh",
  owner: string,
  repo: string,
  rev: string
): string {
  return join(projectDir, ".skillbase", "store", "sources", type, owner, repo, rev);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("resolver", () => {
  it("resolves local skills from manifest", () => {
    const projectDir = makeTempDir("skillbase-resolver-local-");
    mkdirSync(join(projectDir, "skills", "alpha"), { recursive: true });
    mkdirSync(join(projectDir, "skills", "beta"), { recursive: true });
    writeFileSync(join(projectDir, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: a\n---\n", "utf8");
    writeFileSync(join(projectDir, "skills", "beta", "SKILL.md"), "---\nname: beta\ndescription: b\n---\n", "utf8");

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    const result = resolveSkillUnits(manifest, projectDir);
    expect(result.units.map((unit) => unit.skillName).sort()).toEqual(["alpha", "beta"]);
    expect(result.sourceMetadata["local:./skills"]?.type).toBe("local");
  });

  it("resolves remote github source via injected resolver", () => {
    const projectDir = makeTempDir("skillbase-resolver-remote-");
    const remoteRoot = remoteStoreRoot(projectDir, "github", "acme", "repo", "abc123");
    mkdirSync(join(remoteRoot, "skill-a"), { recursive: true });
    mkdirSync(join(remoteRoot, "skill-b"), { recursive: true });
    writeFileSync(join(remoteRoot, "skill-a", "SKILL.md"), "---\nname: skill-a\ndescription: a\n---\n", "utf8");
    writeFileSync(join(remoteRoot, "skill-b", "SKILL.md"), "---\nname: skill-b\ndescription: b\n---\n", "utf8");

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: acme/repo\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    const result = resolveSkillUnits(manifest, projectDir, {
      remoteResolver: () => ({
        rootPath: remoteRoot,
        type: "github",
        resolvedRef: "commit",
        resolvedValue: "abc123"
      })
    });

    expect(result.units.map((unit) => unit.skillName).sort()).toEqual(["skill-a", "skill-b"]);
    expect(result.sourceMetadata["acme/repo"]).toEqual({
      type: "github",
      resolvedRef: "commit",
      resolvedValue: "abc123"
    });
  });

  it("fails required trust verification when remote signature is missing", () => {
    const projectDir = makeTempDir("skillbase-resolver-required-trust-");
    const remoteRoot = remoteStoreRoot(projectDir, "github", "acme", "repo", "abc123");
    mkdirSync(join(remoteRoot, "skill-a"), { recursive: true });
    writeFileSync(join(remoteRoot, "skill-a", "SKILL.md"), "---\nname: skill-a\ndescription: a\n---\n", "utf8");

    const manifest = parseManifest(
      [
        "version: 1",
        "defaults:",
        "  trust:",
        "    mode: required",
        "    keys:",
        "      - id: release-key",
        "        algorithm: ed25519",
        "        publicKey: fake",
        "skillsets:",
        "  base:",
        "    skills:",
        "      - source: acme/repo",
        "apply:",
        "  useSkillsets: [base]",
        ""
      ].join("\n"),
      { filename: "runwright.yml" }
    );

    expect(() =>
      resolveSkillUnits(manifest, projectDir, {
        remoteResolver: () => ({
          rootPath: remoteRoot,
          type: "github",
          resolvedRef: "commit",
          resolvedValue: "abc123"
        })
      })
    ).toThrow(/signature/i);
  });

  it("marks remote source trusted when signature verifies", () => {
    const projectDir = makeTempDir("skillbase-resolver-trusted-");
    const remoteRoot = remoteStoreRoot(projectDir, "github", "acme", "repo", "trusted-sha");
    mkdirSync(join(remoteRoot, "skill-a"), { recursive: true });
    writeFileSync(join(remoteRoot, "skill-a", "SKILL.md"), "---\nname: skill-a\ndescription: a\n---\n", "utf8");

    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const transportDigest = "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const signature = signData(null, Buffer.from(transportDigest, "utf8"), privateKey).toString("base64");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

    const manifest = parseManifest(
      [
        "version: 1",
        "defaults:",
        "  trust:",
        "    mode: required",
        "    keys:",
        "      - id: release-key",
        "        algorithm: ed25519",
        "        publicKey: |",
        ...publicKeyPem
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => `          ${line}`),
        "    rules:",
        "      - source: acme/repo",
        "        requiredSignatures: 1",
        "        keyIds: [release-key]",
        "skillsets:",
        "  base:",
        "    skills:",
        "      - source: acme/repo",
        "apply:",
        "  useSkillsets: [base]",
        ""
      ].join("\n"),
      { filename: "runwright.yml" }
    );

    const result = resolveSkillUnits(manifest, projectDir, {
      remoteResolver: () => ({
        rootPath: remoteRoot,
        type: "github",
        resolvedRef: "commit",
        resolvedValue: "trusted-sha",
        transportDigest,
        signature: {
          keyId: "release-key",
          algorithm: "ed25519",
          value: signature
        }
      })
    });

    expect(result.sourceMetadata["acme/repo"]?.integrity?.trusted).toBe(true);
    expect(result.sourceMetadata["acme/repo"]?.integrity?.signature?.keyId).toBe("release-key");
  });

  it("uses forced pick from remote resolver when manifest pick is absent", () => {
    const projectDir = makeTempDir("skillbase-resolver-forced-pick-");
    const remoteRoot = remoteStoreRoot(projectDir, "skills.sh", "acme", "repo", "def456");
    mkdirSync(join(remoteRoot, "target-skill"), { recursive: true });
    mkdirSync(join(remoteRoot, "other-skill"), { recursive: true });
    writeFileSync(
      join(remoteRoot, "target-skill", "SKILL.md"),
      "---\nname: target\ndescription: target\n---\n",
      "utf8"
    );
    writeFileSync(
      join(remoteRoot, "other-skill", "SKILL.md"),
      "---\nname: other\ndescription: other\n---\n",
      "utf8"
    );

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: https://skills.sh/acme/repo/target-skill\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    const result = resolveSkillUnits(manifest, projectDir, {
      remoteResolver: () => ({
        rootPath: remoteRoot,
        type: "skills.sh",
        resolvedRef: "commit",
        resolvedValue: "def456",
        forcedPick: "target-skill"
      })
    });

    expect(result.units.map((unit) => unit.skillName)).toEqual(["target-skill"]);
    expect(result.sourceMetadata["https://skills.sh/acme/repo/target-skill"]?.type).toBe("skills.sh");
  });

  it("uses cached remote resolution when ttl has not expired", () => {
    const projectDir = makeTempDir("skillbase-resolver-cache-");
    const remoteRoot = remoteStoreRoot(projectDir, "github", "acme", "repo", "abc123");
    mkdirSync(join(remoteRoot, "skill-a"), { recursive: true });
    writeFileSync(join(remoteRoot, "skill-a", "SKILL.md"), "---\nname: skill-a\ndescription: a\n---\n", "utf8");

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: acme/repo\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    let calls = 0;
    const remoteResolver = () => {
      calls += 1;
      return {
        rootPath: remoteRoot,
        type: "github" as const,
        resolvedRef: "commit" as const,
        resolvedValue: "abc123"
      };
    };

    const first = resolveSkillUnits(manifest, projectDir, {
      remoteResolver,
      remoteCacheTtlSeconds: 3600
    });
    const second = resolveSkillUnits(manifest, projectDir, {
      remoteResolver,
      remoteCacheTtlSeconds: 3600
    });

    expect(first.units).toHaveLength(1);
    expect(second.units).toHaveLength(1);
    expect(calls).toBe(1);
  });

  it("refresh-sources bypasses cache and re-resolves remotes", () => {
    const projectDir = makeTempDir("skillbase-resolver-refresh-");
    const remoteRoot = remoteStoreRoot(projectDir, "github", "acme", "repo", "live");
    mkdirSync(join(remoteRoot, "skill-a"), { recursive: true });
    writeFileSync(join(remoteRoot, "skill-a", "SKILL.md"), "---\nname: skill-a\ndescription: a\n---\n", "utf8");

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: acme/repo\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    let calls = 0;
    const remoteResolver = () => {
      calls += 1;
      return {
        rootPath: remoteRoot,
        type: "github" as const,
        resolvedRef: "commit" as const,
        resolvedValue: calls === 1 ? "abc123" : "def456"
      };
    };

    resolveSkillUnits(manifest, projectDir, {
      remoteResolver,
      remoteCacheTtlSeconds: 3600
    });
    const refreshed = resolveSkillUnits(manifest, projectDir, {
      remoteResolver,
      refreshSources: true,
      remoteCacheTtlSeconds: 3600
    });

    expect(calls).toBe(2);
    expect(refreshed.sourceMetadata["acme/repo"]?.resolvedValue).toBe("def456");
  });

  it("cache ttl expiration triggers remote re-resolution", () => {
    const projectDir = makeTempDir("skillbase-resolver-ttl-expired-");
    const remoteRoot = remoteStoreRoot(projectDir, "github", "acme", "repo", "live");
    mkdirSync(join(remoteRoot, "skill-a"), { recursive: true });
    writeFileSync(join(remoteRoot, "skill-a", "SKILL.md"), "---\nname: skill-a\ndescription: a\n---\n", "utf8");

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: acme/repo\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    let calls = 0;
    const remoteResolver = () => {
      calls += 1;
      return {
        rootPath: remoteRoot,
        type: "github" as const,
        resolvedRef: "commit" as const,
        resolvedValue: calls === 1 ? "abc123" : "def456"
      };
    };

    resolveSkillUnits(manifest, projectDir, { remoteResolver, remoteCacheTtlSeconds: 0 });
    const second = resolveSkillUnits(manifest, projectDir, { remoteResolver, remoteCacheTtlSeconds: 0 });

    expect(calls).toBe(2);
    expect(second.sourceMetadata["acme/repo"]?.resolvedValue).toBe("def456");
  });

  it("uses collision-resistant cache keys for distinct long sources", () => {
    const projectDir = makeTempDir("skillbase-resolver-cache-collision-");
    const longPrefix = "a".repeat(190);
    const sourceA = `${longPrefix}x/repo`;
    const sourceB = `${longPrefix}y/repo`;
    const remoteRootA = remoteStoreRoot(projectDir, "github", `${longPrefix}x`, "repo", "sha-a");
    const remoteRootB = remoteStoreRoot(projectDir, "github", `${longPrefix}y`, "repo", "sha-b");
    mkdirSync(join(remoteRootA, "skill-a"), { recursive: true });
    mkdirSync(join(remoteRootB, "skill-b"), { recursive: true });
    writeFileSync(join(remoteRootA, "skill-a", "SKILL.md"), "---\nname: skill-a\ndescription: a\n---\n", "utf8");
    writeFileSync(join(remoteRootB, "skill-b", "SKILL.md"), "---\nname: skill-b\ndescription: b\n---\n", "utf8");
    const manifest = parseManifest(
      `version: 1\nskillsets:\n  base:\n    skills:\n      - source: ${sourceA}\n      - source: ${sourceB}\napply:\n  useSkillsets: [base]\n`,
      { filename: "skillbase.yml" }
    );

    let calls = 0;
    const resolverMap = new Map([
      [
        sourceA,
        {
          rootPath: remoteRootA,
          type: "github" as const,
          resolvedRef: "commit" as const,
          resolvedValue: "sha-a"
        }
      ],
      [
        sourceB,
        {
          rootPath: remoteRootB,
          type: "github" as const,
          resolvedRef: "commit" as const,
          resolvedValue: "sha-b"
        }
      ]
    ]);

    const remoteResolver = (source: string) => {
      calls += 1;
      const resolved = resolverMap.get(source);
      if (!resolved) throw new Error(`unexpected source: ${source}`);
      return resolved;
    };

    const first = resolveSkillUnits(manifest, projectDir, {
      remoteResolver,
      remoteCacheTtlSeconds: 3600
    });
    const second = resolveSkillUnits(manifest, projectDir, {
      remoteResolver,
      remoteCacheTtlSeconds: 3600
    });

    expect(first.units.map((unit) => unit.skillName).sort()).toEqual(["skill-a", "skill-b"]);
    expect(first.sourceMetadata[sourceA]?.resolvedValue).toBe("sha-a");
    expect(first.sourceMetadata[sourceB]?.resolvedValue).toBe("sha-b");
    expect(second.sourceMetadata[sourceA]?.resolvedValue).toBe("sha-a");
    expect(second.sourceMetadata[sourceB]?.resolvedValue).toBe("sha-b");
    expect(calls).toBe(2);
  });

  it("rejects poisoned cache entries whose root path escapes managed store", () => {
    const projectDir = makeTempDir("skillbase-resolver-cache-poison-");
    const trustedRoot = remoteStoreRoot(projectDir, "github", "acme", "repo", "trusted");
    const poisonedRoot = join(projectDir, "poisoned");
    mkdirSync(join(trustedRoot, "skill-safe"), { recursive: true });
    mkdirSync(join(poisonedRoot, "skill-poison"), { recursive: true });
    writeFileSync(join(trustedRoot, "skill-safe", "SKILL.md"), "---\nname: safe\ndescription: safe\n---\n", "utf8");
    writeFileSync(
      join(poisonedRoot, "skill-poison", "SKILL.md"),
      "---\nname: poison\ndescription: poison\n---\n",
      "utf8"
    );

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: acme/repo\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    let calls = 0;
    const remoteResolver = () => {
      calls += 1;
      return {
        rootPath: trustedRoot,
        type: "github" as const,
        resolvedRef: "commit" as const,
        resolvedValue: "trusted"
      };
    };

    const first = resolveSkillUnits(manifest, projectDir, { remoteResolver, remoteCacheTtlSeconds: 3600 });
    expect(first.units.map((unit) => unit.skillName)).toEqual(["skill-safe"]);
    expect(calls).toBe(1);

    const cacheDir = join(projectDir, ".skillbase", "store", "source-cache");
    const cacheFiles = readdirSync(cacheDir).filter((name) => name.endsWith(".json"));
    expect(cacheFiles.length).toBe(1);
    const cachePath = join(cacheDir, cacheFiles[0]!);
    const cached = JSON.parse(readFileSync(cachePath, "utf8"));
    cached.resolution.rootPath = poisonedRoot;
    writeFileSync(cachePath, `${JSON.stringify(cached, null, 2)}\n`, "utf8");

    const second = resolveSkillUnits(manifest, projectDir, { remoteResolver, remoteCacheTtlSeconds: 3600 });
    expect(second.units.map((unit) => unit.skillName)).toEqual(["skill-safe"]);
    expect(calls).toBe(2);
  });

  it("rejects pick paths that escape source root", () => {
    const projectDir = makeTempDir("skillbase-resolver-pick-escape-");
    mkdirSync(join(projectDir, "skills", "safe"), { recursive: true });
    mkdirSync(join(projectDir, "outside", "escaped"), { recursive: true });
    writeFileSync(join(projectDir, "skills", "safe", "SKILL.md"), "---\nname: safe\ndescription: safe\n---\n", "utf8");
    writeFileSync(
      join(projectDir, "outside", "escaped", "SKILL.md"),
      "---\nname: escaped\ndescription: escaped\n---\n",
      "utf8"
    );

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\n        pick: [../outside/escaped]\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    expect(() => resolveSkillUnits(manifest, projectDir)).toThrow(/escapes source root/);
  });

  it("rejects pick paths that resolve outside source root via symlink", () => {
    const projectDir = makeTempDir("skillbase-resolver-pick-symlink-escape-");
    mkdirSync(join(projectDir, "skills", "safe"), { recursive: true });
    mkdirSync(join(projectDir, "outside", "escaped"), { recursive: true });
    writeFileSync(join(projectDir, "skills", "safe", "SKILL.md"), "---\nname: safe\ndescription: safe\n---\n", "utf8");
    writeFileSync(
      join(projectDir, "outside", "escaped", "SKILL.md"),
      "---\nname: escaped\ndescription: escaped\n---\n",
      "utf8"
    );
    symlinkSync(join(projectDir, "outside", "escaped"), join(projectDir, "skills", "linked"), "dir");

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\n        pick: [linked]\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    expect(() => resolveSkillUnits(manifest, projectDir)).toThrow(/escapes source root/);
  });

  it("rejects ambiguous pick basenames that match multiple skills", () => {
    const projectDir = makeTempDir("skillbase-resolver-pick-ambiguous-basename-");
    mkdirSync(join(projectDir, "skills", "group-a", "common"), { recursive: true });
    mkdirSync(join(projectDir, "skills", "group-b", "common"), { recursive: true });
    writeFileSync(
      join(projectDir, "skills", "group-a", "common", "SKILL.md"),
      "---\nname: common-a\ndescription: common A\n---\n",
      "utf8"
    );
    writeFileSync(
      join(projectDir, "skills", "group-b", "common", "SKILL.md"),
      "---\nname: common-b\ndescription: common B\n---\n",
      "utf8"
    );

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\n        pick: [common]\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    expect(() => resolveSkillUnits(manifest, projectDir)).toThrow(/ambiguous/i);
  });

  it("rejects cache entries whose root path is a symlink escaping managed store", () => {
    const projectDir = makeTempDir("skillbase-resolver-cache-poison-symlink-");
    const trustedRoot = remoteStoreRoot(projectDir, "github", "acme", "repo", "trusted");
    const poisonedRoot = join(projectDir, "poisoned");
    mkdirSync(join(trustedRoot, "skill-safe"), { recursive: true });
    mkdirSync(join(poisonedRoot, "skill-poison"), { recursive: true });
    writeFileSync(join(trustedRoot, "skill-safe", "SKILL.md"), "---\nname: safe\ndescription: safe\n---\n", "utf8");
    writeFileSync(
      join(poisonedRoot, "skill-poison", "SKILL.md"),
      "---\nname: poison\ndescription: poison\n---\n",
      "utf8"
    );

    const symlinkedRoot = remoteStoreRoot(projectDir, "github", "acme", "repo", "linked");
    symlinkSync(poisonedRoot, symlinkedRoot, "dir");

    const manifest = parseManifest(
      "version: 1\nskillsets:\n  base:\n    skills:\n      - source: acme/repo\napply:\n  useSkillsets: [base]\n",
      { filename: "skillbase.yml" }
    );

    let calls = 0;
    const remoteResolver = () => {
      calls += 1;
      return {
        rootPath: trustedRoot,
        type: "github" as const,
        resolvedRef: "commit" as const,
        resolvedValue: "trusted"
      };
    };

    const first = resolveSkillUnits(manifest, projectDir, { remoteResolver, remoteCacheTtlSeconds: 3600 });
    expect(first.units.map((unit) => unit.skillName)).toEqual(["skill-safe"]);
    expect(calls).toBe(1);

    const cacheDir = join(projectDir, ".skillbase", "store", "source-cache");
    const cacheFiles = readdirSync(cacheDir).filter((name) => name.endsWith(".json"));
    expect(cacheFiles.length).toBe(1);
    const cachePath = join(cacheDir, cacheFiles[0]!);
    const cached = JSON.parse(readFileSync(cachePath, "utf8"));
    cached.resolution.rootPath = symlinkedRoot;
    writeFileSync(cachePath, `${JSON.stringify(cached, null, 2)}\n`, "utf8");

    const second = resolveSkillUnits(manifest, projectDir, { remoteResolver, remoteCacheTtlSeconds: 3600 });
    expect(second.units.map((unit) => unit.skillName)).toEqual(["skill-safe"]);
    expect(calls).toBe(2);
  });
});
