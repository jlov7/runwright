import { createHash, createPublicKey, verify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ParsedArgs = {
  attestationPath: string;
  artifactPath: string;
  publicKeyPath: string;
  outPath: string;
};

type ReleaseAttestation = {
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
  signature: {
    algorithm: "ed25519";
    keyId: string;
    payloadDigest: string;
    value: string;
  };
};

type AttestationVerificationReport = {
  schemaVersion: "1.0";
  generatedAt: string;
  ok: boolean;
  attestationPath: string;
  artifactPath: string;
  checks: {
    artifactFound: boolean;
    digestMatch: boolean;
    sizeMatch: boolean;
    subjectPathMatch: boolean;
    payloadDigestMatch: boolean;
    keyIdMatch: boolean;
    signatureVerified: boolean;
  };
  issues: string[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    attestationPath: "",
    artifactPath: "",
    publicKeyPath: "",
    outPath: "reports/release/release-attestation.verify.json"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--attestation") {
      parsed.attestationPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--artifact") {
      parsed.artifactPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--public-key") {
      parsed.publicKeyPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--out") {
      parsed.outPath = argv[index + 1] ?? parsed.outPath;
      index += 1;
    }
  }

  if (!parsed.attestationPath) throw new Error("Missing required --attestation argument");
  if (!parsed.artifactPath) throw new Error("Missing required --artifact argument");
  if (!parsed.publicKeyPath) throw new Error("Missing required --public-key argument");
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

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asAttestation(value: unknown): ReleaseAttestation {
  const root = asRecord(value);
  const subject = asRecord(root.subject);
  const subjectDigest = asRecord(subject.digest);
  const builder = asRecord(root.builder);
  const run = asRecord(root.run);
  const signature = asRecord(root.signature);
  return {
    schemaVersion: String(root.schemaVersion ?? "0.0") as "1.0",
    generatedAt: String(root.generatedAt ?? ""),
    predicateType: String(root.predicateType ?? ""),
    subject: {
      path: String(subject.path ?? ""),
      sizeBytes: Number(subject.sizeBytes ?? 0),
      digest: {
        sha256: String(subjectDigest.sha256 ?? "")
      }
    },
    builder: {
      id: String(builder.id ?? ""),
      version: String(builder.version ?? "")
    },
    run: {
      invocationId: String(run.invocationId ?? ""),
      sourceRef: String(run.sourceRef ?? ""),
      workflow: String(run.workflow ?? "")
    },
    signature: {
      algorithm: String(signature.algorithm ?? "") as "ed25519",
      keyId: String(signature.keyId ?? ""),
      payloadDigest: String(signature.payloadDigest ?? ""),
      value: String(signature.value ?? "")
    }
  };
}

function buildUnsignedAttestation(attestation: ReleaseAttestation): Omit<ReleaseAttestation, "signature"> {
  return {
    schemaVersion: attestation.schemaVersion,
    generatedAt: attestation.generatedAt,
    predicateType: attestation.predicateType,
    subject: attestation.subject,
    builder: attestation.builder,
    run: attestation.run
  };
}

function publicKeyFingerprint(publicKeyPath: string): string {
  const key = createPublicKey(readFileSync(publicKeyPath));
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error(`Public key must be ed25519 (received ${String(key.asymmetricKeyType ?? "unknown")})`);
  }
  const der = key.export({ type: "spki", format: "der" });
  const bytes = Buffer.isBuffer(der) ? der : Buffer.from(der);
  return sha256Hex(bytes);
}

function main(): void {
  const args = parseArgs(process.argv);
  const attestationPath = resolve(args.attestationPath);
  const artifactPath = resolve(args.artifactPath);
  const publicKeyPath = resolve(args.publicKeyPath);
  const outPath = resolve(args.outPath);
  const issues: string[] = [];

  const report: AttestationVerificationReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    ok: false,
    attestationPath,
    artifactPath,
    checks: {
      artifactFound: false,
      digestMatch: false,
      sizeMatch: false,
      subjectPathMatch: false,
      payloadDigestMatch: false,
      keyIdMatch: false,
      signatureVerified: false
    },
    issues
  };

  if (!existsSync(attestationPath)) {
    issues.push(`attestation not found: ${args.attestationPath}`);
    writeJson(outPath, report);
    process.stdout.write(`${outPath}\n`);
    process.exit(1);
  }
  if (!existsSync(artifactPath)) {
    issues.push(`artifact not found: ${args.artifactPath}`);
    writeJson(outPath, report);
    process.stdout.write(`${outPath}\n`);
    process.exit(1);
  }
  if (!existsSync(publicKeyPath)) {
    issues.push(`public key not found: ${args.publicKeyPath}`);
    writeJson(outPath, report);
    process.stdout.write(`${outPath}\n`);
    process.exit(1);
  }

  const attestation = asAttestation(JSON.parse(readFileSync(attestationPath, "utf8")) as unknown);
  const artifactStats = statSync(artifactPath);
  report.checks.artifactFound = artifactStats.isFile();
  if (!report.checks.artifactFound) issues.push("artifact path is not a file");

  const artifactBytes = readFileSync(artifactPath);
  const artifactDigest = sha256Hex(artifactBytes);
  report.checks.digestMatch = artifactDigest === attestation.subject.digest.sha256;
  if (!report.checks.digestMatch) {
    issues.push(
      `artifact digest mismatch expected=${attestation.subject.digest.sha256} actual=${artifactDigest}`
    );
  }

  report.checks.sizeMatch = artifactStats.size === attestation.subject.sizeBytes;
  if (!report.checks.sizeMatch) {
    issues.push(
      `artifact size mismatch expected=${attestation.subject.sizeBytes} actual=${artifactStats.size}`
    );
  }

  report.checks.subjectPathMatch = attestation.subject.path === basename(artifactPath);
  if (!report.checks.subjectPathMatch) {
    issues.push(`subject path mismatch expected=${attestation.subject.path} actual=${basename(artifactPath)}`);
  }

  if (attestation.schemaVersion !== "1.0") {
    issues.push(`unsupported schemaVersion '${attestation.schemaVersion}'`);
  }
  if (attestation.signature.algorithm !== "ed25519") {
    issues.push(`unsupported signature algorithm '${attestation.signature.algorithm}'`);
  }

  const expectedPayloadDigest = sha256Hex(
    Buffer.from(canonicalize(buildUnsignedAttestation(attestation)), "utf8")
  );
  report.checks.payloadDigestMatch = expectedPayloadDigest === attestation.signature.payloadDigest;
  if (!report.checks.payloadDigestMatch) {
    issues.push(
      `payload digest mismatch expected=${attestation.signature.payloadDigest} actual=${expectedPayloadDigest}`
    );
  }

  const expectedKeyId = publicKeyFingerprint(publicKeyPath);
  report.checks.keyIdMatch = expectedKeyId === attestation.signature.keyId;
  if (!report.checks.keyIdMatch) {
    issues.push(`keyId mismatch expected=${attestation.signature.keyId} actual=${expectedKeyId}`);
  }

  try {
    const publicKey = createPublicKey(readFileSync(publicKeyPath));
    const signatureBytes = Buffer.from(attestation.signature.value, "base64");
    report.checks.signatureVerified = verify(
      null,
      Buffer.from(expectedPayloadDigest, "utf8"),
      publicKey,
      signatureBytes
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push(`signature verification failed: ${message}`);
  }
  if (!report.checks.signatureVerified) issues.push("signature verification failed");

  report.ok = Object.values(report.checks).every((value) => value) && issues.length === 0;

  writeJson(outPath, report);
  process.stdout.write(`${outPath}\n`);
  if (!report.ok) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
