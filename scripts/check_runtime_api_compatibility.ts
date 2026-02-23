import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createGameRuntimeServer } from "../src/game/runtime.js";

type ParsedArgs = {
  outPath: string;
  expectedMajor: number;
};

type CheckResult = {
  id: string;
  ok: boolean;
  detail: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    outPath: "reports/quality/runtime-api-compat.report.json",
    expectedMajor: 1
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --out");
      parsed.outPath = value;
      index += 1;
      continue;
    }
    if (token === "--expected-major") {
      const value = Number(argv[index + 1] ?? "");
      if (!Number.isInteger(value) || value < 1) throw new Error("--expected-major must be a positive integer");
      parsed.expectedMajor = value;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      process.stdout.write(
        [
          "Usage: pnpm tsx scripts/check_runtime_api_compatibility.ts [options]",
          "",
          "Options:",
          "  --out <path>            Output report path (default: reports/quality/runtime-api-compat.report.json)",
          "  --expected-major <num>  Expected API major version (default: 1)"
        ].join("\n") + "\n"
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return parsed;
}

async function fetchJson(url: string): Promise<{ status: number; payload: unknown; headers: Headers }> {
  const response = await fetch(url);
  return {
    status: response.status,
    payload: (await response.json()) as unknown,
    headers: response.headers
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const tempRoot = mkdtempSync(join(tmpdir(), "runwright-runtime-api-compat-"));
  const stateFile = join(tempRoot, ".skillbase", "runtime-state.json");
  const runtime = await createGameRuntimeServer({
    host: "127.0.0.1",
    port: 0,
    stateFile
  });

  try {
    const health = await fetchJson(`${runtime.baseUrl}/v1/health`);
    const version = await fetchJson(`${runtime.baseUrl}/v1/meta/version`);
    const help = await fetchJson(`${runtime.baseUrl}/v1/help`);
    const readiness = await fetchJson(`${runtime.baseUrl}/v1/release/readiness`);

    const versionPayload = asRecord(version.payload);
    const healthPayload = asRecord(health.payload);
    const helpPayload = asRecord(help.payload);
    const readinessPayload = asRecord(readiness.payload);
    const apiVersion = String(versionPayload?.apiVersion ?? "");
    const apiVersionHeader = String(health.headers.get("x-runwright-api-version") ?? "");
    const majorVersion = Number(apiVersion.split(".")[0] ?? Number.NaN);

    const checks: CheckResult[] = [
      {
        id: "version-endpoint",
        ok: version.status === 200 && apiVersion.length > 0,
        detail: `status=${version.status}, apiVersion=${apiVersion || "missing"}`
      },
      {
        id: "major-version",
        ok: Number.isInteger(majorVersion) && majorVersion === args.expectedMajor,
        detail: `major=${majorVersion}, expected=${args.expectedMajor}`
      },
      {
        id: "version-header",
        ok: apiVersionHeader === apiVersion,
        detail: `header=${apiVersionHeader || "missing"}, payload=${apiVersion || "missing"}`
      },
      {
        id: "health-shape",
        ok: health.status === 200 && typeof healthPayload?.ok === "boolean" && typeof healthPayload?.schemaVersion === "string",
        detail: `status=${health.status}, hasOk=${String(typeof healthPayload?.ok === "boolean")}`
      },
      {
        id: "help-shape",
        ok: help.status === 200 && typeof helpPayload?.docsPath === "string" && Array.isArray(helpPayload?.tooltips),
        detail: `status=${help.status}, tooltips=${Array.isArray(helpPayload?.tooltips) ? "present" : "missing"}`
      },
      {
        id: "readiness-shape",
        ok: readiness.status === 200 && Array.isArray(readinessPayload?.matrix),
        detail: `status=${readiness.status}, matrix=${Array.isArray(readinessPayload?.matrix) ? "present" : "missing"}`
      }
    ];

    const report = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      expectedMajor: args.expectedMajor,
      observed: {
        apiVersion,
        apiVersionHeader
      },
      checks,
      ok: checks.every((check) => check.ok)
    };

    const outPath = resolve(args.outPath);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${outPath}\n`);
    if (!report.ok) process.exit(1);
  } finally {
    await runtime.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
