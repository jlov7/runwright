import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createGameRuntimeServer } from "../src/game/runtime.js";

type CliArgs = {
  host: string;
  port: number;
  stateFile: string;
  staticRoot: string;
  json: boolean;
};

function renderUsage(): string {
  return [
    "Usage: pnpm tsx scripts/game_runtime.ts [options]",
    "",
    "Options:",
    "  --host <host>         Bind host (default: 127.0.0.1)",
    "  --port <number>       Bind port (default: 4242, use 0 for random free port)",
    "  --state-file <path>   Runtime state path (default: .skillbase/runtime-state.json)",
    "  --static-root <path>  Static web shell directory (default: apps/web)",
    "  --json                Emit startup payload as JSON",
    "  --help, -h            Show this help message"
  ].join("\n");
}

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {
    host: "127.0.0.1",
    port: 4242,
    stateFile: resolve(process.cwd(), ".skillbase", "runtime-state.json"),
    staticRoot: resolve(process.cwd(), "apps", "web"),
    json: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i] ?? "";
    if (token === "--help" || token === "-h") {
      process.stdout.write(`${renderUsage()}\n`);
      process.exit(0);
    }
    if (token === "--host") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --host");
      parsed.host = value;
      i += 1;
      continue;
    }
    if (token === "--port") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --port");
      const parsedPort = Number(value);
      if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
        throw new Error(`Invalid --port value: ${value}`);
      }
      parsed.port = parsedPort;
      i += 1;
      continue;
    }
    if (token === "--state-file") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --state-file");
      parsed.stateFile = resolve(process.cwd(), value);
      i += 1;
      continue;
    }
    if (token === "--static-root") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --static-root");
      parsed.staticRoot = resolve(process.cwd(), value);
      i += 1;
      continue;
    }
    if (token === "--json") {
      parsed.json = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  mkdirSync(resolve(args.stateFile, ".."), { recursive: true });
  const runtime = await createGameRuntimeServer({
    host: args.host,
    port: args.port,
    stateFile: args.stateFile,
    staticRoot: args.staticRoot
  });

  const payload = {
    status: "ready" as const,
    host: runtime.host,
    port: runtime.port,
    baseUrl: runtime.baseUrl,
    stateFile: runtime.stateFile,
    staticRoot: args.staticRoot
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(
      [
        "Runwright Game Runtime",
        "",
        `URL: ${runtime.baseUrl}`,
        `State file: ${runtime.stateFile}`,
        `Static root: ${args.staticRoot}`,
        "",
        "Press Ctrl+C to stop."
      ].join("\n") + "\n"
    );
  }

  const shutdown = async (): Promise<void> => {
    await runtime.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`game_runtime error: ${message}\n`);
  process.exit(1);
});
