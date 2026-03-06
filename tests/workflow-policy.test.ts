import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";

type WorkflowDoc = {
  on?: Record<string, unknown> | string[] | string;
  permissions?: Record<string, unknown>;
  concurrency?: Record<string, unknown> | string;
  jobs?: Record<string, Record<string, unknown>>;
};

type WorkflowStep = {
  uses?: string;
  run?: string;
};

function readWorkflow(workflowName: string): WorkflowDoc {
  const workflowPath = join(process.cwd(), ".github", "workflows", workflowName);
  const raw = readFileSync(workflowPath, "utf8");
  const parsed = yaml.load(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid workflow: ${workflowName}`);
  }
  return parsed as WorkflowDoc;
}

function extractSteps(job: Record<string, unknown> | undefined): WorkflowStep[] {
  if (!job) return [];
  const steps = job.steps;
  if (!Array.isArray(steps)) return [];
  return steps.filter((entry): entry is WorkflowStep => Boolean(entry && typeof entry === "object"));
}

function isPinnedUses(uses: string): boolean {
  return /^[^@\s]+@[a-f0-9]{40}$/i.test(uses);
}

function hasPinnedUsesFromRepo(steps: WorkflowStep[], repoPrefix: string): boolean {
  return steps.some((step) => typeof step.uses === "string" && step.uses.startsWith(`${repoPrefix}@`) && isPinnedUses(step.uses));
}

function allUsesArePinned(steps: WorkflowStep[]): boolean {
  return steps.every((step) => (typeof step.uses === "string" ? isPinnedUses(step.uses) : true));
}

function hasRunContaining(steps: WorkflowStep[], expected: string): boolean {
  return steps.some((step) => typeof step.run === "string" && step.run.includes(expected));
}

function hasWorkflowTrigger(workflow: WorkflowDoc, trigger: string): boolean {
  const onField = workflow.on;
  if (typeof onField === "string") return onField === trigger;
  if (Array.isArray(onField)) return onField.includes(trigger);
  if (onField && typeof onField === "object") return trigger in onField;
  return false;
}

describe("workflow policy", () => {
  it("ci workflow uses least-privilege defaults and explicit job timeouts", () => {
    const workflow = readWorkflow("ci.yml");
    expect(workflow.permissions).toBeDefined();
    expect(workflow.permissions?.contents).toBe("read");
    expect(hasWorkflowTrigger(workflow, "push")).toBe(true);
    expect(hasWorkflowTrigger(workflow, "pull_request")).toBe(true);
    expect(hasWorkflowTrigger(workflow, "workflow_dispatch")).toBe(true);
    expect(workflow.concurrency).toBeDefined();
    if (workflow.concurrency && typeof workflow.concurrency === "object" && !Array.isArray(workflow.concurrency)) {
      expect(workflow.concurrency["cancel-in-progress"]).toBe(true);
    }

    const verifyJob = workflow.jobs?.["verify-ubuntu"];
    expect(verifyJob).toBeDefined();
    expect(typeof verifyJob?.["timeout-minutes"]).toBe("number");
    expect((verifyJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((verifyJob?.["timeout-minutes"] as number) <= 30).toBe(true);

    const sarifJob = workflow.jobs?.sarif;
    expect(sarifJob).toBeDefined();
    expect(typeof sarifJob?.["timeout-minutes"]).toBe("number");
    expect((sarifJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((sarifJob?.["timeout-minutes"] as number) <= 30).toBe(true);

    const permissions = sarifJob?.permissions as Record<string, unknown> | undefined;
    expect(permissions?.contents).toBe("read");
    expect(permissions?.["security-events"]).toBe("write");

    const verifySteps = extractSteps(verifyJob);
    expect(hasPinnedUsesFromRepo(verifySteps, "actions/checkout")).toBe(true);
    expect(hasPinnedUsesFromRepo(verifySteps, "actions/setup-node")).toBe(true);
    expect(hasRunContaining(verifySteps, "pnpm install --frozen-lockfile")).toBe(true);
    expect(hasRunContaining(verifySteps, "pnpm audit:deps")).toBe(true);
    expect(hasRunContaining(verifySteps, "pnpm verify")).toBe(true);
    expect(allUsesArePinned(verifySteps)).toBe(true);

    const sarifSteps = extractSteps(sarifJob);
    expect(sarifJob?.needs).toBe("verify-ubuntu");
    expect(hasPinnedUsesFromRepo(sarifSteps, "actions/upload-artifact")).toBe(true);
    expect(hasPinnedUsesFromRepo(sarifSteps, "github/codeql-action/upload-sarif")).toBe(true);
    expect(hasRunContaining(sarifSteps, "scan --format sarif")).toBe(true);
    expect(allUsesArePinned(sarifSteps)).toBe(true);

    const verifyCrossPlatformJob = workflow.jobs?.["verify-cross-platform"];
    expect(verifyCrossPlatformJob).toBeDefined();
    expect(verifyCrossPlatformJob?.needs).toBe("verify-ubuntu");
    expect(typeof verifyCrossPlatformJob?.["timeout-minutes"]).toBe("number");
    expect((verifyCrossPlatformJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((verifyCrossPlatformJob?.["timeout-minutes"] as number) <= 30).toBe(true);
    expect(verifyCrossPlatformJob?.if).toBe("github.event_name != 'pull_request'");

    const verifyCrossPlatformSteps = extractSteps(verifyCrossPlatformJob);
    expect(hasPinnedUsesFromRepo(verifyCrossPlatformSteps, "actions/checkout")).toBe(true);
    expect(hasPinnedUsesFromRepo(verifyCrossPlatformSteps, "actions/setup-node")).toBe(true);
    expect(hasRunContaining(verifyCrossPlatformSteps, "pnpm verify")).toBe(true);
    expect(allUsesArePinned(verifyCrossPlatformSteps)).toBe(true);

    const mutationJob = workflow.jobs?.mutation;
    expect(mutationJob).toBeDefined();
    expect(mutationJob?.needs).toBe("verify-ubuntu");
    expect(typeof mutationJob?.["timeout-minutes"]).toBe("number");
    expect((mutationJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((mutationJob?.["timeout-minutes"] as number) <= 45).toBe(true);

    const mutationSteps = extractSteps(mutationJob);
    expect(hasPinnedUsesFromRepo(mutationSteps, "actions/checkout")).toBe(true);
    expect(hasPinnedUsesFromRepo(mutationSteps, "actions/setup-node")).toBe(true);
    expect(hasPinnedUsesFromRepo(mutationSteps, "actions/upload-artifact")).toBe(true);
    expect(hasRunContaining(mutationSteps, "pnpm test:mutation")).toBe(true);
    expect(allUsesArePinned(mutationSteps)).toBe(true);

    const fuzzJob = workflow.jobs?.["fuzz-differential"];
    expect(fuzzJob).toBeDefined();
    expect(fuzzJob?.needs).toBe("verify-ubuntu");
    expect(typeof fuzzJob?.["timeout-minutes"]).toBe("number");
    expect((fuzzJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((fuzzJob?.["timeout-minutes"] as number) <= 30).toBe(true);

    const fuzzSteps = extractSteps(fuzzJob);
    expect(hasPinnedUsesFromRepo(fuzzSteps, "actions/checkout")).toBe(true);
    expect(hasPinnedUsesFromRepo(fuzzSteps, "actions/setup-node")).toBe(true);
    expect(hasPinnedUsesFromRepo(fuzzSteps, "actions/upload-artifact")).toBe(true);
    expect(hasRunContaining(fuzzSteps, "pnpm test:fuzz-differential")).toBe(true);
    expect(allUsesArePinned(fuzzSteps)).toBe(true);

    const sbomJob = workflow.jobs?.sbom;
    expect(sbomJob).toBeDefined();
    expect(sbomJob?.needs).toBe("verify-ubuntu");
    expect(typeof sbomJob?.["timeout-minutes"]).toBe("number");
    expect((sbomJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((sbomJob?.["timeout-minutes"] as number) <= 30).toBe(true);

    const sbomSteps = extractSteps(sbomJob);
    expect(hasPinnedUsesFromRepo(sbomSteps, "actions/checkout")).toBe(true);
    expect(hasPinnedUsesFromRepo(sbomSteps, "actions/setup-node")).toBe(true);
    expect(hasPinnedUsesFromRepo(sbomSteps, "actions/upload-artifact")).toBe(true);
    expect(hasRunContaining(sbomSteps, "pnpm sbom:generate")).toBe(true);
    expect(allUsesArePinned(sbomSteps)).toBe(true);

    const compatibilityJob = workflow.jobs?.["compatibility-matrix"];
    expect(compatibilityJob).toBeDefined();
    expect(compatibilityJob?.needs).toBe("verify-ubuntu");
    expect(typeof compatibilityJob?.["timeout-minutes"]).toBe("number");
    expect((compatibilityJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((compatibilityJob?.["timeout-minutes"] as number) <= 30).toBe(true);

    const compatibilitySteps = extractSteps(compatibilityJob);
    expect(hasPinnedUsesFromRepo(compatibilitySteps, "actions/checkout")).toBe(true);
    expect(hasPinnedUsesFromRepo(compatibilitySteps, "actions/setup-node")).toBe(true);
    expect(hasRunContaining(compatibilitySteps, "pnpm test:compat-matrix")).toBe(true);
    expect(allUsesArePinned(compatibilitySteps)).toBe(true);

    const performanceTrendJob = workflow.jobs?.["performance-trend"];
    expect(performanceTrendJob).toBeDefined();
    expect(performanceTrendJob?.needs).toBe("verify-ubuntu");
    expect(typeof performanceTrendJob?.["timeout-minutes"]).toBe("number");
    expect((performanceTrendJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((performanceTrendJob?.["timeout-minutes"] as number) <= 45).toBe(true);

    const performanceTrendSteps = extractSteps(performanceTrendJob);
    expect(hasPinnedUsesFromRepo(performanceTrendSteps, "actions/checkout")).toBe(true);
    expect(hasPinnedUsesFromRepo(performanceTrendSteps, "actions/setup-node")).toBe(true);
    expect(hasPinnedUsesFromRepo(performanceTrendSteps, "actions/upload-artifact")).toBe(true);
    expect(hasRunContaining(performanceTrendSteps, "pnpm perf:snapshot")).toBe(true);
    expect(hasRunContaining(performanceTrendSteps, "pnpm perf:trend:check")).toBe(true);
    expect(allUsesArePinned(performanceTrendSteps)).toBe(true);

    const scorecardJob = workflow.jobs?.["quality-scorecard"];
    expect(scorecardJob).toBeDefined();
    expect(scorecardJob?.if).toBe("github.event_name != 'pull_request' && always()");
    expect(typeof scorecardJob?.["timeout-minutes"]).toBe("number");
    expect((scorecardJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((scorecardJob?.["timeout-minutes"] as number) <= 20).toBe(true);

    const scorecardNeeds = scorecardJob?.needs as unknown;
    expect(Array.isArray(scorecardNeeds)).toBe(true);
    expect(scorecardNeeds).toContain("verify-ubuntu");
    expect(scorecardNeeds).toContain("verify-cross-platform");
    expect(scorecardNeeds).toContain("mutation");
    expect(scorecardNeeds).toContain("fuzz-differential");
    expect(scorecardNeeds).toContain("sbom");
    expect(scorecardNeeds).toContain("compatibility-matrix");
    expect(scorecardNeeds).toContain("performance-trend");
    expect(scorecardNeeds).toContain("sarif");

    const scorecardSteps = extractSteps(scorecardJob);
    expect(hasPinnedUsesFromRepo(scorecardSteps, "actions/checkout")).toBe(true);
    expect(hasPinnedUsesFromRepo(scorecardSteps, "actions/setup-node")).toBe(true);
    expect(hasPinnedUsesFromRepo(scorecardSteps, "actions/upload-artifact")).toBe(true);
    expect(hasRunContaining(scorecardSteps, "generate_quality_scorecard.ts")).toBe(true);
    expect(hasRunContaining(scorecardSteps, "verify_quality_evidence.ts")).toBe(true);
    expect(hasRunContaining(scorecardSteps, "--check verify-ubuntu=${{ needs.verify-ubuntu.result }}")).toBe(true);
    expect(hasRunContaining(scorecardSteps, "--check verify-cross-platform=${{ needs.verify-cross-platform.result }}")).toBe(
      true
    );
    expect(hasRunContaining(scorecardSteps, "--check compatibility-matrix=${{ needs.compatibility-matrix.result }}")).toBe(
      true
    );
    expect(hasRunContaining(scorecardSteps, "--check performance-trend=${{ needs.performance-trend.result }}")).toBe(true);
    expect(hasRunContaining(scorecardSteps, "ci-evidence.verify.json")).toBe(true);
    expect(allUsesArePinned(scorecardSteps)).toBe(true);
  });

  it("codeql workflow keeps required security-event permissions and bounded runtime", () => {
    const workflow = readWorkflow("codeql.yml");
    expect(workflow.permissions?.contents).toBe("read");
    expect(workflow.permissions?.["security-events"]).toBe("write");
    expect(hasWorkflowTrigger(workflow, "push")).toBe(true);
    expect(hasWorkflowTrigger(workflow, "pull_request")).toBe(true);
    expect(hasWorkflowTrigger(workflow, "schedule")).toBe(true);
    expect(hasWorkflowTrigger(workflow, "workflow_dispatch")).toBe(true);
    expect(workflow.concurrency).toBeDefined();
    if (workflow.concurrency && typeof workflow.concurrency === "object" && !Array.isArray(workflow.concurrency)) {
      expect(workflow.concurrency["cancel-in-progress"]).toBe(true);
    }

    const analyzeJob = workflow.jobs?.analyze;
    expect(analyzeJob).toBeDefined();
    expect(analyzeJob?.["timeout-minutes"]).toBe(30);

    const analyzeSteps = extractSteps(analyzeJob);
    expect(hasPinnedUsesFromRepo(analyzeSteps, "github/codeql-action/init")).toBe(true);
    expect(hasPinnedUsesFromRepo(analyzeSteps, "github/codeql-action/autobuild")).toBe(true);
    expect(hasPinnedUsesFromRepo(analyzeSteps, "github/codeql-action/analyze")).toBe(true);
    expect(allUsesArePinned(analyzeSteps)).toBe(true);
  });

  it("reliability soak workflow is pinned, least-privilege, and runs ship soak checks", () => {
    const workflow = readWorkflow("reliability-soak.yml");
    expect(workflow.permissions?.contents).toBe("read");
    expect(hasWorkflowTrigger(workflow, "schedule")).toBe(true);
    expect(hasWorkflowTrigger(workflow, "workflow_dispatch")).toBe(true);
    expect(workflow.concurrency).toBeDefined();
    if (workflow.concurrency && typeof workflow.concurrency === "object" && !Array.isArray(workflow.concurrency)) {
      expect(workflow.concurrency["cancel-in-progress"]).toBe(true);
    }

    const soakJob = workflow.jobs?.["soak-ship-gate"];
    expect(soakJob).toBeDefined();
    expect(typeof soakJob?.["timeout-minutes"]).toBe("number");
    expect((soakJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((soakJob?.["timeout-minutes"] as number) <= 120).toBe(true);

    const soakSteps = extractSteps(soakJob);
    expect(hasPinnedUsesFromRepo(soakSteps, "actions/checkout")).toBe(true);
    expect(hasPinnedUsesFromRepo(soakSteps, "actions/setup-node")).toBe(true);
    expect(hasPinnedUsesFromRepo(soakSteps, "actions/upload-artifact")).toBe(true);
    expect(hasRunContaining(soakSteps, "pnpm install --frozen-lockfile")).toBe(true);
    expect(hasRunContaining(soakSteps, "pnpm ship:soak")).toBe(true);
    expect(hasRunContaining(soakSteps, "--iterations 2")).toBe(true);
    expect(hasRunContaining(soakSteps, "--only verify")).toBe(true);
    expect(allUsesArePinned(soakSteps)).toBe(true);
  });

  it("release verification workflow enforces signed artifact verification with pinned actions", () => {
    const workflow = readWorkflow("release-verify.yml");
    expect(workflow.permissions?.contents).toBe("read");
    expect(workflow.permissions?.["id-token"]).toBe("write");
    expect(workflow.permissions?.attestations).toBe("write");
    expect(workflow.concurrency).toBeDefined();
    if (workflow.concurrency && typeof workflow.concurrency === "object" && !Array.isArray(workflow.concurrency)) {
      expect(workflow.concurrency["cancel-in-progress"]).toBe(true);
    }

    const releaseJob = workflow.jobs?.["verify-release-artifact"];
    expect(releaseJob).toBeDefined();
    expect(typeof releaseJob?.["timeout-minutes"]).toBe("number");
    expect((releaseJob?.["timeout-minutes"] as number) > 0).toBe(true);
    expect((releaseJob?.["timeout-minutes"] as number) <= 30).toBe(true);

    const releaseSteps = extractSteps(releaseJob);
    expect(hasPinnedUsesFromRepo(releaseSteps, "actions/checkout")).toBe(true);
    expect(hasPinnedUsesFromRepo(releaseSteps, "actions/setup-node")).toBe(true);
    expect(hasPinnedUsesFromRepo(releaseSteps, "actions/upload-artifact")).toBe(true);
    expect(hasPinnedUsesFromRepo(releaseSteps, "actions/attest-build-provenance")).toBe(true);
    expect(hasRunContaining(releaseSteps, "pnpm install --frozen-lockfile")).toBe(true);
    expect(hasRunContaining(releaseSteps, "pnpm verify")).toBe(true);
    expect(hasRunContaining(releaseSteps, "pnpm release:tag:verify")).toBe(true);
    expect(hasRunContaining(releaseSteps, "SKILLBASE_RELEASE_PRIVATE_KEY")).toBe(true);
    expect(hasRunContaining(releaseSteps, "SKILLBASE_RELEASE_PUBLIC_KEY")).toBe(true);
    expect(hasRunContaining(releaseSteps, "printf '%s' \"$SKILLBASE_RELEASE_PRIVATE_KEY\"")).toBe(true);
    expect(hasRunContaining(releaseSteps, "printf '%s' \"$SKILLBASE_RELEASE_PUBLIC_KEY\"")).toBe(true);
    expect(hasRunContaining(releaseSteps, "export --out skillbase-release.zip --sign-private-key")).toBe(true);
    expect(hasRunContaining(releaseSteps, "--deterministic")).toBe(true);
    expect(
      hasRunContaining(releaseSteps, "verify-bundle --bundle skillbase-release.zip --sign-public-key")
    ).toBe(true);
    expect(hasRunContaining(releaseSteps, "shasum -a 256 skillbase-release.zip > SHA256SUMS")).toBe(true);
    expect(hasRunContaining(releaseSteps, "release:attestation:generate")).toBe(true);
    expect(hasRunContaining(releaseSteps, "release:attestation:verify")).toBe(true);
    expect(hasRunContaining(releaseSteps, "gh attestation download skillbase-release.zip")).toBe(true);
    expect(hasRunContaining(releaseSteps, "verify_release_consumer_artifact.sh")).toBe(true);
    expect(hasRunContaining(releaseSteps, "generate_quality_scorecard.ts")).toBe(true);
    expect(hasRunContaining(releaseSteps, "verify_quality_evidence.ts")).toBe(true);
    expect(hasRunContaining(releaseSteps, "release:notes:generate")).toBe(true);
    expect(hasRunContaining(releaseSteps, "release:artifact-manifest:generate")).toBe(true);
    expect(hasRunContaining(releaseSteps, "release:artifact-manifest:verify")).toBe(true);
    expect(hasRunContaining(releaseSteps, "tag-signature.verify.json")).toBe(true);
    expect(hasRunContaining(releaseSteps, "skillbase-release.attestation.json")).toBe(true);
    expect(hasRunContaining(releaseSteps, "skillbase-release.attestation.local.verify.json")).toBe(true);
    expect(hasRunContaining(releaseSteps, "release-artifact-manifest.json")).toBe(true);
    expect(hasRunContaining(releaseSteps, "release-artifact-manifest.verify.json")).toBe(true);
    expect(hasRunContaining(releaseSteps, "release-scorecard.json")).toBe(true);
    expect(hasRunContaining(releaseSteps, "release-scorecard.verify.json")).toBe(true);
    expect(allUsesArePinned(releaseSteps)).toBe(true);
  });
});
