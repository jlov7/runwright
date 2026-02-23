import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createGameRuntimeServer, createRankedDigest } from "../src/game/runtime.js";

type ParsedArgs = {
  outPath: string;
  maxP95Ms: number;
  minSampleCount: number;
};

type CheckResult = {
  id: string;
  ok: boolean;
  detail: string;
};

type MetricsPayload = {
  requests: { total: number; p95Ms: number };
  endpoints: Array<{ route: string; count: number; p95Ms: number }>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    outPath: "reports/quality/runtime-slo.report.json",
    maxP95Ms: 350,
    minSampleCount: 8
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
    if (token === "--max-p95-ms") {
      const value = Number(argv[index + 1] ?? "");
      if (!Number.isFinite(value) || value < 1) throw new Error("--max-p95-ms must be a positive number");
      parsed.maxP95Ms = value;
      index += 1;
      continue;
    }
    if (token === "--min-sample-count") {
      const value = Number(argv[index + 1] ?? "");
      if (!Number.isInteger(value) || value < 1) throw new Error("--min-sample-count must be a positive integer");
      parsed.minSampleCount = value;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      process.stdout.write(
        [
          "Usage: pnpm tsx scripts/check_runtime_slo.ts [options]",
          "",
          "Options:",
          "  --out <path>              Output report path (default: reports/quality/runtime-slo.report.json)",
          "  --max-p95-ms <number>     Maximum allowed global p95 latency in ms (default: 350)",
          "  --min-sample-count <num>  Minimum required request sample count (default: 8)"
        ].join("\n") + "\n"
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return parsed;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<{ status: number; payload: T }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  return {
    status: response.status,
    payload: (await response.json()) as T
  };
}

function endpointExists(metrics: MetricsPayload, route: string): boolean {
  return metrics.endpoints.some((entry) => entry.route === route && entry.count > 0);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const tempRoot = mkdtempSync(join(tmpdir(), "runwright-runtime-slo-"));
  const stateFile = join(tempRoot, ".skillbase", "runtime-state.json");
  const runtime = await createGameRuntimeServer({
    host: "127.0.0.1",
    port: 0,
    stateFile,
    rankedSalt: "runtime-slo-salt"
  });

  try {
    await jsonRequest(`${runtime.baseUrl}/v1/health`);
    await jsonRequest(`${runtime.baseUrl}/v1/health`);
    await jsonRequest(`${runtime.baseUrl}/v1/health`);
    const signup = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
      method: "POST",
      body: JSON.stringify({ handle: "slo-user", locale: "en-US" })
    });
    const profileId = signup.payload.profile.id;

    await jsonRequest(`${runtime.baseUrl}/v1/telemetry/events`, {
      method: "POST",
      body: JSON.stringify({
        profileId,
        eventId: "runtime-slo-tutorial",
        type: "tutorial.started",
        payload: { source: "runtime-slo" }
      })
    });
    await jsonRequest(`${runtime.baseUrl}/v1/saves`, {
      method: "POST",
      body: JSON.stringify({
        profileId,
        strategy: "last-write-wins",
        baseVersion: 0,
        payload: { checkpoint: "slo-check" }
      })
    });
    await jsonRequest(`${runtime.baseUrl}/v1/ranked/submit`, {
      method: "POST",
      body: JSON.stringify({
        profileId,
        score: 1234,
        clientDigest: createRankedDigest(profileId, 1234, "runtime-slo-salt")
      })
    });
    await jsonRequest(`${runtime.baseUrl}/v1/onboarding/${profileId}`);

    const metricsResponse = await jsonRequest<MetricsPayload>(`${runtime.baseUrl}/v1/metrics`);
    const metrics = metricsResponse.payload;
    const checks: CheckResult[] = [
      {
        id: "sample-count",
        ok: metrics.requests.total >= args.minSampleCount,
        detail: `total=${metrics.requests.total}, minimum=${args.minSampleCount}`
      },
      {
        id: "global-p95",
        ok: metrics.requests.p95Ms <= args.maxP95Ms,
        detail: `p95=${metrics.requests.p95Ms}ms, threshold=${args.maxP95Ms}ms`
      },
      {
        id: "endpoint-health",
        ok: endpointExists(metrics, "GET /v1/health"),
        detail: "expects GET /v1/health samples"
      },
      {
        id: "endpoint-signup",
        ok: endpointExists(metrics, "POST /v1/auth/signup"),
        detail: "expects POST /v1/auth/signup samples"
      }
    ];

    const report = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      thresholds: {
        maxP95Ms: args.maxP95Ms,
        minSampleCount: args.minSampleCount
      },
      metrics,
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
