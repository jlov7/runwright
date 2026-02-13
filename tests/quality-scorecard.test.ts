import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildScorecard, parseArgs, toMarkdown } from "../src/quality/scorecard.js";
import { runTsxScript } from "./harness/runTsxScript.js";

describe("quality scorecard script", () => {
  it("parses repeated checks and metrics from argv", () => {
    const parsed = parseArgs([
      "node",
      "script",
      "--check",
      "verify=success",
      "--check",
      "mutation=failure",
      "--metric",
      "mutation_score=95.42",
      "--title",
      "CI Quality"
    ]);

    expect(parsed.title).toBe("CI Quality");
    expect(parsed.checks).toEqual([
      { name: "verify", result: "success" },
      { name: "mutation", result: "failure" }
    ]);
    expect(parsed.metrics).toEqual([{ key: "mutation_score", value: "95.42" }]);
  });

  it("builds a passing scorecard only when all checks are success", () => {
    const scorecard = buildScorecard({
      title: "CI",
      checks: [
        { name: "verify", result: "success" },
        { name: "mutation", result: "success" },
        { name: "fuzz", result: "success" }
      ],
      metrics: [{ key: "mutation_score", value: "95.42" }]
    });

    expect(scorecard.overall.pass).toBe(true);
    expect(scorecard.overall.scorePercent).toBe(100);
    expect(scorecard.totals.success).toBe(3);
    expect(scorecard.metrics.mutation_score).toBe("95.42");
  });

  it("marks non-success statuses as failing checks", () => {
    const scorecard = buildScorecard({
      title: "CI",
      checks: [
        { name: "verify", result: "success" },
        { name: "mutation", result: "skipped" },
        { name: "sarif", result: "unknown-status" }
      ],
      metrics: []
    });

    expect(scorecard.overall.pass).toBe(false);
    expect(scorecard.totals.success).toBe(1);
    expect(scorecard.totals.skipped).toBe(1);
    expect(scorecard.totals.unknown).toBe(1);
  });

  it("renders markdown table with checks and metrics", () => {
    const scorecard = buildScorecard({
      title: "CI",
      checks: [{ name: "verify", result: "success" }],
      metrics: [{ key: "mutation_score", value: "95.42" }]
    });

    const markdown = toMarkdown(scorecard);
    expect(markdown).toContain("# CI");
    expect(markdown).toContain("| verify | success | yes |");
    expect(markdown).toContain("| mutation_score | 95.42 |");
  });

  it("writes JSON and markdown files from CLI invocation", () => {
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const outDir = join(tmpdir(), `skillbase-scorecard-${runId}`);
    const jsonPath = join(outDir, "scorecard.json");
    const mdPath = join(outDir, "scorecard.md");

    const result = runTsxScript({
      scriptRelativePath: "scripts/generate_quality_scorecard.ts",
      args: ["--out", jsonPath, "--md", mdPath, "--check", "verify=success"],
      cwd: process.cwd()
    });

    expect(result.status).toBe(0);
    const json = JSON.parse(readFileSync(jsonPath, "utf8")) as { checks: Array<{ name: string }>; overall: { pass: boolean } };
    const markdown = readFileSync(mdPath, "utf8");

    expect(json.overall.pass).toBe(true);
    expect(json.checks[0]?.name).toBe("verify");
    expect(markdown).toContain("Skillbase Quality Scorecard");

    rmSync(outDir, { recursive: true, force: true });
  });
});
