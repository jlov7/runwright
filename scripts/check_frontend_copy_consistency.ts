import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  outPath: string;
  htmlPath: string;
  appPath: string;
  minHelpAttributes: number;
  maxVagueCount: number;
};

type CheckResult = {
  id: string;
  ok: boolean;
  detail: string;
};

const REQUIRED_HTML_LABELS = [
  "Start Guided Setup",
  "Explore Without Guide",
  "Take Me To Next Step",
  "Show Help Panel",
  "Create Profile",
  "Run Tutorial Hint",
  "Save Progress",
  "Publish Level"
];

const REQUIRED_APP_COPY = [
  "Create a profile first.",
  "Ranked submission rejected",
  "Onboarding skipped for now. Resume anytime from the onboarding surface.",
  "Deterministic demo progress loaded.",
  "Retry queue cleared.",
  "Help service unavailable."
];

const VAGUE_PATTERNS = [/\bclick here\b/gi, /\bstuff\b/gi, /\bthing\b/gi, /\bwhatever\b/gi];

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    outPath: "reports/quality/frontend-copy-consistency.report.json",
    htmlPath: "apps/web/index.html",
    appPath: "apps/web/app.js",
    minHelpAttributes: 12,
    maxVagueCount: 0
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --out");
      parsed.outPath = value;
      index += 1;
      continue;
    }
    if (token === "--html") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --html");
      parsed.htmlPath = value;
      index += 1;
      continue;
    }
    if (token === "--app") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --app");
      parsed.appPath = value;
      index += 1;
      continue;
    }
    if (token === "--min-help-attributes") {
      const value = Number(argv[index + 1] ?? "");
      if (!Number.isInteger(value) || value < 1) throw new Error("--min-help-attributes must be a positive integer");
      parsed.minHelpAttributes = value;
      index += 1;
      continue;
    }
    if (token === "--max-vague-count") {
      const value = Number(argv[index + 1] ?? "");
      if (!Number.isInteger(value) || value < 0) throw new Error("--max-vague-count must be a non-negative integer");
      parsed.maxVagueCount = value;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      process.stdout.write(
        [
          "Usage: pnpm tsx scripts/check_frontend_copy_consistency.ts [options]",
          "",
          "Options:",
          "  --out <path>                  Output report path (default: reports/quality/frontend-copy-consistency.report.json)",
          "  --html <path>                 HTML file path (default: apps/web/index.html)",
          "  --app <path>                  Runtime app file path (default: apps/web/app.js)",
          "  --min-help-attributes <num>   Minimum required data-help attributes in HTML (default: 12)",
          "  --max-vague-count <num>       Maximum vague-copy matches allowed (default: 0)"
        ].join("\n") + "\n"
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return parsed;
}

function countMatches(input: string, pattern: RegExp): number {
  const matches = input.match(pattern);
  return matches ? matches.length : 0;
}

function main(): void {
  const args = parseArgs(process.argv);
  const html = readFileSync(resolve(args.htmlPath), "utf8");
  const app = readFileSync(resolve(args.appPath), "utf8");

  const missingHtml = REQUIRED_HTML_LABELS.filter((label) => !html.includes(label));
  const missingApp = REQUIRED_APP_COPY.filter((copy) => !app.includes(copy));
  const helpAttributeCount = countMatches(html, /\bdata-help="/g);
  const vagueCount = VAGUE_PATTERNS.reduce((sum, pattern) => sum + countMatches(`${html}\n${app}`, pattern), 0);

  const checks: CheckResult[] = [
    {
      id: "required-html-labels",
      ok: missingHtml.length === 0,
      detail: missingHtml.length === 0 ? "all required labels present" : `missing: ${missingHtml.join(", ")}`
    },
    {
      id: "required-runtime-copy",
      ok: missingApp.length === 0,
      detail: missingApp.length === 0 ? "all required app copy present" : `missing: ${missingApp.join(", ")}`
    },
    {
      id: "help-attribute-density",
      ok: helpAttributeCount >= args.minHelpAttributes,
      detail: `data-help attributes=${helpAttributeCount}, minimum=${args.minHelpAttributes}`
    },
    {
      id: "vague-copy-guard",
      ok: vagueCount <= args.maxVagueCount,
      detail: `vague-count=${vagueCount}, maximum=${args.maxVagueCount}`
    }
  ];

  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    inputs: {
      htmlPath: resolve(args.htmlPath),
      appPath: resolve(args.appPath)
    },
    checks,
    ok: checks.every((check) => check.ok)
  };

  const outPath = resolve(args.outPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${outPath}\n`);
  if (!report.ok) process.exit(1);
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
