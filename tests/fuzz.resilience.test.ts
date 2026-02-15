import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readLockfile } from "../src/lockfile.js";
import { parseManifest } from "../src/manifest.js";
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

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomText(rng: () => number, minLen: number, maxLen: number): string {
  const length = minLen + Math.floor(rng() * (maxLen - minLen + 1));
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]:-_\n #\"',./\\";
  let out = "";
  for (let index = 0; index < length; index += 1) {
    out += alphabet[Math.floor(rng() * alphabet.length)] ?? "x";
  }
  return out;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("fuzz resilience", () => {
  it("manifest parser is resilient under randomized malformed corpus", () => {
    const rng = createRng(0xc0ffee);
    for (let index = 0; index < 96; index += 1) {
      const raw = randomText(rng, 0, 500);
      try {
        const manifest = parseManifest(raw, { filename: `fuzz-${index}.yml` });
        expect(manifest.version).toBe(1);
        expect(typeof manifest.skillsets).toBe("object");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }
  });

  it("lockfile parser is resilient under randomized malformed corpus", () => {
    const rng = createRng(0xdecafbad);
    const projectDir = makeTempDir("skillbase-lockfile-fuzz-");

    for (let index = 0; index < 96; index += 1) {
      const lockfilePath = join(projectDir, "skillbase.lock.json");
      writeFileSync(lockfilePath, randomText(rng, 0, 700), "utf8");
      try {
        const lockfile = readLockfile(lockfilePath);
        expect([1, 2]).toContain(lockfile.version);
        expect(typeof lockfile.generatedAt).toBe("string");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }
  });

  it("verify-bundle handles randomized byte corpus with structured failure responses", () => {
    const rng = createRng(0x1a2b3c4d);
    const projectDir = makeTempDir("skillbase-verify-fuzz-");

    for (let index = 0; index < 24; index += 1) {
      const byteLength = 128 + Math.floor(rng() * 4096);
      const bytes = Buffer.alloc(byteLength);
      for (let offset = 0; offset < byteLength; offset += 1) {
        bytes[offset] = Math.floor(rng() * 256);
      }
      const bundlePath = join(projectDir, `bundle-${index}.zip`);
      writeFileSync(bundlePath, bytes);

      const result = runCli(["verify-bundle", "--bundle", bundlePath, "--json"], projectDir);
      expect(result.status).toBe(1);
      const payload = JSON.parse(result.stdout);
      expect(payload.schemaVersion).toBe("1.0");
      expect(payload.status).toBe(1);
      expect(typeof payload.code).toBe("string");
    }
  });
});
