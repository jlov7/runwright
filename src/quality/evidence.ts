import { normalizeResult } from "./scorecard.js";

type UnknownRecord = Record<string, unknown>;

type MutationStatus = "Killed" | "Timeout" | "Survived" | "NoCoverage" | "CompileError";

export type QualityEvidenceInput = {
  scorecard: unknown;
  requiredChecks: string[];
  requireScorecardPass: boolean;
  mutationReport?: unknown;
  minMutationScore?: number;
  sbom?: unknown;
};

export type QualityEvidenceCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export type QualityEvidenceSummary = {
  schemaVersion: "1.0";
  ok: boolean;
  checks: QualityEvidenceCheck[];
  metrics: {
    mutationScore: number | null;
    minMutationScore: number | null;
    sbomComponents: number | null;
  };
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function getMutationStatuses(report: unknown): MutationStatus[] | null {
  const root = asRecord(report);
  if (!root) return null;
  const files = asRecord(root.files);
  if (!files) return null;

  const statuses: MutationStatus[] = [];
  for (const fileEntry of Object.values(files)) {
    const fileRecord = asRecord(fileEntry);
    if (!fileRecord) continue;
    const mutants = fileRecord.mutants;
    if (!Array.isArray(mutants)) continue;
    for (const mutant of mutants) {
      const mutantRecord = asRecord(mutant);
      if (!mutantRecord) continue;
      const status = String(mutantRecord.status ?? "") as MutationStatus;
      if (
        status === "Killed" ||
        status === "Timeout" ||
        status === "Survived" ||
        status === "NoCoverage" ||
        status === "CompileError"
      ) {
        statuses.push(status);
      }
    }
  }

  return statuses.length > 0 ? statuses : null;
}

export function calculateMutationScore(report: unknown): number | null {
  const statuses = getMutationStatuses(report);
  if (!statuses) return null;

  const detected = statuses.filter((status) => status === "Killed" || status === "Timeout").length;
  const undetected = statuses.filter((status) => status === "Survived" || status === "NoCoverage").length;
  const denominator = detected + undetected;
  if (denominator === 0) return null;
  return Number(((detected / denominator) * 100).toFixed(2));
}

function scorecardChecks(scorecard: unknown, requiredChecks: string[], requireScorecardPass: boolean): QualityEvidenceCheck[] {
  const checks: QualityEvidenceCheck[] = [];
  const scorecardRecord = asRecord(scorecard);
  const overall = scorecardRecord ? asRecord(scorecardRecord.overall) : null;

  if (requireScorecardPass) {
    const pass = overall?.pass === true;
    checks.push({
      name: "scorecard.overall.pass",
      ok: pass,
      detail: pass ? "overall pass is true" : "overall pass is not true"
    });
  }

  const scorecardChecksList = Array.isArray(scorecardRecord?.checks) ? scorecardRecord.checks : [];
  for (const required of requiredChecks) {
    const entry = scorecardChecksList
      .map((item) => asRecord(item))
      .find((item) => item?.name === required);

    if (!entry) {
      checks.push({
        name: `scorecard.check.${required}`,
        ok: false,
        detail: "required check is missing"
      });
      continue;
    }

    const result = normalizeResult(String(entry.result ?? "unknown"));
    const ok = result === "success";
    checks.push({
      name: `scorecard.check.${required}`,
      ok,
      detail: ok ? "check result is success" : `check result is ${result}`
    });
  }

  return checks;
}

function sbomCheck(sbom: unknown): { check: QualityEvidenceCheck; components: number | null } {
  const sbomRecord = asRecord(sbom);
  if (!sbomRecord) {
    return {
      check: { name: "sbom.valid", ok: false, detail: "SBOM document is not an object" },
      components: null
    };
  }

  const formatOk = String(sbomRecord.bomFormat ?? "") === "CycloneDX";
  const components = Array.isArray(sbomRecord.components) ? sbomRecord.components.length : 0;
  const componentsOk = components > 0;

  return {
    check: {
      name: "sbom.valid",
      ok: formatOk && componentsOk,
      detail:
        formatOk && componentsOk
          ? `valid CycloneDX SBOM with ${components} components`
          : `invalid SBOM (bomFormat=${String(sbomRecord.bomFormat ?? "unknown")}, components=${components})`
    },
    components: componentsOk ? components : null
  };
}

export function evaluateQualityEvidence(input: QualityEvidenceInput): QualityEvidenceSummary {
  const checks: QualityEvidenceCheck[] = [];
  checks.push(...scorecardChecks(input.scorecard, input.requiredChecks, input.requireScorecardPass));

  let mutationScore: number | null = null;
  const minMutationScore =
    typeof input.minMutationScore === "number" && Number.isFinite(input.minMutationScore)
      ? input.minMutationScore
      : null;

  if (input.mutationReport !== undefined && minMutationScore !== null) {
    mutationScore = calculateMutationScore(input.mutationReport);
    const ok = mutationScore !== null && mutationScore >= minMutationScore;
    checks.push({
      name: "mutation.score",
      ok,
      detail:
        mutationScore === null
          ? "unable to calculate mutation score from report"
          : `mutation score ${mutationScore} (minimum ${minMutationScore})`
    });
  }

  let sbomComponents: number | null = null;
  if (input.sbom !== undefined) {
    const sbomResult = sbomCheck(input.sbom);
    checks.push(sbomResult.check);
    sbomComponents = sbomResult.components;
  }

  const ok = checks.every((check) => check.ok);
  return {
    schemaVersion: "1.0",
    ok,
    checks,
    metrics: {
      mutationScore,
      minMutationScore,
      sbomComponents
    }
  };
}
