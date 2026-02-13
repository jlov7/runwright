import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  repo?: string;
  refName: string;
  refType: string;
  refJsonPath?: string;
  tagJsonPath?: string;
  outPath: string;
};

type TagSignatureReport = {
  schemaVersion: "1.0";
  generatedAt: string;
  ok: boolean;
  skipped: boolean;
  reason: string;
  tagName?: string;
  objectType?: string;
  objectSha?: string;
  verification?: {
    verified: boolean;
    reason: string;
  };
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    repo: process.env.GITHUB_REPOSITORY,
    refName: process.env.GITHUB_REF_NAME ?? "",
    refType: process.env.GITHUB_REF_TYPE ?? "",
    outPath: "reports/release/tag-signature.verify.json"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--repo") {
      parsed.repo = argv[index + 1] ?? parsed.repo;
      index += 1;
      continue;
    }
    if (token === "--ref-name") {
      parsed.refName = argv[index + 1] ?? parsed.refName;
      index += 1;
      continue;
    }
    if (token === "--ref-type") {
      parsed.refType = argv[index + 1] ?? parsed.refType;
      index += 1;
      continue;
    }
    if (token === "--ref-json") {
      parsed.refJsonPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--tag-json") {
      parsed.tagJsonPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--out") {
      parsed.outPath = argv[index + 1] ?? parsed.outPath;
      index += 1;
    }
  }

  if (!parsed.refName) throw new Error("Missing --ref-name (or GITHUB_REF_NAME)");
  if (!parsed.refType) throw new Error("Missing --ref-type (or GITHUB_REF_TYPE)");
  return parsed;
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function ghApi(path: string): unknown {
  const result = spawnSync("gh", ["api", path], { encoding: "utf8", cwd: process.cwd() });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`gh api failed for ${path}: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function main(): void {
  const args = parseArgs(process.argv);
  const outPath = resolve(args.outPath);

  if (args.refType !== "tag") {
    const report: TagSignatureReport = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      ok: true,
      skipped: true,
      reason: `ref type '${args.refType}' is not tag`,
      tagName: args.refName
    };
    writeJson(outPath, report);
    process.stdout.write(`${outPath}\n`);
    return;
  }

  if (!args.refJsonPath && !args.repo) {
    throw new Error("Missing --repo (or GITHUB_REPOSITORY) for live GitHub API verification");
  }

  const refPayload = asRecord(
    args.refJsonPath
      ? readJson(resolve(args.refJsonPath))
      : ghApi(`repos/${args.repo}/git/ref/tags/${encodeURIComponent(args.refName)}`)
  );
  const object = asRecord(refPayload.object);
  const objectType = String(object.type ?? "");
  const objectSha = String(object.sha ?? "");

  if (objectType !== "tag" || objectSha.length === 0) {
    const report: TagSignatureReport = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      ok: false,
      skipped: false,
      reason: "tag is lightweight or missing annotated tag object",
      tagName: args.refName,
      objectType,
      objectSha
    };
    writeJson(outPath, report);
    process.stdout.write(`${outPath}\n`);
    process.exit(1);
  }

  const tagPayload = asRecord(
    args.tagJsonPath ? readJson(resolve(args.tagJsonPath)) : ghApi(`repos/${args.repo}/git/tags/${objectSha}`)
  );
  const verification = asRecord(tagPayload.verification);
  const verified = verification.verified === true;
  const verificationReason = String(verification.reason ?? "unknown");

  const report: TagSignatureReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    ok: verified,
    skipped: false,
    reason: verified ? "annotated tag signature verified" : `tag signature verification failed (${verificationReason})`,
    tagName: args.refName,
    objectType,
    objectSha,
    verification: {
      verified,
      reason: verificationReason
    }
  };

  writeJson(outPath, report);
  process.stdout.write(`${outPath}\n`);
  if (!verified) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
