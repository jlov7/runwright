import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  htmlPath: string;
  cssPath: string;
  outPath: string;
};

type Baseline = {
  schemaVersion: "1.0";
  generatedAt: string;
  htmlPath: string;
  cssPath: string;
  htmlHash: string;
  cssHash: string;
  combinedHash: string;
};

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function renderUsage(): string {
  return [
    "Usage: pnpm tsx scripts/capture_frontend_visual_baseline.ts [options]",
    "",
    "Options:",
    "  --html <path>   HTML file path (default: apps/web/index.html)",
    "  --css <path>    CSS file path (default: apps/web/styles.css)",
    "  --out <path>    Output JSON path (default: tests/fixtures/frontend-visual-baseline.json)",
    "  --help, -h      Show this help text"
  ].join("\n");
}

function readRequiredArgValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    htmlPath: "apps/web/index.html",
    cssPath: "apps/web/styles.css",
    outPath: "tests/fixtures/frontend-visual-baseline.json"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--html") {
      parsed.htmlPath = readRequiredArgValue(argv, index, "--html");
      index += 1;
      continue;
    }
    if (token === "--css") {
      parsed.cssPath = readRequiredArgValue(argv, index, "--css");
      index += 1;
      continue;
    }
    if (token === "--out") {
      parsed.outPath = readRequiredArgValue(argv, index, "--out");
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument '${token}'`);
  }

  return parsed;
}

function normalize(input: string): string {
  return input.replace(/\r\n/g, "\n").trim();
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function main(): void {
  if (hasHelpFlag(process.argv)) {
    process.stdout.write(`${renderUsage()}\n`);
    return;
  }

  const args = parseArgs(process.argv);
  const html = normalize(readFileSync(resolve(args.htmlPath), "utf8"));
  const css = normalize(readFileSync(resolve(args.cssPath), "utf8"));

  const baseline: Baseline = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    htmlPath: args.htmlPath,
    cssPath: args.cssPath,
    htmlHash: sha256(html),
    cssHash: sha256(css),
    combinedHash: sha256(`${html}\n/*--split--*/\n${css}`)
  };

  const outPath = resolve(args.outPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
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
