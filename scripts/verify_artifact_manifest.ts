import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  manifestPath: string;
  outPath: string;
};

type ManifestEntry = {
  path: string;
  sizeBytes: number;
  sha256: string;
};

type Manifest = {
  schemaVersion: "1.0";
  baseDir: string;
  rootHash: string;
  files: ManifestEntry[];
};

type VerificationReport = {
  schemaVersion: "1.0";
  generatedAt: string;
  ok: boolean;
  checkedFiles: number;
  mismatches: Array<{ path: string; reason: string }>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    manifestPath: "",
    outPath: "reports/release/artifact-manifest.verify.json"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--manifest") {
      parsed.manifestPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--out") {
      parsed.outPath = argv[index + 1] ?? parsed.outPath;
      index += 1;
    }
  }

  if (!parsed.manifestPath) throw new Error("Missing required --manifest argument");
  return parsed;
}

function sha256Hex(bytes: Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(bytes);
  return `sha256:${hash.digest("hex")}`;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function asManifest(value: unknown): Manifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Manifest must be an object");
  }
  const record = value as Record<string, unknown>;
  const files = Array.isArray(record.files) ? record.files : [];
  return {
    schemaVersion: String(record.schemaVersion) as "1.0",
    baseDir: String(record.baseDir ?? ""),
    rootHash: String(record.rootHash ?? ""),
    files: files.map((entry) => {
      const item = entry as Record<string, unknown>;
      return {
        path: String(item.path ?? ""),
        sizeBytes: Number(item.sizeBytes ?? 0),
        sha256: String(item.sha256 ?? "")
      };
    })
  };
}

function main(): void {
  const args = parseArgs(process.argv);
  const manifestPath = resolve(args.manifestPath);
  const outPath = resolve(args.outPath);
  const manifest = asManifest(readJson(manifestPath));
  const mismatches: VerificationReport["mismatches"] = [];

  if (manifest.schemaVersion !== "1.0") {
    mismatches.push({ path: "(manifest)", reason: `unsupported schemaVersion '${manifest.schemaVersion}'` });
  }
  if (!manifest.baseDir) {
    mismatches.push({ path: "(manifest)", reason: "missing baseDir" });
  }

  const recomputedRootLines: string[] = [];
  for (const entry of manifest.files) {
    const absolutePath = resolve(manifest.baseDir, entry.path);
    if (!existsSync(absolutePath)) {
      mismatches.push({ path: entry.path, reason: "missing file" });
      continue;
    }
    const stats = statSync(absolutePath);
    if (!stats.isFile()) {
      mismatches.push({ path: entry.path, reason: "not a file" });
      continue;
    }
    if (stats.size !== entry.sizeBytes) {
      mismatches.push({
        path: entry.path,
        reason: `size mismatch expected=${entry.sizeBytes} actual=${stats.size}`
      });
    }
    const hash = sha256Hex(readFileSync(absolutePath));
    if (hash !== entry.sha256) {
      mismatches.push({
        path: entry.path,
        reason: `hash mismatch expected=${entry.sha256} actual=${hash}`
      });
    }
    recomputedRootLines.push(`${entry.path}\t${entry.sizeBytes}\t${entry.sha256}`);
  }

  const recomputedRootHash = sha256Hex(
    Buffer.from(recomputedRootLines.sort((left, right) => left.localeCompare(right)).join("\n"), "utf8")
  );
  if (manifest.rootHash !== recomputedRootHash) {
    mismatches.push({
      path: "(manifest)",
      reason: `rootHash mismatch expected=${manifest.rootHash} actual=${recomputedRootHash}`
    });
  }

  const report: VerificationReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    ok: mismatches.length === 0,
    checkedFiles: manifest.files.length,
    mismatches
  };

  writeJson(outPath, report);
  process.stdout.write(`${outPath}\n`);
  if (!report.ok) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
