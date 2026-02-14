import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  iterations: number;
  outDir: string;
  only: string[];
  skip: string[];
  minMutationScore?: number;
};

type ShipGateArtifactSet = {
  summary: unknown;
  scorecard: unknown;
  evidence: unknown;
  stageLogs: unknown;
};

type SoakDiff = {
  iteration: number;
  artifact: "summary" | "scorecard" | "evidence" | "stageLogs";
  baselineHash: string;
  currentHash: string;
};

type SoakReport = {
  schemaVersion: "1.0";
  generatedAt: string;
  iterations: number;
  outDir: string;
  consistent: boolean;
  diffs: SoakDiff[];
  runs: Array<{
    iteration: number;
    outDir: string;
    status: number;
    artifactHashes?: Record<string, string>;
  }>;
};

const PROJECT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const NODE_COMMAND = process.execPath;
const TSX_CLI_PATH = resolve(PROJECT_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const RUN_SHIP_GATE_SCRIPT = resolve(PROJECT_ROOT, "scripts", "run_ship_gate.ts");

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    iterations: 2,
    outDir: "reports/quality/soak",
    only: [],
    skip: []
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--iterations") {
      const raw = Number(argv[index + 1] ?? "");
      if (!Number.isInteger(raw) || raw < 2) throw new Error("--iterations must be an integer >= 2");
      parsed.iterations = raw;
      index += 1;
      continue;
    }
    if (token === "--out-dir") {
      parsed.outDir = argv[index + 1] ?? parsed.outDir;
      index += 1;
      continue;
    }
    if (token === "--only") {
      const value = (argv[index + 1] ?? "").trim();
      if (value.length > 0) parsed.only.push(value);
      index += 1;
      continue;
    }
    if (token === "--skip") {
      const value = (argv[index + 1] ?? "").trim();
      if (value.length > 0) parsed.skip.push(value);
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

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortKeys(item));
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  const output: Record<string, unknown> = {};
  for (const [key, nested] of entries) output[key] = sortKeys(nested);
  return output;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeSummary(summary: unknown): unknown {
  const root = asRecord(summary);
  const overall = asRecord(root.overall);
  const stages = Array.isArray(root.stages) ? root.stages : [];
  return sortKeys({
    schemaVersion: root.schemaVersion,
    cwd: root.cwd,
    overall: {
      ok: overall.ok,
      succeeded: overall.succeeded,
      failed: overall.failed,
      total: overall.total
    },
    stages: stages.map((stage) => {
      const record = asRecord(stage);
      return {
        id: record.id,
        command: record.command,
        args: Array.isArray(record.args) ? record.args : [],
        status: record.status,
        ok: record.ok
      };
    })
  });
}

function normalizeScorecard(scorecard: unknown): unknown {
  const root = asRecord(scorecard);
  const metrics = { ...asRecord(root.metrics) };
  delete metrics.total_duration_ms;
  return sortKeys({
    schemaVersion: root.schemaVersion,
    title: root.title,
    checks: root.checks,
    totals: root.totals,
    overall: root.overall,
    metrics
  });
}

function normalizeEvidence(evidence: unknown): unknown {
  const root = asRecord(evidence);
  return sortKeys({
    schemaVersion: root.schemaVersion,
    ok: root.ok,
    checks: root.checks,
    metrics: root.metrics
  });
}

function normalizeStageLogs(stageLogs: unknown): unknown {
  const root = asRecord(stageLogs);
  const stages = Array.isArray(root.stages) ? root.stages : [];
  return sortKeys({
    schemaVersion: root.schemaVersion,
    stages: stages.map((stage) => {
      const record = asRecord(stage);
      return {
        id: record.id,
        status: record.status,
        ok: record.ok
      };
    })
  });
}

function digest(value: unknown): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(sortKeys(value)));
  return `sha256:${hash.digest("hex")}`;
}

function runShipGateIteration(iterationOutDir: string, args: ParsedArgs): number {
  const commandArgs = [TSX_CLI_PATH, RUN_SHIP_GATE_SCRIPT, "--out-dir", iterationOutDir];
  for (const stage of args.only) {
    commandArgs.push("--only", stage);
  }
  for (const stage of args.skip) {
    commandArgs.push("--skip", stage);
  }
  if (typeof args.minMutationScore === "number") {
    commandArgs.push("--min-mutation-score", String(args.minMutationScore));
  }

  const result = spawnSync(NODE_COMMAND, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result.status ?? 1;
}

function loadArtifacts(iterationOutDir: string): ShipGateArtifactSet {
  const summaryPath = resolve(iterationOutDir, "ship-gate.summary.json");
  const scorecardPath = resolve(iterationOutDir, "ship-gate.scorecard.json");
  const evidencePath = resolve(iterationOutDir, "ship-gate.evidence.verify.json");
  const stageLogsPath = resolve(iterationOutDir, "ship-gate.stage-logs.json");

  for (const path of [summaryPath, scorecardPath, evidencePath, stageLogsPath]) {
    if (!existsSync(path)) throw new Error(`Missing expected soak artifact: ${path}`);
  }

  return {
    summary: readJson(summaryPath),
    scorecard: readJson(scorecardPath),
    evidence: readJson(evidencePath),
    stageLogs: readJson(stageLogsPath)
  };
}

function main(): void {
  const args = parseArgs(process.argv);
  const outDir = resolve(args.outDir);
  mkdirSync(outDir, { recursive: true });

  const report: SoakReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    iterations: args.iterations,
    outDir,
    consistent: true,
    diffs: [],
    runs: []
  };

  let baselineHashes: Record<string, string> | null = null;

  for (let iteration = 1; iteration <= args.iterations; iteration += 1) {
    const iterationOutDir = resolve(outDir, `iteration-${String(iteration).padStart(2, "0")}`);
    mkdirSync(iterationOutDir, { recursive: true });
    const status = runShipGateIteration(iterationOutDir, args);

    const runRecord: SoakReport["runs"][number] = {
      iteration,
      outDir: iterationOutDir,
      status
    };

    if (status !== 0) {
      report.consistent = false;
      report.runs.push(runRecord);
      break;
    }

    const artifacts = loadArtifacts(iterationOutDir);
    const hashes = {
      summary: digest(normalizeSummary(artifacts.summary)),
      scorecard: digest(normalizeScorecard(artifacts.scorecard)),
      evidence: digest(normalizeEvidence(artifacts.evidence)),
      stageLogs: digest(normalizeStageLogs(artifacts.stageLogs))
    };
    runRecord.artifactHashes = hashes;
    report.runs.push(runRecord);

    if (!baselineHashes) {
      baselineHashes = hashes;
      continue;
    }

    for (const artifact of Object.keys(hashes) as Array<keyof typeof hashes>) {
      const baseline = baselineHashes[artifact];
      const current = hashes[artifact];
      if (baseline !== current) {
        report.consistent = false;
        report.diffs.push({
          iteration,
          artifact,
          baselineHash: baseline,
          currentHash: current
        });
      }
    }
  }

  const reportPath = resolve(outDir, "ship-gate-soak.report.json");
  writeJson(reportPath, report);
  process.stdout.write(`${reportPath}\n`);

  if (!report.consistent) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
