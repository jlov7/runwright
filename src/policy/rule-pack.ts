import type { ManifestPolicyRule } from "./types.js";

type PolicyRuleWhenKey =
  | "hasUntrustedSources"
  | "minHighFindings"
  | "minMediumFindings"
  | "hasExpiredAllowlist"
  | "hasUnresolvedAllowlist";

const RULE_WHEN_KEYS: PolicyRuleWhenKey[] = [
  "hasUntrustedSources",
  "minHighFindings",
  "minMediumFindings",
  "hasExpiredAllowlist",
  "hasUnresolvedAllowlist"
];

function assertObject(raw: unknown, message: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(message);
  }
  return raw as Record<string, unknown>;
}

function parseRuleWhen(raw: unknown, index: number): ManifestPolicyRule["when"] {
  const when = assertObject(raw, `Rule ${index} must include a when object`);
  const parsed: ManifestPolicyRule["when"] = {};
  for (const key of RULE_WHEN_KEYS) {
    const value = when[key];
    if (typeof value === "undefined") continue;
    if (key === "minHighFindings" || key === "minMediumFindings") {
      if (!Number.isInteger(value) || Number(value) < 0) {
        throw new Error(`Rule ${index} field '${key}' must be a non-negative integer`);
      }
      parsed[key] = Number(value);
      continue;
    }
    if (typeof value !== "boolean") {
      throw new Error(`Rule ${index} field '${key}' must be boolean`);
    }
    parsed[key] = value;
  }
  if (Object.keys(parsed).length === 0) {
    throw new Error(`Rule ${index} must define at least one supported predicate in when`);
  }
  return parsed;
}

function parseRule(raw: unknown, index: number): ManifestPolicyRule {
  const rule = assertObject(raw, `Rule ${index} must be an object`);
  if (typeof rule.id !== "string" || rule.id.trim().length === 0) {
    throw new Error(`Rule ${index} is missing a non-empty id`);
  }
  if (rule.action !== "allow" && rule.action !== "warn" && rule.action !== "deny") {
    throw new Error(`Rule ${index} has invalid action '${String(rule.action)}'`);
  }
  if (typeof rule.message !== "string" || rule.message.trim().length === 0) {
    throw new Error(`Rule ${index} is missing a non-empty message`);
  }

  return {
    id: rule.id,
    when: parseRuleWhen(rule.when, index),
    action: rule.action,
    message: rule.message
  };
}

export function parsePolicyRulePack(raw: unknown): ManifestPolicyRule[] {
  const root = assertObject(raw, "Policy rule pack must be an object");
  if (typeof root.schemaVersion !== "undefined" && root.schemaVersion !== "1.0") {
    throw new Error(`Unsupported policy rule pack schemaVersion '${String(root.schemaVersion)}'`);
  }
  if (!Array.isArray(root.rules)) {
    throw new Error("Policy rule pack must include a rules array");
  }
  return root.rules.map((entry, index) => parseRule(entry, index));
}

export function mergePolicyRules(
  manifestRules: ManifestPolicyRule[],
  packRules: ManifestPolicyRule[]
): ManifestPolicyRule[] {
  const byId = new Map<string, ManifestPolicyRule>();
  for (const rule of manifestRules) byId.set(rule.id, rule);
  for (const rule of packRules) byId.set(rule.id, rule);
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}
