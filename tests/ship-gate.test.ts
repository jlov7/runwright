import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHIP_GATE_STAGES,
  runShipGate,
  selectShipGateStages,
  type ShipGateRunner
} from "../src/quality/ship-gate.js";

describe("ship gate selection", () => {
  it("filters stages with --only", () => {
    const selected = selectShipGateStages(DEFAULT_SHIP_GATE_STAGES, {
      only: ["verify", "audit"]
    });
    expect(selected.map((stage) => stage.id)).toEqual(["verify", "audit"]);
  });

  it("filters stages with --skip", () => {
    const selected = selectShipGateStages(DEFAULT_SHIP_GATE_STAGES, {
      skip: ["release-verify-local", "sbom"]
    });
    expect(selected.some((stage) => stage.id === "release-verify-local")).toBe(false);
    expect(selected.some((stage) => stage.id === "sbom")).toBe(false);
  });

  it("rejects unknown stage identifiers", () => {
    expect(() =>
      selectShipGateStages(DEFAULT_SHIP_GATE_STAGES, {
        only: ["not-real-stage"]
      })
    ).toThrow(/Unknown ship-gate stage/);
  });
});

describe("ship gate runner", () => {
  it("runs all stages and succeeds when all commands return zero", () => {
    const runner: ShipGateRunner = () => ({ status: 0, stdout: "ok", stderr: "" });
    const summary = runShipGate({
      cwd: "/tmp/project",
      stages: DEFAULT_SHIP_GATE_STAGES.slice(0, 3),
      runCommand: runner
    });

    expect(summary.overall.ok).toBe(true);
    expect(summary.overall.total).toBe(3);
    expect(summary.overall.failed).toBe(0);
    expect(summary.stages.every((stage) => stage.ok)).toBe(true);
  });

  it("continues through all stages and fails when any command fails", () => {
    const statuses = [0, 2, 0];
    let callIndex = 0;
    const runner: ShipGateRunner = () => {
      const status = statuses[callIndex] ?? 1;
      callIndex += 1;
      return { status, stdout: `status=${status}`, stderr: status === 0 ? "" : "failed" };
    };

    const summary = runShipGate({
      cwd: "/tmp/project",
      stages: DEFAULT_SHIP_GATE_STAGES.slice(0, 3),
      runCommand: runner
    });

    expect(callIndex).toBe(3);
    expect(summary.overall.ok).toBe(false);
    expect(summary.overall.failed).toBe(1);
    expect(summary.stages[1]?.status).toBe(2);
    expect(summary.stages[2]?.ok).toBe(true);
  });
});
