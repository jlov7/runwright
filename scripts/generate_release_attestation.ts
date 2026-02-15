import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  artifactPath: string;
  privateKeyPath: string;
  outPath: string;
  predicateType: string;
  builderId: string;
  builderVersion: string;
  invocationId: string;
  sourceRef: string;
  workflow: string;
};

type UnsignedAttestation = {
  schemaVersion: "1.0";
  generatedAt: string;
  predicateType: string;
  subject: {
    path: string;
    sizeBytes: number;
    digest: {
      sha256: string;
    };
  };
  builder: {
    id: string;
    version: string;
  };
  run: {
    invocationId: string;
    sourceRef: string;
    workflow: string;
  };
};

type ReleaseAttestation = UnsignedAttestation & {
  signature: {
    algorithm: "ed25519";
    keyId: string;
    payloadDigest: string;
    value: string;
  };
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    artifactPath: "",
    privateKeyPath: "",
    outPath: "reports/release/release-attestation.json",
    predicateType: "https://runwright.dev/provenance/release-attestation/v1",
    builderId: "runwright.release",
    builderVersion: readPackageVersion(),
    invocationId: process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`,
    sourceRef: process.env.GITHUB_SHA ?? "local",
    workflow: process.env.GITHUB_WORKFLOW ?? "local"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--artifact") {
      parsed.artifactPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--private-key") {
      parsed.privateKeyPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--out") {
      parsed.outPath = argv[index + 1] ?? parsed.outPath;
      index += 1;
      continue;
    }
    if (token === "--predicate-type") {
      parsed.predicateType = argv[index + 1] ?? parsed.predicateType;
      index += 1;
      continue;
    }
    if (token === "--builder-id") {
      parsed.builderId = argv[index + 1] ?? parsed.builderId;
      index += 1;
      continue;
    }
    if (token === "--builder-version") {
      parsed.builderVersion = argv[index + 1] ?? parsed.builderVersion;
      index += 1;
      continue;
    }
    if (token === "--invocation-id") {
      parsed.invocationId = argv[index + 1] ?? parsed.invocationId;
      index += 1;
      continue;
    }
    if (token === "--source-ref") {
      parsed.sourceRef = argv[index + 1] ?? parsed.sourceRef;
      index += 1;
      continue;
    }
    if (token === "--workflow") {
      parsed.workflow = argv[index + 1] ?? parsed.workflow;
      index += 1;
    }
  }

  if (!parsed.artifactPath) throw new Error("Missing required --artifact argument");
  if (!parsed.privateKeyPath) throw new Error("Missing required --private-key argument");
  return parsed;
}

function readPackageVersion(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const packagePath = resolve(dirname(currentFile), "..", "package.json");
  try {
    const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.trim().length > 0) return parsed.version;
  } catch {
    // Intentionally ignored: fallback applies below.
  }
  return "0.0.0";
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

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function ed25519PublicKeyFingerprint(privateKeyPath: string): string {
  const privateKeyBytes = readFileSync(privateKeyPath);
  const privateKey = createPrivateKey({ key: privateKeyBytes, format: "pem" });
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error(`Private key must be ed25519 (received ${String(privateKey.asymmetricKeyType ?? "unknown")})`);
  }
  const publicKey = createPublicKey(privateKey);
  const der = publicKey.export({ type: "spki", format: "der" });
  const bytes = Buffer.isBuffer(der) ? der : Buffer.from(der);
  return sha256Hex(bytes);
}

function main(): void {
  const args = parseArgs(process.argv);
  const artifactPath = resolve(args.artifactPath);
  const privateKeyPath = resolve(args.privateKeyPath);
  const outPath = resolve(args.outPath);

  if (!existsSync(artifactPath)) throw new Error(`Artifact not found: ${args.artifactPath}`);
  if (!existsSync(privateKeyPath)) throw new Error(`Private key not found: ${args.privateKeyPath}`);
  const artifactStats = statSync(artifactPath);
  if (!artifactStats.isFile()) throw new Error(`Artifact is not a file: ${args.artifactPath}`);

  const artifactBytes = readFileSync(artifactPath);
  const subjectDigest = sha256Hex(artifactBytes);
  const generatedAt = new Date().toISOString();

  const unsignedAttestation: UnsignedAttestation = {
    schemaVersion: "1.0",
    generatedAt,
    predicateType: args.predicateType,
    subject: {
      path: basename(artifactPath),
      sizeBytes: artifactStats.size,
      digest: { sha256: subjectDigest }
    },
    builder: {
      id: args.builderId,
      version: args.builderVersion
    },
    run: {
      invocationId: args.invocationId,
      sourceRef: args.sourceRef,
      workflow: args.workflow
    }
  };

  const payloadDigest = sha256Hex(Buffer.from(canonicalize(unsignedAttestation), "utf8"));
  const privateKey = createPrivateKey(readFileSync(privateKeyPath));
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error(`Private key must be ed25519 (received ${String(privateKey.asymmetricKeyType ?? "unknown")})`);
  }
  const signatureValue = sign(null, Buffer.from(payloadDigest, "utf8"), privateKey).toString("base64");
  const keyId = ed25519PublicKeyFingerprint(privateKeyPath);

  const attestation: ReleaseAttestation = {
    ...unsignedAttestation,
    signature: {
      algorithm: "ed25519",
      keyId,
      payloadDigest,
      value: signatureValue
    }
  };

  writeJson(outPath, attestation);
  process.stdout.write(`${outPath}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
