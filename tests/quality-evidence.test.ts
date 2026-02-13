import { describe, expect, it } from "vitest";
import { calculateMutationScore, evaluateQualityEvidence } from "../src/quality/evidence.js";

describe("quality evidence", () => {
  it("calculates mutation score from Stryker report statuses", () => {
    const report = {
      files: {
        "src/demo.ts": {
          mutants: [
            { status: "Killed" },
            { status: "Timeout" },
            { status: "Survived" },
            { status: "NoCoverage" },
            { status: "CompileError" }
          ]
        }
      }
    };

    expect(calculateMutationScore(report)).toBe(50);
  });

  it("passes when required checks, mutation score, and sbom are valid", () => {
    const summary = evaluateQualityEvidence({
      scorecard: {
        overall: { pass: true },
        checks: [
          { name: "verify", result: "success" },
          { name: "mutation", result: "success" }
        ]
      },
      requiredChecks: ["verify", "mutation"],
      requireScorecardPass: true,
      mutationReport: {
        files: {
          "src/demo.ts": {
            mutants: [
              { status: "Killed" },
              { status: "Killed" },
              { status: "Survived" }
            ]
          }
        }
      },
      minMutationScore: 60,
      sbom: {
        bomFormat: "CycloneDX",
        components: [{ name: "skillbase" }]
      }
    });

    expect(summary.ok).toBe(true);
    expect(summary.metrics.mutationScore).toBe(66.67);
  });

  it("fails when required checks are missing or not successful", () => {
    const summary = evaluateQualityEvidence({
      scorecard: {
        overall: { pass: false },
        checks: [{ name: "verify", result: "failure" }]
      },
      requiredChecks: ["verify", "mutation"],
      requireScorecardPass: true
    });

    expect(summary.ok).toBe(false);
    expect(summary.checks.some((check) => check.name === "scorecard.overall.pass" && !check.ok)).toBe(true);
    expect(summary.checks.some((check) => check.name === "scorecard.check.verify" && !check.ok)).toBe(true);
    expect(summary.checks.some((check) => check.name === "scorecard.check.mutation" && !check.ok)).toBe(true);
  });

  it("fails when mutation score is under threshold", () => {
    const summary = evaluateQualityEvidence({
      scorecard: {
        overall: { pass: true },
        checks: [{ name: "mutation", result: "success" }]
      },
      requiredChecks: ["mutation"],
      requireScorecardPass: true,
      mutationReport: {
        files: {
          "src/demo.ts": {
            mutants: [
              { status: "Killed" },
              { status: "Survived" }
            ]
          }
        }
      },
      minMutationScore: 80
    });

    expect(summary.ok).toBe(false);
    expect(summary.checks.some((check) => check.name === "mutation.score" && !check.ok)).toBe(true);
  });

  it("fails when sbom is malformed", () => {
    const summary = evaluateQualityEvidence({
      scorecard: {
        overall: { pass: true },
        checks: [{ name: "verify", result: "success" }]
      },
      requiredChecks: ["verify"],
      requireScorecardPass: true,
      sbom: {
        bomFormat: "NotCycloneDX",
        components: []
      }
    });

    expect(summary.ok).toBe(false);
    expect(summary.checks.some((check) => check.name === "sbom.valid" && !check.ok)).toBe(true);
  });
});
