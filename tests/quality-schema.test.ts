import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { AnySchemaObject } from "ajv";
import { buildScorecard } from "../src/quality/scorecard.js";
import { evaluateQualityEvidence } from "../src/quality/evidence.js";
import { DEFAULT_SHIP_GATE_STAGES, runShipGate, type ShipGateRunner } from "../src/quality/ship-gate.js";

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

describe("quality schemas", () => {
  it("validates scorecard payload against scorecard schema", () => {
    const schemaPath = join(process.cwd(), "docs", "schemas", "quality", "scorecard.schema.json");
    const schema = loadJson(schemaPath) as AnySchemaObject;

    const scorecard = buildScorecard({
      title: "Schema test",
      checks: [
        { name: "verify", result: "success" },
        { name: "mutation", result: "success" }
      ],
      metrics: [{ key: "mutation_score", value: "95.42" }]
    });

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(scorecard), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("validates quality evidence payload against evidence schema", () => {
    const schemaPath = join(process.cwd(), "docs", "schemas", "quality", "evidence-verification.schema.json");
    const schema = loadJson(schemaPath) as AnySchemaObject;

    const scorecard = buildScorecard({
      title: "Schema test",
      checks: [
        { name: "verify", result: "success" },
        { name: "mutation", result: "success" }
      ],
      metrics: []
    });

    const evidence = evaluateQualityEvidence({
      scorecard,
      requiredChecks: ["verify", "mutation"],
      requireScorecardPass: true,
      mutationReport: {
        files: {
          "src/demo.ts": {
            mutants: [{ status: "Killed" }, { status: "Survived" }]
          }
        }
      },
      minMutationScore: 40,
      sbom: {
        bomFormat: "CycloneDX",
        components: [{ name: "skillbase" }]
      }
    });

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(evidence), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("validates ship-gate summary payload against summary schema", () => {
    const schemaPath = join(process.cwd(), "docs", "schemas", "quality", "ship-gate-summary.schema.json");
    const schema = loadJson(schemaPath) as AnySchemaObject;

    const statuses = [0, 1, 0];
    let callIndex = 0;
    const runner: ShipGateRunner = () => {
      const status = statuses[callIndex] ?? 0;
      callIndex += 1;
      return { status, stdout: `status=${status}`, stderr: status === 0 ? "" : "failed" };
    };
    const summary = runShipGate({
      cwd: process.cwd(),
      stages: DEFAULT_SHIP_GATE_STAGES.slice(0, 3),
      runCommand: runner
    });

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(summary), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("validates ship-gate stage-logs payload against stage-logs schema", () => {
    const schemaPath = join(
      process.cwd(),
      "docs",
      "schemas",
      "quality",
      "ship-gate-stage-logs.schema.json"
    );
    const schema = loadJson(schemaPath) as AnySchemaObject;
    const stageLogs = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      stages: [
        {
          id: "audit",
          status: 0,
          ok: true,
          durationMs: 123,
          stdout: "ok",
          stderr: ""
        }
      ]
    };

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(stageLogs), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("validates ship-gate soak payload against soak-report schema", () => {
    const schemaPath = join(
      process.cwd(),
      "docs",
      "schemas",
      "quality",
      "ship-gate-soak-report.schema.json"
    );
    const schema = loadJson(schemaPath) as AnySchemaObject;
    const soakReport = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      iterations: 2,
      outDir: "/tmp/skillbase-soak",
      consistent: true,
      diffs: [],
      runs: [
        {
          iteration: 1,
          outDir: "/tmp/skillbase-soak/iteration-01",
          status: 0,
          artifactHashes: {
            summary: `sha256:${"a".repeat(64)}`,
            scorecard: `sha256:${"b".repeat(64)}`,
            evidence: `sha256:${"c".repeat(64)}`,
            stageLogs: `sha256:${"d".repeat(64)}`
          }
        },
        {
          iteration: 2,
          outDir: "/tmp/skillbase-soak/iteration-02",
          status: 0,
          artifactHashes: {
            summary: `sha256:${"a".repeat(64)}`,
            scorecard: `sha256:${"b".repeat(64)}`,
            evidence: `sha256:${"c".repeat(64)}`,
            stageLogs: `sha256:${"d".repeat(64)}`
          }
        }
      ]
    };

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(soakReport), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("validates performance snapshot payload against snapshot schema", () => {
    const schemaPath = join(
      process.cwd(),
      "docs",
      "schemas",
      "quality",
      "performance-snapshot.schema.json"
    );
    const schema = loadJson(schemaPath) as AnySchemaObject;
    const snapshot = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      sample: {
        skills: 120,
        iterations: 3
      },
      metrics: {
        updateMs: 1000,
        exportMedianMs: 900,
        verifyMedianMs: 800
      }
    };

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(snapshot), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("validates performance trend payload against trend-report schema", () => {
    const schemaPath = join(
      process.cwd(),
      "docs",
      "schemas",
      "quality",
      "performance-trend-report.schema.json"
    );
    const schema = loadJson(schemaPath) as AnySchemaObject;
    const report = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      ok: true,
      maxRegressionPercent: 40,
      comparisons: [
        {
          metric: "exportMedianMs",
          reference: 1000,
          current: 1100,
          deltaPercent: 10,
          ok: true,
          referenceKind: "baseline"
        }
      ]
    };

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(report), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("validates release tag signature report payload against schema", () => {
    const schemaPath = join(
      process.cwd(),
      "docs",
      "schemas",
      "quality",
      "release-tag-signature-report.schema.json"
    );
    const schema = loadJson(schemaPath) as AnySchemaObject;
    const report = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      ok: true,
      skipped: false,
      reason: "annotated tag signature verified",
      tagName: "v1.2.3",
      objectType: "tag",
      objectSha: "abc123",
      verification: {
        verified: true,
        reason: "valid"
      }
    };

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    expect(validate(report), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("validates release artifact manifest payloads against schemas", () => {
    const manifestSchemaPath = join(
      process.cwd(),
      "docs",
      "schemas",
      "quality",
      "release-artifact-manifest.schema.json"
    );
    const verifySchemaPath = join(
      process.cwd(),
      "docs",
      "schemas",
      "quality",
      "release-artifact-manifest-verify.schema.json"
    );

    const manifestSchema = loadJson(manifestSchemaPath) as AnySchemaObject;
    const verifySchema = loadJson(verifySchemaPath) as AnySchemaObject;

    const manifest = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      baseDir: "/tmp/release",
      rootHash: `sha256:${"a".repeat(64)}`,
      files: [
        {
          path: "skillbase-release.zip",
          sizeBytes: 123,
          sha256: `sha256:${"b".repeat(64)}`
        }
      ]
    };
    const verification = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      ok: true,
      checkedFiles: 1,
      mismatches: []
    };

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validateManifest = ajv.compile(manifestSchema);
    const validateVerification = ajv.compile(verifySchema);

    expect(validateManifest(manifest), JSON.stringify(validateManifest.errors, null, 2)).toBe(true);
    expect(validateVerification(verification), JSON.stringify(validateVerification.errors, null, 2)).toBe(true);
  });

  it("validates release attestation payloads against schemas", () => {
    const attestationSchemaPath = join(
      process.cwd(),
      "docs",
      "schemas",
      "quality",
      "release-attestation.schema.json"
    );
    const verifySchemaPath = join(
      process.cwd(),
      "docs",
      "schemas",
      "quality",
      "release-attestation-verify.schema.json"
    );

    const attestationSchema = loadJson(attestationSchemaPath) as AnySchemaObject;
    const verifySchema = loadJson(verifySchemaPath) as AnySchemaObject;
    const attestation = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      predicateType: "https://runwright.dev/provenance/release-attestation/v1",
      subject: {
        path: "skillbase-release.zip",
        sizeBytes: 123,
        digest: {
          sha256: `sha256:${"a".repeat(64)}`
        }
      },
      builder: {
        id: "runwright.release",
        version: "1.0.0"
      },
      run: {
        invocationId: "123",
        sourceRef: "abc123",
        workflow: "release-verify"
      },
      signature: {
        algorithm: "ed25519",
        keyId: `sha256:${"b".repeat(64)}`,
        payloadDigest: `sha256:${"c".repeat(64)}`,
        value: "dGVzdA=="
      }
    };
    const verification = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      ok: true,
      attestationPath: "/tmp/release/release-attestation.json",
      artifactPath: "/tmp/release/skillbase-release.zip",
      checks: {
        artifactFound: true,
        digestMatch: true,
        sizeMatch: true,
        subjectPathMatch: true,
        payloadDigestMatch: true,
        keyIdMatch: true,
        signatureVerified: true
      },
      issues: []
    };

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validateAttestation = ajv.compile(attestationSchema);
    const validateVerification = ajv.compile(verifySchema);

    expect(validateAttestation(attestation), JSON.stringify(validateAttestation.errors, null, 2)).toBe(true);
    expect(validateVerification(verification), JSON.stringify(validateVerification.errors, null, 2)).toBe(true);
  });
});
