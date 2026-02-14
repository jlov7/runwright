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
import { lintSkillDir } from "./scanner/lint.js";
import { scanSkillDir, type SecurityRuleId } from "./scanner/security.js";
import { resolveSkillUnits, type SkillUnit } from "./resolver.js";
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

type ParsedArgs = {
  command?: string;
  flags: Map<string, string | boolean>;
  positionals: string[];
  duplicateFlags: string[];
};

type FlagValueType = "boolean" | "string";
const JSON_CONTRACT_SCHEMA_VERSION = "1.0";
const DEFAULT_OPERATION_LOG_PATH = ".skillbase/operations.jsonl";

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
    usage: ["skillbase init [--json]"],
    examples: ["skillbase init", "skillbase init --json"]
  },
  journey: {
    summary: "Show your current onboarding progress and the single best next action.",
    usage: ["skillbase journey [--json]"],
    examples: ["skillbase journey", "skillbase journey --json"]
  },
  apply: {
    summary: "Install resolved skills into target tools (safe by default with scanning).",
    usage: [
      "skillbase apply [--mode link|copy|mirror] [--target codex|claude-code|cursor|all]",
      "               [--scope global|project] [--dry-run] [--json] [--no-scan]",
      "               [--scan-security off|warn|fail] [--fix] [--frozen-lockfile]",
      "               [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: [
      "skillbase apply --target all --scope project --mode copy --dry-run --json",
      "skillbase apply --target codex --scope project --mode copy",
      "skillbase apply --frozen-lockfile --target all --mode copy --json"
    ]
  },
  doctor: {
    summary: "Diagnose and optionally fix safe local install issues.",
    usage: ["skillbase doctor [--fix] [--json] [--target ...] [--scope ...]"],
    examples: ["skillbase doctor", "skillbase doctor --fix --json"]
  },
  scan: {
    summary: "Run lint and security checks on resolved skills.",
    usage: [
      "skillbase scan [--lint-only] [--security off|warn|fail] [--format text|json|sarif]",
      "               [--policy-decisions-out <path>] [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: [
      "skillbase scan --format json",
      "skillbase scan --security fail --format sarif",
      "skillbase scan --policy-decisions-out reports/policy-decisions.jsonl --format json"
    ]
  },
  policy: {
    summary: "Check manifest scan-policy exceptions and expiry health.",
    usage: ["skillbase policy check [--format text|json] [--json] [--refresh-sources] [--remote-cache-ttl <seconds>]"],
    examples: ["skillbase policy check", "skillbase policy check --json"]
  },
  list: {
    summary: "List resolved skills and effective target install paths.",
    usage: ["skillbase list [--json] [--target ...] [--scope ...] [--refresh-sources] [--remote-cache-ttl <seconds>]"],
    examples: ["skillbase list --json", "skillbase list --target codex --scope project --json"]
  },
  update: {
    summary: "Resolve sources and write deterministic lockfile.",
    usage: ["skillbase update [--frozen-lockfile] [--json] [--refresh-sources] [--remote-cache-ttl <seconds>]"],
    examples: ["skillbase update --json", "skillbase update --frozen-lockfile --json"]
  },
  export: {
    summary: "Package manifest, lockfile, and skills into a verifiable bundle.",
    usage: [
      "skillbase export [--out <bundle.zip>] [--sign-key <path>] [--sign-private-key <path>]",
      "                 [--deterministic] [--json] [--refresh-sources] [--remote-cache-ttl <seconds>]"
    ],
    examples: [
      "skillbase export --out skillbase-release.zip --deterministic --json",
      "skillbase export --out skillbase-release.zip --sign-private-key private.pem --deterministic --json"
    ]
  },
  "verify-bundle": {
    summary: "Verify bundle integrity and optional signature requirements.",
    usage: [
      "skillbase verify-bundle --bundle <bundle.zip> [--sign-key <path>] [--sign-public-key <path>]",
      "                        [--require-signature] [--json]"
    ],
    examples: [
      "skillbase verify-bundle --bundle skillbase-release.zip --json",
      "skillbase verify-bundle --bundle skillbase-release.zip --sign-public-key public.pem --require-signature --json"
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
  if (!suggestion) return `Unknown help topic: ${topic}`;
  return [`Unknown help topic: ${topic}`, `Did you mean: skillbase help ${suggestion}`].join("\n");
}

function renderUnknownCommandMessage(command: string): string {
  const suggestion = suggestCommand(command, Object.keys(COMMAND_HELP));
  if (!suggestion) {
    return [`Unknown command: ${command}`, "Run `skillbase help` to see available commands."].join("\n");
  }
  return [
    `Unknown command: ${command}`,
    `Did you mean: skillbase ${suggestion}`,
    "Run `skillbase help` to see available commands."
  ].join("\n");
}

function formatCliErrorGuidance(error: CliError, failedCommand?: string): string {
  const helpForCommand = failedCommand && COMMAND_HELP[failedCommand] ? `skillbase ${failedCommand} --help` : "skillbase help";
  const hints: string[] = [];

  switch (error.code) {
    case "missing-manifest":
      hints.push("skillbase init", "skillbase journey");
      break;
    case "invalid-manifest":
      hints.push("Fix manifest keys/types, then rerun your command.");
      hints.push("Reference: MANIFEST_SPEC.md");
      break;
    case "invalid-flag":
    case "invalid-argument":
    case "invalid-format":
      hints.push(helpForCommand);
      break;
    case "lockfile-error":
      hints.push("skillbase update --json", "Retry your previous command.");
      break;
    case "source-resolution-failed":
      if (failedCommand && COMMAND_HELP[failedCommand]) {
        hints.push(`skillbase ${failedCommand} --refresh-sources`);
      }
      hints.push("Check source refs in skillbase.yml.");
      break;
    case "bundle-verification-failed":
    case "invalid-bundle-manifest":
    case "invalid-bundle-archive":
      hints.push("Re-export bundle from a trusted source and rerun verify-bundle.");
      break;
    default:
      if (error.exitCode === 10) hints.push("skillbase journey");
      break;
  }

  if (hints.length === 0) return error.message;
  return `${error.message}\n\nNext:\n${hints.map((hint) => `  ${hint}`).join("\n")}`;
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
        `skillbase ${command}`,
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

  console.log(`skillbase

Policy-first manifest manager for agent skills.

Start here:
  1) skillbase init
  2) skillbase journey
  3) skillbase update --json
  4) skillbase scan --format json
  5) skillbase apply --target all --scope project --mode copy --dry-run --json

Core commands:
  skillbase init
  skillbase journey
  skillbase apply
  skillbase doctor
  skillbase scan
  skillbase policy check
  skillbase list
  skillbase update
  skillbase export
  skillbase verify-bundle

Help:
  skillbase help
  skillbase help <command>
  skillbase <command> --help
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
  policy: { format: "string", json: "boolean", "refresh-sources": "boolean", "remote-cache-ttl": "string" },
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

function loadManifest(cwd: string): SkillbaseManifest {
  const manifestPathYaml = resolve(cwd, "skillbase.yml");
  const manifestPathJson = resolve(cwd, "skillbase.json");

  let manifestRaw: string;
  let filename: string;
  if (existsSync(manifestPathYaml)) {
    manifestRaw = readFileSync(manifestPathYaml, "utf8");
    filename = "skillbase.yml";
  } else if (existsSync(manifestPathJson)) {
    manifestRaw = readFileSync(manifestPathJson, "utf8");
    filename = "skillbase.json";
  } else {
    throw new CliError("No skillbase.yml or skillbase.json found in current directory.", 10, "missing-manifest");
  }

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

function resolverOptionsFromArgs(args: ParsedArgs): { refreshSources: boolean; remoteCacheTtlSeconds: number } {
  return {
    refreshSources: getBooleanFlag(args, "refresh-sources"),
    remoteCacheTtlSeconds: parseRemoteCacheTtl(getStringFlag(args, "remote-cache-ttl"))
  };
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
    if (error instanceof CliError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Source resolution failed: ${message}`, 1, "source-resolution-failed");
  }
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

function resolveOperationLogPath(cwd: string): string | undefined {
  const override = process.env.SKILLBASE_OPERATION_LOG_PATH?.trim();
  if (override === "off") return undefined;
  const configuredPath = override && override.length > 0 ? override : DEFAULT_OPERATION_LOG_PATH;
  return isAbsolute(configuredPath) ? configuredPath : resolve(cwd, configuredPath);
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

const SHA256_DIGEST_REGEX = /^sha256:[a-f0-9]{64}$/;
const HEX_64_REGEX = /^[a-f0-9]{64}$/;
const BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/;
const MIN_ZIP_MTIME_MS = Date.UTC(1980, 0, 1, 0, 0, 0, 0);

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
  return Math.max(MIN_ZIP_MTIME_MS, seconds * 1000);
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
const REQUIRED_BUNDLE_MANIFEST_CANDIDATES = ["skillbase.yml", "skillbase.json"] as const;
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

function performAtomicTargetApply(plan: TargetApplyPlan, cwd: string): void {
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

  let hadExistingTarget = false;
  try {
    if (existsSync(plan.installDir)) {
      renameSync(plan.installDir, backupDir);
      hadExistingTarget = true;
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

function runInit(cwd: string): { status: number; message: string } {
  const manifestPathYaml = resolve(cwd, "skillbase.yml");
  const manifestPathJson = resolve(cwd, "skillbase.json");
  if (existsSync(manifestPathYaml) || existsSync(manifestPathJson)) {
    return { status: 2, message: "Manifest already exists; init skipped" };
  }

  const starter = `version: 1
defaults:
  mode: link
  scope: global
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
  return { status: 0, message: "Initialized skillbase.yml and updated .gitignore" };
}

type JourneyStepStatus = "complete" | "pending";

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

type OperationEventRecord = {
  command: string;
  status: number;
  mutating: boolean;
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
        events.push({
          command: parsed.command,
          status: parsed.status,
          mutating: parsed.mutating
        });
      }
    } catch {
      continue;
    }
  }
  return events;
}

function hasOperationEvent(
  events: OperationEventRecord[],
  command: string,
  predicate?: (event: OperationEventRecord) => boolean
): boolean {
  return events.some((event) => event.command === command && (predicate ? predicate(event) : true));
}

function runJourney(cwd: string): { status: number; payload: JourneyPayload } {
  const manifestExists = existsSync(resolve(cwd, "skillbase.yml")) || existsSync(resolve(cwd, "skillbase.json"));
  const skillsExist = hasAnySkillMarkdown(resolve(cwd, "skills"));
  const lockfileExists = existsSync(resolve(cwd, "skillbase.lock.json"));
  const events = readOperationEventRecords(cwd);
  const scanCompleted = hasOperationEvent(events, "scan", (event) => event.status === 0 || event.status === 2 || event.status === 30);
  const dryRunApplyCompleted = hasOperationEvent(events, "apply", (event) => event.mutating === false);
  const applyCompleted = hasOperationEvent(events, "apply", (event) => event.mutating === true && (event.status === 0 || event.status === 2));
  const verifyBundleCompleted = hasOperationEvent(events, "verify-bundle", (event) => event.status === 0);

  const steps: JourneyStep[] = [
    {
      id: "manifest",
      title: "Initialize project manifest",
      status: manifestExists ? "complete" : "pending",
      details: manifestExists ? "skillbase.yml/skillbase.json detected." : "Create a baseline manifest for deterministic setup.",
      command: "skillbase init"
    },
    {
      id: "skills",
      title: "Add at least one skill",
      status: skillsExist ? "complete" : "pending",
      details: skillsExist ? "Found at least one SKILL.md under skills/." : "Define one skill so update/scan/apply can produce useful output.",
      command: "mkdir -p skills/<skill-name> && create skills/<skill-name>/SKILL.md"
    },
    {
      id: "lockfile",
      title: "Resolve and lock sources",
      status: lockfileExists ? "complete" : "pending",
      details: lockfileExists
        ? "skillbase.lock.json exists."
        : "Generate lockfile so installs are reproducible and CI-safe.",
      command: "skillbase update --json"
    },
    {
      id: "scan",
      title: "Run safety scan",
      status: scanCompleted ? "complete" : "pending",
      details: scanCompleted
        ? "At least one scan run is recorded in operations log."
        : "Run scan to surface risky content before apply.",
      command: "skillbase scan --format json"
    },
    {
      id: "dry-run-apply",
      title: "Validate install plan with dry-run",
      status: dryRunApplyCompleted ? "complete" : "pending",
      details: dryRunApplyCompleted
        ? "Dry-run apply evidence recorded."
        : "Preview operations without filesystem changes.",
      command: "skillbase apply --target all --scope project --mode copy --dry-run --json"
    },
    {
      id: "apply",
      title: "Apply to targets",
      status: applyCompleted ? "complete" : "pending",
      details: applyCompleted
        ? "Successful mutating apply evidence recorded."
        : "Install resolved skills into your configured targets.",
      command: "skillbase apply --target all --scope project --mode copy --json"
    },
    {
      id: "verify-bundle",
      title: "Verify release artifact integrity",
      status: verifyBundleCompleted ? "complete" : "pending",
      details: verifyBundleCompleted
        ? "Bundle verification succeeded at least once."
        : "Optional release assurance step for distribution workflows.",
      command: "skillbase export --out skillbase-release.zip --deterministic --json && skillbase verify-bundle --bundle skillbase-release.zip --json",
      optional: true
    }
  ];

  const coreSteps = steps.filter((step) => !step.optional);
  const completedCoreSteps = coreSteps.filter((step) => step.status === "complete").length;
  const totalCoreSteps = coreSteps.length;
  const completionPercent = Math.floor((completedCoreSteps / Math.max(totalCoreSteps, 1)) * 100);

  const nextPending = coreSteps.find((step) => step.status === "pending");
  const nextAction = nextPending
    ? {
        command: nextPending.command,
        reason: nextPending.details
      }
    : {
        command:
          "skillbase policy check --json && skillbase export --out skillbase-release.zip --deterministic --json",
        reason: "Core onboarding is complete. Harden policy posture and produce a verifiable release bundle."
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
    "Skillbase Onboarding Journey",
    "",
    `Progress: ${payload.summary.completedCoreSteps}/${payload.summary.totalCoreSteps} core steps complete (${payload.summary.completionPercent}%)`,
    ""
  ];

  for (const [index, step] of payload.steps.entries()) {
    const marker = step.status === "complete" ? "[done]" : "[todo]";
    const optionalSuffix = step.optional ? " (optional)" : "";
    lines.push(`${marker} ${index + 1}. ${step.title}${optionalSuffix}`);
    lines.push(`      ${step.details}`);
    if (step.status === "pending") lines.push(`      Run: ${step.command}`);
  }

  lines.push("", "Next best action:", `  ${payload.nextAction.command}`, `  Why: ${payload.nextAction.reason}`, "", "Guides:");
  for (const docPath of payload.docs) lines.push(`  - ${docPath}`);
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
        lockfileVerified: false
      };
    }
    skillUnits = resolveSkillUnitsFromLockfile(lockfile);
    lockfileVerified = true;
  } else {
    skillUnits = resolveSkillUnitsForArgs(manifest, cwd, args).units;
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
    try {
      for (const plan of targetPlans) performAtomicTargetApply(plan, cwd);
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
    lockfileVerified: frozenLockfile ? lockfileVerified : undefined
  };
}

function renderApplyText(result: {
  status: number;
  dryRun: boolean;
  operations: ApplyOperation[];
  summary: { lintIssues: number; highFindings: number; mediumFindings: number; suppressedFindings: number };
}): string {
  const lines = [
    "Apply Summary",
    `- Planned operations: ${result.operations.length}`,
    `- Mode: ${result.dryRun ? "dry-run (no filesystem changes)" : "apply"}`,
    `- Lint issues: ${result.summary.lintIssues}`,
    `- Security findings: high=${result.summary.highFindings}, medium=${result.summary.mediumFindings}`,
    `- Suppressed findings: ${result.summary.suppressedFindings}`
  ];

  if (result.status === 30) {
    lines.push(
      "",
      "Next:",
      "  Address blocking findings or run with a non-blocking security mode, then rerun:",
      "  skillbase scan --format json"
    );
  } else if (result.dryRun) {
    lines.push(
      "",
      "Next:",
      "  Run the same command without --dry-run to perform installation.",
      "  skillbase apply --target all --scope project --mode copy --json"
    );
  } else {
    lines.push("", "Next:", "  Confirm target paths and installed skills with:", "  skillbase list --json");
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
  const skillUnits = resolveSkillUnitsForArgs(manifest, cwd, args).units;
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
        "",
        "Next:",
        scan.highFindings > 0 || scan.mediumFindings > 0
          ? "  Resolve findings or tune policy exceptions, then rerun scan."
          : "  Run a dry-run apply to validate installation plan.",
        scan.highFindings > 0 || scan.mediumFindings > 0
          ? "  skillbase policy check --json"
          : "  skillbase apply --target all --scope project --mode copy --dry-run --json",
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
  const allowlist = manifest.defaults?.scan?.allowlist ?? [];
  const configuredSources = collectConfiguredSources(manifest);
  const resolution = resolveSkillUnitsForArgs(manifest, cwd, args);
  const units = resolution.units;
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
  const status = unresolved.length > 0 ? 2 : 0;

  if (format === "json") {
    return {
      status,
      payload: {
        schemaVersion: "1.0",
        summary,
        unresolved
      }
    };
  }

  return {
    status,
    payload: {
      text: `policy-check entries=${summary.entries} active=${summary.active} expired=${summary.expired} unresolved=${summary.unresolved}`
    }
  };
}

function runExport(args: ParsedArgs, cwd: string, manifest: SkillbaseManifest): {
  status: number;
  out: string;
  files: number;
  lockfileGenerated: boolean;
  signature?: string;
  signatureAlgorithm?: "hmac-sha256" | "ed25519";
} {
  const outPath = resolve(cwd, getStringFlag(args, "out") ?? "skillbase-export.zip");
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

  const manifestPathYaml = resolve(cwd, "skillbase.yml");
  const manifestPathJson = resolve(cwd, "skillbase.json");
  const manifestPath = existsSync(manifestPathYaml) ? manifestPathYaml : manifestPathJson;
  const manifestName = existsSync(manifestPathYaml) ? "skillbase.yml" : "skillbase.json";

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
      generator: "skillbase-cli",
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
  if (!bundlePathFlag) throw new CliError("verify-bundle requires --bundle <path>", 1, "missing-bundle");

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

  if (cmd === "init") {
    const init = runInit(cwd);
    if (jsonOutput) writeJson(withJsonSchemaVersion({ status: init.status, message: init.message }));
    else process.stdout.write(`${init.message}\n`);
    recordOperationEvent(cwd, startedAtMs, "init", init.status, init.status === 0);
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
    writeJson(withJsonSchemaVersion(result));
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

  const manifest = loadManifest(cwd);

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
            reason: "missing-lockfile"
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
            reason: "invalid-lockfile"
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
            reason: "lockfile-mismatch"
          })
        );
        recordOperationEvent(cwd, startedAtMs, "update", 11, false, {
          code: "lockfile-error",
          counters: { skills: units.length, sources: Object.keys(existing.sources).length }
        });
        process.exit(11);
      }
      const sourcesCount = Object.keys(existing.sources).length;
      writeJson(
        withJsonSchemaVersion({
          status: 0,
          lockfile: "skillbase.lock.json",
          lockfileVerified: true,
          sources: sourcesCount,
          skills: units.length
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
        skills: units.length
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
    failedCommand === "update" ||
    failedCommand === "export";
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
