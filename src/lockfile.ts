import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative } from "node:path";
import { mkdirSync } from "node:fs";
import { z } from "zod";

const SHA256_DIGEST_REGEX = /^sha256:[a-f0-9]{64}$/;
const GITHUB_SOURCE_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SKILLS_SH_SOURCE_REGEX = /^https:\/\/skills\.sh\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?$/;

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function isSafeAbsolutePath(value: string): boolean {
  return value.length > 0 && isAbsolute(value) && !value.includes("\0");
}

const LockfileSkillSchema = z
  .object({
    digest: z.string().regex(SHA256_DIGEST_REGEX, "digest must be sha256:<64 hex chars>"),
    path: z.string().refine(isSafeAbsolutePath, "path must be an absolute, null-free path")
  })
  .strict();

const LockfileIntegritySchema = z
  .object({
    transportDigest: z.string().regex(SHA256_DIGEST_REGEX, "transportDigest must be sha256:<64 hex chars>"),
    trusted: z.boolean(),
    verifiedAt: z.string().refine(isValidTimestamp, "verifiedAt must be a valid timestamp"),
    required: z.boolean().optional(),
    verificationError: z.string().min(1).optional(),
    signature: z
      .object({
        keyId: z.string().min(1),
        algorithm: z.literal("ed25519"),
        value: z.string().min(1)
      })
      .strict()
      .optional()
  })
  .strict();

const LockfileSourceSchema = z
  .object({
    type: z.enum(["local", "github", "skills.sh"]),
    resolved: z
      .object({
        ref: z.enum(["local", "commit", "tag"]),
        value: z.string().min(1)
      })
      .strict(),
    skills: z.record(z.string().min(1), LockfileSkillSchema),
    integrity: LockfileIntegritySchema.optional()
  })
  .strict()
  .superRefine((source, ctx) => {
    if (source.type === "local") {
      if (source.resolved.ref !== "local") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "local sources must use resolved.ref of 'local'",
          path: ["resolved", "ref"]
        });
      }
      return;
    }

    if (source.resolved.ref === "local") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "remote sources must use resolved.ref of 'commit' or 'tag'",
        path: ["resolved", "ref"]
      });
    }
  });

const LockfileSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    generatedAt: z.string().refine(isValidTimestamp, "generatedAt must be a valid timestamp"),
    sources: z.record(z.string().min(1), LockfileSourceSchema)
  })
  .strict()
  .superRefine((lockfile, ctx) => {
    for (const [sourceKey, source] of Object.entries(lockfile.sources)) {
      if (sourceKey.startsWith("local:")) {
        const localPath = sourceKey.slice("local:".length).trim();
        if (localPath.length === 0 || localPath.includes("\0")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `source '${sourceKey}' must include a non-empty local path`,
            path: ["sources", sourceKey]
          });
        }
        if (source.type !== "local") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `source '${sourceKey}' must have type 'local'`,
            path: ["sources", sourceKey, "type"]
          });
        }
        continue;
      }
      if (GITHUB_SOURCE_REGEX.test(sourceKey)) {
        if (source.type !== "github") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `source '${sourceKey}' must have type 'github'`,
            path: ["sources", sourceKey, "type"]
          });
        }
        continue;
      }
      if (SKILLS_SH_SOURCE_REGEX.test(sourceKey)) {
        if (source.type !== "skills.sh") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `source '${sourceKey}' must have type 'skills.sh'`,
            path: ["sources", sourceKey, "type"]
          });
        }
        continue;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `unsupported lockfile source format: ${sourceKey}`,
        path: ["sources", sourceKey]
      });
    }
  });

export type SkillbaseLockfile = z.infer<typeof LockfileSchema>;

export type ResolvedSourceForLockfile = {
  source: string;
  type: "local" | "github" | "skills.sh";
  resolvedRef: "local" | "commit" | "tag";
  resolvedValue?: string;
  integrity?: z.infer<typeof LockfileIntegritySchema>;
  skills: Array<{ name: string; digest: string; path: string }>;
};

function walkFiles(rootPath: string): string[] {
  const output: string[] = [];
  const queue = [rootPath];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Symlinks are not allowed in skill directories: ${fullPath}`);
      }
      if (entry.isDirectory()) queue.push(fullPath);
      else if (entry.isFile()) output.push(fullPath);
    }
  }
  return output.sort((a, b) => a.localeCompare(b));
}

function sortObjectKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => sortObjectKeys(item)) as T;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const output: Record<string, unknown> = {};
    for (const [key, nested] of entries) output[key] = sortObjectKeys(nested);
    return output as T;
  }
  return value;
}

export function canonicalizeLockfile(lockfile: SkillbaseLockfile): SkillbaseLockfile {
  const parsed = LockfileSchema.parse(lockfile);
  return sortObjectKeys(parsed);
}

export function computeSkillDigest(skillPath: string): string {
  const hash = createHash("sha256");
  for (const filePath of walkFiles(skillPath)) {
    const rel = relative(skillPath, filePath).replaceAll("\\", "/");
    hash.update(`path:${rel}\n`);
    hash.update(readFileSync(filePath));
    hash.update("\n");
  }
  return `sha256:${hash.digest("hex")}`;
}

export function buildLockfileFromSources(
  sources: ResolvedSourceForLockfile[],
  generatedAt = new Date().toISOString()
): SkillbaseLockfile {
  const sourceEntries = [...sources].sort((a, b) => a.source.localeCompare(b.source));
  const sourceMap: Record<string, SkillbaseLockfile["sources"][string]> = {};
  for (const sourceEntry of sourceEntries) {
    const skillsMap: Record<string, { digest: string; path: string }> = {};
    for (const skill of [...sourceEntry.skills].sort((a, b) => a.name.localeCompare(b.name))) {
      skillsMap[skill.name] = { digest: skill.digest, path: skill.path };
    }
    sourceMap[sourceEntry.source] = {
      type: sourceEntry.type,
      resolved: { ref: sourceEntry.resolvedRef, value: sourceEntry.resolvedValue ?? sourceEntry.resolvedRef },
      skills: skillsMap,
      ...(sourceEntry.integrity ? { integrity: sourceEntry.integrity } : {})
    };
  }

  return { version: 2, generatedAt, sources: sourceMap };
}

export function writeLockfile(lockPath: string, lockfile: SkillbaseLockfile): void {
  const normalized = canonicalizeLockfile(lockfile);
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function readLockfile(lockPath: string): SkillbaseLockfile {
  if (!existsSync(lockPath)) {
    throw new Error(`Lockfile not found: ${lockPath}`);
  }
  const parsed = JSON.parse(readFileSync(lockPath, "utf8")) as unknown;
  return LockfileSchema.parse(parsed);
}

export function lockfilesEqual(left: SkillbaseLockfile, right: SkillbaseLockfile): boolean {
  return JSON.stringify(canonicalizeLockfile(left)) === JSON.stringify(canonicalizeLockfile(right));
}
