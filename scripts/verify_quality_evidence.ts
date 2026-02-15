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
      parsed.scorecardPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--mutation-report") {
      parsed.mutationReportPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--min-mutation-score") {
      const raw = Number(argv[index + 1] ?? "");
      if (Number.isFinite(raw)) parsed.minMutationScore = raw;
      index += 1;
      continue;
    }
    if (token === "--sbom") {
      parsed.sbomPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--require-check") {
      const name = (argv[index + 1] ?? "").trim();
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
      parsed.outPath = argv[index + 1] ?? parsed.outPath;
      index += 1;
    }
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
