import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildLockfileFromSources,
  computeSkillDigest,
  lockfilesEqual,
  readLockfile,
  writeLockfile
} from "../src/lockfile.js";

const tempDirs: string[] = [];
const VALID_DIGEST_A = `sha256:${"a".repeat(64)}`;
const VALID_DIGEST_B = `sha256:${"b".repeat(64)}`;
const VALID_DIGEST_C = `sha256:${"c".repeat(64)}`;

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("lockfile", () => {
  it("computes deterministic digest for skill directory", () => {
    const skillDir = makeTempDir("skillbase-lockfile-skill-");
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: digest-demo\ndescription: digest demo\n---\n`,
      "utf8"
    );
    mkdirSync(join(skillDir, "scripts"), { recursive: true });
    writeFileSync(join(skillDir, "scripts", "run.sh"), "echo hello\n", "utf8");

    const first = computeSkillDigest(skillDir);
    const second = computeSkillDigest(skillDir);
    expect(first).toBe(second);
    expect(first.startsWith("sha256:")).toBe(true);
  });

  it("changes digest when file content changes", () => {
    const skillDir = makeTempDir("skillbase-lockfile-digest-change-");
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: digest-change\ndescription: digest change\n---\n`,
      "utf8"
    );

    const before = computeSkillDigest(skillDir);
    writeFileSync(join(skillDir, "SKILL.md"), `---\nname: digest-change\ndescription: changed\n---\n`, "utf8");
    const after = computeSkillDigest(skillDir);
    expect(after).not.toBe(before);
  });

  it("changes digest when nested file content changes", () => {
    const skillDir = makeTempDir("skillbase-lockfile-nested-digest-change-");
    mkdirSync(join(skillDir, "scripts"), { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), `---\nname: nested\ndescription: nested\n---\n`, "utf8");
    writeFileSync(join(skillDir, "scripts", "run.sh"), "echo one\n", "utf8");

    const before = computeSkillDigest(skillDir);
    writeFileSync(join(skillDir, "scripts", "run.sh"), "echo two\n", "utf8");
    const after = computeSkillDigest(skillDir);
    expect(after).not.toBe(before);
  });

  it("ignores .git and node_modules contents when computing digest", () => {
    const skillDir = makeTempDir("skillbase-lockfile-ignore-digest-");
    writeFileSync(join(skillDir, "SKILL.md"), `---\nname: digest-ignore\ndescription: digest ignore\n---\n`, "utf8");

    const before = computeSkillDigest(skillDir);
    mkdirSync(join(skillDir, ".git"), { recursive: true });
    mkdirSync(join(skillDir, "node_modules"), { recursive: true });
    writeFileSync(join(skillDir, ".git", "ignored.txt"), "git metadata", "utf8");
    writeFileSync(join(skillDir, "node_modules", "ignored.txt"), "module metadata", "utf8");
    const after = computeSkillDigest(skillDir);
    expect(after).toBe(before);
  });

  it("rejects symlink entries when computing digest", () => {
    const skillDir = makeTempDir("skillbase-lockfile-symlink-");
    writeFileSync(join(skillDir, "SKILL.md"), `---\nname: symlink\ndescription: symlink\n---\n`, "utf8");
    writeFileSync(join(skillDir, "real.txt"), "real", "utf8");
    symlinkSync(join(skillDir, "real.txt"), join(skillDir, "alias.txt"));

    expect(() => computeSkillDigest(skillDir)).toThrow(/Symlinks are not allowed/);
  });

  it("writes deterministic lockfile ordering", () => {
    const lockPath = join(makeTempDir("skillbase-lockfile-order-"), "skillbase.lock.json");
    const lockfile = buildLockfileFromSources(
      [
        {
          source: "local:./skills-b",
          type: "local",
          resolvedRef: "local",
          skills: [{ name: "b-skill", digest: VALID_DIGEST_B, path: "/tmp/b" }]
        },
        {
          source: "local:./skills-a",
          type: "local",
          resolvedRef: "local",
          skills: [{ name: "a-skill", digest: VALID_DIGEST_A, path: "/tmp/a" }]
        }
      ],
      "2026-02-13T00:00:00.000Z"
    );

    writeLockfile(lockPath, lockfile);
    const raw = readFileSync(lockPath, "utf8");
    const indexA = raw.indexOf("local:./skills-a");
    const indexB = raw.indexOf("local:./skills-b");
    expect(indexA).toBeGreaterThan(-1);
    expect(indexB).toBeGreaterThan(-1);
    expect(indexA).toBeLessThan(indexB);
  });

  it("builds lockfile version 2 with integrity support", () => {
    const lockfile = buildLockfileFromSources(
      [
        {
          source: "local:./skills",
          type: "local",
          resolvedRef: "local",
          skills: [{ name: "demo", digest: VALID_DIGEST_A, path: "/tmp/demo" }]
        }
      ],
      "2026-02-13T00:00:00.000Z"
    );

    expect(lockfile.version).toBe(2);
  });

  it("round-trips read and write", () => {
    const lockPath = join(makeTempDir("skillbase-lockfile-roundtrip-"), "skillbase.lock.json");
    const lockfile = buildLockfileFromSources(
      [
        {
          source: "local:./skills",
          type: "local",
          resolvedRef: "local",
          skills: [{ name: "demo", digest: VALID_DIGEST_C, path: "/tmp/demo" }]
        }
      ],
      "2026-02-13T00:00:00.000Z"
    );

    writeLockfile(lockPath, lockfile);
    const loaded = readLockfile(lockPath);
    expect(Object.keys(lockfile.sources["local:./skills"]?.skills ?? {})).toEqual(["demo"]);
    expect(loaded).toEqual(lockfile);
  });

  it("round-trips lockfile with valid remote github and skills.sh sources", () => {
    const lockPath = join(makeTempDir("skillbase-lockfile-remote-roundtrip-"), "skillbase.lock.json");
    const lockfile = buildLockfileFromSources(
      [
        {
          source: "acme/tools",
          type: "github",
          resolvedRef: "commit",
          resolvedValue: "1a2b3c4d",
          skills: [{ name: "gh-skill", digest: VALID_DIGEST_A, path: "/tmp/gh-skill" }]
        },
        {
          source: "https://skills.sh/acme/bundle",
          type: "skills.sh",
          resolvedRef: "tag",
          resolvedValue: "v1.2.3",
          skills: [{ name: "skills-sh", digest: VALID_DIGEST_B, path: "/tmp/skills-sh" }]
        }
      ],
      "2026-02-13T00:00:00.000Z"
    );

    writeLockfile(lockPath, lockfile);
    const loaded = readLockfile(lockPath);
    expect(loaded.sources["acme/tools"]?.type).toBe("github");
    expect(loaded.sources["acme/tools"]?.resolved.ref).toBe("commit");
    expect(Object.keys(loaded.sources["acme/tools"]?.skills ?? {})).toEqual(["gh-skill"]);
    expect(loaded.sources["https://skills.sh/acme/bundle"]?.type).toBe("skills.sh");
    expect(loaded.sources["https://skills.sh/acme/bundle"]?.resolved.ref).toBe("tag");
    expect(Object.keys(loaded.sources["https://skills.sh/acme/bundle"]?.skills ?? {})).toEqual(["skills-sh"]);
  });

  it("round-trips lockfile source integrity metadata", () => {
    const lockPath = join(makeTempDir("skillbase-lockfile-trust-roundtrip-"), "skillbase.lock.json");
    const lockfile = buildLockfileFromSources(
      [
        {
          source: "acme/secure",
          type: "github",
          resolvedRef: "commit",
          resolvedValue: "deadbeef",
          integrity: {
            transportDigest: VALID_DIGEST_C,
            trusted: true,
            verifiedAt: "2026-02-15T00:00:00.000Z",
            signature: {
              keyId: "release-key",
              algorithm: "ed25519",
              value: Buffer.from("sig").toString("base64")
            }
          },
          skills: [{ name: "secure-skill", digest: VALID_DIGEST_A, path: "/tmp/secure-skill" }]
        }
      ],
      "2026-02-13T00:00:00.000Z"
    );

    writeLockfile(lockPath, lockfile);
    const loaded = readLockfile(lockPath);
    expect(loaded.sources["acme/secure"]?.integrity?.trusted).toBe(true);
    expect(loaded.sources["acme/secure"]?.integrity?.signature?.keyId).toBe("release-key");
    expect(loaded.sources["acme/secure"]?.integrity?.transportDigest).toBe(VALID_DIGEST_C);
  });

  it("rejects lockfile with invalid digest format", () => {
    const lockPath = join(makeTempDir("skillbase-lockfile-invalid-digest-"), "skillbase.lock.json");
    writeFileSync(
      lockPath,
      JSON.stringify(
        {
          version: 1,
          generatedAt: "2026-02-13T00:00:00.000Z",
          sources: {
            "local:./skills": {
              type: "local",
              resolved: { ref: "local", value: "local" },
              skills: {
                demo: { digest: "sha256:not-valid", path: "/tmp/demo" }
              }
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    expect(() => readLockfile(lockPath)).toThrow();
  });

  it("rejects lockfile with relative skill path", () => {
    const lockPath = join(makeTempDir("skillbase-lockfile-relative-path-"), "skillbase.lock.json");
    writeFileSync(
      lockPath,
      JSON.stringify(
        {
          version: 1,
          generatedAt: "2026-02-13T00:00:00.000Z",
          sources: {
            "local:./skills": {
              type: "local",
              resolved: { ref: "local", value: "local" },
              skills: {
                demo: { digest: VALID_DIGEST_A, path: "relative/path" }
              }
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    expect(() => readLockfile(lockPath)).toThrow();
  });

  it("rejects missing lockfile path with explicit error", () => {
    const missing = join(makeTempDir("skillbase-lockfile-missing-"), "missing.lock.json");
    expect(() => readLockfile(missing)).toThrow(/Lockfile not found/);
  });

  it("compares lockfiles by canonical structure", () => {
    const left = {
      version: 1,
      generatedAt: "2026-02-13T00:00:00.000Z",
      sources: {
        "local:./skills": {
          type: "local",
          resolved: { ref: "local", value: "local" },
          skills: {
            b: { digest: VALID_DIGEST_B, path: "/tmp/b" },
            a: { digest: VALID_DIGEST_A, path: "/tmp/a" }
          }
        }
      }
    } as const;

    const right = {
      version: 1,
      generatedAt: "2026-02-13T00:00:00.000Z",
      sources: {
        "local:./skills": {
          skills: {
            a: { path: "/tmp/a", digest: VALID_DIGEST_A },
            b: { path: "/tmp/b", digest: VALID_DIGEST_B }
          },
          resolved: { value: "local", ref: "local" },
          type: "local"
        }
      }
    } as const;

    const different = {
      ...right,
      sources: {
        ...right.sources,
        "local:./skills": {
          ...right.sources["local:./skills"],
          skills: {
            ...right.sources["local:./skills"].skills,
            b: { path: "/tmp/b", digest: VALID_DIGEST_C }
          }
        }
      }
    } as const;

    expect(lockfilesEqual(left, right)).toBe(true);
    expect(lockfilesEqual(left, different)).toBe(false);
  });

  it("rejects malformed lockfile schema corpus", () => {
    const base = {
      version: 1,
      generatedAt: "2026-02-13T00:00:00.000Z",
      sources: {
        "local:./skills": {
          type: "local",
          resolved: { ref: "local", value: "local" },
          skills: {
            demo: { digest: VALID_DIGEST_A, path: "/tmp/demo" }
          }
        }
      }
    };
    const cases: Array<{ name: string; doc: unknown }> = [
      {
        name: "invalid generatedAt",
        doc: { ...base, generatedAt: "not-a-timestamp" }
      },
      {
        name: "empty resolved value",
        doc: {
          ...base,
          sources: {
            "local:./skills": {
              ...base.sources["local:./skills"],
              resolved: { ref: "local", value: "" }
            }
          }
        }
      },
      {
        name: "relative path",
        doc: {
          ...base,
          sources: {
            "local:./skills": {
              ...base.sources["local:./skills"],
              skills: {
                demo: { digest: VALID_DIGEST_A, path: "./tmp/demo" }
              }
            }
          }
        }
      },
      {
        name: "extra skill key",
        doc: {
          ...base,
          sources: {
            "local:./skills": {
              ...base.sources["local:./skills"],
              skills: {
                demo: { digest: VALID_DIGEST_A, path: "/tmp/demo", extra: true }
              }
            }
          }
        }
      },
      {
        name: "local source with non-local ref",
        doc: {
          ...base,
          sources: {
            "local:./skills": {
              ...base.sources["local:./skills"],
              resolved: { ref: "commit", value: "abc1234" }
            }
          }
        }
      },
      {
        name: "github source with local ref",
        doc: {
          ...base,
          sources: {
            "local:./skills": {
              type: "github",
              resolved: { ref: "local", value: "local" },
              skills: {
                demo: { digest: VALID_DIGEST_A, path: "/tmp/demo" }
              }
            }
          }
        }
      },
      {
        name: "unsupported source key format",
        doc: {
          ...base,
          sources: {
            "https://evil.example/acme/repo": {
              type: "github",
              resolved: { ref: "commit", value: "abc1234" },
              skills: {
                demo: { digest: VALID_DIGEST_A, path: "/tmp/demo" }
              }
            }
          }
        }
      },
      {
        name: "github source with local ref",
        doc: {
          ...base,
          sources: {
            "acme/tools": {
              type: "github",
              resolved: { ref: "local", value: "local" },
              skills: {
                demo: { digest: VALID_DIGEST_A, path: "/tmp/demo" }
              }
            }
          }
        }
      },
      {
        name: "github key with wrong source type",
        doc: {
          ...base,
          sources: {
            "acme/tools": {
              type: "skills.sh",
              resolved: { ref: "commit", value: "abc1234" },
              skills: {
                demo: { digest: VALID_DIGEST_A, path: "/tmp/demo" }
              }
            }
          }
        }
      },
      {
        name: "skills.sh key with wrong source type",
        doc: {
          ...base,
          sources: {
            "https://skills.sh/acme/bundle": {
              type: "github",
              resolved: { ref: "commit", value: "abc1234" },
              skills: {
                demo: { digest: VALID_DIGEST_A, path: "/tmp/demo" }
              }
            }
          }
        }
      },
      {
        name: "source key and source type mismatch",
        doc: {
          ...base,
          sources: {
            "local:./skills": {
              type: "github",
              resolved: { ref: "commit", value: "abc1234" },
              skills: {
                demo: { digest: VALID_DIGEST_A, path: "/tmp/demo" }
              }
            }
          }
        }
      },
      {
        name: "local source key with empty path",
        doc: {
          ...base,
          sources: {
            "local:": {
              type: "local",
              resolved: { ref: "local", value: "local" },
              skills: {
                demo: { digest: VALID_DIGEST_A, path: "/tmp/demo" }
              }
            }
          }
        }
      }
    ];

    for (const sample of cases) {
      const lockPath = join(makeTempDir(`skillbase-lockfile-corpus-${sample.name.replaceAll(" ", "-")}-`), "skillbase.lock.json");
      writeFileSync(lockPath, `${JSON.stringify(sample.doc, null, 2)}\n`, "utf8");
      expect(() => readLockfile(lockPath)).toThrow();
    }
  });
});
