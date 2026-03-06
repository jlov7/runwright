import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  outPath: string;
};

type DeviceCase = {
  id: string;
  platform: string;
  browser: string;
  viewport: string;
  orientation: "portrait" | "landscape";
  focusAreas: string[];
};

type MatrixReport = {
  schemaVersion: "1.0";
  generatedAt: string;
  cases: DeviceCase[];
};

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function usage(): string {
  return [
    "Usage: pnpm tsx scripts/generate_frontend_device_matrix.ts [options]",
    "",
    "Options:",
    "  --out <path>   Output JSON path (default: reports/qa/frontend-device-matrix.json)",
    "  --help, -h     Show help"
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  let outPath = "reports/qa/frontend-device-matrix.json";
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--") {
      continue;
    }
    if (token === "--out") {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error("Missing value for --out");
      outPath = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument '${token}'`);
  }
  return { outPath };
}

function main(): void {
  if (hasHelpFlag(process.argv)) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const args = parseArgs(process.argv);
  const report: MatrixReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    cases: [
      {
        id: "ios-safari-phone",
        platform: "iOS",
        browser: "Safari",
        viewport: "390x844",
        orientation: "portrait",
        focusAreas: ["mobile nav", "tap targets", "onboarding forms", "retry queue"]
      },
      {
        id: "android-chrome-phone",
        platform: "Android",
        browser: "Chrome",
        viewport: "412x915",
        orientation: "portrait",
        focusAreas: ["mobile nav", "empty/loading/error states", "toast overlap"]
      },
      {
        id: "ipad-safari",
        platform: "iPadOS",
        browser: "Safari",
        viewport: "1024x1366",
        orientation: "landscape",
        focusAreas: ["panel layout", "orientation change", "focus management"]
      },
      {
        id: "desktop-chrome",
        platform: "macOS/Windows",
        browser: "Chrome",
        viewport: "1440x900",
        orientation: "landscape",
        focusAreas: ["full nav shell", "command bar", "analytics/perf overlays"]
      }
    ]
  };

  const outPath = resolve(args.outPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${outPath}\n`);
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
