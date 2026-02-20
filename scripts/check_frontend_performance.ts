import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  htmlPath: string;
  cssPath: string;
  outPath: string;
  maxHtmlKb: number;
  maxCssKb: number;
  maxCombinedKb: number;
  iterations: number;
  maxReadAvgMs: number;
};

type Metric = {
  sizeBytes: number;
  sizeKb: number;
  readMs: number[];
  avgReadMs: number;
  maxReadMs: number;
};

type FrontendPerformanceReport = {
  schemaVersion: "1.0";
  generatedAt: string;
  budgets: {
    maxHtmlKb: number;
    maxCssKb: number;
    maxCombinedKb: number;
    maxReadAvgMs: number;
  };
  metrics: {
    html: Metric;
    css: Metric;
    combinedKb: number;
  };
  checks: Array<{ id: string; ok: boolean; actual: number; limit: number }>;
  ok: boolean;
};

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function renderUsage(): string {
  return [
    "Usage: pnpm tsx scripts/check_frontend_performance.ts [options]",
    "",
    "Options:",
    "  --html <path>             HTML file path (default: apps/web/index.html)",
    "  --css <path>              CSS file path (default: apps/web/styles.css)",
    "  --out <path>              Output JSON path (default: reports/performance/frontend-budget.report.json)",
    "  --max-html-kb <number>    HTML size budget in KB (default: 80)",
    "  --max-css-kb <number>     CSS size budget in KB (default: 45)",
    "  --max-combined-kb <num>   Combined size budget in KB (default: 110)",
    "  --iterations <number>     Read sampling iterations (default: 10)",
    "  --max-read-avg-ms <num>   Average read budget in ms (default: 5)",
    "  --help, -h                Show this help text"
  ].join("\n");
}

function readRequiredArgValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseNumber(argv: string[], index: number, flag: string): number {
  const raw = Number(readRequiredArgValue(argv, index, flag));
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error(`${flag} must be a positive number`);
  }
  return raw;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    htmlPath: "apps/web/index.html",
    cssPath: "apps/web/styles.css",
    outPath: "reports/performance/frontend-budget.report.json",
    maxHtmlKb: 80,
    maxCssKb: 45,
    maxCombinedKb: 110,
    iterations: 10,
    maxReadAvgMs: 5
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--html") {
      parsed.htmlPath = readRequiredArgValue(argv, index, "--html");
      index += 1;
      continue;
    }
    if (token === "--css") {
      parsed.cssPath = readRequiredArgValue(argv, index, "--css");
      index += 1;
      continue;
    }
    if (token === "--out") {
      parsed.outPath = readRequiredArgValue(argv, index, "--out");
      index += 1;
      continue;
    }
    if (token === "--max-html-kb") {
      parsed.maxHtmlKb = parseNumber(argv, index, "--max-html-kb");
      index += 1;
      continue;
    }
    if (token === "--max-css-kb") {
      parsed.maxCssKb = parseNumber(argv, index, "--max-css-kb");
      index += 1;
      continue;
    }
    if (token === "--max-combined-kb") {
      parsed.maxCombinedKb = parseNumber(argv, index, "--max-combined-kb");
      index += 1;
      continue;
    }
    if (token === "--iterations") {
      parsed.iterations = Math.round(parseNumber(argv, index, "--iterations"));
      index += 1;
      continue;
    }
    if (token === "--max-read-avg-ms") {
      parsed.maxReadAvgMs = parseNumber(argv, index, "--max-read-avg-ms");
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument '${token}'`);
  }

  return parsed;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function captureMetric(path: string, iterations: number): Metric {
  let sizeBytes = 0;
  const readMs: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const body = readFileSync(resolve(path), "utf8");
    const duration = performance.now() - started;
    readMs.push(round(duration));
    sizeBytes = Buffer.byteLength(body, "utf8");
  }

  const avgReadMs = round(readMs.reduce((sum, value) => sum + value, 0) / Math.max(1, readMs.length));
  const maxReadMs = round(Math.max(...readMs));
  return {
    sizeBytes,
    sizeKb: round(sizeBytes / 1024),
    readMs,
    avgReadMs,
    maxReadMs
  };
}

function main(): void {
  if (hasHelpFlag(process.argv)) {
    process.stdout.write(`${renderUsage()}\n`);
    return;
  }

  const args = parseArgs(process.argv);
  const html = captureMetric(args.htmlPath, args.iterations);
  const css = captureMetric(args.cssPath, args.iterations);
  const combinedKb = round(html.sizeKb + css.sizeKb);

  const checks = [
    { id: "html-size", ok: html.sizeKb <= args.maxHtmlKb, actual: html.sizeKb, limit: args.maxHtmlKb },
    { id: "css-size", ok: css.sizeKb <= args.maxCssKb, actual: css.sizeKb, limit: args.maxCssKb },
    { id: "combined-size", ok: combinedKb <= args.maxCombinedKb, actual: combinedKb, limit: args.maxCombinedKb },
    { id: "html-read-avg", ok: html.avgReadMs <= args.maxReadAvgMs, actual: html.avgReadMs, limit: args.maxReadAvgMs },
    { id: "css-read-avg", ok: css.avgReadMs <= args.maxReadAvgMs, actual: css.avgReadMs, limit: args.maxReadAvgMs }
  ];

  const report: FrontendPerformanceReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    budgets: {
      maxHtmlKb: args.maxHtmlKb,
      maxCssKb: args.maxCssKb,
      maxCombinedKb: args.maxCombinedKb,
      maxReadAvgMs: args.maxReadAvgMs
    },
    metrics: {
      html,
      css,
      combinedKb
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
