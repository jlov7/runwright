import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type DoctorCheckId = "lint" | "typecheck" | "test" | "build" | "audit:deps" | "policy:explain";

type DoctorCheck = {
  id: DoctorCheckId;
  command: string;
  args: string[];
};

type DoctorCheckResult = {
  id: DoctorCheckId;
  command: string;
  args: string[];
  status: number;
  ok: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
};

type DoctorReport = {
  schemaVersion: "1.0";
  generatedAt: string;
  cwd: string;
  overall: {
    ok: boolean;
    succeeded: number;
    failed: number;
    total: number;
    totalDurationMs: number;
  };
  checks: DoctorCheckResult[];
};

type ParsedArgs = {
  out: string;
  only: string[];
  skip: string[];
};

const PNPM_COMMAND = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const NODE_COMMAND = process.execPath;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TSX_CLI_PATH = resolve(PROJECT_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const RUNWRIGHT_CLI_PATH = resolve(PROJECT_ROOT, "src", "cli.ts");
const MANIFEST_FILENAMES = ["runwright.yml", "runwright.json", "skillbase.yml", "skillbase.json"];
const POLICY_EXPLAIN_ARTIFACT = "reports/policy/policy-explain.json";

const DEFAULT_CHECKS: DoctorCheck[] = [
  { id: "lint", command: PNPM_COMMAND, args: ["run", "lint"] },
  { id: "typecheck", command: PNPM_COMMAND, args: ["run", "typecheck"] },
  { id: "test", command: PNPM_COMMAND, args: ["run", "test"] },
  { id: "build", command: PNPM_COMMAND, args: ["run", "build"] },
  { id: "audit:deps", command: PNPM_COMMAND, args: ["run", "audit:deps"] },
  {
    id: "policy:explain",
    command: NODE_COMMAND,
    args: [TSX_CLI_PATH, RUNWRIGHT_CLI_PATH, "policy", "check", "--explain", "--json"]
  }
];

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function renderUsage(): string {
  return [
    "Usage: pnpm tsx scripts/doctor.ts [options]",
    "",
    "Options:",
    "  --out <path>       Output JSON report path (default: reports/doctor/doctor.json)",
    "  --only <check>     Run only a specific check (repeatable)",
    "  --skip <check>     Skip a specific check (repeatable)",
    "  --help, -h         Show this help message",
    "",
    "Checks:",
    `  ${DEFAULT_CHECKS.map((check) => check.id).join(", ")}`
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
  const parsed: ParsedArgs = {
    out: "reports/doctor/doctor.json",
    only: [],
    skip: []
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--out") {
      parsed.out = readRequiredArgValue(argv, index, "--out");
      index += 1;
      continue;
    }
    if (token === "--only") {
      const value = readRequiredArgValue(argv, index, "--only").trim();
      if (value.length > 0) parsed.only.push(value);
      index += 1;
      continue;
    }
    if (token === "--skip") {
      const value = readRequiredArgValue(argv, index, "--skip").trim();
      if (value.length > 0) parsed.skip.push(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown doctor argument '${token}'`);
  }

  return parsed;
}

function parseMockStatus(raw: string | undefined): number | null {
  if (typeof raw === "undefined") return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("RUNWRIGHT_DOCTOR_MOCK_STATUS must be a non-negative integer");
  }
  return parsed;
}

function manifestExists(cwd: string): boolean {
  return MANIFEST_FILENAMES.some((filename) => existsSync(resolve(cwd, filename)));
}

function selectChecks(checks: DoctorCheck[], args: ParsedArgs): DoctorCheck[] {
  const known = new Set(checks.map((check) => check.id));
  for (const value of [...args.only, ...args.skip]) {
    if (!known.has(value as DoctorCheckId)) throw new Error(`Unknown doctor check '${value}'`);
  }

  let selected = [...checks];
  if (args.only.length > 0) {
    const allow = new Set(args.only);
    selected = selected.filter((check) => allow.has(check.id));
  }
  if (args.skip.length > 0) {
    const deny = new Set(args.skip);
    selected = selected.filter((check) => !deny.has(check.id));
  }
  return selected;
}

function runCheck(check: DoctorCheck, mockStatus: number | null): DoctorCheckResult {
  const startedAt = Date.now();
  if (typeof mockStatus === "number") {
    return {
      id: check.id,
      command: check.command,
      args: check.args,
      status: mockStatus,
      ok: mockStatus === 0,
      durationMs: Date.now() - startedAt,
      stdout: `[mock] ${check.command} ${check.args.join(" ")}`,
      stderr: ""
    };
  }

  const result = spawnSync(check.command, check.args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  const status = result.status ?? 1;
  return {
    id: check.id,
    command: check.command,
    args: check.args,
    status,
    ok: status === 0,
    durationMs: Date.now() - startedAt,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function runPolicyExplainCheck(check: DoctorCheck, mockStatus: number | null, cwd: string): DoctorCheckResult {
  const startedAt = Date.now();
  if (!manifestExists(cwd)) {
    return {
      id: check.id,
      command: check.command,
      args: check.args,
      status: 0,
      ok: true,
      durationMs: Date.now() - startedAt,
      stdout: "Skipped policy:explain (no manifest found)",
      stderr: ""
    };
  }

  if (typeof mockStatus === "number") {
    return {
      id: check.id,
      command: check.command,
      args: check.args,
      status: mockStatus,
      ok: mockStatus === 0,
      durationMs: Date.now() - startedAt,
      stdout: `[mock] ${check.command} ${check.args.join(" ")}`,
      stderr: ""
    };
  }

  const result = spawnSync(check.command, check.args, {
    cwd,
    encoding: "utf8"
  });
  const status = result.status ?? 1;
  const stdout = result.stdout;
  const stderr = result.stderr;

  let payload: unknown | null = null;
  let parseError: string | null = null;
  if (stdout.trim().length > 0) {
    try {
      payload = JSON.parse(stdout) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      parseError = `Unable to parse policy explain JSON: ${message}`;
    }
  } else {
    parseError = "Policy explain command returned empty output";
  }

  if (payload) {
    const outPath = resolve(cwd, POLICY_EXPLAIN_ARTIFACT);
    writeJson(outPath, payload);
  }

  const combinedStderr = parseError ? [stderr, parseError].filter(Boolean).join("\n") : stderr;
  return {
    id: check.id,
    command: check.command,
    args: check.args,
    status,
    ok: status === 0 && !parseError,
    durationMs: Date.now() - startedAt,
    stdout,
    stderr: combinedStderr
  };
}

function main(): void {
  if (hasHelpFlag(process.argv)) {
    process.stdout.write(`${renderUsage()}\n`);
    return;
  }

  const args = parseArgs(process.argv);
  const checks = selectChecks(DEFAULT_CHECKS, args);
  const mockStatus = parseMockStatus(process.env.RUNWRIGHT_DOCTOR_MOCK_STATUS);

  const runStartedAt = Date.now();
  const results = checks.map((check) =>
    check.id === "policy:explain" ? runPolicyExplainCheck(check, mockStatus, process.cwd()) : runCheck(check, mockStatus)
  );

  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;
  const report: DoctorReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    cwd: process.cwd(),
    overall: {
      ok: failed === 0,
      succeeded,
      failed,
      total: results.length,
      totalDurationMs: Date.now() - runStartedAt
    },
    checks: results
  };

  const outPath = resolve(args.out);
  writeJson(outPath, report);
  process.stdout.write(`${outPath}\n`);
  if (!report.overall.ok) process.exit(1);
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
