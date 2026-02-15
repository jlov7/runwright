import type { ManifestPolicyRule, PolicyContext, PolicyEvaluationResult, PolicyTraceEntry } from "./types.js";

function evaluateRule(rule: ManifestPolicyRule, context: PolicyContext): { matched: boolean; reason: string } {
  const checks: Array<{ ok: boolean; description: string }> = [];
  const when = rule.when;

  if (when.hasUntrustedSources !== undefined) {
    checks.push({
      ok: (context.trust.untrustedSources > 0) === when.hasUntrustedSources,
      description: `hasUntrustedSources=${when.hasUntrustedSources}`
    });
  }
  if (when.minHighFindings !== undefined) {
    checks.push({
      ok: context.scan.highFindings >= when.minHighFindings,
      description: `minHighFindings>=${when.minHighFindings}`
    });
  }
  if (when.minMediumFindings !== undefined) {
    checks.push({
      ok: context.scan.mediumFindings >= when.minMediumFindings,
      description: `minMediumFindings>=${when.minMediumFindings}`
    });
  }
  if (when.hasExpiredAllowlist !== undefined) {
    checks.push({
      ok: (context.allowlist.expired > 0) === when.hasExpiredAllowlist,
      description: `hasExpiredAllowlist=${when.hasExpiredAllowlist}`
    });
  }
  if (when.hasUnresolvedAllowlist !== undefined) {
    checks.push({
      ok: (context.allowlist.unresolved > 0) === when.hasUnresolvedAllowlist,
      description: `hasUnresolvedAllowlist=${when.hasUnresolvedAllowlist}`
    });
  }

  if (checks.length === 0) return { matched: false, reason: "no predicates configured" };
  const firstFailure = checks.find((check) => !check.ok);
  if (firstFailure) return { matched: false, reason: `predicate failed: ${firstFailure.description}` };
  return { matched: true, reason: `matched predicates: ${checks.map((check) => check.description).join(", ")}` };
}

export function evaluatePolicyRules(
  rules: ManifestPolicyRule[],
  context: PolicyContext
): PolicyEvaluationResult {
  const sortedRules = [...rules].sort((left, right) => left.id.localeCompare(right.id));
  const trace: PolicyTraceEntry[] = [];
  const decisions: PolicyEvaluationResult["decisions"] = [];

  for (const rule of sortedRules) {
    const result = evaluateRule(rule, context);
    trace.push({
      ruleId: rule.id,
      matched: result.matched,
      action: rule.action,
      reason: result.reason,
      message: rule.message
    });
    if (!result.matched) continue;
    decisions.push({
      ruleId: rule.id,
      action: rule.action,
      message: rule.message
    });
  }

  return {
    decisions,
    trace,
    summary: {
      allow: decisions.filter((decision) => decision.action === "allow").length,
      warn: decisions.filter((decision) => decision.action === "warn").length,
      deny: decisions.filter((decision) => decision.action === "deny").length
    }
  };
}
