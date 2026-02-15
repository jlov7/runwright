import { describe, expect, it } from "vitest";
import { evaluatePolicyRules } from "../src/policy/engine.js";
import type { ManifestPolicyRule } from "../src/policy/types.js";

describe("policy engine", () => {
  it("evaluates matching rules and produces deterministic trace order", () => {
    const rules: ManifestPolicyRule[] = [
      {
        id: "warn-expired",
        when: { hasExpiredAllowlist: true },
        action: "warn",
        message: "Expired allowlist entries detected."
      },
      {
        id: "deny-untrusted",
        when: { hasUntrustedSources: true },
        action: "deny",
        message: "Untrusted sources are blocked."
      }
    ];

    const result = evaluatePolicyRules(rules, {
      trust: { untrustedSources: 1 },
      scan: { highFindings: 0, mediumFindings: 0 },
      allowlist: { expired: 2, unresolved: 0 }
    });

    expect(result.trace.map((entry) => entry.ruleId)).toEqual(["deny-untrusted", "warn-expired"]);
    expect(result.summary.deny).toBe(1);
    expect(result.summary.warn).toBe(1);
    expect(result.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "deny-untrusted", action: "deny" }),
        expect.objectContaining({ ruleId: "warn-expired", action: "warn" })
      ])
    );
  });

  it("does not emit decisions when predicates do not match", () => {
    const rules: ManifestPolicyRule[] = [
      {
        id: "deny-unresolved",
        when: { hasUnresolvedAllowlist: true, minHighFindings: 1 },
        action: "deny",
        message: "Must clear unresolved allowlist + high findings."
      }
    ];

    const result = evaluatePolicyRules(rules, {
      trust: { untrustedSources: 0 },
      scan: { highFindings: 0, mediumFindings: 0 },
      allowlist: { expired: 0, unresolved: 0 }
    });

    expect(result.decisions).toEqual([]);
    expect(result.summary.deny).toBe(0);
    expect(result.trace[0]?.matched).toBe(false);
  });
});
