import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { computeSkillDigest, type ResolvedSourceForLockfile } from "./lockfile.js";
import type { SkillUnit, SourceMetadata } from "./resolver.js";

function sourceDigest(entries: Array<{ name: string; digest: string }>): string {
  const hash = createHash("sha256");
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    hash.update(`${entry.name}:${entry.digest}\n`);
  }
  return `sha256:${hash.digest("hex")}`;
}

function slug(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function materializeSkillsToStore(
  units: SkillUnit[],
  sourceMetadata: Record<string, SourceMetadata>,
  cwd: string
): ResolvedSourceForLockfile[] {
  const grouped = new Map<string, SkillUnit[]>();
  for (const unit of units) {
    const bucket = grouped.get(unit.source) ?? [];
    bucket.push(unit);
    grouped.set(unit.source, bucket);
  }

  const storeRoot = resolve(cwd, ".skillbase", "store", "skills");
  mkdirSync(storeRoot, { recursive: true });

  const output: ResolvedSourceForLockfile[] = [];
  for (const [source, sourceUnits] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sourceMeta = sourceMetadata[source] ?? { type: "local", resolvedRef: "local" };
    const skills = sourceUnits.map((unit) => {
      const digest = computeSkillDigest(unit.skillPath);
      const destination = resolve(storeRoot, `${slug(unit.skillName)}-${digest.slice(7, 19)}`);
      if (!existsSync(destination)) {
        cpSync(unit.skillPath, destination, { recursive: true, force: false, dereference: false });
      }
      return { name: basename(unit.skillName), digest, path: destination.replaceAll("\\", "/") };
    });

    output.push({
      source,
      type: sourceMeta.type,
      resolvedRef: sourceMeta.resolvedRef,
      resolvedValue:
        sourceMeta.resolvedValue ?? sourceDigest(skills.map((skill) => ({ name: skill.name, digest: skill.digest }))),
      skills
    });
  }
  return output;
}
