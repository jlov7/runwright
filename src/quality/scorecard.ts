export type CheckResult = "success" | "failure" | "cancelled" | "skipped" | "unknown";

export type ScorecardCheck = {
  name: string;
  result: CheckResult;
  pass: boolean;
};

export type ParsedArgs = {
  out: string;
  md: string;
  title: string;
  checks: Array<{ name: string; result: CheckResult }>;
  metrics: Array<{ key: string; value: string }>;
};

export type BuildScorecardInput = {
  title: string;
  checks: Array<{ name: string; result: string }>;
  metrics: Array<{ key: string; value: string }>;
};

export type Scorecard = {
  schemaVersion: "1.0";
  generatedAt: string;
  title: string;
  checks: ScorecardCheck[];
  totals: {
    success: number;
    failure: number;
    cancelled: number;
    skipped: number;
    unknown: number;
    total: number;
  };
  overall: {
    pass: boolean;
    scorePercent: number;
  };
  metrics: Record<string, string>;
};

const ALLOWED_RESULTS = new Set<CheckResult>(["success", "failure", "cancelled", "skipped", "unknown"]);

export function normalizeResult(value: string | undefined): CheckResult {
  const normalized = String(value ?? "unknown").trim().toLowerCase() as CheckResult;
  if (ALLOWED_RESULTS.has(normalized)) return normalized;
  return "unknown";
}

export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    out: "reports/quality/scorecard.json",
    md: "reports/quality/scorecard.md",
    title: "Skillbase Quality Scorecard",
    checks: [],
    metrics: []
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--out") {
      parsed.out = argv[index + 1] ?? parsed.out;
      index += 1;
      continue;
    }
    if (token === "--md") {
      parsed.md = argv[index + 1] ?? parsed.md;
      index += 1;
      continue;
    }
    if (token === "--title") {
      parsed.title = argv[index + 1] ?? parsed.title;
      index += 1;
      continue;
    }
    if (token === "--check") {
      const raw = argv[index + 1] ?? "";
      const separator = raw.indexOf("=");
      if (separator > 0) {
        const name = raw.slice(0, separator).trim();
        const result = normalizeResult(raw.slice(separator + 1));
        if (name.length > 0) parsed.checks.push({ name, result });
      }
      index += 1;
      continue;
    }
    if (token === "--metric") {
      const raw = argv[index + 1] ?? "";
      const separator = raw.indexOf("=");
      if (separator > 0) {
        const key = raw.slice(0, separator).trim();
        const value = raw.slice(separator + 1).trim();
        if (key.length > 0) parsed.metrics.push({ key, value });
      }
      index += 1;
    }
  }

  return parsed;
}

export function buildScorecard({ title, checks, metrics }: BuildScorecardInput): Scorecard {
  const normalizedChecks: ScorecardCheck[] = checks.map((check) => {
    const result = normalizeResult(check.result);
    return {
      name: check.name,
      result,
      pass: result === "success"
    };
  });

  const totals = {
    success: normalizedChecks.filter((check) => check.result === "success").length,
    failure: normalizedChecks.filter((check) => check.result === "failure").length,
    cancelled: normalizedChecks.filter((check) => check.result === "cancelled").length,
    skipped: normalizedChecks.filter((check) => check.result === "skipped").length,
    unknown: normalizedChecks.filter((check) => check.result === "unknown").length,
    total: normalizedChecks.length
  };

  const scorePercent = totals.total === 0 ? 0 : Number(((totals.success / totals.total) * 100).toFixed(2));
  const pass =
    totals.total > 0 &&
    totals.failure === 0 &&
    totals.cancelled === 0 &&
    totals.unknown === 0 &&
    totals.skipped === 0;

  const metricMap: Record<string, string> = {};
  for (const metric of metrics) metricMap[metric.key] = metric.value;

  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    title,
    checks: normalizedChecks,
    totals,
    overall: {
      pass,
      scorePercent
    },
    metrics: metricMap
  };
}

export function toMarkdown(scorecard: Scorecard): string {
  const lines = [
    `# ${scorecard.title}`,
    "",
    `- Generated: ${scorecard.generatedAt}`,
    `- Overall pass: ${scorecard.overall.pass ? "yes" : "no"}`,
    `- Score: ${scorecard.overall.scorePercent}%`,
    "",
    "## Checks",
    "",
    "| Check | Result | Pass |",
    "| --- | --- | --- |"
  ];

  for (const check of scorecard.checks) {
    lines.push(`| ${check.name} | ${check.result} | ${check.pass ? "yes" : "no"} |`);
  }

  lines.push("", "## Totals", "", "| Metric | Value |", "| --- | --- |");
  lines.push(`| success | ${scorecard.totals.success} |`);
  lines.push(`| failure | ${scorecard.totals.failure} |`);
  lines.push(`| cancelled | ${scorecard.totals.cancelled} |`);
  lines.push(`| skipped | ${scorecard.totals.skipped} |`);
  lines.push(`| unknown | ${scorecard.totals.unknown} |`);
  lines.push(`| total | ${scorecard.totals.total} |`);

  const metricEntries = Object.entries(scorecard.metrics);
  if (metricEntries.length > 0) {
    lines.push("", "## Metrics", "", "| Metric | Value |", "| --- | --- |");
    for (const [key, value] of metricEntries) lines.push(`| ${key} | ${value} |`);
  }

  lines.push("");
  return lines.join("\n");
}
