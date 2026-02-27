import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { afterEach, describe, expect, it } from "vitest";
import { runTsxScript } from "./harness/runTsxScript.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runCli(
  args: string[],
  cwd: string,
  envOverrides?: Record<string, string>
): { status: number; stdout: string; stderr: string } {
  const result = runTsxScript({
    scriptRelativePath: "src/cli.ts",
    args,
    cwd,
    envOverrides
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function compileSchema(schemaPath: string): ValidateFunction {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  return ajv.compile(schema);
}

function assertValidPayload(validate: ValidateFunction, payload: unknown): void {
  const valid = validate(payload);
  expect(valid, JSON.stringify(validate.errors ?? [], null, 2)).toBe(true);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("json schema contracts", () => {
  it("validates scan/apply/update/pipeline/export/verify-bundle payloads against JSON schemas", () => {
    const projectDir = makeTempDir("skillbase-json-schema-contract-");
    mkdirSync(join(projectDir, "skills", "safe"), { recursive: true });
    writeFileSync(
      join(projectDir, "skills", "safe", "SKILL.md"),
      `---\nname: safe\ndescription: safe skill\n---\n\n# Safe\n`,
      "utf8"
    );
    writeFileSync(
      join(projectDir, "skillbase.yml"),
      `version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\napply:\n  useSkillsets: [base]\n`,
      "utf8"
    );
    writeFileSync(join(projectDir, "bundle.key"), "schema-contract-sign-key", "utf8");

    const schemaRoot = join(process.cwd(), "docs", "schemas", "cli");
    const validateScan = compileSchema(join(schemaRoot, "scan-output.schema.json"));
    const validateApply = compileSchema(join(schemaRoot, "apply-output.schema.json"));
    const validateUpdate = compileSchema(join(schemaRoot, "update-output.schema.json"));
    const validatePipeline = compileSchema(join(schemaRoot, "pipeline-output.schema.json"));
    const validateExport = compileSchema(join(schemaRoot, "export-output.schema.json"));
    const validateVerify = compileSchema(join(schemaRoot, "verify-bundle-output.schema.json"));

    const scan = runCli(["scan", "--format", "json"], projectDir);
    expect(scan.status).toBe(0);
    assertValidPayload(validateScan, JSON.parse(scan.stdout));

    const apply = runCli(
      ["apply", "--target", "codex", "--scope", "project", "--mode", "copy", "--dry-run", "--json"],
      projectDir
    );
    expect(apply.status).toBe(0);
    assertValidPayload(validateApply, JSON.parse(apply.stdout));

    const update = runCli(["update", "--json"], projectDir);
    expect(update.status).toBe(0);
    assertValidPayload(validateUpdate, JSON.parse(update.stdout));

    const pipeline = runCli(["pipeline", "run", "--target", "codex", "--scope", "project", "--mode", "copy", "--dry-run", "--json"], projectDir);
    expect(pipeline.status).toBe(0);
    assertValidPayload(validatePipeline, JSON.parse(pipeline.stdout));

    const bundlePath = join(projectDir, "bundle.zip");
    const exported = runCli(
      [
        "export",
        "--out",
        bundlePath,
        "--sign-key",
        join(projectDir, "bundle.key"),
        "--deterministic",
        "--json"
      ],
      projectDir,
      { SOURCE_DATE_EPOCH: "1704067200" }
    );
    expect(exported.status).toBe(0);
    assertValidPayload(validateExport, JSON.parse(exported.stdout));

    const verify = runCli(
      ["verify-bundle", "--bundle", bundlePath, "--sign-key", join(projectDir, "bundle.key"), "--json"],
      projectDir
    );
    expect(verify.status).toBe(0);
    assertValidPayload(validateVerify, JSON.parse(verify.stdout));
  });
});
