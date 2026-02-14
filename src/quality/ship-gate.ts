export type ShipGateStageId =
  | "verify"
  | "mutation"
  | "fuzz-differential"
  | "audit"
  | "sbom"
  | "release-verify-local";

export type ShipGateStage = {
  id: ShipGateStageId;
  command: string;
  args: string[];
};

export type ShipGateStageResult = {
  id: ShipGateStageId;
  command: string;
  args: string[];
  status: number;
  ok: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
};

export type ShipGateSummary = {
  schemaVersion: "1.0";
  generatedAt: string;
  cwd: string;
  overall: {
    ok: boolean;
    succeeded: number;
    failed: number;
    total: number;
    totalDurationMs: number;
  };
  stages: ShipGateStageResult[];
};

export type ShipGateRunner = (command: string, args: string[], cwd: string) => {
  status: number;
  stdout: string;
  stderr: string;
};

const PNPM_COMMAND = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export const DEFAULT_SHIP_GATE_STAGES: ShipGateStage[] = [
  { id: "verify", command: PNPM_COMMAND, args: ["run", "verify"] },
  { id: "mutation", command: PNPM_COMMAND, args: ["run", "test:mutation"] },
  { id: "fuzz-differential", command: PNPM_COMMAND, args: ["run", "test:fuzz-differential"] },
  { id: "audit", command: PNPM_COMMAND, args: ["run", "audit:deps"] },
  { id: "sbom", command: PNPM_COMMAND, args: ["run", "sbom:generate"] },
  { id: "release-verify-local", command: PNPM_COMMAND, args: ["run", "release:verify-local"] }
];

export function selectShipGateStages(
  stages: ShipGateStage[],
  opts: { only?: string[]; skip?: string[] }
): ShipGateStage[] {
  const known = new Set(stages.map((stage) => stage.id));
  const only = (opts.only ?? []).map((value) => value.trim()).filter((value) => value.length > 0);
  const skip = (opts.skip ?? []).map((value) => value.trim()).filter((value) => value.length > 0);

  for (const value of [...only, ...skip]) {
    if (!known.has(value as ShipGateStageId)) {
      throw new Error(`Unknown ship-gate stage '${value}'`);
    }
  }

  let selected = [...stages];
  if (only.length > 0) {
    const onlySet = new Set(only);
    selected = selected.filter((stage) => onlySet.has(stage.id));
  }
  if (skip.length > 0) {
    const skipSet = new Set(skip);
    selected = selected.filter((stage) => !skipSet.has(stage.id));
  }

  return selected;
}

export function runShipGate(params: {
  cwd: string;
  stages: ShipGateStage[];
  runCommand: ShipGateRunner;
}): ShipGateSummary {
  const startedAt = Date.now();
  const results: ShipGateStageResult[] = [];

  for (const stage of params.stages) {
    const stageStarted = Date.now();
    const result = params.runCommand(stage.command, stage.args, params.cwd);
    const durationMs = Date.now() - stageStarted;
    results.push({
      id: stage.id,
      command: stage.command,
      args: stage.args,
      status: result.status,
      ok: result.status === 0,
      durationMs,
      stdout: result.stdout,
      stderr: result.stderr
    });
  }

  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;

  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    cwd: params.cwd,
    overall: {
      ok: failed === 0,
      succeeded,
      failed,
      total: results.length,
      totalDurationMs: Date.now() - startedAt
    },
    stages: results
  };
}
