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

function remoteStoreRoot(
  projectDir: string,
  owner: string,
  repo: string,
  rev: string
): string {
  return join(projectDir, ".skillbase", "store", "sources", "github", owner, repo, rev);
}

function buildManifestWithSources(sources: string[]): ReturnType<typeof parseManifest> {
  const lines = [
    "version: 1",
    "skillsets:",
    "  base:",
    "    skills:",
    ...sources.map((source) => `      - source: ${source}`),
    "apply:",
    "  useSkillsets: [base]"
  ];
  return parseManifest(`${lines.join("\n")}\n`, { filename: "skillbase.yml" });
}

function cpuBurn(iterations: number): void {
  let checksum = 0;
  for (let index = 0; index < iterations; index += 1) checksum += index % 7;
  if (checksum < 0) throw new Error("unreachable checksum");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("resolver benchmark guards", () => {
  it("cached resolution is materially faster than uncached resolution", () => {
    const projectDir = makeTempDir("skillbase-resolver-bench-cache-");
    const sources = Array.from({ length: 18 }, (_, index) => `team/repo-${index}`);
    const manifest = buildManifestWithSources(sources);

    const remoteMap = new Map<string, RemoteResolution>();
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index]!;
      const root = remoteStoreRoot(projectDir, "team", `repo-${index}`, `sha-${index}`);
      mkdirSync(join(root, `skill-${index}`), { recursive: true });
      writeFileSync(
        join(root, `skill-${index}`, "SKILL.md"),
        `---\nname: skill-${index}\ndescription: skill-${index}\n---\n`,
        "utf8"
      );
      remoteMap.set(source, {
        rootPath: root,
        type: "github",
        resolvedRef: "commit",
        resolvedValue: `sha-${index}`
      });
    }

    let calls = 0;
    const remoteResolver = (source: string) => {
      calls += 1;
      cpuBurn(300_000);
      const resolved = remoteMap.get(source);
      if (!resolved) throw new Error(`unexpected source: ${source}`);
      return resolved;
    };

    const firstStart = Date.now();
    const first = resolveSkillUnits(manifest, projectDir, { remoteResolver, remoteCacheTtlSeconds: 3600 });
    const firstDurationMs = Date.now() - firstStart;

    const secondStart = Date.now();
    const second = resolveSkillUnits(manifest, projectDir, { remoteResolver, remoteCacheTtlSeconds: 3600 });
    const secondDurationMs = Date.now() - secondStart;

    expect(first.units.length).toBe(sources.length);
    expect(second.units.length).toBe(sources.length);
    expect(calls).toBe(sources.length);
    if (firstDurationMs >= 250) {
      expect(secondDurationMs).toBeLessThan(firstDurationMs);
    }
    expect(secondDurationMs).toBeLessThan(1500);
  });

  it("refresh-source churn remains bounded and deterministic", () => {
    const projectDir = makeTempDir("skillbase-resolver-bench-churn-");
    const sources = ["acme/repo-a", "acme/repo-b", "acme/repo-c", "acme/repo-d"];
    const manifest = buildManifestWithSources(sources);

    for (const [index, source] of sources.entries()) {
      const repo = source.split("/")[1] ?? `repo-${index}`;
      const root = remoteStoreRoot(projectDir, "acme", repo, "sha-live");
      mkdirSync(join(root, `skill-${index}`), { recursive: true });
      writeFileSync(
        join(root, `skill-${index}`, "SKILL.md"),
        `---\nname: skill-${index}\ndescription: skill-${index}\n---\n`,
        "utf8"
      );
    }

    let calls = 0;
    const remoteResolver = (source: string) => {
      calls += 1;
      const repo = source.split("/")[1] ?? "repo";
      return {
        rootPath: remoteStoreRoot(projectDir, "acme", repo, "sha-live"),
        type: "github" as const,
        resolvedRef: "commit" as const,
        resolvedValue: `sha-live-${calls}`
      };
    };

    const cycleStartMs = Date.now();
    for (let cycle = 0; cycle < 12; cycle += 1) {
      resolveSkillUnits(manifest, projectDir, {
        remoteResolver,
        refreshSources: cycle % 2 === 0,
        remoteCacheTtlSeconds: 3600
      });
    }
    const cycleDurationMs = Date.now() - cycleStartMs;

    expect(calls).toBe(sources.length * 6);
    expect(cycleDurationMs).toBeLessThan(10_000);
  });
});
