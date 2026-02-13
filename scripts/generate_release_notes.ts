import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  tag: string;
  scorecardPath: string;
  evidencePath: string;
  artifactManifestPath?: string;
  outPath: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    tag: process.env.GITHUB_REF_NAME ?? "unversioned",
    scorecardPath: "",
    evidencePath: "",
    outPath: ".release/project/release-notes.md"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--tag") {
      parsed.tag = argv[index + 1] ?? parsed.tag;
      index += 1;
      continue;
    }
    if (token === "--scorecard") {
      parsed.scorecardPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--evidence") {
      parsed.evidencePath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--artifact-manifest") {
      parsed.artifactManifestPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--out") {
      parsed.outPath = argv[index + 1] ?? parsed.outPath;
      index += 1;
    }
  }

  if (!parsed.scorecardPath) throw new Error("Missing required --scorecard argument");
  if (!parsed.evidencePath) throw new Error("Missing required --evidence argument");
  return parsed;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function main(): void {
  const args = parseArgs(process.argv);
  const scorecard = asRecord(readJson(resolve(args.scorecardPath)));
  const evidence = asRecord(readJson(resolve(args.evidencePath)));
  const checks = Array.isArray(scorecard.checks) ? scorecard.checks : [];
  const evidenceChecks = Array.isArray(evidence.checks) ? evidence.checks : [];
  const metrics = asRecord(evidence.metrics);

  const lines: string[] = [
    `# Release Notes: ${args.tag}`,
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Scorecard pass: ${asRecord(scorecard.overall).pass === true ? "yes" : "no"}`,
    `- Evidence pass: ${evidence.ok === true ? "yes" : "no"}`,
    ""
  ];

  lines.push("## Gate Summary", "", "| Check | Result |", "| --- | --- |");
  for (const check of checks) {
    const entry = asRecord(check);
    lines.push(`| ${String(entry.name ?? "unknown")} | ${String(entry.result ?? "unknown")} |`);
  }

  lines.push("", "## Evidence Highlights", "", "| Control | Status | Detail |", "| --- | --- | --- |");
  for (const check of evidenceChecks) {
    const entry = asRecord(check);
    const status = entry.ok === true ? "pass" : "fail";
    lines.push(
      `| ${String(entry.name ?? "unknown")} | ${status} | ${String(entry.detail ?? "").replaceAll("\n", " ")} |`
    );
  }

  lines.push("", "## Metrics", "", "| Metric | Value |", "| --- | --- |");
  for (const [key, value] of Object.entries(metrics)) {
    lines.push(`| ${key} | ${String(value)} |`);
  }

  if (args.artifactManifestPath) {
    const manifest = asRecord(readJson(resolve(args.artifactManifestPath)));
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    lines.push("", "## Release Artifacts", "", "| Artifact | SHA256 | Size (bytes) |", "| --- | --- | --- |");
    for (const entry of files) {
      const file = asRecord(entry);
      lines.push(`| ${String(file.path ?? "")} | ${String(file.sha256 ?? "")} | ${String(file.sizeBytes ?? "")} |`);
    }
  }

  lines.push("");

  const outPath = resolve(args.outPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join("\n"), "utf8");
  process.stdout.write(`${outPath}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
