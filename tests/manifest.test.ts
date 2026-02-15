import { describe, it, expect } from "vitest";
import { parseManifest } from "../src/manifest.js";

describe("manifest", () => {
  it("parses minimal yaml", () => {
    const m = parseManifest("version: 1\n", { filename: "skillbase.yml" });
    expect(m.version).toBe(1);
  });

  it("rejects wrong version type", () => {
    expect(() => parseManifest("version: nope\n", { filename: "skillbase.yml" })).toThrow();
  });

  it("rejects unsupported manifest version", () => {
    expect(() => parseManifest("version: 2\n", { filename: "skillbase.yml" })).toThrow(
      /version/
    );
  });

  it("rejects invalid source format", () => {
    const raw = `
version: 1
skillsets:
  base:
    skills:
      - source: "not a source"
apply:
  useSkillsets: [base]
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/source/);
  });

  it("rejects unknown skillset references in apply.useSkillsets", () => {
    const raw = `
version: 1
skillsets:
  base:
    skills:
      - source: local:./skills/example
apply:
  useSkillsets: [base, missing]
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/missing/);
  });

  it("accepts allowed source formats", () => {
    const raw = `
version: 1
skillsets:
  base:
    skills:
      - source: local:./skills/example
      - source: local:/absolute/path
      - source: owner/repo
      - source: https://skills.sh/owner/repo
apply:
  useSkillsets: [base]
`;
    const parsed = parseManifest(raw, { filename: "skillbase.yml" });
    expect(parsed.skillsets?.base.skills).toHaveLength(4);
  });

  it("rejects empty local source path values", () => {
    const raw = `
version: 1
skillsets:
  base:
    skills:
      - source: local:
apply:
  useSkillsets: [base]
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/source/);
  });

  it("rejects whitespace-only local source path values", () => {
    const raw = `
version: 1
skillsets:
  base:
    skills:
      - source: "local:    "
apply:
  useSkillsets: [base]
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/source/);
  });

  it("rejects unknown top-level keys", () => {
    const raw = `
version: 1
defaults:
  mode: link
typoTopLevel: true
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow();
  });

  it("rejects unknown nested keys in defaults/targets", () => {
    const raw = `
version: 1
defaults:
  mode: link
  typoDefault: nope
targets:
  codex:
    enabled: true
    typoTarget: true
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow();
  });

  it("rejects unknown target names in targets map", () => {
    const raw = `
version: 1
targets:
  codex:
    enabled: true
  codx:
    enabled: true
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/targets/);
  });

  it("rejects duplicate apply.useSkillsets entries", () => {
    const raw = `
version: 1
skillsets:
  base:
    skills:
      - source: local:./skills
apply:
  useSkillsets: [base, base]
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/useSkillsets/);
  });

  it("rejects invalid defaults.scan.allowRuleIds entries", () => {
    const raw = `
version: 1
defaults:
  scan:
    allowRuleIds: [not-a-rule]
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/allowRuleIds/);
  });

  it("rejects duplicate defaults.scan.allowRuleIds entries", () => {
    const raw = `
version: 1
defaults:
  scan:
    allowRuleIds: [remote-shell-curl-pipe, remote-shell-curl-pipe]
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/allowRuleIds/);
  });

  it("accepts unique defaults.scan.allowRuleIds entries", () => {
    const raw = `
version: 1
defaults:
  scan:
    allowRuleIds: [remote-shell-curl-pipe, env-dump-printenv]
`;
    const manifest = parseManifest(raw, { filename: "skillbase.yml" });
    expect(manifest.defaults?.scan?.allowRuleIds).toEqual([
      "remote-shell-curl-pipe",
      "env-dump-printenv"
    ]);
  });

  it("accepts defaults.trust with keys and source rules", () => {
    const raw = `
version: 1
defaults:
  trust:
    mode: required
    keys:
      - id: release-key
        algorithm: ed25519
        publicKey: |
          -----BEGIN PUBLIC KEY-----
          MCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
          -----END PUBLIC KEY-----
    rules:
      - source: acme/repo
        requiredSignatures: 1
        keyIds: [release-key]
skillsets:
  base:
    skills:
      - source: acme/repo
apply:
  useSkillsets: [base]
`;
    const manifest = parseManifest(raw, { filename: "runwright.yml" });
    expect(manifest.defaults?.trust?.mode).toBe("required");
    expect(manifest.defaults?.trust?.keys?.[0]?.id).toBe("release-key");
    expect(manifest.defaults?.trust?.rules?.[0]?.source).toBe("acme/repo");
  });

  it("rejects defaults.trust rules referencing unknown key ids", () => {
    const raw = `
version: 1
defaults:
  trust:
    mode: required
    keys:
      - id: release-key
        algorithm: ed25519
        publicKey: test
    rules:
      - source: acme/repo
        requiredSignatures: 1
        keyIds: [missing-key]
`;
    expect(() => parseManifest(raw, { filename: "runwright.yml" })).toThrow(/keyIds/);
  });

  it("accepts defaults.policy rules", () => {
    const raw = `
version: 1
defaults:
  policy:
    rules:
      - id: deny-unresolved
        when:
          hasUnresolvedAllowlist: true
        action: deny
        message: Resolve allowlist entries before release.
`;
    const manifest = parseManifest(raw, { filename: "runwright.yml" });
    expect(manifest.defaults?.policy?.rules?.[0]?.id).toBe("deny-unresolved");
  });

  it("rejects duplicate defaults.policy rule ids", () => {
    const raw = `
version: 1
defaults:
  policy:
    rules:
      - id: duplicate
        when:
          hasUnresolvedAllowlist: true
        action: deny
        message: one
      - id: duplicate
        when:
          hasExpiredAllowlist: true
        action: warn
        message: two
`;
    expect(() => parseManifest(raw, { filename: "runwright.yml" })).toThrow(/policy rules must have unique ids/);
  });

  it("rejects invalid defaults.scan.severityOverrides rule IDs", () => {
    const raw = `
version: 1
defaults:
  scan:
    severityOverrides:
      not-a-rule: high
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/severityOverrides/);
  });

  it("accepts defaults.scan.severityOverrides for valid rule IDs", () => {
    const raw = `
version: 1
defaults:
  scan:
    severityOverrides:
      remote-shell-curl-pipe: medium
`;
    const manifest = parseManifest(raw, { filename: "skillbase.yml" });
    expect(manifest.defaults?.scan?.severityOverrides?.["remote-shell-curl-pipe"]).toBe("medium");
  });

  it("rejects defaults.scan.allowlist entries with invalid expiresAt", () => {
    const raw = `
version: 1
defaults:
  scan:
    allowlist:
      - ruleId: remote-shell-curl-pipe
        reason: accepted risk
        expiresAt: not-a-date
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/expiresAt/);
  });

  it("rejects defaults.scan.allowlist entries missing reason", () => {
    const raw = `
version: 1
defaults:
  scan:
    allowlist:
      - ruleId: remote-shell-curl-pipe
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow(/reason/);
  });

  it("accepts defaults.scan.allowlist entries without expiresAt", () => {
    const raw = `
version: 1
defaults:
  scan:
    allowlist:
      - ruleId: remote-shell-curl-pipe
        reason: accepted risk
`;
    const manifest = parseManifest(raw, { filename: "skillbase.yml" });
    expect(manifest.defaults?.scan?.allowlist?.[0]?.ruleId).toBe("remote-shell-curl-pipe");
  });

  it("rejects unknown keys in skill references", () => {
    const raw = `
version: 1
skillsets:
  base:
    skills:
      - source: local:./skills/example
        unknown: value
apply:
  useSkillsets: [base]
`;
    expect(() => parseManifest(raw, { filename: "skillbase.yml" })).toThrow();
  });

  it("accepts skill pick list with unique entries", () => {
    const raw = `
version: 1
skillsets:
  base:
    skills:
      - source: local:./skills/example
        pick: [alpha, beta]
apply:
  useSkillsets: [base]
`;
    const manifest = parseManifest(raw, { filename: "skillbase.yml" });
    expect(manifest.skillsets?.base.skills[0]?.pick).toEqual(["alpha", "beta"]);
  });

  it("parses valid json manifest when filename is .json", () => {
    const parsed = parseManifest("{\"version\":1}", { filename: "skillbase.json" });
    expect(parsed.version).toBe(1);
  });

  it("rejects invalid json syntax for .json manifests", () => {
    expect(() => parseManifest("{\"version\":1,}", { filename: "skillbase.json" })).toThrow();
  });

  it("rejects malformed manifest corpus", () => {
    const cases: Array<{ name: string; raw: string; filename: string }> = [
      {
        name: "unknown top-level key",
        filename: "skillbase.yml",
        raw: "version: 1\nunknownRoot: true\n"
      },
      {
        name: "invalid defaults type",
        filename: "skillbase.yml",
        raw: "version: 1\ndefaults: nope\n"
      },
      {
        name: "invalid skillset skills type",
        filename: "skillbase.yml",
        raw: "version: 1\nskillsets:\n  base:\n    skills: nope\n"
      },
      {
        name: "duplicate picks",
        filename: "skillbase.yml",
        raw: "version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\n        pick: [a, a]\napply:\n  useSkillsets: [base]\n"
      },
      {
        name: "invalid json manifest",
        filename: "skillbase.json",
        raw: "{\"version\":1,\"skillsets\":{\"base\":{\"skills\":[{\"source\":\"local:./skills\",\"unknown\":true}]}}}"
      }
    ];

    for (const sample of cases) {
      expect(() => parseManifest(sample.raw, { filename: sample.filename })).toThrow();
    }
  });
});
