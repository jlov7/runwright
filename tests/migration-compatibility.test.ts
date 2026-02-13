import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalizeLockfile, readLockfile } from "../src/lockfile.js";
import { parseManifest } from "../src/manifest.js";

type FixtureCase = {
  name: string;
  file: string;
  expect: "success" | "error";
  expectedFile?: string;
  errorIncludes?: string;
};

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function readCaseList(path: string): FixtureCase[] {
  return readJson(path) as FixtureCase[];
}

describe("migration compatibility matrix", () => {
  it("replays manifest fixture corpus for backward-compatible parsing", () => {
    const fixtureRoot = join(process.cwd(), "tests", "fixtures", "compat", "matrix");
    const manifestCases = readCaseList(join(fixtureRoot, "manifest-cases.json"));

    for (const testCase of manifestCases) {
      const manifestPath = join(fixtureRoot, testCase.file);
      const raw = readFileSync(manifestPath, "utf8");

      if (testCase.expect === "error") {
        expect(() => parseManifest(raw, { filename: manifestPath })).toThrow();
        continue;
      }

      const parsed = parseManifest(raw, { filename: manifestPath });
      const expected = readJson(join(fixtureRoot, testCase.expectedFile ?? ""));
      expect(parsed, testCase.name).toEqual(expected);
    }
  });

  it("replays lockfile fixture corpus for backward-compatible parsing", () => {
    const fixtureRoot = join(process.cwd(), "tests", "fixtures", "compat", "matrix");
    const lockfileCases = readCaseList(join(fixtureRoot, "lockfile-cases.json"));

    for (const testCase of lockfileCases) {
      const lockfilePath = join(fixtureRoot, testCase.file);

      if (testCase.expect === "error") {
        expect(() => readLockfile(lockfilePath), testCase.name).toThrow();
        continue;
      }

      const parsed = canonicalizeLockfile(readLockfile(lockfilePath));
      const expected = readJson(join(fixtureRoot, testCase.expectedFile ?? ""));
      expect(parsed, testCase.name).toEqual(expected);
    }
  });
});
