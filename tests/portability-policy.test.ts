import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function listFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

describe("test portability policy", () => {
  it("does not hardcode machine-specific absolute paths in test sources", () => {
    const testsRoot = join(process.cwd(), "tests");
    const testSources = listFiles(testsRoot).filter((path) => {
      if (!path.endsWith(".ts")) return false;
      const relativePath = relative(process.cwd(), path).replaceAll("\\", "/");
      return relativePath !== "tests/portability-policy.test.ts";
    });
    const forbiddenPatterns = [
      /\/Users\//,
      /\\Users\\/,
      /node_modules\/\.bin\/tsx/,
      /node_modules\\\.bin\\tsx/
    ];
    const violations: string[] = [];

    for (const sourcePath of testSources) {
      const contents = readFileSync(sourcePath, "utf8");
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(contents)) {
          violations.push(`${relative(process.cwd(), sourcePath)} matches ${pattern.source}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
