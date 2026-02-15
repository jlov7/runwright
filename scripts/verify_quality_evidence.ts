import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateQualityEvidence } from "../src/quality/evidence.js";
import { DEFAULT_SHIP_GATE_STAGES } from "../src/quality/ship-gate.js";

type ParsedArgs = {
  scorecardPath: string;
  mutationReportPath?: string;
  minMutationScore?: number;
  sbomPath?: string;
  requireChecks: string[];
  requireScorecardPass: boolean;
  outPath: string;
};

const DEFAULT_SCORECARD_PATH = "reports/quality/ship-gate.scorecard.json";
const DEFAULT_REQUIRED_CHECKS = DEFAULT_SHIP_GATE_STAGES.map((stage) => stage.id);

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function renderUsage(): string {
  return [
    "Usage: pnpm tsx scripts/verify_quality_evidence.ts [options]",
    "",
    "Options:",
    `  --scorecard <path>          Scorecard JSON path (default: ${DEFAULT_SCORECARD_PATH})`,
    "  --require-check <name>      Require a named scorecard check to be successful (repeatable)",
    "  --allow-scorecard-fail      Do not fail when overall scorecard pass=false",
    "  --mutation-report <path>    Optional mutation report JSON path",
    "  --min-mutation-score <num>  Optional minimum mutation score threshold",
    "  --sbom <path>               Optional SBOM JSON path",
    "  --out <path>                Output verification JSON path (default: reports/quality/evidence-verification.json)",
    "  --help, -h                  Show this help message"
  ].join("\n");
}

function readRequiredArgValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv: string[]): ParsedArgs {
  let requireChecksExplicitlySet = false;
  const parsed: ParsedArgs = {
    scorecardPath: DEFAULT_SCORECARD_PATH,
    requireChecks: [],
    requireScorecardPass: true,
    outPath: "reports/quality/evidence-verification.json"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--scorecard") {
      parsed.scorecardPath = readRequiredArgValue(argv, index, "--scorecard");
      index += 1;
      continue;
    }
    if (token === "--mutation-report") {
      parsed.mutationReportPath = readRequiredArgValue(argv, index, "--mutation-report");
      index += 1;
      continue;
    }
    if (token === "--min-mutation-score") {
      const raw = Number(readRequiredArgValue(argv, index, "--min-mutation-score"));
      if (!Number.isFinite(raw)) {
        throw new Error("Expected a numeric value for --min-mutation-score");
      }
      parsed.minMutationScore = raw;
      index += 1;
      continue;
    }
    if (token === "--sbom") {
      parsed.sbomPath = readRequiredArgValue(argv, index, "--sbom");
      index += 1;
      continue;
    }
    if (token === "--require-check") {
      const name = readRequiredArgValue(argv, index, "--require-check").trim();
      if (name.length > 0) {
        parsed.requireChecks.push(name);
        requireChecksExplicitlySet = true;
      }
      index += 1;
      continue;
    }
    if (token === "--allow-scorecard-fail") {
      parsed.requireScorecardPass = false;
      continue;
    }
    if (token === "--out") {
      parsed.outPath = readRequiredArgValue(argv, index, "--out");
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument '${token}'`);
  }

  if (!requireChecksExplicitlySet && parsed.scorecardPath === DEFAULT_SCORECARD_PATH) {
    parsed.requireChecks = DEFAULT_REQUIRED_CHECKS;
  }

  return parsed;
}

function readJson(path: string): unknown {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to read JSON file '${path}': ${message}\n` +
      "Run `pnpm ship:gate` first or pass an explicit --scorecard path."
    );
  }
}

function main(): void {
  if (hasHelpFlag(process.argv)) {
    process.stdout.write(`${renderUsage()}\n`);
    return;
  }

  const args = parseArgs(process.argv);
  const scorecard = readJson(resolve(args.scorecardPath));
  const mutationReport = args.mutationReportPath ? readJson(resolve(args.mutationReportPath)) : undefined;
  const sbom = args.sbomPath ? readJson(resolve(args.sbomPath)) : undefined;

  const summary = evaluateQualityEvidence({
    scorecard,
    requiredChecks: args.requireChecks,
    requireScorecardPass: args.requireScorecardPass,
    mutationReport,
    minMutationScore: args.minMutationScore,
    sbom
  });

  const outPath = resolve(args.outPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  process.stdout.write(`${outPath}\n`);
  if (!summary.ok) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
