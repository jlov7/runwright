import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  baseDir: string;
  outPath: string;
  files: string[];
};

type ArtifactManifest = {
  schemaVersion: "1.0";
  generatedAt: string;
  baseDir: string;
  rootHash: string;
  files: Array<{
    path: string;
    sizeBytes: number;
    sha256: string;
  }>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    baseDir: ".",
    outPath: "reports/release/artifact-manifest.json",
    files: []
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--base-dir") {
      parsed.baseDir = argv[index + 1] ?? parsed.baseDir;
      index += 1;
      continue;
    }
    if (token === "--out") {
      parsed.outPath = argv[index + 1] ?? parsed.outPath;
      index += 1;
      continue;
    }
    if (token === "--file") {
      const value = (argv[index + 1] ?? "").trim();
      if (value.length > 0) parsed.files.push(value);
      index += 1;
    }
  }

  if (parsed.files.length === 0) {
    throw new Error("At least one --file path is required");
  }
  return parsed;
}

function sha256Hex(bytes: Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(bytes);
  return `sha256:${hash.digest("hex")}`;
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function main(): void {
  const args = parseArgs(process.argv);
  const baseDir = resolve(args.baseDir);
  const outPath = resolve(args.outPath);

  const files = [...new Set(args.files)]
    .map((entry) => {
      const absolute = resolve(baseDir, entry);
      if (!existsSync(absolute)) throw new Error(`Artifact not found: ${entry}`);
      const stats = statSync(absolute);
      if (!stats.isFile()) throw new Error(`Artifact is not a file: ${entry}`);
      const rel = relative(baseDir, absolute).replaceAll("\\", "/");
      if (rel.startsWith("../") || rel === "..") throw new Error(`Artifact path escapes base directory: ${entry}`);
      const bytes = readFileSync(absolute);
      return {
        path: rel,
        sizeBytes: stats.size,
        sha256: sha256Hex(bytes)
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  const rootHash = sha256Hex(
    Buffer.from(
      files.map((entry) => `${entry.path}\t${entry.sizeBytes}\t${entry.sha256}`).join("\n"),
      "utf8"
    )
  );

  const manifest: ArtifactManifest = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    baseDir,
    rootHash,
    files
  };
  writeJson(outPath, manifest);
  process.stdout.write(`${outPath}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
