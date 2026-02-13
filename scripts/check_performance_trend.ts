import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  currentPath: string;
  baselinePath: string;
  previousPath?: string;
  maxRegressionPercent: number;
  outPath: string;
  historyDir?: string;
};

type Snapshot = {
  schemaVersion: "1.0";
  generatedAt: string;
  metrics: Record<string, number>;
};

type TrendComparison = {
  metric: string;
  reference: number;
  current: number;
  deltaPercent: number;
  ok: boolean;
  referenceKind: "baseline" | "previous";
};

type TrendReport = {
  schemaVersion: "1.0";
  generatedAt: string;
  ok: boolean;
  maxRegressionPercent: number;
  comparisons: TrendComparison[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    currentPath: "",
    baselinePath: "",
    maxRegressionPercent: 40,
    outPath: "reports/performance/trend.report.json",
    historyDir: "reports/performance/history"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--current") {
      parsed.currentPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--baseline") {
      parsed.baselinePath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--previous") {
      parsed.previousPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--max-regression-percent") {
      const raw = Number(argv[index + 1] ?? "");
      if (!Number.isFinite(raw) || raw < 0) throw new Error("--max-regression-percent must be >= 0");
      parsed.maxRegressionPercent = raw;
      index += 1;
      continue;
    }
    if (token === "--out") {
      parsed.outPath = argv[index + 1] ?? parsed.outPath;
      index += 1;
      continue;
    }
    if (token === "--history-dir") {
      parsed.historyDir = argv[index + 1] ?? parsed.historyDir;
      index += 1;
    }
  }

  if (!parsed.currentPath) throw new Error("Missing required --current argument");
  if (!parsed.baselinePath) throw new Error("Missing required --baseline argument");
  return parsed;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function asSnapshot(path: string): Snapshot {
  const value = readJson(path) as Snapshot;
  if (!value || value.schemaVersion !== "1.0" || typeof value.metrics !== "object") {
    throw new Error(`Invalid snapshot payload: ${path}`);
  }
  return value;
}

function compareMetrics(
  current: Snapshot,
  reference: Snapshot,
  maxRegressionPercent: number,
  referenceKind: "baseline" | "previous"
): TrendComparison[] {
  const comparisons: TrendComparison[] = [];
  for (const metric of Object.keys(reference.metrics).sort()) {
    const referenceValue = Number(reference.metrics[metric]);
    const currentValue = Number(current.metrics[metric]);
    if (!Number.isFinite(referenceValue) || !Number.isFinite(currentValue)) continue;

    const deltaPercent =
      referenceValue === 0 ? (currentValue === 0 ? 0 : Number.POSITIVE_INFINITY) : ((currentValue - referenceValue) / referenceValue) * 100;
    const ok = deltaPercent <= maxRegressionPercent;
    comparisons.push({
      metric,
      reference: Number(referenceValue.toFixed(2)),
      current: Number(currentValue.toFixed(2)),
      deltaPercent: Number(deltaPercent.toFixed(2)),
      ok,
      referenceKind
    });
  }
  return comparisons;
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeHistorySnapshot(snapshotPath: string, historyDir: string | undefined): void {
  if (!historyDir || historyDir === "off") return;
  const absoluteHistoryDir = resolve(historyDir);
  mkdirSync(absoluteHistoryDir, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const destination = resolve(absoluteHistoryDir, `snapshot-${timestamp}.json`);
  copyFileSync(snapshotPath, destination);
}

function main(): void {
  const args = parseArgs(process.argv);
  const currentPath = resolve(args.currentPath);
  const baselinePath = resolve(args.baselinePath);
  const previousPath = args.previousPath ? resolve(args.previousPath) : undefined;
  const outPath = resolve(args.outPath);

  const current = asSnapshot(currentPath);
  const baseline = asSnapshot(baselinePath);
  const comparisons = compareMetrics(current, baseline, args.maxRegressionPercent, "baseline");

  if (previousPath) {
    const previous = asSnapshot(previousPath);
    comparisons.push(...compareMetrics(current, previous, args.maxRegressionPercent, "previous"));
  }

  const report: TrendReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    ok: comparisons.every((comparison) => comparison.ok),
    maxRegressionPercent: args.maxRegressionPercent,
    comparisons
  };

  writeJson(outPath, report);
  writeHistorySnapshot(currentPath, args.historyDir);

  process.stdout.write(`${outPath}\n`);
  if (!report.ok) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
