# Next-Level Feature Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver all three next-level tracks in one coordinated push: trusted remote source verification, policy-as-code with explain output, and safe auto-remediation with rollback.

**Architecture:** Extend existing manifest -> resolver -> store -> CLI flow instead of replacing it. Add trust and policy layers as composable modules (`src/trust/*`, `src/policy/*`) and keep `runwright fix` as an orchestration layer over existing scan/policy primitives. Preserve deterministic behavior by anchoring all decisions in lockfile metadata and explicit operation plans.

**Tech Stack:** TypeScript (ESM), Node.js `crypto/fs/path`, zod schemas, Vitest integration + contract tests, existing CLI parser/renderer in `src/cli.ts`.

---

## Delivery Rules

- Follow `@test-driven-development` for every behavior change.
- Run targeted tests per task, then run full `pnpm verify` at end of each workstream.
- Keep commits scoped to one task each (conventional commits).
- Keep backwards compatibility for existing manifest/lockfile v1 fixtures unless a migration test is explicitly updated.

## Scope / Non-Goals

- In scope: remote trust verification, explainable policy evaluation, fix planning/apply rollback safety, docs and evidence updates.
- Out of scope: UI app, hosted policy service, non-ed25519 signature algorithms, auto-fixing arbitrary custom scripts.

## Task Order

1. Workstream A foundation and verification path.
2. Workstream B policy engine and explain UX.
3. Workstream C fix planner/apply rollback.
4. Final quality/evidence convergence.

---

### Task 1: Manifest Trust Schema

**Files:**
- Modify: `src/manifest.ts`
- Test: `tests/manifest.test.ts`
- Test: `tests/cli.integration.test.ts`

**Step 1: Write the failing tests**

```ts
it("parses defaults.trust with required signature policies", () => {
  const manifest = parseManifest(
    `version: 1
defaults:
  trust:
    mode: required
    keys:
      - id: release-key
        algorithm: ed25519
        publicKey: "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----"
    rules:
      - source: acme/repo
        requiredSignatures: 1
        keyIds: [release-key]
skillsets:
  base:
    skills:
      - source: acme/repo
apply:
  useSkillsets: [base]
`,
    { filename: "runwright.yml" }
  );
  expect(manifest.defaults?.trust?.mode).toBe("required");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/manifest.test.ts -t "defaults.trust"`
Expected: FAIL with unknown key or validation errors for `defaults.trust`.

**Step 3: Write minimal implementation**

- Add `defaults.trust` schema with:
  - `mode`: `off | optional | required`
  - `keys[]`: `{ id, algorithm: "ed25519", publicKey }`
  - `rules[]`: `{ source, requiredSignatures, keyIds[] }`
- Validate rule key references exist in declared keys.
- Keep old manifests valid with trust omitted.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/manifest.test.ts tests/cli.integration.test.ts`
Expected: PASS for trust parsing; no regressions in existing manifest tests.

**Step 5: Commit**

```bash
git add src/manifest.ts tests/manifest.test.ts tests/cli.integration.test.ts
git commit -m "feat(manifest): add trust policy schema for signed sources"
```

---

### Task 2: Lockfile v2 Trust Metadata

**Files:**
- Modify: `src/lockfile.ts`
- Test: `tests/lockfile.test.ts`
- Test: `tests/migration-compatibility.test.ts`
- Test fixtures: `tests/fixtures/compat/matrix/lockfile/*`

**Step 1: Write the failing tests**

```ts
it("serializes lockfile v2 with integrity and trust metadata", () => {
  const lock = buildLockfileFromSources(
    [
      {
        source: "acme/repo",
        type: "github",
        resolvedRef: "commit",
        resolvedValue: "abc123",
        skills: [{ name: "safe", digest: "sha256:" + "a".repeat(64), path: "/tmp/safe" }],
        integrity: {
          transportDigest: "sha256:" + "b".repeat(64),
          signature: { keyId: "release-key", algorithm: "ed25519", signature: "base64sig==" },
          verifiedAt: "2026-02-15T00:00:00.000Z",
          trusted: true
        }
      }
    ],
    "2026-02-15T00:00:00.000Z"
  );
  expect(lock.version).toBe(2);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lockfile.test.ts -t "lockfile v2"`
Expected: FAIL because `version: 2` and integrity fields are unsupported.

**Step 3: Write minimal implementation**

- Introduce lockfile schema `version: 2` while preserving read support for `version: 1`.
- Add per-source metadata:
  - `integrity.transportDigest`
  - `integrity.signature.{keyId,algorithm,signature}`
  - `integrity.verifiedAt`
  - `integrity.trusted`
- Ensure canonical sorting still deterministic.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/lockfile.test.ts tests/migration-compatibility.test.ts`
Expected: PASS including v1 compatibility fixtures.

**Step 5: Commit**

```bash
git add src/lockfile.ts tests/lockfile.test.ts tests/migration-compatibility.test.ts tests/fixtures/compat/matrix/lockfile
git commit -m "feat(lockfile): add v2 integrity and trust metadata with v1 compatibility"
```

---

### Task 3: Signature Verification Module

**Files:**
- Create: `src/trust/signature.ts`
- Create: `tests/trust-signature.test.ts`

**Step 1: Write the failing tests**

```ts
it("verifies ed25519 signatures for source digests", () => {
  const result = verifySourceSignature({
    digest: "sha256:" + "c".repeat(64),
    signature: validSignature,
    publicKeyPem,
    algorithm: "ed25519"
  });
  expect(result.ok).toBe(true);
});

it("rejects tampered digests", () => {
  const result = verifySourceSignature({
    digest: "sha256:" + "d".repeat(64),
    signature: validSignature,
    publicKeyPem,
    algorithm: "ed25519"
  });
  expect(result.ok).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/trust-signature.test.ts`
Expected: FAIL with missing module `src/trust/signature.ts`.

**Step 3: Write minimal implementation**

- Implement `verifySourceSignature` using Node `crypto.verify`.
- Return structured result:
  - `{ ok: true, keyId, algorithm }`
  - `{ ok: false, reason }`
- Normalize digest input to exact byte sequence used during signing.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/trust-signature.test.ts`
Expected: PASS for valid, tampered, unsupported-algorithm, malformed-key cases.

**Step 5: Commit**

```bash
git add src/trust/signature.ts tests/trust-signature.test.ts
git commit -m "feat(trust): add ed25519 signature verification primitive"
```

---

### Task 4: Resolver Trust Enforcement and Cache Semantics

**Files:**
- Modify: `src/resolver.ts`
- Modify: `src/store.ts`
- Test: `tests/resolver.test.ts`
- Test: `tests/source-provider.contract.test.ts`

**Step 1: Write the failing tests**

```ts
it("fails remote resolution when trust mode is required and signature is missing", () => {
  expect(() =>
    resolveSkillUnits(manifestWithRequiredTrust, projectDir, { remoteResolver: resolverWithoutSignature })
  ).toThrow(/signature/i);
});

it("uses cached verified resolution when ttl not expired", () => {
  const first = resolveSkillUnits(manifest, projectDir, { remoteResolver, remoteCacheTtlSeconds: 3600 });
  const second = resolveSkillUnits(manifest, projectDir, { remoteResolver, remoteCacheTtlSeconds: 3600 });
  expect(second.sourceMetadata["acme/repo"]?.resolvedValue).toBe(first.sourceMetadata["acme/repo"]?.resolvedValue);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/resolver.test.ts tests/source-provider.contract.test.ts`
Expected: FAIL for missing trust metadata and enforcement.

**Step 3: Write minimal implementation**

- Extend remote resolution payload to include optional signature envelope + transport digest.
- Enforce trust mode:
  - `off`: no verification required
  - `optional`: attempt verify and record trusted/untrusted
  - `required`: fail if verification cannot succeed
- Persist trust metadata in cache entries.
- Propagate trust metadata into `ResolvedSourceForLockfile`.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/resolver.test.ts tests/source-provider.contract.test.ts`
Expected: PASS including cache ttl + refresh behavior.

**Step 5: Commit**

```bash
git add src/resolver.ts src/store.ts tests/resolver.test.ts tests/source-provider.contract.test.ts
git commit -m "feat(resolver): enforce trust modes and cache verified source metadata"
```

---

### Task 5: CLI Trust UX and Command Surface

**Files:**
- Modify: `src/cli.ts`
- Test: `tests/cli.integration.test.ts`
- Test: `tests/help-ux.test.ts`
- Test: `tests/error-guidance-ux.test.ts`

**Step 1: Write the failing tests**

```ts
it("shows trusted/untrusted summary in update --json output", () => {
  const result = runCli(["update", "--json"], projectDir);
  const payload = JSON.parse(result.stdout);
  expect(payload.trust.summary.requiredSources).toBeGreaterThanOrEqual(0);
  expect(payload.trust.summary.verifiedSources).toBeGreaterThanOrEqual(0);
});

it("prints actionable trust failure guidance in text mode", () => {
  const result = runCli(["apply", "--target", "codex"], projectDirWithBadSignature);
  expect(result.status).toBe(11);
  expect(result.stdout).toContain("Trust Verification Failed");
  expect(result.stdout).toContain("check trust keys");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/cli.integration.test.ts tests/help-ux.test.ts tests/error-guidance-ux.test.ts`
Expected: FAIL because trust summary/rendering is not implemented.

**Step 3: Write minimal implementation**

- Add trust summaries to `update`, `scan`, and `apply` JSON outputs.
- Add text-mode sections:
  - Trust Verification Passed
  - Trust Verification Failed
- Ensure help output documents trust behavior and next steps.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/cli.integration.test.ts tests/help-ux.test.ts tests/error-guidance-ux.test.ts`
Expected: PASS with explicit trust guidance copy.

**Step 5: Commit**

```bash
git add src/cli.ts tests/cli.integration.test.ts tests/help-ux.test.ts tests/error-guidance-ux.test.ts
git commit -m "feat(cli): surface trust verification outcomes and guidance"
```

---

### Task 6: Workstream A Full Regression Pass

**Files:**
- Modify: `tests/compatibility-replay.test.ts`
- Modify: `tests/json-contract-schema.test.ts`
- Modify: `tests/release-consumer-verification.test.ts`
- Optional fixtures: `tests/fixtures/compat/**`

**Step 1: Write failing contract tests for new trust fields**

```ts
expect(output).toMatchObject({
  trust: {
    summary: expect.objectContaining({
      verifiedSources: expect.any(Number)
    })
  }
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/compatibility-replay.test.ts tests/json-contract-schema.test.ts tests/release-consumer-verification.test.ts`
Expected: FAIL on schema/contract mismatch.

**Step 3: Update fixtures and schema expectations**

- Update expected JSON contracts and replay fixtures.
- Keep previous fields intact; append trust fields without destructive rename.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/compatibility-replay.test.ts tests/json-contract-schema.test.ts tests/release-consumer-verification.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/compatibility-replay.test.ts tests/json-contract-schema.test.ts tests/release-consumer-verification.test.ts tests/fixtures
git commit -m "test(contracts): cover trust metadata in compatibility and consumer schemas"
```

---

### Task 7: Policy Rule Schema and Parser

**Files:**
- Create: `src/policy/schema.ts`
- Modify: `src/manifest.ts`
- Create: `tests/policy-schema.test.ts`
- Modify: `tests/manifest.test.ts`

**Step 1: Write failing tests**

```ts
it("parses policy rules with deny/warn actions", () => {
  const manifest = parseManifest(policyManifestYaml, { filename: "runwright.yml" });
  expect(manifest.defaults?.policy?.rules).toHaveLength(2);
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/policy-schema.test.ts tests/manifest.test.ts`
Expected: FAIL because `defaults.policy` is unknown.

**Step 3: Write minimal implementation**

- Add `defaults.policy.rules[]` schema:
  - `id`, `description`, `when`, `action: allow|warn|deny`, `message`
- Keep `when` constrained to supported predicates (no arbitrary code execution).

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/policy-schema.test.ts tests/manifest.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/policy/schema.ts src/manifest.ts tests/policy-schema.test.ts tests/manifest.test.ts
git commit -m "feat(policy): add typed policy rule schema in manifest defaults"
```

---

### Task 8: Policy Engine Evaluation Core

**Files:**
- Create: `src/policy/engine.ts`
- Create: `src/policy/types.ts`
- Create: `tests/policy-engine.test.ts`

**Step 1: Write failing tests**

```ts
it("returns deny outcome when required trust is false", () => {
  const result = evaluatePolicies(rules, contextWithUntrustedSource);
  expect(result.outcomes.some((o) => o.action === "deny")).toBe(true);
});

it("records explain trace per evaluated rule", () => {
  const result = evaluatePolicies(rules, context);
  expect(result.trace[0]).toEqual(
    expect.objectContaining({ ruleId: expect.any(String), matched: expect.any(Boolean) })
  );
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/policy-engine.test.ts`
Expected: FAIL because policy engine modules do not exist.

**Step 3: Write minimal implementation**

- Compile rule predicates into safe evaluators against structured context.
- Return:
  - `outcomes[]` with action + message + severity
  - `summary` counters
  - `trace[]` explain entries
- Enforce deterministic rule ordering by rule ID.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/policy-engine.test.ts`
Expected: PASS for allow/warn/deny precedence and trace output.

**Step 5: Commit**

```bash
git add src/policy/engine.ts src/policy/types.ts tests/policy-engine.test.ts
git commit -m "feat(policy): implement deterministic policy evaluation engine with trace"
```

---

### Task 9: `runwright policy check --explain`

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/quality/evidence.ts`
- Test: `tests/cli.integration.test.ts`
- Test: `tests/error-guidance-ux.test.ts`

**Step 1: Write failing tests**

```ts
it("policy check --explain prints rule-by-rule decisions", () => {
  const result = runCli(["policy", "check", "--explain"], projectDir);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Policy Decision Trace");
  expect(result.stdout).toContain("ruleId");
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/cli.integration.test.ts tests/error-guidance-ux.test.ts`
Expected: FAIL because `--explain` flag is unsupported.

**Step 3: Write minimal implementation**

- Add `--explain` parsing to `policy check`.
- Render explain trace in text and JSON payloads.
- Return non-zero status on `deny` outcomes with actionable next steps.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/cli.integration.test.ts tests/error-guidance-ux.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/cli.ts src/quality/evidence.ts tests/cli.integration.test.ts tests/error-guidance-ux.test.ts
git commit -m "feat(policy): add explain mode and deny-aware status handling"
```

---

### Task 10: Policy Decision Artifact + CI Contract

**Files:**
- Modify: `scripts/doctor.ts`
- Modify: `scripts/verify_quality_evidence.ts`
- Test: `tests/doctor-script.test.ts`
- Test: `tests/quality-evidence-script.test.ts`

**Step 1: Write failing tests**

```ts
it("doctor output includes policy explain artifact status", async () => {
  const result = await runDoctor();
  expect(result.checks.find((c) => c.id === "policy:explain")).toBeDefined();
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/doctor-script.test.ts tests/quality-evidence-script.test.ts`
Expected: FAIL due to missing policy explain check.

**Step 3: Write minimal implementation**

- Add doctor check for policy explain output generation.
- Extend evidence verifier schema to require/validate policy decision artifact when policy rules are configured.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/doctor-script.test.ts tests/quality-evidence-script.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/doctor.ts scripts/verify_quality_evidence.ts tests/doctor-script.test.ts tests/quality-evidence-script.test.ts
git commit -m "feat(evidence): add policy explain artifact checks to doctor pipeline"
```

---

### Task 11: Fix Planner Domain Model

**Files:**
- Create: `src/fix/types.ts`
- Create: `src/fix/planner.ts`
- Create: `tests/fix-planner.test.ts`

**Step 1: Write failing tests**

```ts
it("builds fix plan actions from security findings and policy denies", () => {
  const plan = buildFixPlan({ findings, policyOutcomes, lockStatus });
  expect(plan.actions.length).toBeGreaterThan(0);
  expect(plan.riskLevel).toMatch(/low|medium|high/);
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/fix-planner.test.ts`
Expected: FAIL because fix planner modules do not exist.

**Step 3: Write minimal implementation**

- Define action model:
  - `update_lockfile`
  - `rewrite_manifest_policy`
  - `remove_blocked_skill`
  - `require_manual_review`
- Include `preconditions`, `expectedImpact`, `reversible`.
- Ensure deterministic ordering by action type + target path.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/fix-planner.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/fix/types.ts src/fix/planner.ts tests/fix-planner.test.ts
git commit -m "feat(fix): add deterministic remediation plan model"
```

---

### Task 12: Fix Plan Rendering and Preview UX

**Files:**
- Modify: `src/cli.ts`
- Create: `src/fix/render.ts`
- Test: `tests/cli.integration.test.ts`
- Test: `tests/help-ux.test.ts`

**Step 1: Write failing tests**

```ts
it("runwright fix --plan --json returns operations and diff previews", () => {
  const result = runCli(["fix", "--plan", "--json"], projectDir);
  const payload = JSON.parse(result.stdout);
  expect(payload.plan.actions[0]).toEqual(
    expect.objectContaining({ type: expect.any(String), target: expect.any(String), reversible: expect.any(Boolean) })
  );
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/cli.integration.test.ts tests/help-ux.test.ts`
Expected: FAIL because `fix` command is not available.

**Step 3: Write minimal implementation**

- Add `fix` command and `--plan` mode.
- Add text and JSON renderers for plan preview, including risk and manual-review actions.
- Add help docs for `runwright fix`.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/cli.integration.test.ts tests/help-ux.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/cli.ts src/fix/render.ts tests/cli.integration.test.ts tests/help-ux.test.ts
git commit -m "feat(cli): add runwright fix plan preview UX"
```

---

### Task 13: Transactional Apply + Rollback Engine

**Files:**
- Create: `src/fix/apply.ts`
- Modify: `src/cli.ts`
- Test: `tests/fix-integration.test.ts`
- Test: `tests/error-guidance-ux.test.ts`

**Step 1: Write failing tests**

```ts
it("rolls back all modified files when fix apply fails mid-flight", () => {
  const result = runCli(["fix", "--apply"], projectDirWithInjectedFailure);
  expect(result.status).toBe(11);
  expect(readFileSync(manifestPath, "utf8")).toBe(originalManifest);
  expect(result.stdout).toContain("Rollback completed");
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/fix-integration.test.ts tests/error-guidance-ux.test.ts`
Expected: FAIL because transactional apply/rollback is missing.

**Step 3: Write minimal implementation**

- Snapshot touched files before apply into `.skillbase/backups/<timestamp>/`.
- Apply operations in deterministic order.
- On first failure:
  - restore backups
  - emit rollback report
  - return failure exit code + guidance.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/fix-integration.test.ts tests/error-guidance-ux.test.ts`
Expected: PASS for both success and rollback paths.

**Step 5: Commit**

```bash
git add src/fix/apply.ts src/cli.ts tests/fix-integration.test.ts tests/error-guidance-ux.test.ts
git commit -m "feat(fix): add transactional apply engine with rollback safety"
```

---

### Task 14: Idempotency and Safety Rails for `fix`

**Files:**
- Modify: `src/fix/planner.ts`
- Modify: `src/fix/apply.ts`
- Test: `tests/fix-planner.test.ts`
- Test: `tests/cli.integration.test.ts`

**Step 1: Write failing tests**

```ts
it("returns no-op plan when project already compliant", () => {
  const result = runCli(["fix", "--plan", "--json"], cleanProjectDir);
  const payload = JSON.parse(result.stdout);
  expect(payload.plan.actions).toEqual([]);
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm vitest run tests/fix-planner.test.ts tests/cli.integration.test.ts`
Expected: FAIL because no-op/idempotent behavior is incomplete.

**Step 3: Write minimal implementation**

- Detect no-op state and return success with explicit copy.
- Block unsafe operations unless explicitly marked reversible.
- Ensure repeated `fix --apply` on compliant state is stable and non-mutating.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/fix-planner.test.ts tests/cli.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/fix/planner.ts src/fix/apply.ts tests/fix-planner.test.ts tests/cli.integration.test.ts
git commit -m "feat(fix): enforce idempotent no-op and safety rails"
```

---

### Task 15: Documentation for New Operator Flows

**Files:**
- Modify: `README.md`
- Modify: `docs/help/README.md`
- Modify: `CLI_SPEC.md`
- Test: `tests/help-ux.test.ts`

**Step 1: Write failing doc-facing help test**

```ts
it("help output includes trust, policy explain, and fix commands", () => {
  const result = runCli(["help"], projectDir);
  expect(result.stdout).toContain("policy check --explain");
  expect(result.stdout).toContain("runwright fix");
  expect(result.stdout).toContain("trust");
});
```

**Step 2: Run test to verify failure**

Run: `pnpm vitest run tests/help-ux.test.ts`
Expected: FAIL for missing command/help docs.

**Step 3: Update docs**

- Document trust configuration and signature key setup.
- Document policy rule examples and explain interpretation.
- Document `fix --plan` and `fix --apply` safety and rollback behavior.

**Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/help-ux.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add README.md docs/help/README.md CLI_SPEC.md tests/help-ux.test.ts
git commit -m "docs: add trust policy explain and fix command operator guidance"
```

---

### Task 16: Final Verification and Release Evidence

**Files:**
- Modify: `GAPS.md`
- Modify: `RELEASE_CHECKLIST.md`
- Modify: `PLANS.md`
- Modify: `QUESTIONS.md` (only if blocked decisions remain)
- Generated: `reports/doctor/doctor.json`, `reports/quality/*`

**Step 1: Run targeted suites one final time**

Run:
- `pnpm vitest run tests/resolver.test.ts tests/source-provider.contract.test.ts`
- `pnpm vitest run tests/policy-engine.test.ts tests/cli.integration.test.ts`
- `pnpm vitest run tests/fix-planner.test.ts tests/fix-integration.test.ts`

Expected: PASS on all targeted suites.

**Step 2: Run full verification gates**

Run:
- `pnpm verify`
- `pnpm run doctor`
- `pnpm quality:evidence:verify`
- `pnpm ship:gate`

Expected: PASS and refreshed evidence files.

**Step 3: Reconcile release docs**

- Update gap statuses and evidence references.
- Mark completed milestones in `PLANS.md`.
- Log any still-blocked external dependencies in `QUESTIONS.md`.

**Step 4: Validate clean diff for intended scope**

Run: `git status --short`
Expected: only files related to three workstreams and release evidence/docs.

**Step 5: Commit final convergence changes**

```bash
git add GAPS.md RELEASE_CHECKLIST.md PLANS.md QUESTIONS.md reports
git commit -m "chore(release): verify and document triple-feature convergence evidence"
```

---

## Exit Criteria

- Trusted remote sources can be verified and enforced with clear failure UX.
- `runwright policy check --explain` provides deterministic, machine-readable decisions.
- `runwright fix` supports plan preview and transactional apply with rollback.
- Release gates and evidence are refreshed and documented.

## Blockers To Log Immediately

- Missing trusted signature metadata from external registries.
- Product-level conflicts in policy defaults (`warn` vs `deny`) for v1 operators.
- Any rollback scenario that cannot guarantee filesystem restoration.

## Suggested Kickoff Command Set

1. `pnpm vitest run tests/manifest.test.ts tests/lockfile.test.ts`
2. `pnpm vitest run tests/resolver.test.ts tests/cli.integration.test.ts`
3. `pnpm vitest run tests/policy-engine.test.ts tests/fix-planner.test.ts`

