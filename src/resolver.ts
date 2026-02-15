import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import type { SkillbaseManifest } from "./manifest.js";
import { verifySourceSignature } from "./trust/signature.js";

export type SkillUnit = {
  source: string;
  skillPath: string;
  skillName: string;
};

export type SourceMetadata = {
  type: "local" | "github" | "skills.sh";
  resolvedRef: "local" | "commit" | "tag";
  resolvedValue?: string;
  integrity?: {
    transportDigest: string;
    trusted: boolean;
    verifiedAt: string;
    required: boolean;
    verificationError?: string;
    signature?: {
      keyId: string;
      algorithm: "ed25519";
      value: string;
    };
  };
};

export type ResolutionResult = {
  units: SkillUnit[];
  sourceMetadata: Record<string, SourceMetadata>;
};

export type RemoteResolution = {
  rootPath: string;
  type: "github" | "skills.sh";
  resolvedRef: "commit" | "tag";
  resolvedValue: string;
  forcedPick?: string;
  transportDigest?: string;
  signature?: {
    keyId: string;
    algorithm: "ed25519";
    value: string;
  };
};

export type RemoteResolver = (source: string, cwd: string) => RemoteResolution;

type ResolverCacheEntry = {
  fetchedAt: string;
  resolution: RemoteResolution;
};

const SHA256_DIGEST_REGEX = /^sha256:[a-f0-9]{64}$/;

export class TrustVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrustVerificationError";
  }
}

function walkFiles(rootPath: string): string[] {
  const output: string[] = [];
  const queue = [rootPath];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) queue.push(fullPath);
      else if (entry.isFile()) output.push(fullPath);
    }
  }
  return output.sort((left, right) => left.localeCompare(right));
}

function computeTransportDigest(rootPath: string): string {
  const hash = createHash("sha256");
  for (const filePath of walkFiles(rootPath)) {
    const rel = relative(rootPath, filePath).replaceAll("\\", "/");
    hash.update(`path:${rel}\n`);
    hash.update(readFileSync(filePath));
    hash.update("\n");
  }
  return `sha256:${hash.digest("hex")}`;
}

type TrustRule = NonNullable<NonNullable<NonNullable<SkillbaseManifest["defaults"]>["trust"]>["rules"]>[number];

function resolveTrustRule(manifest: SkillbaseManifest, source: string): TrustRule | undefined {
  return manifest.defaults?.trust?.rules?.find((rule) => rule.source === source);
}

function resolveSourceIntegrity(
  manifest: SkillbaseManifest,
  source: string,
  remote: RemoteResolution
): SourceMetadata["integrity"] | undefined {
  const trustConfig = manifest.defaults?.trust;
  const trustMode = trustConfig?.mode ?? "off";
  const hasSignature = Boolean(remote.signature);
  if (trustMode === "off" && !hasSignature) return undefined;

  const transportDigest = remote.transportDigest ?? computeTransportDigest(remote.rootPath);
  if (!SHA256_DIGEST_REGEX.test(transportDigest)) {
    throw new Error(`Invalid transport digest for ${source}`);
  }
  const rule = resolveTrustRule(manifest, source);
  const required = trustMode === "required" || (rule?.requiredSignatures ?? 0) > 0;
  const trustedKeys = new Map((trustConfig?.keys ?? []).map((key) => [key.id, key.publicKey]));
  const allowedKeyIds = rule?.keyIds && rule.keyIds.length > 0 ? new Set(rule.keyIds) : undefined;
  const verifiedAt = new Date().toISOString();

  if (!remote.signature) {
    if (required) throw new TrustVerificationError(`Trust verification failed for ${source}: signature is required`);
    return {
      transportDigest,
      trusted: false,
      verifiedAt,
      required,
      verificationError: "missing signature"
    };
  }

  const signature = remote.signature;
  if (allowedKeyIds && !allowedKeyIds.has(signature.keyId)) {
    if (required) {
      throw new TrustVerificationError(`Trust verification failed for ${source}: key '${signature.keyId}' is not allowed`);
    }
    return {
      transportDigest,
      trusted: false,
      verifiedAt,
      required,
      verificationError: `key '${signature.keyId}' is not allowed`,
      signature
    };
  }

  const publicKeyPem = trustedKeys.get(signature.keyId);
  if (!publicKeyPem) {
    if (required) {
      throw new TrustVerificationError(`Trust verification failed for ${source}: unknown key '${signature.keyId}'`);
    }
    return {
      transportDigest,
      trusted: false,
      verifiedAt,
      required,
      verificationError: `unknown key '${signature.keyId}'`,
      signature
    };
  }

  const verified = verifySourceSignature({
    digest: transportDigest,
    algorithm: signature.algorithm,
    keyId: signature.keyId,
    signature: signature.value,
    publicKeyPem
  });
  if (!verified.ok) {
    if (required) {
      throw new TrustVerificationError(`Trust verification failed for ${source}: ${verified.reason}`);
    }
    return {
      transportDigest,
      trusted: false,
      verifiedAt,
      required,
      verificationError: verified.reason,
      signature
    };
  }

  return {
    transportDigest,
    trusted: true,
    verifiedAt,
    required,
    signature
  };
}

function cacheFilenameForSource(source: string): string {
  const sanitized = source.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "source";
  const digest = createHash("sha256").update(source).digest("hex").slice(0, 16);
  return `${sanitized}-${digest}.json`;
}

function isPathWithinRoot(rootPath: string, candidatePath: string): boolean {
  const rel = relative(rootPath, candidatePath);
  return rel === "" || (!rel.startsWith("../") && !rel.startsWith("..\\") && !isAbsolute(rel));
}

function parseSkillRefs(manifest: SkillbaseManifest): Array<{ source: string; pick?: string[] }> {
  const skillsets = manifest.skillsets ?? {};
  const selectedSkillsets = manifest.apply?.useSkillsets ?? Object.keys(skillsets);
  const refs: Array<{ source: string; pick?: string[] }> = [];

  for (const skillsetName of selectedSkillsets) {
    const skillset = skillsets[skillsetName];
    if (!skillset) continue;
    refs.push(...skillset.skills);
  }
  if (manifest.apply?.extraSkills) refs.push(...manifest.apply.extraSkills);
  return refs;
}

function walkDirectories(rootPath: string): string[] {
  const output: string[] = [];
  const queue = [rootPath];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    output.push(current);
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      queue.push(join(current, entry.name));
    }
  }
  return output;
}

function collectSkillDirs(rootPath: string, picks?: string[]): string[] {
  const rootReal = realpathSync(rootPath);
  const directories = walkDirectories(rootReal);
  const skillDirs = directories.filter((dir) => existsSync(join(dir, "SKILL.md")));
  if (!picks || picks.length === 0) return skillDirs;

  const selected = new Set<string>();
  for (const pick of picks) {
    const direct = resolve(rootReal, pick);
    const rel = relative(rootReal, direct);
    if (rel === ".." || rel.startsWith("../") || rel.startsWith("..\\") || isAbsolute(rel)) {
      throw new Error(`Requested skill pick '${pick}' escapes source root`);
    }
    if (existsSync(join(direct, "SKILL.md"))) {
      const directReal = realpathSync(direct);
      if (!isPathWithinRoot(rootReal, directReal)) {
        throw new Error(`Requested skill pick '${pick}' escapes source root`);
      }
      selected.add(directReal);
      continue;
    }
    const byName = skillDirs.filter((dir) => basename(dir) === pick);
    if (byName.length === 1) {
      selected.add(byName[0]!);
      continue;
    }
    if (byName.length > 1) {
      const choices = byName.map((path) => relative(rootReal, path).replaceAll("\\", "/")).sort((a, b) => a.localeCompare(b));
      throw new Error(`Requested skill pick '${pick}' is ambiguous under ${rootPath}: ${choices.join(", ")}`);
      continue;
    }
    throw new Error(`Requested skill pick '${pick}' not found under ${rootPath}`);
  }
  return [...selected];
}

function parseRemoteSource(source: string): {
  owner: string;
  repo: string;
  type: "github" | "skills.sh";
  forcedPick?: string;
} {
  if (source.startsWith("https://skills.sh/")) {
    const url = new URL(source);
    const [owner, repo, skill] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repo) throw new Error(`Invalid skills.sh source: ${source}`);
    return { owner, repo, type: "skills.sh", forcedPick: skill };
  }

  const parts = source.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Unsupported source format: ${source}`);
  }
  return { owner: parts[0], repo: parts[1], type: "github" };
}

function expectedRemoteStoreRoot(source: string, cwd: string): { type: "github" | "skills.sh"; root: string } {
  const parsed = parseRemoteSource(source);
  return {
    type: parsed.type,
    root: resolve(cwd, ".skillbase", "store", "sources", parsed.type, parsed.owner, parsed.repo)
  };
}

function validateRemoteResolutionForSource(source: string, cwd: string, resolution: RemoteResolution): RemoteResolution {
  const expected = expectedRemoteStoreRoot(source, cwd);
  if (resolution.resolvedRef !== "commit" && resolution.resolvedRef !== "tag") {
    throw new Error(`Resolved remote ref is invalid for ${source}`);
  }
  if (typeof resolution.resolvedValue !== "string" || resolution.resolvedValue.trim().length === 0) {
    throw new Error(`Resolved remote revision is invalid for ${source}`);
  }
  if (
    resolution.forcedPick !== undefined &&
    (typeof resolution.forcedPick !== "string" || resolution.forcedPick.trim().length === 0)
  ) {
    throw new Error(`Resolved forced pick is invalid for ${source}`);
  }
  if (typeof resolution.rootPath !== "string" || resolution.rootPath.trim().length === 0) {
    throw new Error(`Resolved remote root path is invalid for ${source}`);
  }
  if (resolution.transportDigest !== undefined && !SHA256_DIGEST_REGEX.test(resolution.transportDigest)) {
    throw new Error(`Resolved remote transport digest is invalid for ${source}`);
  }
  if (resolution.signature) {
    if (typeof resolution.signature.keyId !== "string" || resolution.signature.keyId.trim().length === 0) {
      throw new Error(`Resolved signature key id is invalid for ${source}`);
    }
    if (resolution.signature.algorithm !== "ed25519") {
      throw new Error(`Resolved signature algorithm is invalid for ${source}`);
    }
    if (typeof resolution.signature.value !== "string" || resolution.signature.value.trim().length === 0) {
      throw new Error(`Resolved signature value is invalid for ${source}`);
    }
  }
  const rootPath = resolve(resolution.rootPath);
  if (resolution.type !== expected.type) {
    throw new Error(`Resolved remote source type mismatch for ${source}`);
  }
  if (!existsSync(rootPath)) {
    throw new Error(`Resolved remote source path does not exist for ${source}`);
  }
  const rootPathReal = realpathSync(rootPath);
  const expectedRootReal = existsSync(expected.root) ? realpathSync(expected.root) : resolve(expected.root);
  if (!isPathWithinRoot(expectedRootReal, rootPathReal)) {
    throw new Error(`Resolved remote source path is outside managed store for ${source}`);
  }
  return {
    rootPath: rootPathReal,
    type: resolution.type,
    resolvedRef: resolution.resolvedRef,
    resolvedValue: resolution.resolvedValue,
    ...(resolution.forcedPick ? { forcedPick: resolution.forcedPick } : {}),
    ...(resolution.transportDigest ? { transportDigest: resolution.transportDigest } : {}),
    ...(resolution.signature ? { signature: resolution.signature } : {})
  };
}

export function defaultRemoteResolver(source: string, cwd: string): RemoteResolution {
  const { owner, repo, type, forcedPick } = parseRemoteSource(source);
  const repoUrl = `https://github.com/${owner}/${repo}.git`;
  const lsRemote = execFileSync("git", ["ls-remote", repoUrl, "HEAD"], {
    encoding: "utf8"
  });
  const sha = lsRemote.trim().split(/\s+/)[0];
  if (!sha || sha.length < 7) throw new Error(`Unable to resolve HEAD commit for ${source}`);

  const sourceRoot = resolve(cwd, ".skillbase", "store", "sources", type, owner, repo);
  const repoPath = resolve(sourceRoot, sha);
  if (!existsSync(repoPath)) {
    mkdirSync(sourceRoot, { recursive: true });
    const tmpPath = resolve(sourceRoot, `.tmp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    try {
      execFileSync("git", ["clone", "--filter=blob:none", "--no-checkout", repoUrl, tmpPath], {
        stdio: "pipe"
      });
      execFileSync("git", ["-C", tmpPath, "fetch", "--depth", "1", "origin", sha], { stdio: "pipe" });
      execFileSync("git", ["-C", tmpPath, "checkout", "--detach", "FETCH_HEAD"], { stdio: "pipe" });
      rmSync(resolve(tmpPath, ".git"), { recursive: true, force: true });
      renameSync(tmpPath, repoPath);
    } catch (error) {
      rmSync(tmpPath, { recursive: true, force: true });
      throw error;
    }
  }

  return {
    rootPath: repoPath,
    type,
    resolvedRef: "commit",
    resolvedValue: sha,
    forcedPick
  };
}

export function resolveSkillUnits(
  manifest: SkillbaseManifest,
  cwd: string,
  options?: { remoteResolver?: RemoteResolver; refreshSources?: boolean; remoteCacheTtlSeconds?: number }
): ResolutionResult {
  const remoteResolver = options?.remoteResolver ?? defaultRemoteResolver;
  const refreshSources = options?.refreshSources ?? false;
  const remoteCacheTtlSeconds = options?.remoteCacheTtlSeconds ?? 3600;
  const refs = parseSkillRefs(manifest);
  const units = new Map<string, SkillUnit>();
  const sourceMetadata: Record<string, SourceMetadata> = {};

  for (const ref of refs) {
    if (ref.source.startsWith("local:")) {
      const rawPath = ref.source.slice("local:".length).trim();
      const sourcePath = isAbsolute(rawPath) ? rawPath : resolve(cwd, rawPath);
      if (!existsSync(sourcePath)) continue;
      const dirs = collectSkillDirs(sourcePath, ref.pick);
      sourceMetadata[ref.source] = { type: "local", resolvedRef: "local" };
      for (const dir of dirs) {
        const key = `${ref.source}::${dir}`;
        units.set(key, { source: ref.source, skillPath: dir, skillName: basename(dir) });
      }
      continue;
    }

    const cacheRoot = resolve(cwd, ".skillbase", "store", "source-cache");
    mkdirSync(cacheRoot, { recursive: true });
    const cachePath = resolve(cacheRoot, cacheFilenameForSource(ref.source));
    let remote: RemoteResolution | undefined;
    if (!refreshSources && existsSync(cachePath)) {
      try {
        const cached = JSON.parse(readFileSync(cachePath, "utf8")) as ResolverCacheEntry;
        const fetchedAt = Date.parse(cached.fetchedAt);
        const ageSeconds = Number.isFinite(fetchedAt) ? (Date.now() - fetchedAt) / 1000 : Number.POSITIVE_INFINITY;
        if (
          Number.isFinite(ageSeconds) &&
          ageSeconds < remoteCacheTtlSeconds &&
          cached.resolution?.rootPath &&
          existsSync(cached.resolution.rootPath)
        ) {
          remote = validateRemoteResolutionForSource(ref.source, cwd, cached.resolution);
        }
      } catch {
        // Ignore corrupt cache and refresh.
      }
    }

    if (!remote) {
      remote = validateRemoteResolutionForSource(ref.source, cwd, remoteResolver(ref.source, cwd));
      const cacheEntry: ResolverCacheEntry = {
        fetchedAt: new Date().toISOString(),
        resolution: remote
      };
      writeFileSync(cachePath, `${JSON.stringify(cacheEntry, null, 2)}\n`, "utf8");
    }

    const effectivePicks = ref.pick && ref.pick.length > 0 ? ref.pick : remote.forcedPick ? [remote.forcedPick] : undefined;
    const dirs = collectSkillDirs(remote.rootPath, effectivePicks);
    const integrity = resolveSourceIntegrity(manifest, ref.source, remote);
    sourceMetadata[ref.source] = {
      type: remote.type,
      resolvedRef: remote.resolvedRef,
      resolvedValue: remote.resolvedValue,
      ...(integrity ? { integrity } : {})
    };
    for (const dir of dirs) {
      const key = `${ref.source}::${dir}`;
      units.set(key, { source: ref.source, skillPath: dir, skillName: basename(dir) });
    }
  }

  return {
    units: [...units.values()].sort((a, b) =>
      a.source === b.source ? a.skillName.localeCompare(b.skillName) : a.source.localeCompare(b.source)
    ),
    sourceMetadata
  };
}
