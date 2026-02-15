import type { SkillbaseManifest } from "../manifest.js";

export type ManifestPolicyRule = NonNullable<
  NonNullable<NonNullable<SkillbaseManifest["defaults"]>["policy"]>["rules"]
>[number];

export type PolicyContext = {
  trust: {
    untrustedSources: number;
  };
  scan: {
    highFindings: number;
    mediumFindings: number;
  };
  allowlist: {
    expired: number;
    unresolved: number;
  };
};

export type PolicyDecision = {
  ruleId: string;
  action: "allow" | "warn" | "deny";
  message: string;
};

export type PolicyTraceEntry = {
  ruleId: string;
  matched: boolean;
  action: "allow" | "warn" | "deny";
  reason: string;
  message: string;
};

export type PolicyEvaluationResult = {
  decisions: PolicyDecision[];
  trace: PolicyTraceEntry[];
  summary: {
    allow: number;
    warn: number;
    deny: number;
  };
};
