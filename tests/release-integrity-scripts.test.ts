import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

describe("release integrity scripts", () => {
  it("generates and verifies immutable artifact manifests", () => {
    const dir = makeTempDir("skillbase-artifact-manifest-");
    const fileA = join(dir, "a.txt");
    const fileB = join(dir, "b.txt");
    writeFileSync(fileA, "artifact-a", "utf8");
    writeFileSync(fileB, "artifact-b", "utf8");

    const manifestPath = join(dir, "artifact-manifest.json");
    const verifyPath = join(dir, "artifact-manifest.verify.json");

    const generate = runTsxScript({
      scriptRelativePath: "scripts/generate_artifact_manifest.ts",
      args: ["--base-dir", dir, "--file", "a.txt", "--file", "b.txt", "--out", manifestPath],
      cwd: process.cwd()
    });
    expect(generate.status).toBe(0);
    expect(existsSync(manifestPath)).toBe(true);

    const verify = runTsxScript({
      scriptRelativePath: "scripts/verify_artifact_manifest.ts",
      args: ["--manifest", manifestPath, "--out", verifyPath],
      cwd: process.cwd()
    });
    expect(verify.status).toBe(0);
    const verifyReport = JSON.parse(readFileSync(verifyPath, "utf8")) as { ok: boolean };
    expect(verifyReport.ok).toBe(true);

    writeFileSync(fileA, "artifact-a-tampered", "utf8");
    const verifyAfterTamper = runTsxScript({
      scriptRelativePath: "scripts/verify_artifact_manifest.ts",
      args: ["--manifest", manifestPath, "--out", verifyPath],
      cwd: process.cwd()
    });
    expect(verifyAfterTamper.status).toBe(1);
    const tamperReport = JSON.parse(readFileSync(verifyPath, "utf8")) as { ok: boolean };
    expect(tamperReport.ok).toBe(false);
  });

  it("generates release notes from scorecard/evidence artifacts", () => {
    const dir = makeTempDir("skillbase-release-notes-");
    const scorecardPath = join(dir, "release-scorecard.json");
    const evidencePath = join(dir, "release-evidence.json");
    const manifestPath = join(dir, "artifact-manifest.json");
    const notesPath = join(dir, "release-notes.md");

    writeFileSync(
      scorecardPath,
      JSON.stringify({
        schemaVersion: "1.0",
        overall: { pass: true },
        checks: [{ name: "verify", result: "success" }]
      }),
      "utf8"
    );
    writeFileSync(
      evidencePath,
      JSON.stringify({
        schemaVersion: "1.0",
        ok: true,
        checks: [{ name: "mutation.score", ok: true, detail: "ok" }],
        metrics: { mutationScore: 95.42 }
      }),
      "utf8"
    );
    writeFileSync(
      manifestPath,
      JSON.stringify({
        schemaVersion: "1.0",
        baseDir: dir,
        rootHash: `sha256:${"a".repeat(64)}`,
        files: [{ path: "bundle.zip", sizeBytes: 123, sha256: `sha256:${"b".repeat(64)}` }]
      }),
      "utf8"
    );

    const result = runTsxScript({
      scriptRelativePath: "scripts/generate_release_notes.ts",
      args: [
        "--tag",
        "v1.2.3",
        "--scorecard",
        scorecardPath,
        "--evidence",
        evidencePath,
        "--artifact-manifest",
        manifestPath,
        "--out",
        notesPath
      ],
      cwd: process.cwd()
    });
    expect(result.status).toBe(0);
    const notes = readFileSync(notesPath, "utf8");
    expect(notes).toContain("Release Notes: v1.2.3");
    expect(notes).toContain("Gate Summary");
    expect(notes).toContain("Release Artifacts");
  });

  it("verifies release tag signatures using fixture payloads", () => {
    const dir = makeTempDir("skillbase-release-tag-");
    const refJsonPath = join(dir, "ref.json");
    const tagJsonPath = join(dir, "tag.json");
    const outPath = join(dir, "tag-verify.json");

    writeFileSync(refJsonPath, JSON.stringify({ object: { type: "tag", sha: "abc123" } }), "utf8");
    writeFileSync(tagJsonPath, JSON.stringify({ verification: { verified: true, reason: "valid" } }), "utf8");

    const okResult = runTsxScript({
      scriptRelativePath: "scripts/verify_release_tag_signature.ts",
      args: [
        "--ref-name",
        "v1.2.3",
        "--ref-type",
        "tag",
        "--ref-json",
        refJsonPath,
        "--tag-json",
        tagJsonPath,
        "--out",
        outPath
      ],
      cwd: process.cwd()
    });
    expect(okResult.status).toBe(0);
    const okReport = JSON.parse(readFileSync(outPath, "utf8")) as { ok: boolean };
    expect(okReport.ok).toBe(true);

    writeFileSync(tagJsonPath, JSON.stringify({ verification: { verified: false, reason: "unsigned" } }), "utf8");
    const failResult = runTsxScript({
      scriptRelativePath: "scripts/verify_release_tag_signature.ts",
      args: [
        "--ref-name",
        "v1.2.3",
        "--ref-type",
        "tag",
        "--ref-json",
        refJsonPath,
        "--tag-json",
        tagJsonPath,
        "--out",
        outPath
      ],
      cwd: process.cwd()
    });
    expect(failResult.status).toBe(1);
    const failReport = JSON.parse(readFileSync(outPath, "utf8")) as { ok: boolean };
    expect(failReport.ok).toBe(false);

    const skippedResult = runTsxScript({
      scriptRelativePath: "scripts/verify_release_tag_signature.ts",
      args: ["--ref-name", "main", "--ref-type", "branch", "--out", outPath],
      cwd: process.cwd()
    });
    expect(skippedResult.status).toBe(0);
    const skippedReport = JSON.parse(readFileSync(outPath, "utf8")) as { skipped: boolean };
    expect(skippedReport.skipped).toBe(true);
  });
});
