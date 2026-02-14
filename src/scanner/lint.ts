import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import yaml from "js-yaml";

type LintIssue = {
  severity: "error" | "warn";
  message: string;
  file?: string;
};

const MAX_SKILL_MD_BYTES = 256 * 1024;

function extractFrontmatter(raw: string): string | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match?.[1] ?? null;
}

function walkFiles(rootPath: string): string[] {
  const output: string[] = [];
  const queue = [rootPath];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) queue.push(fullPath);
      else if (entry.isFile()) output.push(fullPath);
    }
  }
  return output;
}

function walkSymlinks(rootPath: string): string[] {
  const output: string[] = [];
  const queue = [rootPath];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        output.push(fullPath);
        continue;
      }
      if (entry.isDirectory()) queue.push(fullPath);
    }
  }
  return output;
}

export function lintSkillDir(path: string): { ok: boolean; issues: LintIssue[] } {
  const issues: LintIssue[] = [];
  const skillFile = join(path, "SKILL.md");

  if (!existsSync(skillFile)) {
    issues.push({ severity: "error", file: "SKILL.md", message: "Missing required SKILL.md file" });
    return { ok: false, issues };
  }

  const skillStat = statSync(skillFile);
  if (skillStat.size > MAX_SKILL_MD_BYTES) {
    issues.push({
      severity: "error",
      file: "SKILL.md",
      message: `SKILL.md exceeds ${MAX_SKILL_MD_BYTES} bytes`
    });
  }

  const raw = readFileSync(skillFile, "utf8");
  const frontmatter = extractFrontmatter(raw);
  if (!frontmatter) {
    issues.push({
      severity: "error",
      file: "SKILL.md",
      message: "SKILL.md is missing YAML frontmatter"
    });
  } else {
    let parsed: unknown;
    try {
      parsed = yaml.load(frontmatter);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid YAML frontmatter";
      issues.push({ severity: "error", file: "SKILL.md", message });
    }

    const metadata = parsed as { name?: unknown; description?: unknown } | undefined;
    if (!metadata || typeof metadata !== "object") {
      issues.push({ severity: "error", file: "SKILL.md", message: "Frontmatter must be an object" });
    } else {
      if (typeof metadata.name !== "string" || metadata.name.trim().length === 0) {
        issues.push({ severity: "error", file: "SKILL.md", message: "Frontmatter requires a non-empty name" });
      }
      if (typeof metadata.description !== "string" || metadata.description.trim().length === 0) {
        issues.push({
          severity: "error",
          file: "SKILL.md",
          message: "Frontmatter requires a non-empty description"
        });
      }
    }
  }

  for (const filePath of walkFiles(path)) {
    const relPath = relative(path, filePath).replaceAll("\\", "/");
    if (relPath === ".." || relPath.startsWith("../") || relPath.includes("/../")) {
      issues.push({
        severity: "error",
        file: relPath,
        message: "Disallowed path traversal sequence detected in file path"
      });
    }
  }

  for (const symlinkPath of walkSymlinks(path)) {
    issues.push({
      severity: "error",
      file: relative(path, symlinkPath).replaceAll("\\", "/"),
      message: "Symlinks are not allowed in skill directories"
    });
  }

  const ok = issues.every((issue) => issue.severity !== "error");
  return { ok, issues };
}
