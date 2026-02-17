import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { load } from "js-yaml";

type CliArgs = {
  outPath: string;
  repoRoot: string;
  showHelp: boolean;
};

type WorkflowJobReport = {
  id: string;
  steps: number;
  ok: boolean;
};

type WorkflowReport = {
  file: string;
  ok: boolean;
  jobs: WorkflowJobReport[];
};

type HardeningReport = {
  schemaVersion: "1.0";
  generatedAt: string;
  ok: boolean;
  requiredWorkflows: string[];
  workflows: WorkflowReport[];
  failures: string[];
};

const DEFAULT_OUT_PATH = "reports/quality/ci-hardening.json";
const REQUIRED_WORKFLOWS = ["ci.yml", "codeql.yml"];

function printUsage(): void {
  const lines = [
    "Usage: pnpm tsx scripts/verify_ci_hardening.ts [options]",
    "",
    "Options:",
    "  --out <path>        Output JSON report path (default: reports/quality/ci-hardening.json)",
    "  --repo-root <path>  Repository root to inspect (default: cwd)",
    "  --help, -h          Show this help",
    "",
    "Checks:",
    "  - Required workflow files exist (ci.yml + codeql.yml).",
    "  - Every workflow has jobs.",
    "  - Every job has at least one executable step.",
    "  - CI workflow contains a verify step; CodeQL workflow contains analyze usage."
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function parseArgs(argv: string[]): CliArgs {
  let outPath = DEFAULT_OUT_PATH;
  let repoRoot = process.cwd();
  let showHelp = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      showHelp = true;
      continue;
    }
    if (arg === "--out") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) throw new Error("Missing value for --out");
      outPath = value;
      i += 1;
      continue;
    }
    if (arg === "--repo-root") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) throw new Error("Missing value for --repo-root");
      repoRoot = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown ci hardening argument '${arg}'`);
  }
  return { outPath, repoRoot, showHelp };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function verifyWorkflow(filePath: string): WorkflowReport {
  const raw = readFileSync(filePath, "utf8");
  const parsed = load(raw) as unknown;
  const root = asRecord(parsed);
  const jobsRaw = asRecord(root.jobs);
  const jobs: WorkflowJobReport[] = Object.entries(jobsRaw).map(([jobId, jobValue]) => {
    const job = asRecord(jobValue);
    const steps = Array.isArray(job.steps) ? job.steps : [];
    const executableSteps = steps.filter((step) => {
      const candidate = asRecord(step);
      return typeof candidate.run === "string" || typeof candidate.uses === "string";
    });
    return {
      id: jobId,
      steps: executableSteps.length,
      ok: executableSteps.length > 0
    };
  });
  return {
    file: filePath,
    ok: jobs.length > 0 && jobs.every((job) => job.ok),
    jobs
  };
}

function generateReport(repoRoot: string): HardeningReport {
  const workflowsDir = resolve(repoRoot, ".github", "workflows");
  const failures: string[] = [];
  if (!existsSync(workflowsDir)) {
    failures.push(`Missing workflows directory: ${workflowsDir}`);
    return {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      ok: false,
      requiredWorkflows: REQUIRED_WORKFLOWS,
      workflows: [],
      failures
    };
  }

  for (const required of REQUIRED_WORKFLOWS) {
    if (!existsSync(join(workflowsDir, required))) failures.push(`Missing required workflow file: ${required}`);
  }

  const workflowFiles = readdirSync(workflowsDir)
    .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
    .map((entry) => join(workflowsDir, entry))
    .sort((left, right) => left.localeCompare(right));

  const workflows = workflowFiles.map((filePath) => verifyWorkflow(filePath));
  for (const workflow of workflows) {
    if (!workflow.ok) failures.push(`Workflow has empty jobs or steps: ${workflow.file}`);
    for (const job of workflow.jobs) {
      if (!job.ok) failures.push(`Job '${job.id}' in ${workflow.file} has no executable steps`);
    }
  }

  const ciPath = join(workflowsDir, "ci.yml");
  if (existsSync(ciPath)) {
    const ciRaw = readFileSync(ciPath, "utf8");
    if (!ciRaw.includes("pnpm verify")) failures.push("ci.yml does not include 'pnpm verify' gate execution");
  }
  const codeqlPath = join(workflowsDir, "codeql.yml");
  if (existsSync(codeqlPath)) {
    const codeqlRaw = readFileSync(codeqlPath, "utf8");
    if (!codeqlRaw.includes("analyze")) failures.push("codeql.yml does not include analyze step usage");
  }

  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    ok: failures.length === 0,
    requiredWorkflows: REQUIRED_WORKFLOWS,
    workflows,
    failures
  };
}

function writeReport(outPath: string, report: HardeningReport): void {
  const resolved = resolve(outPath);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function main(): void {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.showHelp) {
      printUsage();
      process.exit(0);
    }
    const report = generateReport(resolve(args.repoRoot));
    writeReport(args.outPath, report);
    process.stdout.write(`${resolve(args.outPath)}\n`);
    process.exit(report.ok ? 0 : 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

main();
