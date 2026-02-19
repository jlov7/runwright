import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

describe("frontend device matrix script", () => {
  it("writes qa matrix artifact", () => {
    const outDir = makeTempDir("runwright-frontend-matrix-");
    const outPath = join(outDir, "frontend-device-matrix.json");

    const result = runTsxScript({
      scriptRelativePath: "scripts/generate_frontend_device_matrix.ts",
      args: ["--out", outPath],
      cwd: process.cwd()
    });

    expect(result.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);

    const report = JSON.parse(readFileSync(outPath, "utf8")) as {
      schemaVersion: string;
      cases: Array<{ id: string }>;
    };
    expect(report.schemaVersion).toBe("1.0");
    expect(report.cases.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["ios-safari-phone", "android-chrome-phone", "ipad-safari", "desktop-chrome"])
    );
  });
});
