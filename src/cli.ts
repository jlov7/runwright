#!/usr/bin/env node
import {
  createPrivateKey,
  createPublicKey,
  createHmac,
  createHash,
  sign as signData,
  timingSafeEqual,
  verify as verifyData
} from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  readdirSync as readdirSyncFs,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { claudeAdapter } from "./adapters/claude.js";
import { codexAdapter } from "./adapters/codex.js";
import { cursorAdapter } from "./adapters/cursor.js";
import {
  buildLockfileFromSources,
  computeSkillDigest,
  lockfilesEqual,
  type SkillbaseLockfile,
  readLockfile,
  writeLockfile
} from "./lockfile.js";
import { parseManifest, type SkillbaseManifest } from "./manifest.js";
import { evaluatePolicyRules } from "./policy/engine.js";
import { mergePolicyRules, parsePolicyRulePack } from "./policy/rule-pack.js";
import type { ManifestPolicyRule, PolicyContext } from "./policy/types.js";
import { lintSkillDir } from "./scanner/lint.js";
import { scanSkillDir, type SecurityRuleId } from "./scanner/security.js";
import { TrustVerificationError, resolveSkillUnits, type SkillUnit } from "./resolver.js";
import { materializeSkillsToStore } from "./store.js";

type TargetName = "codex" | "claude-code" | "cursor";
type InstallMode = "link" | "copy" | "mirror";
type InstallScope = "global" | "project";
type SecurityMode = "off" | "warn" | "fail";
type ScanFormat = "text" | "json" | "sarif";
type PolicyFormat = "text" | "json";
type FindingSeverity = "high" | "medium";

type ManifestScanPolicy = NonNullable<NonNullable<SkillbaseManifest["defaults"]>["scan"]>;
type ScanPolicyAllowlistEntry = NonNullable<ManifestScanPolicy["allowlist"]>[number];
type ScanPolicyConfig = {
  allowRuleIds: SecurityRuleId[];
  severityOverrides: Partial<Record<SecurityRuleId, FindingSeverity>>;
  allowlist: ScanPolicyAllowlistEntry[];
};

type TrustSummary = {
  totalSources: number;
  verifiedSources: number;
  untrustedSources: number;
  requiredSources: number;
};

type ApplyOperation = {
  target: TargetName;
  mode: InstallMode;
  source: string;
  destination: string;
};

type TargetApplyPlan = {
  target: TargetName;
  mode: InstallMode;
  installDir: string;
  skills: Array<{ source: string; skillName: string }>;
};

type DoctorIssue = {
  type: "broken-symlink" | "invalid-skill" | "duplicate-skill";
  message: string;
  path?: string;
};

type FixActionType =
  | "update-lockfile"
  | "address-security-findings"
  | "resolve-allowlist-entries"
  | "resolve-policy-denies"
  | "verify-trusted-sources";

type FixRiskLevel = "low" | "medium" | "high";

type FixAction = {
  type: FixActionType;
  message: string;
  reversible: boolean;
  target: string;
  risk: FixRiskLevel;
};

type ParsedArgs = {
  command?: string;
  flags: Map<string, string | boolean>;
  positionals: string[];
  duplicateFlags: string[];
};

type FlagValueType = "boolean" | "string";
const JSON_CONTRACT_SCHEMA_VERSION = "1.0";
const DEFAULT_OPERATION_LOG_PATH = ".skillbase/operations.jsonl";
const DEFAULT_APPLY_JOURNAL_PATH = ".skillbase/apply-journal.json";
const PRIMARY_MANIFEST_FILENAMES = ["runwright.yml", "runwright.json"] as const;
const LEGACY_MANIFEST_FILENAMES = ["skillbase.yml", "skillbase.json"] as const;

const adapters: Record<
  TargetName,
  {
    resolveInstallDir: (scope: InstallScope, cwd: string, homeDir: string) => string;
  }
> = {
  codex: codexAdapter,
  "claude-code": claudeAdapter,
  cursor: cursorAdapter
};

class CliError extends Error {
  exitCode: number;
  code?: string;

  constructor(message: string, exitCode: number, code?: string) {
    super(message);
    this.exitCode = exitCode;
    this.code = code;
  }
}

type CommandHelpEntry = {
  summary: string;
  usage: string[];
  examples: string[];
};

const COMMAND_HELP: Record<string, CommandHelpEntry> = {
  init: {
    summary: "Create starter manifest and baseline ignore rules.",
    usage: ["runwright init [--json]"],
    examples: ["runwright init", "runwright init --json"]
  },
  journey: {
    summary: "Show your current onboarding progress and the single best next action.",
    usage: ["runwright journey [--json]"],
    examples: ["runwright journey", "runwright journey --json"]
  },
  mission: {
    summary: "Mission control dashboard for onboarding, trust, quality, and one-command actions.",
    usage: [
      "runwright mission [--action journey|scan|policy-check|fix-plan|apply-dry-run] [--json]",
      "                 [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: ["runwright mission --json", "runwright mission --action scan --json"]
  },
  apply: {
    summary: "Install resolved skills into target tools (safe by default with scanning).",
    usage: [
      "runwright apply [--mode link|copy|mirror] [--target codex|claude-code|cursor|all]",
      "               [--scope global|project] [--dry-run] [--json] [--no-scan]",
      "               [--scan-security off|warn|fail] [--fix] [--frozen-lockfile]",
      "               [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: [
      "runwright apply --target all --scope project --mode copy --dry-run --json",
      "runwright apply --target codex --scope project --mode copy",
      "runwright apply --frozen-lockfile --target all --scope project --mode copy --json"
    ]
  },
  "apply-resume": {
    summary: "Recover from interrupted apply transactions using the persisted apply journal.",
    usage: ["runwright apply-resume [--json]"],
    examples: ["runwright apply-resume", "runwright apply-resume --json"]
  },
  remediate: {
    summary: "Guide remediation actions from scan/policy/doctor signals, with optional safe apply.",
    usage: [
      "runwright remediate [--json] [--non-interactive] [--apply-safe] [--rule-pack <path>]",
      "                   [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: ["runwright remediate --non-interactive --json", "runwright remediate --apply-safe --json"]
  },
  watch: {
    summary: "Continuously watch project drift and run update -> scan -> apply (or dry-run) loops.",
    usage: [
      "runwright watch [--once] [--apply-safe] [--debounce-ms <ms>] [--target ...] [--scope ...] [--mode ...] [--json]",
      "               [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: ["runwright watch --once --json", "runwright watch --apply-safe --target codex --scope project --mode copy"]
  },
  doctor: {
    summary: "Diagnose and optionally fix safe local install issues.",
    usage: ["runwright doctor [--fix] [--json] [--target ...] [--scope ...]"],
    examples: ["runwright doctor", "runwright doctor --fix --json"]
  },
  scan: {
    summary: "Run lint and security checks on resolved skills.",
    usage: [
      "runwright scan [--lint-only] [--security off|warn|fail] [--format text|json|sarif]",
      "               [--policy-decisions-out <path>] [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: [
      "runwright scan --format json",
      "runwright scan --security fail --format sarif",
      "runwright scan --policy-decisions-out reports/policy-decisions.jsonl --format json"
    ]
  },
  policy: {
    summary: "Check manifest scan-policy exceptions and expiry health.",
    usage: [
      "runwright policy check [--format text|json] [--json] [--explain] [--rule-pack <path>]",
      "                      [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: ["runwright policy check", "runwright policy check --explain --rule-pack team-policy.json --json"]
  },
  fix: {
    summary: "Plan and optionally apply safe remediations for policy/scan findings.",
    usage: [
      "runwright fix [--plan] [--apply] [--autopilot] [--max-risk low|medium|high]",
      "             [--json] [--rule-pack <path>] [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: [
      "runwright fix --plan --json",
      "runwright fix --autopilot --max-risk medium --json",
      "runwright fix --apply --rule-pack team-policy.json --json"
    ]
  },
  list: {
    summary: "List resolved skills and effective target install paths.",
    usage: ["runwright list [--json] [--target ...] [--scope ...] [--refresh-sources] [--remote-cache-ttl <seconds>]"],
    examples: ["runwright list --json", "runwright list --target codex --scope project --json"]
  },
  update: {
    summary: "Resolve sources and write deterministic lockfile.",
    usage: ["runwright update [--frozen-lockfile] [--json] [--refresh-sources] [--remote-cache-ttl <seconds>]"],
    examples: ["runwright update --json", "runwright update --frozen-lockfile --json"]
  },
  export: {
    summary: "Package manifest, lockfile, and skills into a verifiable bundle.",
    usage: [
      "runwright export [--out <bundle.zip>] [--sign-key <path>] [--sign-private-key <path>]",
      "                 [--deterministic] [--json] [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: [
      "runwright export --out runwright-release.zip --deterministic --json",
      "runwright export --out runwright-release.zip --sign-private-key private.pem --deterministic --json"
    ]
  },
  registry: {
    summary: "Push and pull signed bundles from a shared team registry directory.",
    usage: [
      "runwright registry push --registry-dir <path> --bundle <bundle.zip> --sign-private-key <key.pem> [--source-ref <ref>] [--json]",
      "runwright registry pull --registry-dir <path> [--artifact-id <id>] --sign-public-key <key.pem> [--out <bundle.zip>] [--json]"
    ],
    examples: [
      "runwright registry push --registry-dir .runwright-registry --bundle runwright-release.zip --sign-private-key release-private.pem --json",
      "runwright registry pull --registry-dir .runwright-registry --sign-public-key release-public.pem --out synced-bundle.zip --json"
    ]
  },
  "verify-bundle": {
    summary: "Verify bundle integrity and optional signature requirements.",
    usage: [
      "runwright verify-bundle --bundle <bundle.zip> [--sign-key <path>] [--sign-public-key <path>]",
      "                        [--require-signature] [--json]"
    ],
    examples: [
      "runwright verify-bundle --bundle runwright-release.zip --json",
      "runwright verify-bundle --bundle runwright-release.zip --sign-public-key public.pem --require-signature --json"
    ]
  }
};

const KNOWN_TOP_LEVEL_COMMANDS = new Set<string>([...Object.keys(COMMAND_HELP), "help"]);

function levenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[left.length][right.length];
}

function suggestCommand(rawInput: string, candidates: string[]): string | undefined {
  const input = rawInput.trim().toLowerCase();
  if (!input) return undefined;
  if (candidates.includes(input)) return input;
  const threshold = input.length <= 4 ? 2 : Math.max(2, Math.floor(input.length / 3));
  let best: { candidate: string; distance: number } | undefined;

  for (const candidate of candidates) {
    const distance = candidate.startsWith(input) || input.startsWith(candidate)
      ? Math.abs(candidate.length - input.length)
      : levenshteinDistance(input, candidate);
    if (!best || distance < best.distance) best = { candidate, distance };
  }

  if (!best || best.distance > threshold) return undefined;
  return best.candidate;
}

function renderUnknownHelpTopic(topic: string): string {
  const suggestion = suggestCommand(topic, Object.keys(COMMAND_HELP));
  if (!suggestion) {
    return [`Unknown help topic: ${topic}`, "Run `runwright help` to list supported commands."].join("\n");
  }
  return [
    `Unknown help topic: ${topic}`,
    `Did you mean: runwright help ${suggestion}`,
    "Run `runwright help` to list supported commands."
  ].join("\n");
}

function renderUnknownCommandMessage(command: string): string {
  const suggestion = suggestCommand(command, Object.keys(COMMAND_HELP));
  if (!suggestion) {
    return [
      `Unknown command: ${command}`,
      "Run `runwright help` to see available commands.",
      "Need guided onboarding? Run `runwright journey`."
    ].join("\n");
  }
  return [
    `Unknown command: ${command}`,
    `Did you mean: runwright ${suggestion}`,
    "Run `runwright help` to see available commands.",
    "Need guided onboarding? Run `runwright journey`."
  ].join("\n");
}

function formatCliErrorGuidance(error: CliError, failedCommand?: string): string {
  const helpForCommand = failedCommand && COMMAND_HELP[failedCommand] ? `runwright ${failedCommand} --help` : "runwright help";
  const hints: string[] = [];

  switch (error.code) {
    case "missing-manifest":
      hints.push("runwright init", "runwright journey");
      break;
    case "invalid-manifest":
      hints.push("Fix manifest keys/types, then rerun your command.");
      hints.push("Reference: MANIFEST_SPEC.md");
      break;
    case "invalid-flag":
    case "invalid-argument":
    case "invalid-format":
    case "invalid-policy-pack":
      hints.push(helpForCommand);
      break;
    case "lockfile-error":
      hints.push("runwright update --json", "Retry your previous command.");
      break;
    case "source-resolution-failed":
      if (failedCommand && COMMAND_HELP[failedCommand]) {
        hints.push(`runwright ${failedCommand} --refresh-sources`);
      }
      hints.push("Check source refs in runwright.yml (legacy skillbase.yml is also supported).");
      break;
    case "trust-verification-failed": {
      const refreshTarget =
        failedCommand && COMMAND_HELP[failedCommand] ? `runwright ${failedCommand}` : "runwright scan";
      hints.push("Review defaults.trust keys and rules in runwright.yml.");
      hints.push(`${refreshTarget} --refresh-sources`);
      break;
    }
    case "bundle-verification-failed":
    case "invalid-bundle-manifest":
    case "invalid-bundle-archive":
      hints.push("Re-export bundle from a trusted source and rerun verify-bundle.");
      break;
    default:
      if (error.exitCode === 10) hints.push("runwright journey");
      break;
  }

  const helpLines = [helpForCommand, "docs/help/troubleshooting.md"];
  if (hints.length === 0) return `${error.message}\n\nHelp:\n${helpLines.map((line) => `  ${line}`).join("\n")}`;
  return [
    error.message,
    "",
    "Next:",
    ...hints.map((hint) => `  ${hint}`),
    "",
    "Help:",
    ...helpLines.map((line) => `  ${line}`)
  ].join("\n");
}

function usage(command?: string): boolean {
  if (command) {
    const entry = COMMAND_HELP[command];
    if (!entry) {
      console.log(`${renderUnknownHelpTopic(command)}\n`);
      usage();
      return false;
    }
    console.log(
      [
        `runwright ${command}`,
        "",
        entry.summary,
        "",
        "Usage:",
        ...entry.usage.map((line) => `  ${line}`),
        "",
        "Examples:",
        ...entry.examples.map((line) => `  ${line}`),
        ""
      ].join("\n")
    );
    return true;
  }

  console.log(`runwright

Policy-first manifest manager for agent skills.

Start here:
  1) runwright init
  2) runwright journey
  3) runwright update --json
  4) runwright scan --format json
  5) runwright apply --target all --scope project --mode copy --dry-run --json

First success moment:
  runwright apply --target all --scope project --mode copy --json

Core loop after first success:
  Edit skill -> runwright update --json -> runwright scan --format json -> runwright apply --target all --scope project --mode copy --json

Core commands:
  runwright init
  runwright journey
  runwright mission
  runwright apply
  runwright apply-resume
  runwright remediate
  runwright watch
  runwright doctor
  runwright scan
  runwright policy check
  runwright fix
  runwright list
  runwright update
  runwright export
  runwright registry
  runwright verify-bundle

Help:
  runwright journey
  runwright help
  runwright help <command>
  runwright <command> --help

Docs:
  docs/help/README.md
  docs/help/troubleshooting.md
`);
  return true;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  const positionals: string[] = [];
  const duplicateFlags: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (flags.has(key)) duplicateFlags.push(key);
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      i += 1;
    } else {
      flags.set(key, true);
    }
  }
  return { command, flags, positionals, duplicateFlags };
}

const FLAG_SPECS_BY_COMMAND: Record<string, Record<string, FlagValueType>> = {
  init: { json: "boolean" },
  journey: { json: "boolean" },
  mission: { action: "string", json: "boolean", "refresh-sources": "boolean", "remote-cache-ttl": "string" },
  apply: {
    mode: "string",
    target: "string",
    scope: "string",
    "dry-run": "boolean",
    json: "boolean",
    "no-scan": "boolean",
    "scan-security": "string",
    fix: "boolean",
    "refresh-sources": "boolean",
    "remote-cache-ttl": "string",
    "frozen-lockfile": "boolean"
  },
  "apply-resume": { json: "boolean" },
  remediate: {
    json: "boolean",
    "non-interactive": "boolean",
    "apply-safe": "boolean",
    "rule-pack": "string",
    "refresh-sources": "boolean",
    "remote-cache-ttl": "string"
  },
  watch: {
    once: "boolean",
    "apply-safe": "boolean",
    "debounce-ms": "string",
    target: "string",
    scope: "string",
    mode: "string",
    json: "boolean",
    "refresh-sources": "boolean",
    "remote-cache-ttl": "string"
  },
  doctor: { fix: "boolean", json: "boolean", target: "string", scope: "string" },
  scan: {
    "lint-only": "boolean",
    security: "string",
    format: "string",
    "policy-decisions-out": "string",
    json: "boolean",
    "refresh-sources": "boolean",
    "remote-cache-ttl": "string"
  },
  policy: {
    format: "string",
    json: "boolean",
    explain: "boolean",
    "rule-pack": "string",
    "refresh-sources": "boolean",
    "remote-cache-ttl": "string"
  },
  fix: {
    plan: "boolean",
    apply: "boolean",
    autopilot: "boolean",
    "max-risk": "string",
    json: "boolean",
    "rule-pack": "string",
    "refresh-sources": "boolean",
    "remote-cache-ttl": "string"
  },
  list: { json: "boolean", target: "string", scope: "string", "refresh-sources": "boolean", "remote-cache-ttl": "string" },
  update: { "frozen-lockfile": "boolean", "refresh-sources": "boolean", "remote-cache-ttl": "string", json: "boolean" },
  export: {
    out: "string",
    "sign-key": "string",
    "sign-private-key": "string",
    deterministic: "boolean",
    json: "boolean",
    "refresh-sources": "boolean",
    "remote-cache-ttl": "string"
  },
  registry: {
    "registry-dir": "string",
    bundle: "string",
    "artifact-id": "string",
    out: "string",
    "source-ref": "string",
    "sign-private-key": "string",
    "sign-public-key": "string",
    json: "boolean"
  },
  "verify-bundle": {
    bundle: "string",
    "sign-key": "string",
    "sign-public-key": "string",
    "require-signature": "boolean",
    json: "boolean"
  }
};
const PROCESS_STARTED_AT_MS = Date.now();

function validateAllowedFlags(args: ParsedArgs): void {
  if (!args.command) return;
  const specs = FLAG_SPECS_BY_COMMAND[args.command];
  if (!specs) return;
  if (args.duplicateFlags.length > 0) {
    throw new CliError(
      `Duplicate flags are not allowed for command '${args.command}': ${args.duplicateFlags.map((flag) => `--${flag}`).join(", ")}`,
      1,
      "invalid-argument"
    );
  }
  if (args.command === "policy") {
    if (args.positionals.length !== 1 || args.positionals[0] !== "check") {
      throw new CliError("policy command requires subcommand: policy check", 1, "invalid-argument");
    }
  } else if (args.command === "registry") {
    const subcommand = args.positionals[0];
    if (args.positionals.length !== 1 || (subcommand !== "push" && subcommand !== "pull")) {
      throw new CliError("registry command requires subcommand: registry push|pull", 1, "invalid-argument");
    }
  } else if (args.positionals.length > 0) {
    throw new CliError(
      `Unexpected positional arguments for command '${args.command}': ${args.positionals.join(" ")}`,
      1,
      "invalid-argument"
    );
  }
  for (const [key, value] of args.flags.entries()) {
    const expectedType = specs[key];
    if (!expectedType) {
      throw new CliError(`Unknown flag '--${key}' for command '${args.command}'`, 1, "invalid-flag");
    }
    if (expectedType === "boolean" && value !== true) {
      throw new CliError(`Flag '--${key}' for command '${args.command}' does not accept a value`, 1, "invalid-argument");
    }
    if (expectedType === "string" && typeof value !== "string") {
      throw new CliError(`Flag '--${key}' for command '${args.command}' requires a value`, 1, "invalid-argument");
    }
  }
}

function getStringFlag(args: ParsedArgs, key: string): string | undefined {
  const value = args.flags.get(key);
  if (typeof value === "string") return value;
  return undefined;
}

function getBooleanFlag(args: ParsedArgs, key: string): boolean {
  return args.flags.get(key) === true;
}

function resolveManifestFile(cwd: string): { path: string; filename: string } | undefined {
  const filenames = [...PRIMARY_MANIFEST_FILENAMES, ...LEGACY_MANIFEST_FILENAMES];
  for (const filename of filenames) {
    const path = resolve(cwd, filename);
    if (existsSync(path)) return { path, filename };
  }
  return undefined;
}

function loadManifest(cwd: string): SkillbaseManifest {
  const manifestRef = resolveManifestFile(cwd);
  if (!manifestRef) {
    throw new CliError(
      "No runwright.yml/runwright.json found (legacy skillbase.yml/skillbase.json is also supported).",
      10,
      "missing-manifest"
    );
  }
  const manifestRaw = readFileSync(manifestRef.path, "utf8");
  const filename = manifestRef.filename;

  try {
    return parseManifest(manifestRaw, { filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(message, 10, "invalid-manifest");
  }
}

function parseTargets(raw: string | undefined): TargetName[] {
  if (!raw || raw === "all") return ["codex", "claude-code", "cursor"];
  if (raw === "codex" || raw === "claude-code" || raw === "cursor") return [raw];
  throw new CliError(`Invalid target: ${raw}`, 1, "invalid-target");
}

function resolveApplyTargets(manifest: SkillbaseManifest, targetFlag: string | undefined): TargetName[] {
  if (targetFlag) return parseTargets(targetFlag);

  const defaultTargets = parseTargets(undefined);
  return defaultTargets.filter((target) => manifest.targets?.[target]?.enabled !== false);
}

function parseScope(raw: string | undefined, fallback: InstallScope): InstallScope {
  if (!raw) return fallback;
  if (raw === "global" || raw === "project") return raw;
  throw new CliError(`Invalid scope: ${raw}`, 1, "invalid-scope");
}

function parseMode(raw: string | undefined, fallback: InstallMode): InstallMode {
  if (!raw) return fallback;
  if (raw === "link" || raw === "copy" || raw === "mirror") return raw;
  throw new CliError(`Invalid mode: ${raw}`, 1, "invalid-mode");
}

function parseSecurityMode(raw: string | undefined, fallback: SecurityMode): SecurityMode {
  if (!raw) return fallback;
  if (raw === "off" || raw === "warn" || raw === "fail") return raw;
  throw new CliError(`Invalid security mode: ${raw}`, 1, "invalid-security-mode");
}

function parseRemoteCacheTtl(raw: string | undefined): number {
  if (!raw) return 3600;
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
    throw new CliError(`Invalid remote cache ttl: ${raw}`, 1, "invalid-remote-cache-ttl");
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new CliError(`Invalid remote cache ttl: ${raw}`, 1, "invalid-remote-cache-ttl");
  }
  return parsed;
}

function parseScanFormat(raw: string | undefined, fallback: ScanFormat): ScanFormat {
  if (!raw) return fallback;
  if (raw === "text" || raw === "json" || raw === "sarif") return raw;
  throw new CliError(`Invalid format: ${raw}`, 1, "invalid-format");
}

function parsePolicyFormat(raw: string | undefined, fallback: PolicyFormat): PolicyFormat {
  if (!raw) return fallback;
  if (raw === "text" || raw === "json") return raw;
  throw new CliError(`Invalid format: ${raw}`, 1, "invalid-format");
}

function parseFixRisk(raw: string | undefined, fallback: FixRiskLevel): FixRiskLevel {
  if (!raw) return fallback;
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  throw new CliError(`Invalid fix risk level: ${raw}`, 1, "invalid-argument");
}

function validateSemanticFlags(args: ParsedArgs): void {
  const command = args.command;
  if (!command) return;

  if (command === "apply") {
    parseTargets(getStringFlag(args, "target"));
    parseScope(getStringFlag(args, "scope"), "project");
    parseMode(getStringFlag(args, "mode"), "link");
    parseSecurityMode(getStringFlag(args, "scan-security"), "warn");
    parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"));
    return;
  }

  if (command === "doctor") {
    parseTargets(getStringFlag(args, "target"));
    parseScope(getStringFlag(args, "scope"), "project");
    return;
  }

  if (command === "mission") {
    const action = getStringFlag(args, "action");
    if (action) parseMissionAction(action);
    parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"));
    return;
  }

  if (command === "scan") {
    parseSecurityMode(getStringFlag(args, "security"), "warn");
    parseScanFormat(getStringFlag(args, "format"), "text");
    parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"));
    return;
  }

  if (command === "policy") {
    parsePolicyFormat(getStringFlag(args, "format"), "text");
    parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"));
    return;
  }

  if (command === "fix") {
    parseFixRisk(getStringFlag(args, "max-risk"), "medium");
    parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"));
    return;
  }

  if (command === "remediate") {
    parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"));
    return;
  }

  if (command === "watch") {
    parseTargets(getStringFlag(args, "target"));
    parseScope(getStringFlag(args, "scope"), "project");
    parseMode(getStringFlag(args, "mode"), "copy");
    const debounceRaw = getStringFlag(args, "debounce-ms");
    if (debounceRaw && (!/^(0|[1-9][0-9]*)$/.test(debounceRaw) || Number(debounceRaw) > 600000)) {
      throw new CliError(`Invalid debounce milliseconds: ${debounceRaw}`, 1, "invalid-argument");
    }
    parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"));
    return;
  }

  if (command === "list") {
    parseTargets(getStringFlag(args, "target"));
    parseScope(getStringFlag(args, "scope"), "project");
    parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"));
    return;
  }

  if (command === "update" || command === "export") {
    parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"));
  }
}

function resolverOptionsFromArgs(args: ParsedArgs): { refreshSources: boolean; remoteCacheTtlSeconds: number } {
  return {
    refreshSources: getBooleanFlag(args, "refresh-sources"),
    remoteCacheTtlSeconds: parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"))
  };
}

type MissionAction = "journey" | "scan" | "policy-check" | "fix-plan" | "apply-dry-run";

function parseMissionAction(raw: string): MissionAction {
  if (
    raw === "journey" ||
    raw === "scan" ||
    raw === "policy-check" ||
    raw === "fix-plan" ||
    raw === "apply-dry-run"
  ) {
    return raw;
  }
  throw new CliError(`Invalid mission action: ${raw}`, 1, "invalid-argument");
}

function resolveEffectivePolicyRules(
  manifest: SkillbaseManifest,
  cwd: string,
  args: ParsedArgs
): ManifestPolicyRule[] {
  const manifestRules = manifest.defaults?.policy?.rules ?? [];
  const rulePackFlag = getStringFlag(args, "rule-pack");
  if (!rulePackFlag) {
    return [...manifestRules].sort((left, right) => left.id.localeCompare(right.id));
  }

  const packPath = resolve(cwd, rulePackFlag);
  let packRaw: unknown;
  try {
    packRaw = JSON.parse(readFileSync(packPath, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Unable to read policy rule pack '${rulePackFlag}': ${message}`, 1, "invalid-policy-pack");
  }
  try {
    const packRules = parsePolicyRulePack(packRaw);
    return mergePolicyRules(manifestRules, packRules);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid policy rule pack '${rulePackFlag}': ${message}`, 1, "invalid-policy-pack");
  }
}

function collectConfiguredSources(manifest: SkillbaseManifest): Set<string> {
  const configured = new Set<string>();
  const skillsets = manifest.skillsets ?? {};
  const selectedSkillsets = manifest.apply?.useSkillsets ?? Object.keys(skillsets);
  for (const skillsetName of selectedSkillsets) {
    const skillset = skillsets[skillsetName];
    if (!skillset) continue;
    for (const ref of skillset.skills) configured.add(ref.source);
  }
  for (const ref of manifest.apply?.extraSkills ?? []) configured.add(ref.source);
  return configured;
}

function resolveSkillUnitsForArgs(
  manifest: SkillbaseManifest,
  cwd: string,
  args: ParsedArgs
): ReturnType<typeof resolveSkillUnits> {
  try {
    return resolveSkillUnits(manifest, cwd, resolverOptionsFromArgs(args));
  } catch (error) {
    if (
      error instanceof TrustVerificationError ||
      (error instanceof Error && error.message.startsWith("Trust verification failed"))
    ) {
      throw new CliError(error.message, 12, "trust-verification-failed");
    }
    if (error instanceof CliError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Source resolution failed: ${message}`, 1, "source-resolution-failed");
  }
}

function summarizeTrustFromSourceMetadata(
  sourceMetadata: ReturnType<typeof resolveSkillUnits>["sourceMetadata"]
): TrustSummary {
  const entries = Object.values(sourceMetadata);
  const withIntegrity = entries.filter((entry) => entry.integrity !== undefined);
  return {
    totalSources: entries.length,
    verifiedSources: withIntegrity.filter((entry) => entry.integrity?.trusted === true).length,
    untrustedSources: withIntegrity.filter((entry) => entry.integrity?.trusted === false).length,
    requiredSources: withIntegrity.filter((entry) => entry.integrity?.required === true).length
  };
}

function summarizeTrustFromLockfile(lockfile: SkillbaseLockfile): TrustSummary {
  const entries = Object.values(lockfile.sources);
  const withIntegrity = entries.filter((entry) => entry.integrity !== undefined);
  return {
    totalSources: entries.length,
    verifiedSources: withIntegrity.filter((entry) => entry.integrity?.trusted === true).length,
    untrustedSources: withIntegrity.filter((entry) => entry.integrity?.trusted === false).length,
    requiredSources: withIntegrity.filter((entry) => entry.integrity?.required === true).length
  };
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function withJsonSchemaVersion(value: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: JSON_CONTRACT_SCHEMA_VERSION,
    ...value
  };
}

type OperationEvent = {
  schemaVersion: string;
  timestamp: string;
  command: string;
  status: number;
  durationMs: number;
  mutating: boolean;
  code?: string;
  counters?: Record<string, number>;
};

type ApplyJournal = {
  schemaVersion: "1.0";
  phase: "target-in-progress";
  target: TargetName;
  installDir: string;
  stagingRoot: string;
  backupDir: string;
  updatedAt: string;
};

function resolveOperationLogPath(cwd: string): string | undefined {
  const override = process.env.SKILLBASE_OPERATION_LOG_PATH?.trim();
  if (override === "off") return undefined;
  const configuredPath = override && override.length > 0 ? override : DEFAULT_OPERATION_LOG_PATH;
  return isAbsolute(configuredPath) ? configuredPath : resolve(cwd, configuredPath);
}

function resolveApplyJournalPath(cwd: string): string {
  return resolve(cwd, DEFAULT_APPLY_JOURNAL_PATH);
}

function readApplyJournal(cwd: string): ApplyJournal | undefined {
  const path = resolveApplyJournalPath(cwd);
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const root = parsed as Record<string, unknown>;
  if (
    root.schemaVersion !== "1.0" ||
    root.phase !== "target-in-progress" ||
    typeof root.target !== "string" ||
    typeof root.installDir !== "string" ||
    typeof root.stagingRoot !== "string" ||
    typeof root.backupDir !== "string" ||
    typeof root.updatedAt !== "string"
  ) {
    return undefined;
  }
  if (root.target !== "codex" && root.target !== "claude-code" && root.target !== "cursor") {
    return undefined;
  }
  return {
    schemaVersion: "1.0",
    phase: "target-in-progress",
    target: root.target,
    installDir: root.installDir,
    stagingRoot: root.stagingRoot,
    backupDir: root.backupDir,
    updatedAt: root.updatedAt
  };
}

function writeApplyJournal(cwd: string, entry: ApplyJournal): void {
  const path = resolveApplyJournalPath(cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
}

function clearApplyJournal(cwd: string): void {
  const path = resolveApplyJournalPath(cwd);
  if (existsSync(path)) rmSync(path, { force: true });
}

function appendOperationEvent(cwd: string, event: OperationEvent): void {
  const logPath = resolveOperationLogPath(cwd);
  if (!logPath) return;
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(logPath, `${JSON.stringify(event)}\n`, { encoding: "utf8", flag: "a" });
  } catch {
    // Logging must not interfere with command execution.
  }
}

function recordOperationEvent(
  cwd: string,
  startTimeMs: number,
  command: string,
  status: number,
  mutating: boolean,
  options?: { code?: string; counters?: Record<string, number> }
): void {
  appendOperationEvent(cwd, {
    schemaVersion: JSON_CONTRACT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    command,
    status,
    durationMs: Math.max(0, Date.now() - startTimeMs),
    mutating,
    ...(options?.code ? { code: options.code } : {}),
    ...(options?.counters ? { counters: options.counters } : {})
  });
}

function sha256Hex(bytes: Uint8Array | Buffer): string {
  const hash = createHash("sha256");
  hash.update(bytes);
  return `sha256:${hash.digest("hex")}`;
}

function readSigningMaterial(cwd: string, keyPath: string, label: string): Buffer {
  const resolvedPath = resolve(cwd, keyPath);
  let keyBytes: Buffer;
  try {
    keyBytes = readFileSync(resolvedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Unable to read ${label}: ${message}`, 1, "invalid-sign-key");
  }
  if (keyBytes.byteLength === 0) {
    throw new CliError(`${label} must not be empty`, 1, "invalid-sign-key");
  }
  return keyBytes;
}

function readHmacSigningKey(cwd: string, keyPath: string): Buffer {
  return readSigningMaterial(cwd, keyPath, "signing key");
}

function readEd25519PrivateKey(cwd: string, keyPath: string) {
  const keyBytes = readSigningMaterial(cwd, keyPath, "private signing key");
  try {
    const privateKey = createPrivateKey({ key: keyBytes, format: "pem" });
    if (privateKey.asymmetricKeyType !== "ed25519") {
      throw new CliError(
        `Private signing key must be ed25519 (received ${String(privateKey.asymmetricKeyType ?? "unknown")})`,
        1,
        "invalid-sign-key"
      );
    }
    return privateKey;
  } catch (error) {
    if (error instanceof CliError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Unable to parse private signing key: ${message}`, 1, "invalid-sign-key");
  }
}

function readEd25519PublicKey(cwd: string, keyPath: string) {
  const keyBytes = readSigningMaterial(cwd, keyPath, "public signing key");
  try {
    const publicKey = createPublicKey({ key: keyBytes, format: "pem" });
    if (publicKey.asymmetricKeyType !== "ed25519") {
      throw new CliError(
        `Public signing key must be ed25519 (received ${String(publicKey.asymmetricKeyType ?? "unknown")})`,
        1,
        "invalid-sign-key"
      );
    }
    return publicKey;
  } catch (error) {
    if (error instanceof CliError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Unable to parse public signing key: ${message}`, 1, "invalid-sign-key");
  }
}

type BundleFileEntry = {
  path: string;
  digest: string;
  size: number;
};

type BundleProvenance = {
  generator: string;
  contractVersion: "1.0";
  createdBy: string;
};

type BundleManifest = {
  schemaVersion: "1.0";
  createdAt: string;
  files: BundleFileEntry[];
  provenance?: BundleProvenance;
  signature?: {
    algorithm: "hmac-sha256" | "ed25519";
    value: string;
    keyId?: string;
  };
};

type RegistrySignature = {
  algorithm: "ed25519";
  keyId: string;
  value: string;
};

type RegistryArtifact = {
  id: string;
  bundleFile: string;
  digest: string;
  publishedAt: string;
  sourceRef?: string;
  signature: RegistrySignature;
};

type RegistryIndex = {
  schemaVersion: "1.0";
  artifacts: RegistryArtifact[];
};

const SHA256_DIGEST_REGEX = /^sha256:[a-f0-9]{64}$/;
const HEX_64_REGEX = /^[a-f0-9]{64}$/;
const BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/;
const MIN_ZIP_MTIME_MS = new Date(1980, 0, 1, 0, 0, 0, 0).getTime();
const MAX_ZIP_MTIME_MS = new Date(2099, 11, 31, 23, 59, 59, 999).getTime();

function publicKeyFingerprint(key: ReturnType<typeof createPublicKey>): string {
  const der = key.export({ type: "spki", format: "der" });
  const bytes = Buffer.isBuffer(der) ? der : Buffer.from(der);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function resolveSourceDateEpochMs(): number | undefined {
  const raw = process.env.SOURCE_DATE_EPOCH ?? process.env.SKILLBASE_SOURCE_DATE_EPOCH;
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new CliError(
      "SOURCE_DATE_EPOCH must be an integer Unix timestamp in seconds",
      1,
      "invalid-argument"
    );
  }
  const seconds = Number(raw);
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new CliError(
      "SOURCE_DATE_EPOCH must be a non-negative integer Unix timestamp in seconds",
      1,
      "invalid-argument"
    );
  }
  const epochMs = seconds * 1000;
  if (epochMs > MAX_ZIP_MTIME_MS) {
    throw new CliError(
      "SOURCE_DATE_EPOCH must be within the ZIP timestamp range (1980-01-01 through 2099-12-31)",
      1,
      "invalid-argument"
    );
  }
  return Math.max(MIN_ZIP_MTIME_MS, epochMs);
}
const MAX_BUNDLE_COMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_BUNDLE_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
const MAX_BUNDLE_FILE_ENTRIES = 4096;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP64_SENTINEL_U16 = 0xffff;
const ZIP64_SENTINEL_U32 = 0xffffffff;
const ZIP_GENERAL_PURPOSE_BIT_FLAG_ENCRYPTED = 0x0001;
const ZIP_COMPRESSION_METHOD_STORED = 0;
const ZIP_COMPRESSION_METHOD_DEFLATE = 8;
const REQUIRED_BUNDLE_PATHS = ["skillbase.lock.json"] as const;
const REQUIRED_BUNDLE_MANIFEST_CANDIDATES = ["runwright.yml", "runwright.json", "skillbase.yml", "skillbase.json"] as const;
const ZIP_UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

type ZipCentralDirectoryEntry = {
  path: string;
  compressionMethod: number;
  generalPurposeBitFlag: number;
};

function bundleSignaturePayload(manifest: {
  schemaVersion: string;
  createdAt: string;
  files: BundleFileEntry[];
  provenance?: BundleProvenance;
}): string {
  const files = [...manifest.files].sort((a, b) => a.path.localeCompare(b.path));
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    createdAt: manifest.createdAt,
    files,
    ...(manifest.provenance ? { provenance: manifest.provenance } : {})
  });
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function decodeZipFileName(bytes: Uint8Array, offset: number, length: number): string {
  try {
    return ZIP_UTF8_DECODER.decode(bytes.subarray(offset, offset + length));
  } catch {
    throw new Error("invalid ZIP filename encoding");
  }
}

function inspectZipResourceUsage(bytes: Uint8Array): {
  entryCount: number;
  totalUncompressedBytes: number;
  entries: ZipCentralDirectoryEntry[];
} {
  if (bytes.byteLength < 22) throw new Error("bundle is not a valid ZIP archive");

  const eocdSearchStart = bytes.byteLength - 22;
  const eocdSearchEnd = Math.max(0, bytes.byteLength - (0xffff + 22));
  let eocdOffset = -1;
  for (let index = eocdSearchStart; index >= eocdSearchEnd; index -= 1) {
    if (readUint32LE(bytes, index) === ZIP_EOCD_SIGNATURE) {
      eocdOffset = index;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error("missing ZIP end of central directory");

  const entryCount = readUint16LE(bytes, eocdOffset + 10);
  const centralDirectorySize = readUint32LE(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readUint32LE(bytes, eocdOffset + 16);
  if (
    entryCount === ZIP64_SENTINEL_U16 ||
    centralDirectorySize === ZIP64_SENTINEL_U32 ||
    centralDirectoryOffset === ZIP64_SENTINEL_U32
  ) {
    throw new Error("ZIP64 archives are not supported");
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > bytes.byteLength) {
    throw new Error("invalid ZIP central directory bounds");
  }

  let entryCursor = centralDirectoryOffset;
  let countedEntries = 0;
  let totalUncompressedBytes = 0;
  const entries: ZipCentralDirectoryEntry[] = [];
  while (entryCursor < centralDirectoryEnd) {
    if (entryCursor + 46 > bytes.byteLength) throw new Error("truncated ZIP central directory");
    if (readUint32LE(bytes, entryCursor) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("invalid ZIP central directory entry");
    }

    const generalPurposeBitFlag = readUint16LE(bytes, entryCursor + 8);
    const compressionMethod = readUint16LE(bytes, entryCursor + 10);
    const uncompressedSize = readUint32LE(bytes, entryCursor + 24);
    const fileNameLength = readUint16LE(bytes, entryCursor + 28);
    const extraLength = readUint16LE(bytes, entryCursor + 30);
    const commentLength = readUint16LE(bytes, entryCursor + 32);
    const recordLength = 46 + fileNameLength + extraLength + commentLength;
    if (entryCursor + recordLength > centralDirectoryEnd) {
      throw new Error("truncated ZIP central directory entry data");
    }
    const path = decodeZipFileName(bytes, entryCursor + 46, fileNameLength);

    totalUncompressedBytes += uncompressedSize;
    countedEntries += 1;
    entries.push({ path, compressionMethod, generalPurposeBitFlag });
    entryCursor += recordLength;
  }

  if (entryCursor !== centralDirectoryEnd) {
    throw new Error("invalid ZIP central directory structure");
  }
  if (countedEntries !== entryCount) {
    throw new Error("ZIP central directory entry count mismatch");
  }

  return { entryCount: countedEntries, totalUncompressedBytes, entries };
}

function isSafeBundleRelativePath(pathValue: string): boolean {
  if (!pathValue) return false;
  if (pathValue.startsWith("/") || pathValue.includes("\\") || pathValue.includes("\0")) return false;
  const segments = pathValue.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function validateBundleManifest(value: unknown): { manifest?: BundleManifest; issues: string[] } {
  const issues: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { issues: ["bundle manifest must be an object"] };
  }

  const raw = value as Record<string, unknown>;
  const allowedTopLevelKeys = new Set(["schemaVersion", "createdAt", "files", "provenance", "signature"]);
  for (const key of Object.keys(raw)) {
    if (!allowedTopLevelKeys.has(key)) issues.push(`unknown manifest key: ${key}`);
  }
  if (raw.schemaVersion !== "1.0") issues.push(`invalid manifest schemaVersion: ${String(raw.schemaVersion)}`);

  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : "";
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) issues.push("invalid manifest createdAt timestamp");

  const files: BundleFileEntry[] = [];
  const seenPaths = new Set<string>();
  if (!Array.isArray(raw.files)) {
    issues.push("manifest files must be an array");
  } else {
    for (const entry of raw.files) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        issues.push("manifest file entry must be an object");
        continue;
      }

      const rawEntry = entry as Record<string, unknown>;
      const allowedEntryKeys = new Set(["path", "digest", "size"]);
      for (const key of Object.keys(rawEntry)) {
        if (!allowedEntryKeys.has(key)) issues.push(`unknown manifest file key: ${key}`);
      }
      const path = typeof rawEntry.path === "string" ? rawEntry.path : "";
      const digest = typeof rawEntry.digest === "string" ? rawEntry.digest : "";
      const size = rawEntry.size;
      const validSize = typeof size === "number" && Number.isInteger(size) && size >= 0;
      const pathLabel = path || "<unknown>";

      if (!isSafeBundleRelativePath(path)) {
        issues.push(`invalid manifest file path: ${String(rawEntry.path)}`);
      } else {
        if (path === "_bundle/manifest.json") issues.push("manifest file list must not include _bundle/manifest.json");
        if (seenPaths.has(path)) issues.push(`duplicate manifest file path: ${path}`);
        seenPaths.add(path);
      }

      if (!SHA256_DIGEST_REGEX.test(digest)) issues.push(`invalid manifest digest for ${pathLabel}`);
      if (!validSize) issues.push(`invalid manifest size for ${pathLabel}`);

      if (isSafeBundleRelativePath(path) && SHA256_DIGEST_REGEX.test(digest) && validSize) {
        files.push({ path, digest, size });
      }
    }
  }

  let provenance: BundleProvenance | undefined;
  if (raw.provenance !== undefined) {
    if (!raw.provenance || typeof raw.provenance !== "object" || Array.isArray(raw.provenance)) {
      issues.push("invalid manifest provenance object");
    } else {
      const provenanceRaw = raw.provenance as Record<string, unknown>;
      const allowedProvenanceKeys = new Set(["generator", "contractVersion", "createdBy"]);
      for (const key of Object.keys(provenanceRaw)) {
        if (!allowedProvenanceKeys.has(key)) issues.push(`unknown manifest provenance key: ${key}`);
      }
      const generator = typeof provenanceRaw.generator === "string" ? provenanceRaw.generator : "";
      const contractVersion = provenanceRaw.contractVersion;
      const createdBy = typeof provenanceRaw.createdBy === "string" ? provenanceRaw.createdBy : "";
      if (!generator) issues.push("invalid manifest provenance generator");
      if (contractVersion !== "1.0") issues.push(`invalid manifest provenance contractVersion: ${String(contractVersion)}`);
      if (!createdBy) issues.push("invalid manifest provenance createdBy");
      if (generator && contractVersion === "1.0" && createdBy) {
        provenance = {
          generator,
          contractVersion: "1.0",
          createdBy
        };
      }
    }
  }

  let signature: BundleManifest["signature"] | undefined;
  if (raw.signature !== undefined) {
    if (!raw.signature || typeof raw.signature !== "object" || Array.isArray(raw.signature)) {
      issues.push("invalid manifest signature object");
    } else {
      const signatureRaw = raw.signature as Record<string, unknown>;
      const allowedSignatureKeys = new Set(["algorithm", "value", "keyId"]);
      for (const key of Object.keys(signatureRaw)) {
        if (!allowedSignatureKeys.has(key)) issues.push(`unknown manifest signature key: ${key}`);
      }
      const algorithm = signatureRaw.algorithm;
      const valueRaw = signatureRaw.value;
      const keyIdRaw = signatureRaw.keyId;
      const keyId = typeof keyIdRaw === "string" ? keyIdRaw : undefined;
      if (keyIdRaw !== undefined && (typeof keyIdRaw !== "string" || !SHA256_DIGEST_REGEX.test(keyIdRaw))) {
        issues.push("invalid manifest signature keyId");
      }
      if (algorithm !== "hmac-sha256" && algorithm !== "ed25519") {
        issues.push(`unsupported signature algorithm: ${String(algorithm)}`);
      } else if (typeof valueRaw !== "string") {
        issues.push("invalid manifest signature encoding");
      } else if (algorithm === "hmac-sha256") {
        if (!HEX_64_REGEX.test(valueRaw)) {
          issues.push("invalid manifest signature encoding");
        } else {
          signature = {
            algorithm: "hmac-sha256",
            value: valueRaw,
            ...(keyId && SHA256_DIGEST_REGEX.test(keyId) ? { keyId } : {})
          };
        }
      } else {
        if (!BASE64_REGEX.test(valueRaw) || Buffer.from(valueRaw, "base64").byteLength === 0) {
          issues.push("invalid manifest signature encoding");
        } else if (!keyId || !SHA256_DIGEST_REGEX.test(keyId)) {
          issues.push("ed25519 signatures require valid keyId");
        } else {
          signature = { algorithm: "ed25519", value: valueRaw, keyId };
        }
      }
    }
  }

  if (issues.length > 0) return { issues };
  return {
    issues,
    manifest: {
      schemaVersion: "1.0",
      createdAt,
      files,
      ...(provenance ? { provenance } : {}),
      ...(signature ? { signature } : {})
    }
  };
}

function assertNoDuplicateSkillNames(units: SkillUnit[]): void {
  const byCanonicalName = new Map<string, Array<{ skillName: string; source: string; path: string }>>();
  for (const unit of units) {
    const canonicalName = unit.skillName.normalize("NFKC").toLowerCase();
    const bucket = byCanonicalName.get(canonicalName) ?? [];
    bucket.push({ skillName: unit.skillName, source: unit.source, path: unit.skillPath });
    byCanonicalName.set(canonicalName, bucket);
  }

  const duplicates = [...byCanonicalName.entries()]
    .filter(([, refs]) => refs.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));

  if (duplicates.length === 0) return;

  const duplicateSummary = duplicates
    .map(([, refs]) => {
      const sortedRefs = [...refs].sort((left, right) =>
        left.skillName === right.skillName
          ? left.source === right.source
            ? left.path.localeCompare(right.path)
            : left.source.localeCompare(right.source)
          : left.skillName.localeCompare(right.skillName)
      );
      const refsSummary = sortedRefs.map((ref) => `${ref.skillName} from ${ref.source} -> ${ref.path}`).join(", ");
      return refsSummary;
    })
    .join("; ");

  throw new CliError(`Duplicate skill names are not allowed: ${duplicateSummary}`, 1, "duplicate-skill-name");
}

function walkFiles(rootPath: string): string[] {
  const output: string[] = [];
  const queue = [rootPath];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    for (const entry of readdirSyncFs(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Symlinks are not allowed in skill directories: ${full}`);
      }
      if (entry.isDirectory()) queue.push(full);
      else if (entry.isFile()) output.push(full);
    }
  }
  return output;
}

function resolveSkillUnitsFromLockfile(lockfile: SkillbaseLockfile): SkillUnit[] {
  const units: SkillUnit[] = [];
  const sources = Object.entries(lockfile.sources).sort(([a], [b]) => a.localeCompare(b));
  for (const [source, sourceData] of sources) {
    const skills = Object.entries(sourceData.skills).sort(([a], [b]) => a.localeCompare(b));
    for (const [skillName, skillData] of skills) {
      units.push({ source, skillName, skillPath: skillData.path });
    }
  }
  return units;
}

function isPathWithinRoot(rootPath: string, candidatePath: string): boolean {
  const rel = relative(rootPath, candidatePath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function verifyLockfileMaterialized(lockfile: SkillbaseLockfile, cwd: string): { ok: boolean; reason?: string } {
  const storeRoot = resolve(cwd, ".skillbase", "store", "skills");
  if (!existsSync(storeRoot)) return { ok: false, reason: "missing skill store root" };
  const storeRootReal = realpathSync(storeRoot);

  for (const sourceData of Object.values(lockfile.sources)) {
    for (const [skillName, skillData] of Object.entries(sourceData.skills)) {
      if (!existsSync(skillData.path)) {
        return { ok: false, reason: `missing skill path for ${skillName}` };
      }
      const skillPathReal = realpathSync(skillData.path);
      if (!isPathWithinRoot(storeRootReal, skillPathReal)) {
        return { ok: false, reason: `disallowed lockfile path for ${skillName}` };
      }
      let digest: string;
      try {
        digest = computeSkillDigest(skillData.path);
      } catch {
        return { ok: false, reason: `invalid skill content for ${skillName}` };
      }
      if (digest !== skillData.digest) {
        return { ok: false, reason: `digest mismatch for ${skillName}` };
      }
    }
  }
  return { ok: true };
}

type ScanIssue = { skill: string; source: string; severity: string; message: string; file?: string };
type ScanFinding = {
  skill: string;
  source: string;
  id: SecurityRuleId;
  severity: FindingSeverity;
  originalSeverity: FindingSeverity;
  message: string;
  file: string;
};
type ScanPolicyDecisionReason = "allowRuleIds" | "allowlist" | "allowlist-expired" | "no-match";
type ScanPolicyDecision = {
  source: string;
  skill: string;
  file: string;
  ruleId: SecurityRuleId;
  action: "suppressed" | "reported";
  reason: ScanPolicyDecisionReason;
  originalSeverity: FindingSeverity;
  effectiveSeverity: FindingSeverity;
  matchedAllowlist?: ScanPolicyAllowlistEntry;
};

function normalizeScanPolicy(manifest: SkillbaseManifest): ScanPolicyConfig {
  const scanDefaults = manifest.defaults?.scan;
  return {
    allowRuleIds: (scanDefaults?.allowRuleIds ?? []) as SecurityRuleId[],
    severityOverrides: (scanDefaults?.severityOverrides ?? {}) as Partial<Record<SecurityRuleId, FindingSeverity>>,
    allowlist: scanDefaults?.allowlist ?? []
  };
}

function isAllowlistEntryActive(entry: ScanPolicyAllowlistEntry, nowMs: number): boolean {
  if (!entry.expiresAt) return true;
  const expiresAtMs = Date.parse(entry.expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs >= nowMs;
}

function findMatchingAllowlistEntry(
  policy: ScanPolicyConfig,
  finding: { id: SecurityRuleId },
  unit: { source: string; skillName: string },
  nowMs: number
): { active?: ScanPolicyAllowlistEntry; expired?: ScanPolicyAllowlistEntry } {
  const candidates = policy.allowlist.filter((entry) => {
    if (entry.ruleId !== finding.id) return false;
    if (entry.source && entry.source !== unit.source) return false;
    if (entry.skill && entry.skill !== unit.skillName) return false;
    return true;
  });
  if (candidates.length === 0) return {};

  const active = candidates.find((entry) => isAllowlistEntryActive(entry, nowMs));
  if (active) return { active };
  return { expired: candidates[0] };
}

function writePolicyDecisionsArtifact(cwd: string, outPath: string, decisions: ScanPolicyDecision[]): void {
  const artifactPath = resolve(cwd, outPath);
  try {
    mkdirSync(dirname(artifactPath), { recursive: true });
    const content = decisions.map((decision) => JSON.stringify(decision)).join("\n");
    writeFileSync(artifactPath, content.length > 0 ? `${content}\n` : "", "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Unable to write policy decisions artifact: ${message}`, 1, "policy-decisions-write-failed");
  }
}

function runSkillScans(
  units: SkillUnit[],
  options: { lintOnly: boolean; security: SecurityMode; policy: ScanPolicyConfig }
): {
  lintIssues: number;
  highFindings: number;
  mediumFindings: number;
  suppressedFindings: number;
  issues: ScanIssue[];
  findings: ScanFinding[];
  policyDecisions: ScanPolicyDecision[];
} {
  const issues: ScanIssue[] = [];
  const findings: ScanFinding[] = [];
  const policyDecisions: ScanPolicyDecision[] = [];
  const allowRuleIds = new Set(options.policy.allowRuleIds);
  const nowMs = Date.now();
  const lintCache = new Map<string, ReturnType<typeof lintSkillDir>>();
  const securityCache = new Map<string, ReturnType<typeof scanSkillDir>>();

  for (const unit of units) {
    const lint = lintCache.get(unit.skillPath) ?? lintSkillDir(unit.skillPath);
    lintCache.set(unit.skillPath, lint);
    for (const issue of lint.issues) {
      issues.push({
        source: unit.source,
        skill: unit.skillName,
        severity: issue.severity,
        message: issue.message,
        file: issue.file
      });
    }

    if (!options.lintOnly && options.security !== "off") {
      const security = securityCache.get(unit.skillPath) ?? scanSkillDir(unit.skillPath);
      securityCache.set(unit.skillPath, security);
      for (const finding of security.findings) {
        const originalSeverity = finding.severity;
        const effectiveSeverity = options.policy.severityOverrides[finding.id] ?? originalSeverity;

        if (allowRuleIds.has(finding.id)) {
          policyDecisions.push({
            source: unit.source,
            skill: unit.skillName,
            file: finding.file,
            ruleId: finding.id,
            action: "suppressed",
            reason: "allowRuleIds",
            originalSeverity,
            effectiveSeverity
          });
          continue;
        }

        const allowlistMatch = findMatchingAllowlistEntry(options.policy, finding, unit, nowMs);
        if (allowlistMatch.active) {
          policyDecisions.push({
            source: unit.source,
            skill: unit.skillName,
            file: finding.file,
            ruleId: finding.id,
            action: "suppressed",
            reason: "allowlist",
            originalSeverity,
            effectiveSeverity,
            matchedAllowlist: allowlistMatch.active
          });
          continue;
        }

        policyDecisions.push({
          source: unit.source,
          skill: unit.skillName,
          file: finding.file,
          ruleId: finding.id,
          action: "reported",
          reason: allowlistMatch.expired ? "allowlist-expired" : "no-match",
          originalSeverity,
          effectiveSeverity,
          ...(allowlistMatch.expired ? { matchedAllowlist: allowlistMatch.expired } : {})
        });

        findings.push({
          source: unit.source,
          skill: unit.skillName,
          id: finding.id,
          originalSeverity,
          severity: effectiveSeverity,
          message: finding.message,
          file: finding.file
        });
      }
    }
  }

  const highFindings = findings.filter((finding) => finding.severity === "high").length;
  const mediumFindings = findings.filter((finding) => finding.severity === "medium").length;
  const suppressedFindings = policyDecisions.filter((entry) => entry.action === "suppressed").length;
  const sortedIssues = [...issues].sort((left, right) => {
    if (left.source !== right.source) return left.source.localeCompare(right.source);
    if (left.skill !== right.skill) return left.skill.localeCompare(right.skill);
    if ((left.file ?? "") !== (right.file ?? "")) return (left.file ?? "").localeCompare(right.file ?? "");
    return left.message.localeCompare(right.message);
  });
  const sortedFindings = [...findings].sort((left, right) => {
    if (left.source !== right.source) return left.source.localeCompare(right.source);
    if (left.skill !== right.skill) return left.skill.localeCompare(right.skill);
    if (left.file !== right.file) return left.file.localeCompare(right.file);
    if (left.id !== right.id) return left.id.localeCompare(right.id);
    return left.message.localeCompare(right.message);
  });
  const sortedPolicyDecisions = [...policyDecisions].sort((left, right) => {
    if (left.source !== right.source) return left.source.localeCompare(right.source);
    if (left.skill !== right.skill) return left.skill.localeCompare(right.skill);
    if (left.file !== right.file) return left.file.localeCompare(right.file);
    return left.ruleId.localeCompare(right.ruleId);
  });

  return {
    lintIssues: sortedIssues.length,
    highFindings,
    mediumFindings,
    suppressedFindings,
    issues: sortedIssues,
    findings: sortedFindings,
    policyDecisions: sortedPolicyDecisions
  };
}

function performAtomicTargetApply(
  plan: TargetApplyPlan,
  cwd: string,
  onPrepared?: (paths: { target: TargetName; installDir: string; stagingRoot: string; backupDir: string }) => void
): void {
  const parentDir = resolve(plan.installDir, "..");
  mkdirSync(parentDir, { recursive: true });

  const safeTarget = plan.target.replace(/[^a-z0-9-]/gi, "-");
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const stagingRoot = resolve(cwd, ".skillbase", "staging", `${safeTarget}-${nonce}`);
  const stagedInstallDir = join(stagingRoot, "skills");
  const backupDir = resolve(parentDir, `.skillbase-backup-${safeTarget}-${nonce}`);

  mkdirSync(stagedInstallDir, { recursive: true });
  for (const skill of plan.skills) {
    walkFiles(skill.source);
    const stagedDestination = join(stagedInstallDir, skill.skillName);
    if (plan.mode === "link") {
      symlinkSync(skill.source, stagedDestination, "dir");
    } else {
      cpSync(skill.source, stagedDestination, { recursive: true, force: true, dereference: false });
    }
  }

  if (onPrepared) {
    onPrepared({
      target: plan.target,
      installDir: plan.installDir,
      stagingRoot,
      backupDir
    });
  }

  let hadExistingTarget = false;
  try {
    if (existsSync(plan.installDir)) {
      renameSync(plan.installDir, backupDir);
      hadExistingTarget = true;
      if (process.env.SKILLBASE_APPLY_CRASH_AFTER_BACKUP_RENAME === "1") {
        process.exit(99);
      }
    }
    renameSync(stagedInstallDir, plan.installDir);
    if (hadExistingTarget && existsSync(backupDir)) {
      rmSync(backupDir, { recursive: true, force: true });
    }
  } catch (error) {
    if (existsSync(plan.installDir)) {
      rmSync(plan.installDir, { recursive: true, force: true });
    }
    if (hadExistingTarget && existsSync(backupDir)) {
      renameSync(backupDir, plan.installDir);
    }
    throw error;
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
    if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true });
  }
}

function runApplyResume(cwd: string): { status: number; recovered: boolean; message: string } {
  const journal = readApplyJournal(cwd);
  if (!journal) {
    return { status: 0, recovered: false, message: "No interrupted apply transaction found." };
  }

  const actions: string[] = [];
  if (existsSync(journal.backupDir)) {
    if (existsSync(journal.installDir)) {
      rmSync(journal.backupDir, { recursive: true, force: true });
      actions.push("removed stale backup directory");
    } else {
      mkdirSync(resolve(journal.installDir, ".."), { recursive: true });
      renameSync(journal.backupDir, journal.installDir);
      actions.push("restored target from backup directory");
    }
  }
  if (existsSync(journal.stagingRoot)) {
    rmSync(journal.stagingRoot, { recursive: true, force: true });
    actions.push("removed stale staging directory");
  }
  clearApplyJournal(cwd);
  const actionSummary = actions.length > 0 ? actions.join("; ") : "no filesystem cleanup was needed";
  return {
    status: 0,
    recovered: actions.length > 0,
    message: `Apply journal recovered for target '${journal.target}': ${actionSummary}.`
  };
}

function runInit(cwd: string): { status: number; message: string; mutating: boolean } {
  if (resolveManifestFile(cwd)) {
    return {
      status: 0,
      message: "Already initialized: manifest exists. Next: runwright journey",
      mutating: false
    };
  }

  const manifestPathYaml = resolve(cwd, "runwright.yml");
  const starter = `version: 1
defaults:
  mode: link
  scope: project
  verify: true
  scan:
    lint: true
    security: warn

targets:
  codex:
    enabled: true
  claude-code:
    enabled: true
  cursor:
    enabled: true
    mode: copy

skillsets:
  base:
    description: core skills
    skills:
      - source: local:./skills

apply:
  useSkillsets: [base]
`;
  writeFileSync(manifestPathYaml, starter, "utf8");

  const gitIgnorePath = resolve(cwd, ".gitignore");
  const existing = existsSync(gitIgnorePath) ? readFileSync(gitIgnorePath, "utf8") : "";
  const additions = ["skillbase.lock.json", ".skillbase/"];
  const nextLines = existing.length > 0 ? existing.split("\n") : [];
  for (const entry of additions) {
    if (!nextLines.includes(entry)) nextLines.push(entry);
  }
  writeFileSync(gitIgnorePath, `${nextLines.filter((line) => line.length > 0).join("\n")}\n`, "utf8");
  return { status: 0, message: "Initialized runwright.yml and updated .gitignore. Next: runwright journey", mutating: true };
}

type JourneyStepStatus = "complete" | "pending" | "blocked";

type JourneyStep = {
  id:
    | "manifest"
    | "skills"
    | "lockfile"
    | "scan"
    | "dry-run-apply"
    | "apply"
    | "verify-bundle";
  title: string;
  status: JourneyStepStatus;
  details: string;
  command: string;
  optional?: boolean;
};

type JourneyPayload = {
  summary: {
    completedCoreSteps: number;
    totalCoreSteps: number;
    completionPercent: number;
  };
  steps: JourneyStep[];
  nextAction: {
    command: string;
    reason: string;
  };
  docs: string[];
};

type MissionPayload = {
  status: number;
  mode: "dashboard";
  nextAction: JourneyPayload["nextAction"];
  sections: {
    journey: {
      completedCoreSteps: number;
      totalCoreSteps: number;
      completionPercent: number;
    };
    trust: TrustSummary;
    scan: {
      lastStatus: number | null;
      lastTimestampMs: number | null;
      health: "ok" | "warn" | "blocked" | "unknown";
    };
    policy: {
      lastStatus: number | null;
      lastTimestampMs: number | null;
      health: "ok" | "warn" | "blocked" | "unknown";
    };
  };
  action?: {
    command: string;
    status: number;
    summary: Record<string, number | string | boolean>;
  };
};

type OperationEventRecord = {
  command: string;
  status: number;
  mutating: boolean;
  timestampMs: number;
  code?: string;
};

function hasAnySkillMarkdown(rootPath: string): boolean {
  if (!existsSync(rootPath)) return false;
  const queue = [rootPath];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    for (const entry of readdirSyncFs(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isFile() && entry.name === "SKILL.md") return true;
      if (entry.isDirectory()) queue.push(fullPath);
    }
  }
  return false;
}

function latestModifiedTimeMs(rootPath: string): number {
  if (!existsSync(rootPath)) return 0;
  const queue = [rootPath];
  let latest = 0;
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    let stats;
    try {
      stats = statSync(current);
    } catch {
      continue;
    }
    latest = Math.max(latest, stats.mtimeMs);
    if (!stats.isDirectory()) continue;
    for (const entry of readdirSyncFs(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      if (entry.isSymbolicLink()) continue;
      if (!entry.isDirectory() && !entry.isFile()) continue;
      queue.push(join(current, entry.name));
    }
  }
  return latest;
}

function readOperationEventRecords(cwd: string): OperationEventRecord[] {
  const logPath = resolveOperationLogPath(cwd);
  if (!logPath || !existsSync(logPath)) return [];
  const lines = readFileSync(logPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const events: OperationEventRecord[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (
        typeof parsed.command === "string" &&
        typeof parsed.status === "number" &&
        typeof parsed.mutating === "boolean"
      ) {
        const timestampRaw = typeof parsed.timestamp === "string" ? Date.parse(parsed.timestamp) : Number.NaN;
        events.push({
          command: parsed.command,
          status: parsed.status,
          mutating: parsed.mutating,
          timestampMs: Number.isFinite(timestampRaw) ? timestampRaw : 0,
          ...(typeof parsed.code === "string" ? { code: parsed.code } : {})
        });
      }
    } catch {
      continue;
    }
  }
  return events;
}

function latestOperationEvent(
  events: OperationEventRecord[],
  command: string,
  predicate?: (event: OperationEventRecord) => boolean
): OperationEventRecord | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event) continue;
    if (event.command !== command) continue;
    if (predicate && !predicate(event)) continue;
    return event;
  }
  return undefined;
}

function runJourney(cwd: string): { status: number; payload: JourneyPayload } {
  const manifestRef = resolveManifestFile(cwd);
  const manifestExists = Boolean(manifestRef);
  const skillsRoot = resolve(cwd, "skills");
  const lockfilePath = resolve(cwd, "skillbase.lock.json");
  const skillsExist = hasAnySkillMarkdown(skillsRoot);
  const lockfileExists = existsSync(lockfilePath);
  const events = readOperationEventRecords(cwd);
  const scanEvent = latestOperationEvent(events, "scan");
  const dryRunApplyEvent = latestOperationEvent(events, "apply", (event) => event.mutating === false);
  const applyEvent = latestOperationEvent(events, "apply", (event) => event.mutating === true);
  const verifyBundleEvent = latestOperationEvent(events, "verify-bundle", (event) => event.status === 0);

  const sourceSnapshotMs = Math.max(
    manifestRef ? latestModifiedTimeMs(manifestRef.path) : 0,
    latestModifiedTimeMs(skillsRoot)
  );
  const lockfileUpdatedAtMs = lockfileExists ? latestModifiedTimeMs(lockfilePath) : 0;
  const lockfileFresh = lockfileExists && lockfileUpdatedAtMs >= sourceSnapshotMs;
  const scanFresh = Boolean(scanEvent && scanEvent.timestampMs >= Math.max(sourceSnapshotMs, lockfileUpdatedAtMs));
  const dryRunFresh = Boolean(
    dryRunApplyEvent && dryRunApplyEvent.timestampMs >= Math.max(sourceSnapshotMs, lockfileUpdatedAtMs, scanEvent?.timestampMs ?? 0)
  );
  const applyFresh = Boolean(
    applyEvent && applyEvent.timestampMs >= Math.max(sourceSnapshotMs, lockfileUpdatedAtMs, scanEvent?.timestampMs ?? 0)
  );
  const verifyBundleFresh = Boolean(
    verifyBundleEvent && verifyBundleEvent.timestampMs >= Math.max(sourceSnapshotMs, lockfileUpdatedAtMs)
  );

  const scanStatus: JourneyStepStatus = !scanEvent
    ? "pending"
    : !scanFresh
      ? "pending"
      : scanEvent.status === 30
        ? "blocked"
        : scanEvent.status === 0 || scanEvent.status === 2
          ? "complete"
          : "pending";
  const dryRunApplyStatus: JourneyStepStatus = !dryRunApplyEvent
    ? "pending"
    : !dryRunFresh
      ? "pending"
      : dryRunApplyEvent.status === 30
        ? "blocked"
        : dryRunApplyEvent.status === 0 || dryRunApplyEvent.status === 2
          ? "complete"
          : "pending";
  const applyStatus: JourneyStepStatus = !applyEvent
    ? "pending"
    : !applyFresh
      ? "pending"
      : applyEvent.status === 30
        ? "blocked"
        : applyEvent.status === 0 || applyEvent.status === 2
          ? "complete"
          : "pending";
  const verifyBundleStatus: JourneyStepStatus = verifyBundleEvent && verifyBundleFresh && applyStatus === "complete"
    ? "complete"
    : "pending";

  const steps: JourneyStep[] = [
    {
      id: "manifest",
      title: "Initialize project manifest",
      status: manifestExists ? "complete" : "pending",
      details: manifestExists
        ? `${manifestRef?.filename ?? "manifest"} detected.`
        : "Empty state: no manifest found. Initialize once to unlock the guided setup flow.",
      command: "runwright init"
    },
    {
      id: "skills",
      title: "Add at least one skill",
      status: skillsExist ? "complete" : "pending",
      details: skillsExist
        ? "Found at least one SKILL.md under skills/."
        : "Empty state: no SKILL.md found under skills/. Add one skill to unlock your first successful apply (see quickstart template).",
      command: "mkdir -p skills/example-skill && touch skills/example-skill/SKILL.md"
    },
    {
      id: "lockfile",
      title: "Resolve and lock sources",
      status: lockfileExists && lockfileFresh ? "complete" : "pending",
      details: !lockfileExists
        ? "Generate lockfile so installs are reproducible and CI-safe."
        : lockfileFresh
          ? "skillbase.lock.json exists and is up to date."
          : "Skills or manifest changed since the last lockfile update. Rerun update to keep installs reproducible.",
      command: "runwright update --json"
    },
    {
      id: "scan",
      title: "Run safety scan",
      status: scanStatus,
      details: scanStatus === "complete"
        ? "Latest scan run is recorded in operations log."
        : scanEvent && !scanFresh
          ? "Sources changed since the last scan. Rerun scan to refresh safety evidence."
        : scanStatus === "blocked"
          ? "Scan is blocked on findings. Resolve risky content, then rerun scan."
          : "Run scan to surface risky content before apply.",
      command: "runwright scan --format json"
    },
    {
      id: "dry-run-apply",
      title: "Validate install plan with dry-run",
      status: dryRunApplyStatus,
      details: dryRunApplyStatus === "complete"
        ? "Dry-run apply succeeded. Your install plan is ready for a real apply."
        : dryRunApplyEvent && !dryRunFresh
          ? "Changes detected since the last dry-run apply. Rerun dry-run before applying."
        : dryRunApplyStatus === "blocked"
          ? "Dry-run apply was blocked. Resolve scan/policy issues and rerun dry-run."
          : "Preview operations without filesystem changes.",
      command: "runwright apply --target all --scope project --mode copy --dry-run --json"
    },
    {
      id: "apply",
      title: "Apply to targets",
      status: applyStatus,
      details: applyStatus === "complete"
        ? "First success: skills were installed to your targets. Keep the update -> scan -> apply loop for every change."
        : applyEvent && !applyFresh
          ? "Changes detected since the last apply. Run apply again to keep targets in sync."
        : applyStatus === "blocked"
          ? "Apply was blocked. Resolve scan/policy issues and rerun apply."
          : "Install resolved skills into your configured targets to complete onboarding.",
      command: "runwright apply --target all --scope project --mode copy --json"
    },
    {
      id: "verify-bundle",
      title: "Verify release artifact integrity",
      status: verifyBundleStatus,
      details: verifyBundleStatus === "complete"
        ? "Bundle verification succeeded for the current project state."
        : verifyBundleEvent && !verifyBundleFresh
          ? "Project inputs changed since last verification. Re-export and verify the bundle again."
          : applyStatus !== "complete"
            ? "Optional release assurance step once the core loop is healthy."
            : "Optional release assurance step ready now that onboarding is complete.",
      command: "runwright export --out runwright-release.zip --deterministic --json && runwright verify-bundle --bundle runwright-release.zip --json",
      optional: true
    }
  ];

  const coreSteps = steps.filter((step) => !step.optional);
  const completedCoreSteps = coreSteps.filter((step) => step.status === "complete").length;
  const totalCoreSteps = coreSteps.length;
  const completionPercent = Math.floor((completedCoreSteps / Math.max(totalCoreSteps, 1)) * 100);

  const nextActionStep = coreSteps.find((step) => step.status === "blocked") ?? coreSteps.find((step) => step.status === "pending");
  const nextAction = nextActionStep
    ? {
        command: nextActionStep.command,
        reason: nextActionStep.details
      }
    : {
        command:
          "runwright update --json && runwright scan --format json && runwright apply --target all --scope project --mode copy --json",
        reason: "Core onboarding is complete. Stay release-ready by running the update -> scan -> apply loop after each skill change."
      };

  return {
    status: 0,
    payload: {
      summary: { completedCoreSteps, totalCoreSteps, completionPercent },
      steps,
      nextAction,
      docs: [
        "docs/getting-started/quickstart.md",
        "docs/getting-started/user-journeys.md",
        "docs/help/cli-recipes.md",
        "docs/help/troubleshooting.md"
      ]
    }
  };
}

function renderJourneyText(payload: JourneyPayload): string {
  const lines = [
    "Runwright Onboarding Journey",
    "",
    `Progress: ${payload.summary.completedCoreSteps}/${payload.summary.totalCoreSteps} core steps complete (${payload.summary.completionPercent}%)`,
    ""
  ];

  for (const [index, step] of payload.steps.entries()) {
    const marker = step.status === "complete" ? "[done]" : step.status === "blocked" ? "[blocked]" : "[todo]";
    const optionalSuffix = step.optional ? " (optional)" : "";
    lines.push(`${marker} ${index + 1}. ${step.title}${optionalSuffix}`);
    lines.push(`      ${step.details}`);
    if (step.status === "pending" || step.status === "blocked") {
      lines.push(`      Run: ${step.command}`);
      const helpTipByStep: Record<JourneyStep["id"], string> = {
        manifest: "runwright help init",
        skills: "docs/getting-started/quickstart.md",
        lockfile: "runwright help update",
        scan: "runwright help scan",
        "dry-run-apply": "runwright help apply",
        apply: "runwright help apply",
        "verify-bundle": "runwright help verify-bundle"
      };
      lines.push(`      Help: ${helpTipByStep[step.id]}`);
    }
  }

  lines.push("", "Next best action:", `  ${payload.nextAction.command}`, `  Why: ${payload.nextAction.reason}`, "", "Guides:");
  for (const docPath of payload.docs) lines.push(`  - ${docPath}`);
  lines.push("");
  return lines.join("\n");
}

function runMission(args: ParsedArgs, cwd: string, manifest: SkillbaseManifest): MissionPayload {
  const journey = runJourney(cwd).payload;
  const events = readOperationEventRecords(cwd);
  const scanEvent = latestOperationEvent(events, "scan");
  const policyEvent = latestOperationEvent(events, "policy");

  let trustSummary: TrustSummary = { totalSources: 0, verifiedSources: 0, untrustedSources: 0, requiredSources: 0 };
  const lockPath = resolve(cwd, "skillbase.lock.json");
  if (existsSync(lockPath)) {
    try {
      trustSummary = summarizeTrustFromLockfile(readLockfile(lockPath));
    } catch {
      trustSummary = { totalSources: 0, verifiedSources: 0, untrustedSources: 0, requiredSources: 0 };
    }
  } else {
    const resolution = resolveSkillUnitsForArgs(manifest, cwd, args);
    trustSummary = summarizeTrustFromSourceMetadata(resolution.sourceMetadata);
  }

  const asHealth = (status: number | null): "ok" | "warn" | "blocked" | "unknown" => {
    if (status === null) return "unknown";
    if (status === 0) return "ok";
    if (status === 2) return "warn";
    if (status === 30) return "blocked";
    return "warn";
  };

  const payload: MissionPayload = {
    status: 0,
    mode: "dashboard",
    nextAction: journey.nextAction,
    sections: {
      journey: {
        completedCoreSteps: journey.summary.completedCoreSteps,
        totalCoreSteps: journey.summary.totalCoreSteps,
        completionPercent: journey.summary.completionPercent
      },
      trust: trustSummary,
      scan: {
        lastStatus: scanEvent ? scanEvent.status : null,
        lastTimestampMs: scanEvent ? scanEvent.timestampMs : null,
        health: asHealth(scanEvent ? scanEvent.status : null)
      },
      policy: {
        lastStatus: policyEvent ? policyEvent.status : null,
        lastTimestampMs: policyEvent ? policyEvent.timestampMs : null,
        health: asHealth(policyEvent ? policyEvent.status : null)
      }
    }
  };

  const actionRaw = getStringFlag(args, "action");
  if (!actionRaw) return payload;
  const action = parseMissionAction(actionRaw);

  if (action === "journey") {
    payload.action = { command: "journey", status: 0, summary: { completionPercent: journey.summary.completionPercent } };
    payload.status = 0;
    return payload;
  }

  if (action === "scan") {
    const result = runScan(
      { command: "scan", flags: new Map<string, string | boolean>([["format", "json"], ["json", true]]), positionals: [], duplicateFlags: [] },
      cwd,
      manifest
    );
    const scanPayload = result.payload as Record<string, unknown>;
    const scanSummary =
      scanPayload.summary && typeof scanPayload.summary === "object"
        ? (scanPayload.summary as Record<string, unknown>)
        : {};
    payload.action = {
      command: "scan",
      status: result.status,
      summary: {
        lintIssues: Number(scanSummary.lintIssues ?? 0),
        highFindings: Number(scanSummary.highFindings ?? 0),
        mediumFindings: Number(scanSummary.mediumFindings ?? 0)
      }
    };
    payload.status = result.status;
    return payload;
  }

  if (action === "policy-check") {
    const result = runPolicyCheck(
      { command: "policy", flags: new Map<string, string | boolean>([["json", true]]), positionals: ["check"], duplicateFlags: [] },
      cwd,
      manifest
    );
    const policyPayload = result.payload as Record<string, unknown>;
    const unresolvedCount = Number((policyPayload.summary as Record<string, unknown> | undefined)?.unresolved ?? 0);
    const deniedPolicies = Number(
      ((policyPayload.policy as Record<string, unknown> | undefined)?.summary as Record<string, unknown> | undefined)?.deny ?? 0
    );
    payload.action = {
      command: "policy-check",
      status: result.status,
      summary: {
        unresolvedAllowlistEntries: unresolvedCount,
        deniedPolicies
      }
    };
    payload.status = result.status;
    return payload;
  }

  if (action === "fix-plan") {
    const result = runFix(
      { command: "fix", flags: new Map<string, string | boolean>([["plan", true], ["json", true]]), positionals: [], duplicateFlags: [] },
      cwd,
      manifest
    );
    payload.action = {
      command: "fix-plan",
      status: result.status,
      summary: {
        actions: result.actions.length,
        deniedPolicies: result.summary.deniedPolicies
      }
    };
    payload.status = result.status;
    return payload;
  }

  const applyResult = runApply(
    {
      command: "apply",
      flags: new Map<string, string | boolean>([
        ["dry-run", true],
        ["target", "all"],
        ["scope", "project"],
        ["mode", "copy"],
        ["json", true]
      ]),
      positionals: [],
      duplicateFlags: []
    },
    cwd,
    manifest
  );
  payload.action = {
    command: "apply-dry-run",
    status: applyResult.status,
    summary: {
      operations: applyResult.operations.length,
      scanned: applyResult.scanned,
      dryRun: true
    }
  };
  payload.status = applyResult.status;
  return payload;
}

function renderMissionText(payload: MissionPayload): string {
  const lines = [
    "Runwright Mission Control",
    "",
    `Journey: ${payload.sections.journey.completedCoreSteps}/${payload.sections.journey.totalCoreSteps} (${payload.sections.journey.completionPercent}%)`,
    `Trust: verified=${payload.sections.trust.verifiedSources}/${payload.sections.trust.totalSources} required=${payload.sections.trust.requiredSources}`,
    `Scan: ${payload.sections.scan.health}`,
    `Policy: ${payload.sections.policy.health}`,
    "",
    "Next best action:",
    `  ${payload.nextAction.command}`,
    `  Why: ${payload.nextAction.reason}`
  ];

  if (payload.action) {
    lines.push("", "Action run:", `  ${payload.action.command} -> status=${payload.action.status}`);
  }
  lines.push("");
  return lines.join("\n");
}

function runDoctor(args: ParsedArgs, cwd: string): { status: number; issues: DoctorIssue[]; fixed: number } {
  const homeDir = homedir();
  const targetFlag = getStringFlag(args, "target");
  const scopeFlag = getStringFlag(args, "scope");
  const fix = getBooleanFlag(args, "fix");
  const targets = parseTargets(targetFlag);
  const scopes: InstallScope[] = scopeFlag
    ? [parseScope(scopeFlag, "project")]
    : ["project", "global"];
  const issues: DoctorIssue[] = [];
  const seenSkills = new Map<string, string[]>();
  let fixed = 0;

  for (const target of targets) {
    for (const scope of scopes) {
      const root = adapters[target].resolveInstallDir(scope, cwd, homeDir);
      if (!existsSync(root)) continue;

      for (const entry of readdirSync(root, { withFileTypes: true })) {
        const entryPath = join(root, entry.name);
        if (entry.isSymbolicLink() && !existsSync(entryPath)) {
          issues.push({
            type: "broken-symlink",
            path: entryPath,
            message: `Broken symlink detected: ${entryPath}`
          });
          if (fix) {
            unlinkSync(entryPath);
            fixed += 1;
          }
          continue;
        }

        if (!existsSync(join(entryPath, "SKILL.md"))) {
          issues.push({
            type: "invalid-skill",
            path: entryPath,
            message: `Missing SKILL.md in ${entryPath}`
          });
        }

        const key = entry.name;
        const bucket = seenSkills.get(key) ?? [];
        bucket.push(entryPath);
        seenSkills.set(key, bucket);
      }
    }
  }

  for (const [skillName, paths] of seenSkills.entries()) {
    if (paths.length <= 1) continue;
    issues.push({
      type: "duplicate-skill",
      message: `Duplicate skill '${skillName}' discovered at ${paths.join(", ")}`
    });
  }

  return { status: issues.length > 0 ? 2 : 0, issues, fixed };
}

function runApply(args: ParsedArgs, cwd: string, manifest: SkillbaseManifest): {
  status: number;
  code?: string;
  dryRun: boolean;
  scanned: boolean;
  operations: ApplyOperation[];
  summary: { lintIssues: number; highFindings: number; mediumFindings: number; suppressedFindings: number };
  trustSummary: TrustSummary;
  lockfileVerified?: boolean;
  reason?: string;
} {
  const homeDir = homedir();
  const dryRun = getBooleanFlag(args, "dry-run");
  const jsonOutput = getBooleanFlag(args, "json");
  const noScan = getBooleanFlag(args, "no-scan");
  const frozenLockfile = getBooleanFlag(args, "frozen-lockfile");
  const fix = getBooleanFlag(args, "fix");
  const lockPath = resolve(cwd, "skillbase.lock.json");

  const selectedTargets = resolveApplyTargets(manifest, getStringFlag(args, "target"));
  const fallbackScope = (manifest.defaults?.scope ?? "global") as InstallScope;
  if (fix) {
    const scopeFlag = getStringFlag(args, "scope");
    for (const target of selectedTargets) {
      const targetOverrides = manifest.targets?.[target];
      const scope = parseScope(scopeFlag, (targetOverrides?.scope ?? fallbackScope) as InstallScope);
      runDoctor(
        {
          command: "doctor",
          flags: new Map<string, string | boolean>([
            ["target", target],
            ["scope", scope],
            ["fix", true]
          ]),
          positionals: [],
          duplicateFlags: []
        },
        cwd
      );
    }
  }
  let lockfileVerified = false;
  let skillUnits: SkillUnit[];
  let trustSummary: TrustSummary = { totalSources: 0, verifiedSources: 0, untrustedSources: 0, requiredSources: 0 };
  if (frozenLockfile) {
    if (!existsSync(lockPath)) {
      return {
        status: 11,
        code: "lockfile-error",
        reason: "missing-lockfile",
        dryRun,
        scanned: false,
        operations: [],
        summary: {
          lintIssues: 0,
          highFindings: 0,
          mediumFindings: 0,
          suppressedFindings: 0
        },
        trustSummary,
        lockfileVerified: false
      };
    }
    let lockfile: SkillbaseLockfile;
    try {
      lockfile = readLockfile(lockPath);
    } catch {
      return {
        status: 11,
        code: "lockfile-error",
        reason: "invalid-lockfile",
        dryRun,
        scanned: false,
        operations: [],
        summary: {
          lintIssues: 0,
          highFindings: 0,
          mediumFindings: 0,
          suppressedFindings: 0
        },
        trustSummary,
        lockfileVerified: false
      };
    }
    const verification = verifyLockfileMaterialized(lockfile, cwd);
    if (!verification.ok) {
      return {
        status: 11,
        code: "lockfile-error",
        reason: "lockfile-mismatch",
        dryRun,
        scanned: false,
        operations: [],
        summary: {
          lintIssues: 0,
          highFindings: 0,
          mediumFindings: 0,
          suppressedFindings: 0
        },
        trustSummary,
        lockfileVerified: false
      };
    }
    skillUnits = resolveSkillUnitsFromLockfile(lockfile);
    trustSummary = summarizeTrustFromLockfile(lockfile);
    lockfileVerified = true;
  } else {
    const resolution = resolveSkillUnitsForArgs(manifest, cwd, args);
    skillUnits = resolution.units;
    trustSummary = summarizeTrustFromSourceMetadata(resolution.sourceMetadata);
  }
  assertNoDuplicateSkillNames(skillUnits);
  const scanPolicy = normalizeScanPolicy(manifest);
  const fallbackMode = (manifest.defaults?.mode ?? "link") as InstallMode;
  const securityMode = parseSecurityMode(
    getStringFlag(args, "scan-security"),
    (manifest.defaults?.scan?.security ?? "warn") as SecurityMode
  );

  const scan = noScan
    ? { lintIssues: 0, highFindings: 0, mediumFindings: 0, suppressedFindings: 0, issues: [], findings: [], policyDecisions: [] }
    : runSkillScans(skillUnits, { lintOnly: false, security: securityMode, policy: scanPolicy });

  if (!noScan && securityMode === "fail" && (scan.highFindings > 0 || scan.mediumFindings > 0)) {
    return {
      status: 30,
      dryRun,
      scanned: true,
      operations: [],
      summary: {
        lintIssues: scan.lintIssues,
        highFindings: scan.highFindings,
        mediumFindings: scan.mediumFindings,
        suppressedFindings: scan.suppressedFindings
      },
      trustSummary,
      lockfileVerified: frozenLockfile ? lockfileVerified : undefined
    };
  }

  const operations: ApplyOperation[] = [];
  const targetPlans: TargetApplyPlan[] = [];
  for (const target of selectedTargets) {
    const targetOverrides = manifest.targets?.[target];
    const scope = parseScope(getStringFlag(args, "scope"), (targetOverrides?.scope ?? fallbackScope) as InstallScope);
    const mode = parseMode(getStringFlag(args, "mode"), (targetOverrides?.mode ?? fallbackMode) as InstallMode);
    const installDir = adapters[target].resolveInstallDir(scope, cwd, homeDir);
    const targetSkills: Array<{ source: string; skillName: string }> = [];

    for (const skill of skillUnits) {
      targetSkills.push({ source: skill.skillPath, skillName: skill.skillName });
      operations.push({
        target,
        mode,
        source: skill.skillPath,
        destination: join(installDir, skill.skillName)
      });
    }
    targetPlans.push({ target, mode, installDir, skills: targetSkills });
  }

  if (!dryRun) {
    const staleJournal = readApplyJournal(cwd);
    if (staleJournal) {
      throw new CliError(
        "Detected interrupted apply journal. Run `runwright apply-resume` before applying again.",
        11,
        "apply-recovery-required"
      );
    }
    try {
      for (const plan of targetPlans) {
        performAtomicTargetApply(plan, cwd, (paths) => {
          writeApplyJournal(cwd, {
            schemaVersion: "1.0",
            phase: "target-in-progress",
            target: paths.target,
            installDir: paths.installDir,
            stagingRoot: paths.stagingRoot,
            backupDir: paths.backupDir,
            updatedAt: new Date().toISOString()
          });
        });
        clearApplyJournal(cwd);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Filesystem apply failed: ${message}`, 20, "filesystem-apply-failed");
    }
  }

  const warnings = scan.lintIssues > 0 || scan.highFindings > 0 || scan.mediumFindings > 0;
  const status = warnings ? 2 : 0;
  if (jsonOutput) {
    return {
      status,
      dryRun,
      scanned: !noScan,
      operations,
      summary: {
        lintIssues: scan.lintIssues,
        highFindings: scan.highFindings,
        mediumFindings: scan.mediumFindings,
        suppressedFindings: scan.suppressedFindings
      },
      trustSummary,
      lockfileVerified: frozenLockfile ? lockfileVerified : undefined
    };
  }

  return {
    status,
    dryRun,
    scanned: !noScan,
    operations,
    summary: {
      lintIssues: scan.lintIssues,
      highFindings: scan.highFindings,
      mediumFindings: scan.mediumFindings,
      suppressedFindings: scan.suppressedFindings
    },
    trustSummary,
    lockfileVerified: frozenLockfile ? lockfileVerified : undefined
  };
}

function renderApplyText(result: {
  status: number;
  code?: string;
  reason?: string;
  dryRun: boolean;
  scanned?: boolean;
  lockfileVerified?: boolean;
  operations: ApplyOperation[];
  summary: { lintIssues: number; highFindings: number; mediumFindings: number; suppressedFindings: number };
  trustSummary: TrustSummary;
}): string {
  const lockfileReasonText: Record<string, string> = {
    "missing-lockfile": "No skillbase.lock.json found for frozen mode.",
    "invalid-lockfile": "skillbase.lock.json is malformed and cannot be read.",
    "lockfile-mismatch": "skillbase.lock.json is out of date with local skill content."
  };
  const failed = result.status !== 0 && result.status !== 2 && result.status !== 30;
  const lines = [
    failed ? "Apply Failed" : "Apply Summary",
    `- Status: ${result.status}`,
    `- Planned operations: ${result.operations.length}`,
    `- Mode: ${result.dryRun ? "dry-run (no filesystem changes)" : "apply"}`,
    `- Scan executed: ${result.scanned === false ? "no" : "yes"}`,
    `- Lint issues: ${result.summary.lintIssues}`,
    `- Security findings: high=${result.summary.highFindings}, medium=${result.summary.mediumFindings}`,
    `- Suppressed findings: ${result.summary.suppressedFindings}`,
    `- Trust summary: verified=${result.trustSummary.verifiedSources}, untrusted=${result.trustSummary.untrustedSources}, required=${result.trustSummary.requiredSources}`,
    ...(typeof result.lockfileVerified === "boolean" ? [`- Lockfile verified: ${result.lockfileVerified ? "yes" : "no"}`] : [])
  ];

  if (result.status === 11 && result.code === "lockfile-error") {
    lines.push(
      "",
      "Reason:",
      `  ${lockfileReasonText[result.reason ?? ""] ?? "Frozen lockfile verification failed."}`,
      "",
      "Next:",
      "  runwright update --json",
      "  Retry your apply command."
    );
  } else if (result.status === 30) {
    lines.push(
      "",
      "Next:",
      "  Address blocking findings or run with a non-blocking security mode, then rerun:",
      "  runwright scan --format json"
    );
  } else if (result.dryRun) {
    lines.push(
      "",
      "Next:",
      "  Run the same command without --dry-run to perform installation.",
      "  runwright apply --target all --scope project --mode copy --json"
    );
  } else if (failed) {
    lines.push("", "Next:", "  Review command help and retry:", "  runwright apply --help");
  } else {
    lines.push("", "Next:", "  Confirm target paths and installed skills with:", "  runwright list --json");
  }

  lines.push("");
  return lines.join("\n");
}

function renderFixText(result: {
  status: number;
  mode: "plan" | "apply";
  applied: boolean;
  rolledBack: boolean;
  actions: FixAction[];
  trust: { summary: TrustSummary };
  summary: {
    highFindings: number;
    mediumFindings: number;
    unresolvedAllowlistEntries: number;
    deniedPolicies: number;
  };
}): string {
  const lines = [
    "Fix Summary",
    `- Status: ${result.status}`,
    `- Mode: ${result.mode}`,
    `- Actions: ${result.actions.length}`,
    `- Applied: ${result.applied ? "yes" : "no"}`,
    `- Rolled back: ${result.rolledBack ? "yes" : "no"}`,
    `- Security findings: high=${result.summary.highFindings}, medium=${result.summary.mediumFindings}`,
    `- Allowlist unresolved: ${result.summary.unresolvedAllowlistEntries}`,
    `- Policy denies: ${result.summary.deniedPolicies}`,
    `- Trust summary: verified=${result.trust.summary.verifiedSources}, untrusted=${result.trust.summary.untrustedSources}`
  ];

  if (result.actions.length > 0) {
    lines.push("", "Planned actions:");
    for (const action of result.actions) {
      lines.push(`- ${action.type}: ${action.message} (${action.reversible ? "reversible" : "manual"})`);
    }
  }

  if (result.mode === "plan") {
    lines.push("", "Next:", "  runwright fix --apply --json");
  } else if (result.rolledBack) {
    lines.push("", "Next:", "  Rollback completed. Resolve blocking issues, then rerun fix.");
  } else {
    lines.push("", "Next:", "  runwright update --json", "  runwright scan --format json");
  }

  lines.push("");
  return lines.join("\n");
}

function runScan(args: ParsedArgs, cwd: string, manifest: SkillbaseManifest): {
  status: number;
  payload: Record<string, unknown>;
} {
  const lintOnly = getBooleanFlag(args, "lint-only");
  const security = parseSecurityMode(getStringFlag(args, "security"), "warn");
  const format = parseScanFormat(getStringFlag(args, "format"), getBooleanFlag(args, "json") ? "json" : "text");
  const policyDecisionsOutPath = getStringFlag(args, "policy-decisions-out");
  const resolution = resolveSkillUnitsForArgs(manifest, cwd, args);
  const skillUnits = resolution.units;
  const trustSummary = summarizeTrustFromSourceMetadata(resolution.sourceMetadata);
  const scanPolicy = normalizeScanPolicy(manifest);
  const scan = runSkillScans(skillUnits, { lintOnly, security, policy: scanPolicy });
  if (policyDecisionsOutPath) {
    writePolicyDecisionsArtifact(cwd, policyDecisionsOutPath, scan.policyDecisions);
  }
  const hasSecurityFindings = scan.highFindings > 0 || scan.mediumFindings > 0;
  const status = security === "fail" && hasSecurityFindings ? 30 : scan.lintIssues > 0 || hasSecurityFindings ? 2 : 0;

  if (format === "sarif") {
    const rules = Array.from(new Set(scan.findings.map((finding) => finding.id)))
      .sort((a, b) => a.localeCompare(b))
      .map((ruleId) => ({
        id: ruleId,
        shortDescription: { text: ruleId }
      }));

    return {
      status,
      payload: {
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        version: "2.1.0",
        schemaVersion: "1.0",
        runs: [
          {
            tool: { driver: { name: "skillbase-scan", rules } },
            results: scan.findings.map((finding) => ({
              ruleId: finding.id,
              level: finding.severity === "high" ? "error" : "warning",
              message: { text: finding.message },
              locations: [{ physicalLocation: { artifactLocation: { uri: finding.file } } }]
            }))
          }
        ]
      }
    };
  }

  if (format === "json") {
    return {
      status,
      payload: {
        schemaVersion: "1.0",
        policy: {
          lintOnly,
          security,
          allowRuleIds: scanPolicy.allowRuleIds,
          severityOverrides: scanPolicy.severityOverrides,
          allowlist: scanPolicy.allowlist
        },
        trust: {
          summary: trustSummary
        },
        summary: {
          skills: skillUnits.length,
          lintIssues: scan.lintIssues,
          highFindings: scan.highFindings,
          mediumFindings: scan.mediumFindings,
          suppressedFindings: scan.suppressedFindings
        },
        issues: scan.issues,
        findings: scan.findings,
        policyDecisions: scan.policyDecisions
      }
    };
  }

  return {
    status,
    payload: {
      text: [
        "Scan Summary",
        `- Skills scanned: ${skillUnits.length}`,
        `- Lint issues: ${scan.lintIssues}`,
        `- Security findings: high=${scan.highFindings}, medium=${scan.mediumFindings}`,
        `- Suppressed findings: ${scan.suppressedFindings}`,
        `- Trust summary: verified=${trustSummary.verifiedSources}, untrusted=${trustSummary.untrustedSources}, required=${trustSummary.requiredSources}`,
        "",
        "Next:",
        scan.highFindings > 0 || scan.mediumFindings > 0
          ? "  Resolve findings or tune policy exceptions, then rerun scan."
          : "  Run a dry-run apply to validate installation plan.",
        scan.highFindings > 0 || scan.mediumFindings > 0
          ? "  runwright policy check --json"
          : "  runwright apply --target all --scope project --mode copy --dry-run --json",
        ""
      ].join("\n")
    }
  };
}

type PolicyCheckIssue = {
  code: "expired-allowlist-entry" | "unknown-source" | "unknown-skill" | "unresolved-source";
  entryIndex: number;
  ruleId: SecurityRuleId;
  reason: string;
  source?: string;
  skill?: string;
  expiresAt?: string;
};

function runPolicyCheck(args: ParsedArgs, cwd: string, manifest: SkillbaseManifest): {
  status: number;
  payload: Record<string, unknown>;
} {
  const format = parsePolicyFormat(getStringFlag(args, "format"), getBooleanFlag(args, "json") ? "json" : "text");
  const explain = getBooleanFlag(args, "explain");
  const allowlist = manifest.defaults?.scan?.allowlist ?? [];
  const configuredSources = collectConfiguredSources(manifest);
  const resolution = resolveSkillUnitsForArgs(manifest, cwd, args);
  const units = resolution.units;
  const trustSummary = summarizeTrustFromSourceMetadata(resolution.sourceMetadata);
  const resolvedSources = new Set(units.map((unit) => unit.source));
  const nowMs = Date.now();
  const unresolved: PolicyCheckIssue[] = [];
  let expired = 0;

  for (let index = 0; index < allowlist.length; index += 1) {
    const entry = allowlist[index];
    if (!entry) continue;
    const entryLabel = `allowlist[${index}]`;
    const entryExpired = entry.expiresAt ? Date.parse(entry.expiresAt) < nowMs : false;
    if (entryExpired) {
      expired += 1;
      unresolved.push({
        code: "expired-allowlist-entry",
        entryIndex: index,
        ruleId: entry.ruleId as SecurityRuleId,
        source: entry.source,
        skill: entry.skill,
        expiresAt: entry.expiresAt,
        reason: `${entryLabel} expired at ${entry.expiresAt}`
      });
    }

    if (entry.source && !configuredSources.has(entry.source)) {
      unresolved.push({
        code: "unknown-source",
        entryIndex: index,
        ruleId: entry.ruleId as SecurityRuleId,
        source: entry.source,
        skill: entry.skill,
        expiresAt: entry.expiresAt,
        reason: `${entryLabel} references source '${entry.source}' not configured in selected manifest skill references`
      });
      continue;
    }
    if (entry.source && !resolvedSources.has(entry.source)) {
      unresolved.push({
        code: "unresolved-source",
        entryIndex: index,
        ruleId: entry.ruleId as SecurityRuleId,
        source: entry.source,
        skill: entry.skill,
        expiresAt: entry.expiresAt,
        reason: `${entryLabel} references source '${entry.source}' that did not resolve to any skills`
      });
      continue;
    }

    if (entry.skill) {
      const skillExists = units.some((unit) =>
        entry.source ? unit.source === entry.source && unit.skillName === entry.skill : unit.skillName === entry.skill
      );
      if (!skillExists) {
        unresolved.push({
          code: "unknown-skill",
          entryIndex: index,
          ruleId: entry.ruleId as SecurityRuleId,
          source: entry.source,
          skill: entry.skill,
          expiresAt: entry.expiresAt,
          reason: `${entryLabel} references skill '${entry.skill}' that was not resolved`
        });
      }
    }
  }

  const summary = {
    entries: allowlist.length,
    active: allowlist.length - expired,
    expired,
    unresolved: unresolved.length
  };
  const context: PolicyContext = {
    trust: {
      untrustedSources: trustSummary.untrustedSources
    },
    scan: {
      highFindings: 0,
      mediumFindings: 0
    },
    allowlist: {
      expired: summary.expired,
      unresolved: summary.unresolved
    }
  };
  const policyEvaluation = evaluatePolicyRules(resolveEffectivePolicyRules(manifest, cwd, args), context);
  const status = unresolved.length > 0 || policyEvaluation.summary.deny > 0 ? 2 : 0;

  if (format === "json") {
    return {
      status,
      payload: {
        schemaVersion: "1.0",
        summary,
        unresolved,
        policy: {
          summary: policyEvaluation.summary,
          decisions: policyEvaluation.decisions,
          ...(explain ? { trace: policyEvaluation.trace } : {})
        },
        trust: {
          summary: trustSummary
        }
      }
    };
  }

  const textLines = [
    `policy-check entries=${summary.entries} active=${summary.active} expired=${summary.expired} unresolved=${summary.unresolved}`,
    `policy-rules allow=${policyEvaluation.summary.allow} warn=${policyEvaluation.summary.warn} deny=${policyEvaluation.summary.deny}`
  ];
  if (explain) {
    textLines.push("", "Policy Decision Trace");
    for (const trace of policyEvaluation.trace) {
      textLines.push(
        `- ${trace.ruleId}: matched=${trace.matched ? "yes" : "no"} action=${trace.action} reason=${trace.reason}`
      );
    }
  }
  return {
    status,
    payload: {
      text: textLines.join("\n")
    }
  };
}

function buildFixActions(input: {
  scan: { highFindings: number; mediumFindings: number };
  trustSummary: TrustSummary;
  unresolvedAllowlistEntries: number;
  deniedPolicies: number;
  lockfileExists: boolean;
}): FixAction[] {
  const actions: FixAction[] = [];
  if (!input.lockfileExists) {
    actions.push({
      type: "update-lockfile",
      message: "Generate deterministic lockfile for reproducible installs.",
      reversible: true,
      target: "skillbase.lock.json",
      risk: "low"
    });
  }
  if (input.scan.highFindings > 0 || input.scan.mediumFindings > 0) {
    actions.push({
      type: "address-security-findings",
      message: "Review and resolve security findings reported by scan.",
      reversible: false,
      target: "skills/*/SKILL.md",
      risk: "high"
    });
  }
  if (input.unresolvedAllowlistEntries > 0) {
    actions.push({
      type: "resolve-allowlist-entries",
      message: "Update or remove expired/unresolved allowlist entries.",
      reversible: true,
      target: "runwright.yml",
      risk: "low"
    });
  }
  if (input.deniedPolicies > 0) {
    actions.push({
      type: "resolve-policy-denies",
      message: "Policy deny rules matched; manual policy remediation is required.",
      reversible: false,
      target: "defaults.policy.rules",
      risk: "high"
    });
  }
  if (input.trustSummary.untrustedSources > 0) {
    actions.push({
      type: "verify-trusted-sources",
      message: "One or more sources are untrusted. Refresh source signatures and trust keys.",
      reversible: false,
      target: "defaults.trust",
      risk: "medium"
    });
  }
  return actions;
}

function runFix(args: ParsedArgs, cwd: string, manifest: SkillbaseManifest): {
  status: number;
  mode: "plan" | "apply";
  applied: boolean;
  rolledBack: boolean;
  actions: FixAction[];
  trust: { summary: TrustSummary };
  autopilot: {
    enabled: boolean;
    maxRisk: FixRiskLevel;
    blockedActions: Array<{ type: FixActionType; risk: FixRiskLevel }>;
  };
  summary: {
    highFindings: number;
    mediumFindings: number;
    unresolvedAllowlistEntries: number;
    deniedPolicies: number;
  };
} {
  const explicitPlan = getBooleanFlag(args, "plan");
  const explicitApply = getBooleanFlag(args, "apply");
  const autopilotEnabled = getBooleanFlag(args, "autopilot");
  if (explicitPlan && explicitApply) {
    throw new CliError("Choose only one fix mode: --plan or --apply", 1, "invalid-argument");
  }
  if (autopilotEnabled && explicitPlan) {
    throw new CliError("Autopilot mode cannot be combined with --plan", 1, "invalid-argument");
  }
  const mode: "plan" | "apply" = explicitApply || autopilotEnabled ? "apply" : "plan";
  const maxRisk = parseFixRisk(getStringFlag(args, "max-risk"), "medium");
  const riskRank: Record<FixRiskLevel, number> = { low: 1, medium: 2, high: 3 };
  const resolution = resolveSkillUnitsForArgs(manifest, cwd, args);
  const trustSummary = summarizeTrustFromSourceMetadata(resolution.sourceMetadata);
  const scanPolicy = normalizeScanPolicy(manifest);
  const scan = runSkillScans(resolution.units, { lintOnly: false, security: "warn", policy: scanPolicy });
  const policyFlags = new Map<string, string | boolean>([["json", true]]);
  const rulePackPath = getStringFlag(args, "rule-pack");
  if (rulePackPath) policyFlags.set("rule-pack", rulePackPath);

  const policyCheck = runPolicyCheck(
    {
      command: "policy",
      flags: policyFlags,
      positionals: ["check"],
      duplicateFlags: []
    },
    cwd,
    manifest
  );
  const policyPayload = policyCheck.payload as {
    summary?: { unresolved?: number };
    policy?: { summary?: { deny?: number } };
  };
  const unresolvedAllowlistEntries = Number(policyPayload.summary?.unresolved ?? 0);
  const deniedPolicies = Number(policyPayload.policy?.summary?.deny ?? 0);
  const lockfilePath = resolve(cwd, "skillbase.lock.json");
  const lockfileExists = existsSync(lockfilePath);
  const actions = buildFixActions({
    scan: { highFindings: scan.highFindings, mediumFindings: scan.mediumFindings },
    trustSummary,
    unresolvedAllowlistEntries,
    deniedPolicies,
    lockfileExists
  }).sort((left, right) => riskRank[right.risk] - riskRank[left.risk] || left.type.localeCompare(right.type));
  const blockedActions = autopilotEnabled
    ? actions
        .filter((action) => riskRank[action.risk] > riskRank[maxRisk])
        .map((action) => ({ type: action.type, risk: action.risk }))
    : [];
  const summary = {
    highFindings: scan.highFindings,
    mediumFindings: scan.mediumFindings,
    unresolvedAllowlistEntries,
    deniedPolicies
  };

  if (autopilotEnabled && blockedActions.length > 0) {
    return {
      status: 30,
      mode: "apply",
      applied: false,
      rolledBack: false,
      actions,
      trust: { summary: trustSummary },
      autopilot: {
        enabled: true,
        maxRisk,
        blockedActions
      },
      summary
    };
  }

  if (mode === "plan") {
    return {
      status: 0,
      mode,
      applied: false,
      rolledBack: false,
      actions,
      trust: { summary: trustSummary },
      autopilot: {
        enabled: false,
        maxRisk,
        blockedActions: []
      },
      summary
    };
  }

  const backupRoot = resolve(cwd, ".skillbase", "fix-backups", `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  const manifestRef = resolveManifestFile(cwd);
  const backedUpPaths: Array<{ source: string; backup: string }> = [];
  try {
    mkdirSync(backupRoot, { recursive: true });
    for (const sourcePath of [manifestRef?.path, lockfileExists ? lockfilePath : undefined]) {
      if (!sourcePath || !existsSync(sourcePath)) continue;
      const backupPath = join(backupRoot, sourcePath.replaceAll(":", "").replaceAll("/", "_"));
      cpSync(sourcePath, backupPath, { recursive: false });
      backedUpPaths.push({ source: sourcePath, backup: backupPath });
    }

    if (process.env.SKILLBASE_FIX_FORCE_FAIL_AFTER_BACKUP === "1") {
      throw new Error("forced fix failure for rollback validation");
    }

    const resolvedSources = materializeSkillsToStore(resolution.units, resolution.sourceMetadata, cwd);
    const lockfile = buildLockfileFromSources(resolvedSources);
    writeLockfile(lockfilePath, lockfile);
    rmSync(backupRoot, { recursive: true, force: true });
    return {
      status: actions.length > 0 ? 2 : 0,
      mode,
      applied: true,
      rolledBack: false,
      actions,
      trust: { summary: trustSummary },
      autopilot: {
        enabled: autopilotEnabled,
        maxRisk,
        blockedActions
      },
      summary
    };
  } catch {
    for (const pathEntry of backedUpPaths) {
      cpSync(pathEntry.backup, pathEntry.source, { force: true });
    }
    rmSync(backupRoot, { recursive: true, force: true });
    return {
      status: 11,
      mode,
      applied: false,
      rolledBack: true,
      actions,
      trust: { summary: trustSummary },
      autopilot: {
        enabled: autopilotEnabled,
        maxRisk,
        blockedActions
      },
      summary
    };
  }
}

async function runRemediate(args: ParsedArgs, cwd: string, manifest: SkillbaseManifest): Promise<{
  status: number;
  mode: "plan" | "apply";
  interactive: boolean;
  applied: boolean;
  rolledBack: boolean;
  actions: FixAction[];
  trust: { summary: TrustSummary };
  summary: {
    highFindings: number;
    mediumFindings: number;
    unresolvedAllowlistEntries: number;
    deniedPolicies: number;
  };
}> {
  const sharedFlags = new Map<string, string | boolean>();
  const rulePack = getStringFlag(args, "rule-pack");
  const remoteCacheTtl = getStringFlag(args, "remote-cache-ttl");
  if (rulePack) sharedFlags.set("rule-pack", rulePack);
  if (remoteCacheTtl) sharedFlags.set("remote-cache-ttl", remoteCacheTtl);
  if (getBooleanFlag(args, "refresh-sources")) sharedFlags.set("refresh-sources", true);
  sharedFlags.set("json", true);

  const planFlags = new Map(sharedFlags);
  planFlags.set("plan", true);
  const planResult = runFix(
    {
      command: "fix",
      flags: planFlags,
      positionals: [],
      duplicateFlags: []
    },
    cwd,
    manifest
  );

  const applySafe = getBooleanFlag(args, "apply-safe");
  const interactive = !getBooleanFlag(args, "non-interactive") && process.stdin.isTTY && process.stdout.isTTY;
  if (!applySafe) {
    return { ...planResult, interactive, mode: "plan" };
  }

  if (!interactive) {
    const applyFlags = new Map(sharedFlags);
    applyFlags.set("apply", true);
    const applyResult = runFix(
      {
        command: "fix",
        flags: applyFlags,
        positionals: [],
        duplicateFlags: []
      },
      cwd,
      manifest
    );
    return { ...applyResult, interactive, mode: "apply" };
  }

  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  try {
    process.stdout.write("Remediation candidates:\n");
    for (const [index, action] of planResult.actions.entries()) {
      process.stdout.write(`  ${index + 1}. ${action.type}: ${action.message}\n`);
    }
    const answer = (await terminal.question("Apply safe remediation now? [y/N]: ")).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      return { ...planResult, interactive, mode: "plan" };
    }
  } finally {
    terminal.close();
  }

  const applyFlags = new Map(sharedFlags);
  applyFlags.set("apply", true);
  const applyResult = runFix(
    {
      command: "fix",
      flags: applyFlags,
      positionals: [],
      duplicateFlags: []
    },
    cwd,
    manifest
  );
  return { ...applyResult, interactive, mode: "apply" };
}

function buildWatchApplyArgs(args: ParsedArgs, dryRun: boolean): ParsedArgs {
  const flags = new Map<string, string | boolean>();
  flags.set("json", true);
  flags.set("no-scan", true);
  if (dryRun) flags.set("dry-run", true);
  const target = getStringFlag(args, "target");
  const scope = getStringFlag(args, "scope");
  const mode = getStringFlag(args, "mode");
  const refreshSources = getBooleanFlag(args, "refresh-sources");
  const remoteCacheTtl = getStringFlag(args, "remote-cache-ttl");
  if (target) flags.set("target", target);
  if (scope) flags.set("scope", scope);
  if (mode) flags.set("mode", mode);
  if (refreshSources) flags.set("refresh-sources", true);
  if (remoteCacheTtl) flags.set("remote-cache-ttl", remoteCacheTtl);
  return { command: "apply", flags, positionals: [], duplicateFlags: [] };
}

function buildWatchScanArgs(args: ParsedArgs): ParsedArgs {
  const flags = new Map<string, string | boolean>();
  flags.set("json", true);
  flags.set("format", "json");
  const refreshSources = getBooleanFlag(args, "refresh-sources");
  const remoteCacheTtl = getStringFlag(args, "remote-cache-ttl");
  if (refreshSources) flags.set("refresh-sources", true);
  if (remoteCacheTtl) flags.set("remote-cache-ttl", remoteCacheTtl);
  return { command: "scan", flags, positionals: [], duplicateFlags: [] };
}

function runWatchCycle(
  args: ParsedArgs,
  cwd: string
): {
  status: number;
  update: { status: number; lockfile: string; skills: number; sources: number };
  scan: { status: number; lintIssues: number; highFindings: number; mediumFindings: number; suppressedFindings: number };
  apply: { status: number; dryRun: boolean; operations: number };
} {
  const manifest = loadManifest(cwd);
  const resolution = resolveSkillUnitsForArgs(manifest, cwd, args);
  const units = resolution.units;
  const resolvedSources = materializeSkillsToStore(units, resolution.sourceMetadata, cwd);
  const lockfile = buildLockfileFromSources(resolvedSources);
  const lockPath = resolve(cwd, "skillbase.lock.json");
  writeLockfile(lockPath, lockfile);

  const scanResult = runScan(buildWatchScanArgs(args), cwd, manifest);
  const scanSummary = scanResult.payload.summary as
    | { lintIssues?: number; highFindings?: number; mediumFindings?: number; suppressedFindings?: number }
    | undefined;
  const applySafe = getBooleanFlag(args, "apply-safe");
  let applyResult: ReturnType<typeof runApply>;
  if (applySafe && scanResult.status === 30) {
    applyResult = {
      status: 30,
      dryRun: false,
      scanned: true,
      operations: [],
      summary: {
        lintIssues: Number(scanSummary?.lintIssues ?? 0),
        highFindings: Number(scanSummary?.highFindings ?? 0),
        mediumFindings: Number(scanSummary?.mediumFindings ?? 0),
        suppressedFindings: Number(scanSummary?.suppressedFindings ?? 0)
      },
      trustSummary: summarizeTrustFromSourceMetadata(resolution.sourceMetadata)
    };
  } else {
    applyResult = runApply(buildWatchApplyArgs(args, !applySafe), cwd, manifest);
  }

  const status = scanResult.status === 30 || applyResult.status === 30
    ? 30
    : Math.max(
        Number(scanResult.status ?? 0),
        Number(applyResult.status ?? 0)
      );

  return {
    status,
    update: {
      status: 0,
      lockfile: "skillbase.lock.json",
      skills: units.length,
      sources: Object.keys(lockfile.sources).length
    },
    scan: {
      status: scanResult.status,
      lintIssues: Number(scanSummary?.lintIssues ?? 0),
      highFindings: Number(scanSummary?.highFindings ?? 0),
      mediumFindings: Number(scanSummary?.mediumFindings ?? 0),
      suppressedFindings: Number(scanSummary?.suppressedFindings ?? 0)
    },
    apply: {
      status: applyResult.status,
      dryRun: applyResult.dryRun,
      operations: applyResult.operations.length
    }
  };
}

function watchFingerprint(cwd: string): string {
  const manifestRef = resolveManifestFile(cwd);
  const manifestMtime = manifestRef ? latestModifiedTimeMs(manifestRef.path) : 0;
  const skillsMtime = latestModifiedTimeMs(resolve(cwd, "skills"));
  const lockfileMtime = latestModifiedTimeMs(resolve(cwd, "skillbase.lock.json"));
  return `${manifestMtime}:${skillsMtime}:${lockfileMtime}`;
}

async function runWatch(args: ParsedArgs, cwd: string): Promise<{
  status: number;
  mode: "once" | "watch";
  applySafe: boolean;
  debounceMs: number;
  cycles: Array<{
    status: number;
    update: { status: number; lockfile: string; skills: number; sources: number };
    scan: { status: number; lintIssues: number; highFindings: number; mediumFindings: number; suppressedFindings: number };
    apply: { status: number; dryRun: boolean; operations: number };
  }>;
}> {
  const applySafe = getBooleanFlag(args, "apply-safe");
  const once = getBooleanFlag(args, "once");
  const debounceMs = Number(getStringFlag(args, "debounce-ms") ?? "1500");

  const cycles: Array<{
    status: number;
    update: { status: number; lockfile: string; skills: number; sources: number };
    scan: { status: number; lintIssues: number; highFindings: number; mediumFindings: number; suppressedFindings: number };
    apply: { status: number; dryRun: boolean; operations: number };
  }> = [];

  if (once) {
    cycles.push(runWatchCycle(args, cwd));
    return { status: cycles[0]?.status ?? 0, mode: "once", applySafe, debounceMs, cycles };
  }

  let previousFingerprint = watchFingerprint(cwd);
  let pendingChangeAtMs = 0;

  while (true) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    const fingerprint = watchFingerprint(cwd);
    if (fingerprint !== previousFingerprint) {
      previousFingerprint = fingerprint;
      pendingChangeAtMs = Date.now();
      continue;
    }
    if (pendingChangeAtMs === 0 || Date.now() - pendingChangeAtMs < debounceMs) continue;
    const result = runWatchCycle(args, cwd);
    cycles.push(result);
    pendingChangeAtMs = 0;
    previousFingerprint = watchFingerprint(cwd);
  }
}

function readRegistryIndex(registryDir: string): RegistryIndex {
  const indexPath = resolve(registryDir, "index.json");
  if (!existsSync(indexPath)) {
    return { schemaVersion: "1.0", artifacts: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(indexPath, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid registry index JSON: ${message}`, 1, "invalid-registry-index");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new CliError("Invalid registry index: expected object root", 1, "invalid-registry-index");
  }
  const root = parsed as Record<string, unknown>;
  const artifactsRaw = root.artifacts;
  if (!Array.isArray(artifactsRaw)) {
    throw new CliError("Invalid registry index: expected artifacts array", 1, "invalid-registry-index");
  }

  const artifacts: RegistryArtifact[] = [];
  for (const entry of artifactsRaw) {
    if (!entry || typeof entry !== "object") {
      throw new CliError("Invalid registry index: artifact entry must be object", 1, "invalid-registry-index");
    }
    const artifact = entry as Record<string, unknown>;
    const signatureRaw = artifact.signature;
    if (!signatureRaw || typeof signatureRaw !== "object") {
      throw new CliError("Invalid registry index: artifact signature missing", 1, "invalid-registry-index");
    }
    const signature = signatureRaw as Record<string, unknown>;
    if (
      typeof artifact.id !== "string" ||
      typeof artifact.bundleFile !== "string" ||
      typeof artifact.digest !== "string" ||
      typeof artifact.publishedAt !== "string" ||
      signature.algorithm !== "ed25519" ||
      typeof signature.keyId !== "string" ||
      typeof signature.value !== "string"
    ) {
      throw new CliError("Invalid registry index: malformed artifact entry", 1, "invalid-registry-index");
    }
    artifacts.push({
      id: artifact.id,
      bundleFile: artifact.bundleFile,
      digest: artifact.digest,
      publishedAt: artifact.publishedAt,
      ...(typeof artifact.sourceRef === "string" ? { sourceRef: artifact.sourceRef } : {}),
      signature: {
        algorithm: "ed25519",
        keyId: signature.keyId,
        value: signature.value
      }
    });
  }
  return { schemaVersion: "1.0", artifacts };
}

function writeRegistryIndex(registryDir: string, index: RegistryIndex): void {
  mkdirSync(registryDir, { recursive: true });
  writeFileSync(resolve(registryDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

function parseRegistrySubcommand(args: ParsedArgs): "push" | "pull" {
  const subcommand = args.positionals[0];
  if (subcommand === "push" || subcommand === "pull") return subcommand;
  throw new CliError("registry command requires subcommand: registry push|pull", 1, "invalid-argument");
}

function requireStringFlag(args: ParsedArgs, key: string, message: string): string {
  const value = getStringFlag(args, key);
  if (!value || value.trim().length === 0) throw new CliError(message, 1, "invalid-argument");
  return value;
}

function runRegistry(args: ParsedArgs, cwd: string): {
  status: number;
  subcommand: "push" | "pull";
  registryDir: string;
  artifactId?: string;
  digest?: string;
  out?: string;
  signatureVerified?: boolean;
  code?: string;
  message: string;
} {
  const subcommand = parseRegistrySubcommand(args);
  const registryDirRaw = requireStringFlag(args, "registry-dir", "registry requires --registry-dir <path>");
  const registryDir = resolve(cwd, registryDirRaw);
  const bundlesDir = resolve(registryDir, "bundles");

  if (subcommand === "push") {
    const bundleFlag = requireStringFlag(args, "bundle", "registry push requires --bundle <bundle.zip>");
    const privateKeyFlag = requireStringFlag(
      args,
      "sign-private-key",
      "registry push requires --sign-private-key <private-key.pem>"
    );
    const sourceRef = getStringFlag(args, "source-ref");
    const bundlePath = resolve(cwd, bundleFlag);
    let bundleBytes: Buffer;
    try {
      bundleBytes = readFileSync(bundlePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Unable to read bundle for registry push: ${message}`, 1, "invalid-argument");
    }
    const digest = sha256Hex(bundleBytes);
    const privateKey = readEd25519PrivateKey(cwd, privateKeyFlag);
    const publicKey = createPublicKey(privateKey);
    const keyId = publicKeyFingerprint(publicKey);
    const signature = signData(null, Buffer.from(digest, "utf8"), privateKey).toString("base64");
    const publishedAt = new Date().toISOString();
    const artifactIdBase = `${publishedAt.replace(/[-:.TZ]/g, "")}-${digest.slice(7, 19)}`;

    mkdirSync(bundlesDir, { recursive: true });
    const index = readRegistryIndex(registryDir);
    let artifactId = artifactIdBase;
    while (index.artifacts.some((artifact) => artifact.id === artifactId)) {
      artifactId = `${artifactIdBase}-${Math.random().toString(16).slice(2, 6)}`;
    }
    const bundleFile = `bundles/${artifactId}.zip`;
    writeFileSync(resolve(registryDir, bundleFile), bundleBytes);

    const artifact: RegistryArtifact = {
      id: artifactId,
      bundleFile,
      digest,
      publishedAt,
      ...(sourceRef ? { sourceRef } : {}),
      signature: {
        algorithm: "ed25519",
        keyId,
        value: signature
      }
    };
    const nextArtifacts = [...index.artifacts.filter((entry) => entry.id !== artifact.id), artifact].sort((left, right) => {
      const byDate = right.publishedAt.localeCompare(left.publishedAt);
      return byDate !== 0 ? byDate : right.id.localeCompare(left.id);
    });
    writeRegistryIndex(registryDir, { schemaVersion: "1.0", artifacts: nextArtifacts });

    return {
      status: 0,
      subcommand,
      registryDir,
      artifactId,
      digest,
      message: `Published ${artifactId} to registry`
    };
  }

  const publicKeyFlag = requireStringFlag(args, "sign-public-key", "registry pull requires --sign-public-key <public-key.pem>");
  const outFlag = getStringFlag(args, "out") ?? "runwright-registry-sync.zip";
  const outPath = resolve(cwd, outFlag);
  const artifactIdFlag = getStringFlag(args, "artifact-id");
  const index = readRegistryIndex(registryDir);
  if (index.artifacts.length === 0) {
    return {
      status: 1,
      subcommand,
      registryDir,
      code: "registry-empty",
      signatureVerified: false,
      message: "Registry is empty; nothing to pull."
    };
  }
  const artifact = artifactIdFlag
    ? index.artifacts.find((entry) => entry.id === artifactIdFlag)
    : [...index.artifacts].sort((left, right) => {
        const byDate = right.publishedAt.localeCompare(left.publishedAt);
        return byDate !== 0 ? byDate : right.id.localeCompare(left.id);
      })[0];
  if (!artifact) {
    return {
      status: 1,
      subcommand,
      registryDir,
      code: "registry-artifact-not-found",
      signatureVerified: false,
      message: `Registry artifact not found: ${artifactIdFlag}`
    };
  }

  const bundlePath = resolve(registryDir, artifact.bundleFile);
  let bundleBytes: Buffer;
  try {
    bundleBytes = readFileSync(bundlePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 1,
      subcommand,
      registryDir,
      artifactId: artifact.id,
      code: "registry-read-failed",
      signatureVerified: false,
      message: `Unable to read registry artifact bundle: ${message}`
    };
  }
  const computedDigest = sha256Hex(bundleBytes);
  if (computedDigest !== artifact.digest) {
    return {
      status: 1,
      subcommand,
      registryDir,
      artifactId: artifact.id,
      code: "registry-digest-mismatch",
      signatureVerified: false,
      message: "Registry artifact digest mismatch."
    };
  }

  const publicKey = readEd25519PublicKey(cwd, publicKeyFlag);
  const expectedKeyId = publicKeyFingerprint(publicKey);
  if (artifact.signature.keyId !== expectedKeyId) {
    return {
      status: 1,
      subcommand,
      registryDir,
      artifactId: artifact.id,
      code: "registry-signature-failed",
      signatureVerified: false,
      message: "Registry signature keyId mismatch."
    };
  }
  const signatureVerified = verifyData(
    null,
    Buffer.from(artifact.digest, "utf8"),
    publicKey,
    Buffer.from(artifact.signature.value, "base64")
  );
  if (!signatureVerified) {
    return {
      status: 1,
      subcommand,
      registryDir,
      artifactId: artifact.id,
      code: "registry-signature-failed",
      signatureVerified: false,
      message: "Registry signature verification failed."
    };
  }

  writeFileSync(outPath, bundleBytes);
  return {
    status: 0,
    subcommand,
    registryDir,
    artifactId: artifact.id,
    digest: artifact.digest,
    out: outPath,
    signatureVerified: true,
    message: `Pulled ${artifact.id} to ${outPath}`
  };
}

function renderRegistryText(result: {
  status: number;
  subcommand: "push" | "pull";
  registryDir: string;
  artifactId?: string;
  digest?: string;
  out?: string;
  signatureVerified?: boolean;
  code?: string;
  message: string;
}): string {
  const lines: string[] = [
    result.status === 0 ? "Registry Sync" : "Registry Sync Failed",
    `- Subcommand: ${result.subcommand}`,
    `- Status: ${result.status}`,
    `- Registry: ${result.registryDir}`,
    ...(result.artifactId ? [`- Artifact: ${result.artifactId}`] : []),
    ...(result.digest ? [`- Digest: ${result.digest}`] : []),
    ...(result.out ? [`- Output: ${result.out}`] : []),
    ...(typeof result.signatureVerified === "boolean"
      ? [`- Signature: ${result.signatureVerified ? "verified" : "not verified"}`]
      : []),
    ...(result.code ? [`- Code: ${result.code}`] : []),
    "",
    result.message
  ];
  lines.push("");
  return lines.join("\n");
}

function runExport(args: ParsedArgs, cwd: string, manifest: SkillbaseManifest): {
  status: number;
  out: string;
  files: number;
  lockfileGenerated: boolean;
  signature?: string;
  signatureAlgorithm?: "hmac-sha256" | "ed25519";
} {
  const outPath = resolve(cwd, getStringFlag(args, "out") ?? "runwright-export.zip");
  const signKeyPath = getStringFlag(args, "sign-key");
  const signPrivateKeyPath = getStringFlag(args, "sign-private-key");
  const deterministicFlag = getBooleanFlag(args, "deterministic");
  const sourceDateEpochMs = resolveSourceDateEpochMs();
  const deterministic = deterministicFlag || sourceDateEpochMs !== undefined;
  const createdAtMs = deterministic ? (sourceDateEpochMs ?? MIN_ZIP_MTIME_MS) : Date.now();
  const createdAt = new Date(createdAtMs).toISOString();
  const zipMtime = new Date(createdAtMs);
  if (signKeyPath && signPrivateKeyPath) {
    throw new CliError("Use only one signing mode: --sign-key or --sign-private-key", 1, "invalid-argument");
  }

  const manifestRef = resolveManifestFile(cwd);
  if (!manifestRef) {
    throw new CliError(
      "No runwright.yml/runwright.json found (legacy skillbase.yml/skillbase.json is also supported).",
      10,
      "missing-manifest"
    );
  }
  const manifestPath = manifestRef.path;
  const manifestName = manifestRef.filename;

  const lockPath = resolve(cwd, "skillbase.lock.json");
  const lockfileGenerated = !existsSync(lockPath);
  const resolution = resolveSkillUnitsForArgs(manifest, cwd, args);
  let runtimeLockfile: SkillbaseLockfile;
  if (lockfileGenerated) {
    try {
      runtimeLockfile = buildLockfileFromSources(
        materializeSkillsToStore(resolution.units, resolution.sourceMetadata, cwd)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Invalid skill content: ${message}`, 1, "invalid-skill-content");
    }
  } else {
    try {
      runtimeLockfile = readLockfile(lockPath);
    } catch {
      throw new CliError("Invalid lockfile: skillbase.lock.json", 11, "invalid-lockfile");
    }
  }
  const lockVerification = verifyLockfileMaterialized(runtimeLockfile, cwd);
  if (!lockVerification.ok) {
    throw new CliError(
      `Invalid lockfile materialization: ${lockVerification.reason ?? "unknown"}`,
      11,
      "lockfile-mismatch"
    );
  }
  const lockfileRaw = `${JSON.stringify(runtimeLockfile, null, 2)}\n`;
  const units = resolveSkillUnitsFromLockfile(runtimeLockfile);
  assertNoDuplicateSkillNames(units);

  const archive: Record<string, Uint8Array> = {
    [manifestName]: strToU8(readFileSync(manifestPath, "utf8")),
    "skillbase.lock.json": strToU8(lockfileRaw)
  };

  for (const unit of units) {
    for (const filePath of walkFiles(unit.skillPath)) {
      const relativePath = filePath.slice(unit.skillPath.length + 1).replaceAll("\\", "/");
      archive[`skills/${unit.skillName}/${relativePath}`] = readFileSync(filePath);
    }
  }

  const files: BundleFileEntry[] = Object.entries(archive)
    .map(([path, content]) => ({
      path,
      digest: sha256Hex(content),
      size: content.byteLength
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const manifestDoc: BundleManifest = {
    schemaVersion: "1.0",
    createdAt,
    files,
    provenance: {
      generator: "runwright-cli",
      contractVersion: "1.0",
      createdBy: `node ${process.version}`
    }
  };

  let signature: string | undefined;
  let signatureAlgorithm: "hmac-sha256" | "ed25519" | undefined;
  if (signKeyPath) {
    const keyBytes = readHmacSigningKey(cwd, signKeyPath);
    signature = createHmac("sha256", keyBytes).update(bundleSignaturePayload(manifestDoc)).digest("hex");
    signatureAlgorithm = "hmac-sha256";
    manifestDoc.signature = {
      algorithm: "hmac-sha256",
      value: signature
    };
  } else if (signPrivateKeyPath) {
    const privateKey = readEd25519PrivateKey(cwd, signPrivateKeyPath);
    const publicKey = createPublicKey(privateKey);
    const keyId = publicKeyFingerprint(publicKey);
    signature = signData(null, Buffer.from(bundleSignaturePayload(manifestDoc), "utf8"), privateKey).toString("base64");
    signatureAlgorithm = "ed25519";
    manifestDoc.signature = {
      algorithm: "ed25519",
      value: signature,
      keyId
    };
  }

  archive["_bundle/manifest.json"] = strToU8(`${JSON.stringify(manifestDoc, null, 2)}\n`);

  const zipEntries = Object.entries(archive).sort(([left], [right]) => left.localeCompare(right));
  const deterministicZipOptions = { level: 9 as const, mtime: zipMtime };
  const zipInput: Record<string, Uint8Array | [Uint8Array, typeof deterministicZipOptions]> = {};
  for (const [archivePath, content] of zipEntries) {
    if (deterministic) {
      zipInput[archivePath] = [content, deterministicZipOptions];
    } else {
      zipInput[archivePath] = content;
    }
  }

  const zip = zipSync(zipInput, deterministic ? deterministicZipOptions : { level: 9 });
  writeFileSync(outPath, Buffer.from(zip));
  return { status: 0, out: outPath, files: Object.keys(archive).length, lockfileGenerated, signature, signatureAlgorithm };
}

function runVerifyBundle(args: ParsedArgs, cwd: string): {
  status: number;
  code?: string;
  integrityOk: boolean;
  signatureVerified: boolean;
  issues: string[];
} {
  const bundlePathFlag = getStringFlag(args, "bundle");
  if (!bundlePathFlag) {
    return {
      status: 1,
      code: "missing-bundle",
      integrityOk: false,
      signatureVerified: false,
      issues: ["verify-bundle requires --bundle <path>"]
    };
  }

  const bundlePath = resolve(cwd, bundlePathFlag);
  const signKeyPath = getStringFlag(args, "sign-key");
  const signPublicKeyPath = getStringFlag(args, "sign-public-key");
  if (signKeyPath && signPublicKeyPath) {
    return {
      status: 1,
      code: "invalid-argument",
      integrityOk: false,
      signatureVerified: false,
      issues: ["Use only one verification key mode: --sign-key or --sign-public-key"]
    };
  }
  const requireSignature = getBooleanFlag(args, "require-signature");
  const issues: string[] = [];
  let bundleStatSize: number;
  try {
    bundleStatSize = statSync(bundlePath).size;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 1,
      code: "invalid-bundle-archive",
      integrityOk: false,
      signatureVerified: false,
      issues: [`unable to read bundle: ${message}`]
    };
  }
  if (bundleStatSize > MAX_BUNDLE_COMPRESSED_BYTES) {
    return {
      status: 1,
      code: "bundle-too-large",
      integrityOk: false,
      signatureVerified: false,
      issues: [`bundle compressed size exceeds limit (${bundleStatSize} > ${MAX_BUNDLE_COMPRESSED_BYTES})`]
    };
  }
  let bytes: Buffer;
  try {
    bytes = readFileSync(bundlePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 1,
      code: "invalid-bundle-archive",
      integrityOk: false,
      signatureVerified: false,
      issues: [`unable to read bundle: ${message}`]
    };
  }
  if (bytes.byteLength > MAX_BUNDLE_COMPRESSED_BYTES) {
    return {
      status: 1,
      code: "bundle-too-large",
      integrityOk: false,
      signatureVerified: false,
      issues: [`bundle compressed size exceeds limit (${bytes.byteLength} > ${MAX_BUNDLE_COMPRESSED_BYTES})`]
    };
  }

  let zipUsage: { entryCount: number; totalUncompressedBytes: number; entries: ZipCentralDirectoryEntry[] };
  try {
    zipUsage = inspectZipResourceUsage(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 1,
      code: "invalid-bundle-archive",
      integrityOk: false,
      signatureVerified: false,
      issues: [`invalid bundle archive: ${message}`]
    };
  }

  if (zipUsage.entryCount > MAX_BUNDLE_FILE_ENTRIES) {
    return {
      status: 1,
      code: "bundle-too-large",
      integrityOk: false,
      signatureVerified: false,
      issues: [`bundle file count exceeds limit (${zipUsage.entryCount} > ${MAX_BUNDLE_FILE_ENTRIES})`]
    };
  }
  if (zipUsage.totalUncompressedBytes > MAX_BUNDLE_UNCOMPRESSED_BYTES) {
    return {
      status: 1,
      code: "bundle-too-large",
      integrityOk: false,
      signatureVerified: false,
      issues: [
        `bundle uncompressed size exceeds limit (${zipUsage.totalUncompressedBytes} > ${MAX_BUNDLE_UNCOMPRESSED_BYTES})`
      ]
    };
  }
  const seenArchivePaths = new Set<string>();
  for (const entry of zipUsage.entries) {
    if (!isSafeBundleRelativePath(entry.path)) {
      return {
        status: 1,
        code: "invalid-bundle-archive",
        integrityOk: false,
        signatureVerified: false,
        issues: [`invalid bundle archive: unsafe archive entry path: ${entry.path}`]
      };
    }
    if (seenArchivePaths.has(entry.path)) {
      return {
        status: 1,
        code: "invalid-bundle-archive",
        integrityOk: false,
        signatureVerified: false,
        issues: [`invalid bundle archive: duplicate archive entry path: ${entry.path}`]
      };
    }
    seenArchivePaths.add(entry.path);
    if ((entry.generalPurposeBitFlag & ZIP_GENERAL_PURPOSE_BIT_FLAG_ENCRYPTED) !== 0) {
      return {
        status: 1,
        code: "invalid-bundle-archive",
        integrityOk: false,
        signatureVerified: false,
        issues: [`invalid bundle archive: encrypted ZIP entries are not supported (${entry.path})`]
      };
    }
    if (
      entry.compressionMethod !== ZIP_COMPRESSION_METHOD_STORED &&
      entry.compressionMethod !== ZIP_COMPRESSION_METHOD_DEFLATE
    ) {
      return {
        status: 1,
        code: "invalid-bundle-archive",
        integrityOk: false,
        signatureVerified: false,
        issues: [
          `invalid bundle archive: unsupported ZIP compression method ${entry.compressionMethod} for ${entry.path}`
        ]
      };
    }
  }

  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 1,
      code: "invalid-bundle-archive",
      integrityOk: false,
      signatureVerified: false,
      issues: [`invalid bundle archive: ${message}`]
    };
  }
  const manifestBytes = archive["_bundle/manifest.json"];
  if (!manifestBytes) {
    return {
      status: 1,
      code: "invalid-bundle-manifest",
      integrityOk: false,
      signatureVerified: false,
      issues: ["missing _bundle/manifest.json"]
    };
  }

  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse(strFromU8(manifestBytes)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 1,
      code: "invalid-bundle-manifest",
      integrityOk: false,
      signatureVerified: false,
      issues: [`invalid manifest json: ${message}`]
    };
  }
  const manifestValidation = validateBundleManifest(manifestRaw);
  if (!manifestValidation.manifest) {
    return {
      status: 1,
      code: "invalid-bundle-manifest",
      integrityOk: false,
      signatureVerified: false,
      issues: manifestValidation.issues
    };
  }
  const manifestDoc = manifestValidation.manifest;
  const manifestFilePaths = new Set(manifestDoc.files.map((file) => file.path));
  for (const requiredPath of REQUIRED_BUNDLE_PATHS) {
    if (!manifestFilePaths.has(requiredPath)) {
      issues.push(`bundle manifest missing required file: ${requiredPath}`);
    }
  }
  if (!REQUIRED_BUNDLE_MANIFEST_CANDIDATES.some((candidate) => manifestFilePaths.has(candidate))) {
    issues.push("bundle manifest missing required project manifest file");
  }
  if (!manifestDoc.files.some((file) => file.path.startsWith("skills/") && file.path.endsWith("/SKILL.md"))) {
    issues.push("bundle manifest missing required skills/*/SKILL.md entry");
  }
  const skillRoots = new Set<string>();
  for (const file of manifestDoc.files) {
    if (!file.path.startsWith("skills/")) continue;
    const segments = file.path.split("/");
    if (segments.length < 3) {
      issues.push(`invalid skills path in manifest: ${file.path}`);
      continue;
    }
    skillRoots.add(`skills/${segments[1]}`);
  }
  for (const root of [...skillRoots].sort((left, right) => left.localeCompare(right))) {
    if (!manifestFilePaths.has(`${root}/SKILL.md`)) {
      issues.push(`bundle manifest missing SKILL.md entry for skill directory: ${root}`);
    }
  }

  for (const file of manifestDoc.files) {
    const content = archive[file.path];
    if (!content) {
      issues.push(`missing file from archive: ${file.path}`);
      continue;
    }
    const digest = sha256Hex(content);
    if (digest !== file.digest) issues.push(`digest mismatch for ${file.path}`);
    if (content.byteLength !== file.size) issues.push(`size mismatch for ${file.path}`);
  }

  const expectedPaths = new Set<string>(["_bundle/manifest.json", ...manifestDoc.files.map((file) => file.path)]);
  for (const archivePath of Object.keys(archive)) {
    if (!expectedPaths.has(archivePath)) {
      issues.push(`unexpected file in archive: ${archivePath}`);
    }
  }

  let signatureVerified = false;
  if (manifestDoc.signature) {
    const signaturePayload = Buffer.from(
      bundleSignaturePayload({
        schemaVersion: manifestDoc.schemaVersion,
        createdAt: manifestDoc.createdAt,
        files: manifestDoc.files,
        provenance: manifestDoc.provenance
      }),
      "utf8"
    );
    if (manifestDoc.signature.algorithm === "hmac-sha256") {
      if (!signKeyPath) {
        issues.push("bundle is hmac-signed but --sign-key was not provided");
      } else {
        const keyBytes = readHmacSigningKey(cwd, signKeyPath);
        const expectedHex = createHmac("sha256", keyBytes).update(signaturePayload).digest("hex");
        const expected = Buffer.from(expectedHex, "hex");
        const provided = Buffer.from(manifestDoc.signature.value, "hex");
        signatureVerified = expected.length === provided.length && timingSafeEqual(expected, provided);
        if (!signatureVerified) issues.push("signature verification failed");
      }
    } else if (manifestDoc.signature.algorithm === "ed25519") {
      if (!signPublicKeyPath) {
        issues.push("bundle is ed25519-signed but --sign-public-key was not provided");
      } else {
        const publicKey = readEd25519PublicKey(cwd, signPublicKeyPath);
        const expectedKeyId = publicKeyFingerprint(publicKey);
        if (manifestDoc.signature.keyId !== expectedKeyId) {
          issues.push("signature keyId mismatch");
        }
        signatureVerified = verifyData(
          null,
          signaturePayload,
          publicKey,
          Buffer.from(manifestDoc.signature.value, "base64")
        );
        if (!signatureVerified) issues.push("signature verification failed");
      }
    }
  } else if (signKeyPath || signPublicKeyPath) {
    if (signKeyPath) issues.push("--sign-key provided but bundle is unsigned");
    if (signPublicKeyPath) issues.push("--sign-public-key provided but bundle is unsigned");
  } else if (requireSignature) {
    issues.push("signature required but bundle is unsigned");
  }

  const integrityOk = issues.length === 0;
  return {
    status: integrityOk ? 0 : 1,
    ...(integrityOk ? {} : { code: "bundle-verification-failed" }),
    integrityOk,
    signatureVerified,
    issues
  };
}

function renderVerifyBundleText(result: {
  status: number;
  code?: string;
  integrityOk: boolean;
  signatureVerified: boolean;
  issues: string[];
}): string {
  const lines: string[] = [
    result.status === 0 ? "Bundle Verification" : "Bundle Verification Failed",
    `- Status: ${result.status}`,
    `- Integrity: ${result.integrityOk ? "ok" : "failed"}`,
    `- Signature: ${result.signatureVerified ? "verified" : "not verified"}`,
    `- Issues: ${result.issues.length}`
  ];

  if (result.status !== 0) {
    if (result.code) lines.push(`- Code: ${result.code}`);
    if (result.issues.length > 0) {
      lines.push("", "Details:");
      for (const issue of result.issues) lines.push(`  - ${issue}`);
    }
    lines.push("", "Next:");
    if (result.code === "missing-bundle") {
      lines.push("  runwright verify-bundle --bundle <bundle.zip> --json");
    } else {
      lines.push("  docs/help/troubleshooting.md");
      lines.push("  runwright help verify-bundle");
    }
  } else {
    lines.push("", "Next:", "  Keep this output with release evidence artifacts.");
  }

  lines.push("");
  return lines.join("\n");
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const cmd = parsed.command;
  const commandFlagHelp = getBooleanFlag(parsed, "help") || getBooleanFlag(parsed, "h");
  if (!cmd || cmd === "-h" || cmd === "--help") {
    usage();
    process.exit(0);
  }
  if (cmd === "help") {
    const topic = parsed.positionals[0];
    const knownTopic = usage(topic);
    process.exit(topic && !knownTopic ? 1 : 0);
  }
  if (commandFlagHelp) {
    const knownCommand = usage(cmd);
    process.exit(knownCommand ? 0 : 1);
  }

  const cwd = process.cwd();
  const jsonOutput = getBooleanFlag(parsed, "json");
  const startedAtMs = PROCESS_STARTED_AT_MS;
  validateAllowedFlags(parsed);

  if (!KNOWN_TOP_LEVEL_COMMANDS.has(cmd)) {
    const unknownMessage = renderUnknownCommandMessage(cmd);
    if (jsonOutput) writeJson(withJsonSchemaVersion({ status: 1, code: "unknown-command", error: unknownMessage }));
    else process.stderr.write(`${unknownMessage}\n`);
    process.exit(1);
  }
  validateSemanticFlags(parsed);

  if (cmd === "init") {
    const init = runInit(cwd);
    if (jsonOutput) writeJson(withJsonSchemaVersion({ status: init.status, message: init.message }));
    else process.stdout.write(`${init.message}\n`);
    recordOperationEvent(cwd, startedAtMs, "init", init.status, init.mutating);
    process.exit(init.status);
  }

  if (cmd === "doctor") {
    const doctor = runDoctor(parsed, cwd);
    if (jsonOutput) writeJson(withJsonSchemaVersion({ status: doctor.status, issues: doctor.issues, fixed: doctor.fixed }));
    else {
      if (doctor.issues.length === 0) process.stdout.write("doctor: no issues found\n");
      else for (const issue of doctor.issues) process.stdout.write(`doctor: ${issue.type}: ${issue.message}\n`);
    }
    const mutating = getBooleanFlag(parsed, "fix") && doctor.fixed > 0;
    recordOperationEvent(cwd, startedAtMs, "doctor", doctor.status, mutating, {
      counters: { issues: doctor.issues.length, fixed: doctor.fixed }
    });
    process.exit(doctor.status);
  }

  if (cmd === "verify-bundle") {
    const result = runVerifyBundle(parsed, cwd);
    if (jsonOutput) writeJson(withJsonSchemaVersion(result));
    else process.stdout.write(renderVerifyBundleText(result));
    recordOperationEvent(cwd, startedAtMs, "verify-bundle", result.status, false, {
      ...(result.code ? { code: result.code } : {}),
      counters: { issues: result.issues.length, signatureVerified: result.signatureVerified ? 1 : 0 }
    });
    process.exit(result.status);
  }

  if (cmd === "journey") {
    const result = runJourney(cwd);
    if (jsonOutput) writeJson(withJsonSchemaVersion(result.payload));
    else process.stdout.write(renderJourneyText(result.payload));
    process.exit(result.status);
  }

  if (cmd === "apply-resume") {
    const result = runApplyResume(cwd);
    if (jsonOutput) writeJson(withJsonSchemaVersion(result));
    else process.stdout.write(`${result.message}\n`);
    recordOperationEvent(cwd, startedAtMs, "apply-resume", result.status, result.recovered, {
      counters: { recovered: result.recovered ? 1 : 0 }
    });
    process.exit(result.status);
  }

  if (cmd === "registry") {
    const result = runRegistry(parsed, cwd);
    if (jsonOutput) writeJson(withJsonSchemaVersion(result));
    else process.stdout.write(renderRegistryText(result));
    recordOperationEvent(cwd, startedAtMs, "registry", result.status, result.status === 0, {
      ...(result.code ? { code: result.code } : {}),
      counters: { signatureVerified: result.signatureVerified ? 1 : 0 }
    });
    process.exit(result.status);
  }

  const manifest = loadManifest(cwd);

  if (cmd === "mission") {
    const mission = runMission(parsed, cwd, manifest);
    if (jsonOutput) writeJson(withJsonSchemaVersion(mission));
    else process.stdout.write(renderMissionText(mission));
    recordOperationEvent(cwd, startedAtMs, "mission", mission.status, false, {
      counters: {
        completionPercent: mission.sections.journey.completionPercent,
        trustVerifiedSources: mission.sections.trust.verifiedSources,
        trustRequiredSources: mission.sections.trust.requiredSources,
        actionStatus: mission.action ? mission.action.status : 0
      }
    });
    process.exit(mission.status);
  }

  if (cmd === "watch") {
    const watchResult = await runWatch(parsed, cwd);
    if (jsonOutput) writeJson(withJsonSchemaVersion(watchResult));
    else {
      process.stdout.write(`watch mode=${watchResult.mode} cycles=${watchResult.cycles.length} applySafe=${watchResult.applySafe}\n`);
      for (const [index, cycle] of watchResult.cycles.entries()) {
        process.stdout.write(
          `cycle#${index + 1} status=${cycle.status} scan=${cycle.scan.status} apply=${cycle.apply.status} dryRun=${cycle.apply.dryRun}\n`
        );
      }
    }
    const latestCycle = watchResult.cycles[watchResult.cycles.length - 1];
    recordOperationEvent(cwd, startedAtMs, "watch", watchResult.status, latestCycle ? !latestCycle.apply.dryRun : false, {
      counters: {
        cycles: watchResult.cycles.length,
        highFindings: Number(latestCycle?.scan.highFindings ?? 0),
        mediumFindings: Number(latestCycle?.scan.mediumFindings ?? 0),
        operations: Number(latestCycle?.apply.operations ?? 0)
      }
    });
    process.exit(watchResult.status);
  }

  if (cmd === "apply") {
    const applyResult = runApply(parsed, cwd, manifest);
    if (jsonOutput) writeJson(withJsonSchemaVersion({ ...applyResult }));
    else process.stdout.write(renderApplyText(applyResult));
    const applyMutating = !applyResult.dryRun && applyResult.operations.length > 0 && applyResult.status !== 30;
    recordOperationEvent(cwd, startedAtMs, "apply", applyResult.status, applyMutating, {
      ...(applyResult.code ? { code: applyResult.code } : {}),
      counters: {
        operations: applyResult.operations.length,
        lintIssues: applyResult.summary.lintIssues,
        highFindings: applyResult.summary.highFindings,
        mediumFindings: applyResult.summary.mediumFindings,
        suppressedFindings: applyResult.summary.suppressedFindings
      }
    });
    process.exit(applyResult.status);
  }

  if (cmd === "scan") {
    const scan = runScan(parsed, cwd, manifest);
    const format = parseScanFormat(getStringFlag(parsed, "format"), jsonOutput ? "json" : "text");
    if (format === "text") {
      process.stdout.write(`${String(scan.payload.text ?? "")}\n`);
    } else {
      writeJson(scan.payload);
    }
    recordOperationEvent(cwd, startedAtMs, "scan", scan.status, false, {
      counters: scan.payload.summary && typeof scan.payload.summary === "object"
        ? {
            lintIssues: Number((scan.payload.summary as Record<string, unknown>).lintIssues ?? 0),
            highFindings: Number((scan.payload.summary as Record<string, unknown>).highFindings ?? 0),
            mediumFindings: Number((scan.payload.summary as Record<string, unknown>).mediumFindings ?? 0)
          }
        : undefined
    });
    process.exit(scan.status);
  }

  if (cmd === "policy") {
    const policy = runPolicyCheck(parsed, cwd, manifest);
    const format = parsePolicyFormat(getStringFlag(parsed, "format"), jsonOutput ? "json" : "text");
    if (format === "text") {
      process.stdout.write(`${String(policy.payload.text ?? "")}\n`);
    } else {
      writeJson(policy.payload);
    }
    process.exit(policy.status);
  }

  if (cmd === "remediate") {
    const remediateResult = await runRemediate(parsed, cwd, manifest);
    if (jsonOutput) writeJson(withJsonSchemaVersion(remediateResult));
    else process.stdout.write(renderFixText(remediateResult));
    recordOperationEvent(cwd, startedAtMs, "remediate", remediateResult.status, remediateResult.applied && !remediateResult.rolledBack, {
      counters: {
        actions: remediateResult.actions.length,
        highFindings: remediateResult.summary.highFindings,
        mediumFindings: remediateResult.summary.mediumFindings,
        unresolvedAllowlistEntries: remediateResult.summary.unresolvedAllowlistEntries,
        deniedPolicies: remediateResult.summary.deniedPolicies
      }
    });
    process.exit(remediateResult.status);
  }

  if (cmd === "fix") {
    const fixResult = runFix(parsed, cwd, manifest);
    if (jsonOutput) writeJson(withJsonSchemaVersion({ ...fixResult, plan: { actions: fixResult.actions } }));
    else process.stdout.write(renderFixText(fixResult));
    recordOperationEvent(cwd, startedAtMs, "fix", fixResult.status, fixResult.applied && !fixResult.rolledBack, {
      counters: {
        actions: fixResult.actions.length,
        highFindings: fixResult.summary.highFindings,
        mediumFindings: fixResult.summary.mediumFindings,
        unresolvedAllowlistEntries: fixResult.summary.unresolvedAllowlistEntries,
        deniedPolicies: fixResult.summary.deniedPolicies
      }
    });
    process.exit(fixResult.status);
  }

  if (cmd === "list") {
    const targets = parseTargets(getStringFlag(parsed, "target"));
    const fallbackScope = (manifest.defaults?.scope ?? "global") as InstallScope;
    const homeDir = homedir();
    const skills = resolveSkillUnitsForArgs(manifest, cwd, parsed).units.map((skill) => skill.skillName);
    const targetSummary = targets.map((target) => {
      const targetOverrides = manifest.targets?.[target];
      const scope = parseScope(getStringFlag(parsed, "scope"), (targetOverrides?.scope ?? fallbackScope) as InstallScope);
      return {
        target,
        scope,
        path: adapters[target].resolveInstallDir(scope, cwd, homeDir)
      };
    });
    writeJson(withJsonSchemaVersion({ skills, targets: targetSummary }));
    process.exit(0);
  }

  if (cmd === "update") {
    const resolution = resolveSkillUnitsForArgs(manifest, cwd, parsed);
    const units = resolution.units;
    const trustSummary = summarizeTrustFromSourceMetadata(resolution.sourceMetadata);
    assertNoDuplicateSkillNames(units);
    const lockPath = resolve(cwd, "skillbase.lock.json");
    let resolvedSources: ReturnType<typeof materializeSkillsToStore>;
    try {
      resolvedSources = materializeSkillsToStore(units, resolution.sourceMetadata, cwd);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Invalid skill content: ${message}`, 1, "invalid-skill-content");
    }
    const frozen = getBooleanFlag(parsed, "frozen-lockfile");

    if (frozen) {
      if (!existsSync(lockPath)) {
        writeJson(
          withJsonSchemaVersion({
            status: 11,
            code: "lockfile-error",
            lockfileVerified: false,
            reason: "missing-lockfile",
            trust: {
              summary: trustSummary
            }
          })
        );
        recordOperationEvent(cwd, startedAtMs, "update", 11, false, {
          code: "lockfile-error",
          counters: { skills: units.length }
        });
        process.exit(11);
      }
      let existing: SkillbaseLockfile;
      try {
        existing = readLockfile(lockPath);
      } catch {
        writeJson(
          withJsonSchemaVersion({
            status: 11,
            code: "lockfile-error",
            lockfileVerified: false,
            reason: "invalid-lockfile",
            trust: {
              summary: trustSummary
            }
          })
        );
        recordOperationEvent(cwd, startedAtMs, "update", 11, false, {
          code: "lockfile-error",
          counters: { skills: units.length }
        });
        process.exit(11);
      }
      const expected = buildLockfileFromSources(resolvedSources, existing.generatedAt);
      if (!lockfilesEqual(existing, expected)) {
        writeJson(
          withJsonSchemaVersion({
            status: 11,
            code: "lockfile-error",
            lockfileVerified: false,
            reason: "lockfile-mismatch",
            trust: {
              summary: trustSummary
            }
          })
        );
        recordOperationEvent(cwd, startedAtMs, "update", 11, false, {
          code: "lockfile-error",
          counters: { skills: units.length, sources: Object.keys(existing.sources).length }
        });
        process.exit(11);
      }
      const sourcesCount = Object.keys(existing.sources).length;
      const frozenTrustSummary = summarizeTrustFromLockfile(existing);
      writeJson(
        withJsonSchemaVersion({
          status: 0,
          lockfile: "skillbase.lock.json",
          lockfileVerified: true,
          sources: sourcesCount,
          skills: units.length,
          trust: {
            summary: frozenTrustSummary
          }
        })
      );
      recordOperationEvent(cwd, startedAtMs, "update", 0, false, {
        counters: { skills: units.length, sources: sourcesCount }
      });
      process.exit(0);
    }

    const lockfile = buildLockfileFromSources(resolvedSources);
    writeLockfile(lockPath, lockfile);
    const sourcesCount = Object.keys(lockfile.sources).length;
    writeJson(
      withJsonSchemaVersion({
        status: 0,
        lockfile: "skillbase.lock.json",
        lockfileVerified: false,
        sources: sourcesCount,
        skills: units.length,
        trust: {
          summary: trustSummary
        }
      })
    );
    recordOperationEvent(cwd, startedAtMs, "update", 0, true, {
      counters: { skills: units.length, sources: sourcesCount }
    });
    process.exit(0);
  }

  if (cmd === "export") {
    const exportResult = runExport(parsed, cwd, manifest);
    if (jsonOutput) writeJson(withJsonSchemaVersion({ ...exportResult }));
    else process.stdout.write(`export: out=${exportResult.out} files=${exportResult.files}\n`);
    recordOperationEvent(cwd, startedAtMs, "export", exportResult.status, exportResult.status === 0, {
      counters: {
        files: exportResult.files,
        lockfileGenerated: exportResult.lockfileGenerated ? 1 : 0
      }
    });
    process.exit(exportResult.status);
  }

  process.stderr.write("Unhandled command routing state.\n");
  usage();
  process.exit(1);
}

main().catch((err) => {
  const parsedForError = parseArgs(process.argv.slice(2));
  const wantsJsonError = getBooleanFlag(parsedForError, "json");
  const failedCommand = parsedForError.command;
  const isMutatingCommand =
    failedCommand === "init" ||
    failedCommand === "doctor" ||
    failedCommand === "apply" ||
    failedCommand === "apply-resume" ||
    failedCommand === "update" ||
    failedCommand === "export" ||
    failedCommand === "registry" ||
    failedCommand === "remediate" ||
    failedCommand === "watch" ||
    failedCommand === "fix";
  if (err instanceof CliError) {
    if (isMutatingCommand && failedCommand) {
      recordOperationEvent(process.cwd(), PROCESS_STARTED_AT_MS, failedCommand, err.exitCode, false, {
        ...(err.code ? { code: err.code } : {})
      });
    }
    if (wantsJsonError) {
      writeJson(
        withJsonSchemaVersion({
          status: err.exitCode,
          ...(err.code ? { code: err.code } : {}),
          error: err.message
        })
      );
    }
    else process.stderr.write(`${formatCliErrorGuidance(err, failedCommand)}\n`);
    process.exit(err.exitCode);
  }
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  if (isMutatingCommand && failedCommand) {
    recordOperationEvent(process.cwd(), PROCESS_STARTED_AT_MS, failedCommand, 1, false);
  }
  if (wantsJsonError) writeJson(withJsonSchemaVersion({ status: 1, error: message }));
  else process.stderr.write(`${message}\n`);
  process.exit(1);
});
