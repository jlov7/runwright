import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

export type SecurityRuleId =
  | "remote-shell-curl-pipe"
  | "remote-shell-wget-pipe"
  | "privileged-command-sudo"
  | "insecure-chmod-777"
  | "unpinned-npx-package"
  | "secret-exfiltration-ssh-cat"
  | "env-dump-printenv";

export type SecurityFinding = {
  id: SecurityRuleId;
  severity: "high" | "medium";
  message: string;
  file: string;
};

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".sh",
  ".zsh",
  ".bash",
  ".js",
  ".ts",
  ".json",
  ".yaml",
  ".yml",
  ".toml"
]);

type SecurityRule = {
  id: SecurityRuleId;
  regex: RegExp;
  severity: "high" | "medium";
  message: string;
};

const RISK_PATTERNS: SecurityRule[] = [
  {
    id: "remote-shell-curl-pipe",
    regex: /\bcurl\b[^\n|]*\|\s*(bash|sh)\b/i,
    severity: "high",
    message: "Potential remote shell execution via curl pipe"
  },
  {
    id: "remote-shell-wget-pipe",
    regex: /\bwget\b[^\n|]*\|\s*(bash|sh)\b/i,
    severity: "high",
    message: "Potential remote shell execution via wget pipe"
  },
  { id: "privileged-command-sudo", regex: /\bsudo\b/i, severity: "high", message: "Privileged command usage detected" },
  { id: "insecure-chmod-777", regex: /\bchmod\s+777\b/i, severity: "medium", message: "Overly permissive chmod detected" },
  {
    id: "unpinned-npx-package",
    regex: /\bnpx\s+(?!\S+@[0-9])(?:--[A-Za-z-]+\s+)*(?:@?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?)(?:\s|$)/i,
    severity: "medium",
    message: "Unpinned npx package detected"
  },
  {
    id: "secret-exfiltration-ssh-cat",
    regex: /\bcat\s+~\/\.ssh\b/i,
    severity: "high",
    message: "Potential secret exfiltration pattern detected"
  },
  { id: "env-dump-printenv", regex: /\bprintenv\b/i, severity: "medium", message: "Environment variable dump detected" }
];

export const SECURITY_RULE_IDS: SecurityRuleId[] = RISK_PATTERNS.map((rule) => rule.id);

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
  return output.sort((a, b) => a.localeCompare(b));
}

export function scanSkillDir(path: string): { ok: boolean; findings: SecurityFinding[] } {
  const findings: SecurityFinding[] = [];
  for (const filePath of walkFiles(path)) {
    const extension = extname(filePath).toLowerCase();
    const baseName = filePath.split("/").pop() ?? "";
    if (baseName !== "SKILL.md" && !TEXT_EXTENSIONS.has(extension)) continue;

    const raw = readFileSync(filePath, "utf8");
    for (const risk of RISK_PATTERNS) {
      if (risk.regex.test(raw)) {
        findings.push({
          id: risk.id,
          severity: risk.severity,
          message: risk.message,
          file: relative(path, filePath) || filePath
        });
      }
    }
  }

  const ok = findings.length === 0;
  return { ok, findings };
}
