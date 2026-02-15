import { describe, expect, it } from "vitest";
import { mergePolicyRules, parsePolicyRulePack } from "../src/policy/rule-pack.js";

describe("policy rule packs", () => {
  it("parses rule pack documents and validates required fields", () => {
    const parsed = parsePolicyRulePack({
      schemaVersion: "1.0",
      rules: [
        {
          id: "deny-expired",
          when: { hasExpiredAllowlist: true },
          action: "deny",
          message: "Expired allowlist entries are denied."
        }
      ]
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe("deny-expired");
    expect(parsed[0]?.action).toBe("deny");
  });

  it("merges manifest + pack rules with pack precedence by id", () => {
    const merged = mergePolicyRules(
      [
        {
          id: "warn-expired",
          when: { hasExpiredAllowlist: true },
          action: "warn",
          message: "warn"
        }
      ],
      [
        {
          id: "warn-expired",
          when: { hasExpiredAllowlist: true },
          action: "deny",
          message: "deny"
        },
        {
          id: "deny-untrusted",
          when: { hasUntrustedSources: true },
          action: "deny",
          message: "deny untrusted"
        }
      ]
    );

    expect(merged.map((rule) => rule.id)).toEqual(["deny-untrusted", "warn-expired"]);
    expect(merged.find((rule) => rule.id === "warn-expired")?.action).toBe("deny");
  });

  it("rejects malformed rule pack predicates", () => {
    expect(() =>
      parsePolicyRulePack({
        schemaVersion: "1.0",
        rules: [{ id: "bad", when: { minHighFindings: -1 }, action: "warn", message: "bad" }]
      })
    ).toThrow(/non-negative integer/i);
  });
});
