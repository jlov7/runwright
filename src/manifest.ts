import yaml from "js-yaml";
import { z } from "zod";
import { SECURITY_RULE_IDS } from "./scanner/security.js";

const TargetMode = z.enum(["link", "copy", "mirror"]);
const Scope = z.enum(["global", "project"]);
const GitHubSource = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SkillsShSource = /^https:\/\/skills\.sh\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?$/;

function isValidSource(value: string): boolean {
  if (value.startsWith("local:")) return value.slice("local:".length).trim().length > 0;
  if (GitHubSource.test(value)) return true;
  return SkillsShSource.test(value);
}

function isValidSecurityRuleId(value: string): boolean {
  return SECURITY_RULE_IDS.includes(value as (typeof SECURITY_RULE_IDS)[number]);
}

const SeverityOverrideValue = z.enum(["high", "medium"]);
const TrustMode = z.enum(["off", "optional", "required"]);
const TrustAlgorithm = z.enum(["ed25519"]);
const PolicyAction = z.enum(["allow", "warn", "deny"]);

const ScanAllowlistEntrySchema = z
  .object({
    ruleId: z.string().refine(isValidSecurityRuleId, {
      message: `ruleId must be one of: ${SECURITY_RULE_IDS.join(", ")}`
    }),
    source: z.string().min(1).optional(),
    skill: z.string().min(1).optional(),
    expiresAt: z.preprocess(
      (value) => (value instanceof Date ? value.toISOString() : value),
      z
        .string()
        .optional()
        .refine((value) => (value ? !Number.isNaN(Date.parse(value)) : true), {
          message: "expiresAt must be a valid ISO-8601 date-time"
        })
    ),
    reason: z.string().min(1)
  })
  .strict();

const DefaultsSchema = z
  .object({
    mode: TargetMode.optional(),
    scope: Scope.optional(),
    verify: z.boolean().optional(),
    scan: z
      .object({
        lint: z.boolean().optional(),
        security: z.enum(["off", "warn", "fail"]).optional(),
        allowRuleIds: z
          .array(
            z.string().refine(isValidSecurityRuleId, {
              message: `allowRuleIds entries must be valid security rule IDs: ${SECURITY_RULE_IDS.join(", ")}`
            })
          )
          .optional()
          .refine((ruleIds) => (ruleIds ? new Set(ruleIds).size === ruleIds.length : true), {
            message: "allowRuleIds entries must be unique"
          }),
        severityOverrides: z
          .record(SeverityOverrideValue)
          .optional()
          .superRefine((overrides, ctx) => {
            if (!overrides) return;
            for (const ruleId of Object.keys(overrides)) {
              if (!isValidSecurityRuleId(ruleId)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `severityOverrides keys must be valid security rule IDs: ${SECURITY_RULE_IDS.join(", ")}`,
                  path: [ruleId]
                });
              }
            }
          }),
        allowlist: z.array(ScanAllowlistEntrySchema).optional()
      })
      .optional(),
    trust: z
      .object({
        mode: TrustMode.optional(),
        keys: z
          .array(
            z
              .object({
                id: z.string().min(1),
                algorithm: TrustAlgorithm,
                publicKey: z.string().min(1)
              })
              .strict()
          )
          .optional()
          .refine((keys) => (keys ? new Set(keys.map((key) => key.id)).size === keys.length : true), {
            message: "trust keys must have unique ids"
          }),
        rules: z
          .array(
            z
              .object({
                source: z.string().refine(isValidSource, {
                  message: "source must be owner/repo, https://skills.sh/... or local:<path>"
                }),
                requiredSignatures: z.number().int().min(1).optional(),
                keyIds: z
                  .array(z.string().min(1))
                  .optional()
                  .refine((ids) => (ids ? new Set(ids).size === ids.length : true), {
                    message: "keyIds entries must be unique"
                  })
              })
              .strict()
          )
          .optional()
      }),
    policy: z
      .object({
        rules: z
          .array(
            z
              .object({
                id: z.string().min(1),
                description: z.string().min(1).optional(),
                when: z
                  .object({
                    hasUntrustedSources: z.boolean().optional(),
                    minHighFindings: z.number().int().min(0).optional(),
                    minMediumFindings: z.number().int().min(0).optional(),
                    hasExpiredAllowlist: z.boolean().optional(),
                    hasUnresolvedAllowlist: z.boolean().optional()
                  })
                  .strict(),
                action: PolicyAction,
                message: z.string().min(1)
              })
              .strict()
          )
          .optional()
          .refine((rules) => (rules ? new Set(rules.map((rule) => rule.id)).size === rules.length : true), {
            message: "policy rules must have unique ids"
          })
      })
      .optional()
  })
  .partial()
  .strict();

const TargetSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: TargetMode.optional(),
    scope: Scope.optional()
  })
  .partial()
  .strict();

const TargetsSchema = z
  .object({
    codex: TargetSchema.optional(),
    "claude-code": TargetSchema.optional(),
    cursor: TargetSchema.optional()
  })
  .strict();

const SkillRefSchema = z
  .object({
    source: z.string().refine(isValidSource, {
      message: "source must be owner/repo, https://skills.sh/... or local:<path>"
    }),
    pick: z
      .array(z.string().min(1))
      .optional()
      .refine((pick) => (pick ? new Set(pick).size === pick.length : true), {
        message: "pick entries must be unique"
      })
  })
  .strict();

const SkillsetSchema = z
  .object({
    description: z.string().optional(),
    skills: z.array(SkillRefSchema)
  })
  .strict();

const ApplySchema = z
  .object({
    useSkillsets: z
      .array(z.string().min(1))
      .optional()
      .refine((skillsets) => (skillsets ? new Set(skillsets).size === skillsets.length : true), {
        message: "useSkillsets entries must be unique"
      }),
    extraSkills: z.array(SkillRefSchema).optional()
  })
  .partial()
  .strict();

const ManifestSchema = z
  .object({
    version: z.literal(1),
    defaults: DefaultsSchema.optional(),
    targets: TargetsSchema.optional(),
    skillsets: z.record(SkillsetSchema).optional(),
    apply: ApplySchema.optional()
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const configuredSkillsets = new Set(Object.keys(manifest.skillsets ?? {}));
    const requestedSkillsets = manifest.apply?.useSkillsets ?? [];
    for (const skillset of requestedSkillsets) {
      if (!configuredSkillsets.has(skillset)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `apply.useSkillsets references missing skillset '${skillset}'`,
          path: ["apply", "useSkillsets"]
        });
      }
    }

    const configuredTrustKeyIds = new Set((manifest.defaults?.trust?.keys ?? []).map((key) => key.id));
    for (const [ruleIndex, rule] of (manifest.defaults?.trust?.rules ?? []).entries()) {
      if (!rule.keyIds) continue;
      for (const keyId of rule.keyIds) {
        if (!configuredTrustKeyIds.has(keyId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `defaults.trust.rules[${ruleIndex}] references unknown key id '${keyId}'`,
            path: ["defaults", "trust", "rules", ruleIndex, "keyIds"]
          });
        }
      }
    }
  });

export type SkillbaseManifest = z.infer<typeof ManifestSchema>;

export function parseManifest(raw: string, opts: { filename: string }): SkillbaseManifest {
  let data: unknown;
  if (opts.filename.endsWith(".json")) {
    data = JSON.parse(raw);
  } else {
    data = yaml.load(raw);
  }
  const parsed = ManifestSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid manifest (${opts.filename}):\n${msg}`);
  }
  return parsed.data;
}
