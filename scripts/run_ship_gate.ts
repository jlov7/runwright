import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildScorecard, toMarkdown } from "../src/quality/scorecard.js";
import { evaluateQualityEvidence } from "../src/quality/evidence.js";
import {
  DEFAULT_SHIP_GATE_STAGES,
  runShipGate,
  selectShipGateStages,
  type ShipGateRunner
} from "../src/quality/ship-gate.js";

type ParsedArgs = {
  outDir: string;
  only: string[];
  skip: string[];
  minMutationScore: number;
};

function parseMockStatus(raw: string | undefined): number | null {
  if (typeof raw === "undefined") return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("RUNWRIGHT_SHIP_GATE_MOCK_STATUS must be a non-negative integer");
  }
  return parsed;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    outDir: "reports/quality",
    only: [],
    skip: [],
    minMutationScore: 85
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--out-dir") {
      parsed.outDir = argv[index + 1] ?? parsed.outDir;
      index += 1;
      continue;
    }
    if (token === "--only") {
      const value = argv[index + 1] ?? "";
      parsed.only.push(value);
      index += 1;
      continue;
    }
    if (token === "--skip") {
      const value = argv[index + 1] ?? "";
      parsed.skip.push(value);
      index += 1;
      continue;
    }
    if (token === "--min-mutation-score") {
      const raw = Number(argv[index + 1] ?? "");
      if (!Number.isFinite(raw)) throw new Error("--min-mutation-score must be numeric");
      parsed.minMutationScore = raw;
      index += 1;
    }
  }

  return parsed;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function main(): void {
  const args = parseArgs(process.argv);
  const outDir = resolve(args.outDir);
  const mockStatus = parseMockStatus(process.env.RUNWRIGHT_SHIP_GATE_MOCK_STATUS);
  mkdirSync(outDir, { recursive: true });

  const selectedStages = selectShipGateStages(DEFAULT_SHIP_GATE_STAGES, {
    only: args.only,
    skip: args.skip
  });

  const runCommand: ShipGateRunner = (command, commandArgs, cwd) => {
    if (typeof mockStatus === "number") {
      return {
        status: mockStatus,
        stdout: `[mock] ${command} ${commandArgs.join(" ")}`,
        stderr: ""
      };
    }
    const result = spawnSync(command, commandArgs, { cwd, encoding: "utf8" });
    return {
      status: result.status ?? 1,
      stdout: result.stdout,
      stderr: result.stderr
    };
  };

  const summary = runShipGate({
    cwd: process.cwd(),
    stages: selectedStages,
    runCommand
  });

  const summaryPath = resolve(outDir, "ship-gate.summary.json");
  writeJson(summaryPath, summary);

  const scorecard = buildScorecard({
    title: "Skillbase Ship Gate Scorecard",
    checks: summary.stages.map((stage) => ({
      name: stage.id,
      result: stage.ok ? "success" : "failure"
    })),
    metrics: [
      { key: "total_duration_ms", value: String(summary.overall.totalDurationMs) },
      { key: "succeeded", value: String(summary.overall.succeeded) },
      { key: "failed", value: String(summary.overall.failed) }
    ]
  });

  const scorecardJsonPath = resolve(outDir, "ship-gate.scorecard.json");
  const scorecardMdPath = resolve(outDir, "ship-gate.scorecard.md");
  writeJson(scorecardJsonPath, scorecard);
  writeFileSync(scorecardMdPath, toMarkdown(scorecard), "utf8");

  const selectedStageIds = new Set(summary.stages.map((stage) => stage.id));
  const mutationReport =
    selectedStageIds.has("mutation") && existsSync(resolve("reports/mutation/mutation.json"))
      ? readJson(resolve("reports/mutation/mutation.json"))
      : undefined;
  const sbom = selectedStageIds.has("sbom") && existsSync(resolve("reports/sbom/bom.json"))
    ? readJson(resolve("reports/sbom/bom.json"))
    : undefined;

  const evidence = evaluateQualityEvidence({
    scorecard,
    requiredChecks: summary.stages.map((stage) => stage.id),
    requireScorecardPass: true,
    mutationReport,
    minMutationScore: selectedStageIds.has("mutation") ? args.minMutationScore : undefined,
    sbom
  });

  const evidencePath = resolve(outDir, "ship-gate.evidence.verify.json");
  writeJson(evidencePath, evidence);

  const stageLogsPath = resolve(outDir, "ship-gate.stage-logs.json");
  writeJson(
    stageLogsPath,
    {
      schemaVersion: "1.0",
      generatedAt: summary.generatedAt,
      stages: summary.stages.map((stage) => ({
        id: stage.id,
        status: stage.status,
        ok: stage.ok,
        durationMs: stage.durationMs,
        stdout: stage.stdout,
        stderr: stage.stderr
      }))
    }
  );

  process.stdout.write(`${summaryPath}\n`);
  process.stdout.write(`${scorecardJsonPath}\n`);
  process.stdout.write(`${scorecardMdPath}\n`);
  process.stdout.write(`${evidencePath}\n`);
  process.stdout.write(`${stageLogsPath}\n`);

  const ok = summary.overall.ok && evidence.ok;
  if (!ok) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
