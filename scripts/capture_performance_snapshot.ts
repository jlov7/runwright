import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

type ParsedArgs = {
  outPath: string;
  skills: number;
  iterations: number;
  sourceDateEpoch: string;
};

type Snapshot = {
  schemaVersion: "1.0";
  generatedAt: string;
  platform: string;
  nodeVersion: string;
  sample: {
    skills: number;
    iterations: number;
  };
  metrics: {
    updateMs: number;
    exportMedianMs: number;
    verifyMedianMs: number;
  };
};

const PROJECT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TSX_CLI_PATH = resolve(PROJECT_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    outPath: "reports/performance/current.snapshot.json",
    skills: 120,
    iterations: 3,
    sourceDateEpoch: "1704067200"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--out") {
      parsed.outPath = argv[index + 1] ?? parsed.outPath;
      index += 1;
      continue;
    }
    if (token === "--skills") {
      const raw = Number(argv[index + 1] ?? "");
      if (!Number.isInteger(raw) || raw <= 0) throw new Error("--skills must be a positive integer");
      parsed.skills = raw;
      index += 1;
      continue;
    }
    if (token === "--iterations") {
      const raw = Number(argv[index + 1] ?? "");
      if (!Number.isInteger(raw) || raw < 1) throw new Error("--iterations must be an integer >= 1");
      parsed.iterations = raw;
      index += 1;
      continue;
    }
    if (token === "--source-date-epoch") {
      parsed.sourceDateEpoch = argv[index + 1] ?? parsed.sourceDateEpoch;
      index += 1;
    }
  }

  return parsed;
}

function runCli(args: string[], cwd: string, envOverrides?: Record<string, string>): { status: number; elapsedMs: number } {
  const startedAtNs = process.hrtime.bigint();
  const result = spawnSync(process.execPath, [TSX_CLI_PATH, resolve(PROJECT_ROOT, "src/cli.ts"), ...args], {
    cwd,
    encoding: "utf8",
    env: envOverrides ? { ...process.env, ...envOverrides } : process.env
  });
  const elapsedMs = Number((process.hrtime.bigint() - startedAtNs) / BigInt(1_000_000));
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed (${args.join(" ")}): ${result.stderr || result.stdout}`);
  }
  return { status: result.status ?? 1, elapsedMs };
}

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? Math.round((ordered[mid - 1]! + ordered[mid]!) / 2)
    : ordered[mid]!;
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function main(): void {
  const args = parseArgs(process.argv);
  const outPath = resolve(args.outPath);
  const tempDir = mkdtempSync(join(tmpdir(), "skillbase-perf-snapshot-"));

  try {
    for (let index = 0; index < args.skills; index += 1) {
      const skillName = `skill-${String(index).padStart(3, "0")}`;
      mkdirSync(join(tempDir, "skills", skillName), { recursive: true });
      writeFileSync(
        join(tempDir, "skills", skillName, "SKILL.md"),
        `---\nname: ${skillName}\ndescription: ${skillName}\n---\n\n# ${skillName}\n`,
        "utf8"
      );
    }
    writeFileSync(
      join(tempDir, "skillbase.yml"),
      `version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\napply:\n  useSkillsets: [base]\n`,
      "utf8"
    );

    const update = runCli(["update"], tempDir);
    const exportDurations: number[] = [];
    const verifyDurations: number[] = [];
    const bundlePath = join(tempDir, "bundle.zip");

    for (let iteration = 0; iteration < args.iterations; iteration += 1) {
      const exported = runCli(
        ["export", "--out", bundlePath, "--deterministic"],
        tempDir,
        { SOURCE_DATE_EPOCH: args.sourceDateEpoch }
      );
      exportDurations.push(exported.elapsedMs);
      const verified = runCli(["verify-bundle", "--bundle", bundlePath, "--json"], tempDir);
      verifyDurations.push(verified.elapsedMs);
    }

    const snapshot: Snapshot = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      sample: {
        skills: args.skills,
        iterations: args.iterations
      },
      metrics: {
        updateMs: update.elapsedMs,
        exportMedianMs: median(exportDurations),
        verifyMedianMs: median(verifyDurations)
      }
    };

    writeJson(outPath, snapshot);
    process.stdout.write(`${outPath}\n`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
