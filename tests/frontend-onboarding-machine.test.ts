import { describe, expect, it } from "vitest";

import {
  initialOnboardingState,
  nextOnboardingAction,
  parseOnboardingState,
  reduceOnboardingState,
  serializeOnboardingState
} from "../apps/web/src/features/onboarding/state-machine";

describe("frontend onboarding state machine", () => {
  it("starts at profile creation with deterministic next action", () => {
    const state = initialOnboardingState();
    expect(state.status).toBe("not-started");
    expect(nextOnboardingAction(state)?.stepId).toBe("profile");
  });

  it("progresses through full first-success path to completed state", () => {
    let state = initialOnboardingState();
    state = reduceOnboardingState(state, { type: "profile-created" });
    state = reduceOnboardingState(state, { type: "tutorial-recorded" });
    state = reduceOnboardingState(state, { type: "progress-saved" });
    state = reduceOnboardingState(state, { type: "level-published" });
    state = reduceOnboardingState(state, { type: "campaign-started" });

    expect(state.status).toBe("completed");
    expect(state.celebration).toBe(true);
    expect(nextOnboardingAction(state)).toBeNull();
  });

  it("supports skip and resume without losing step history", () => {
    let state = initialOnboardingState();
    state = reduceOnboardingState(state, { type: "profile-created" });
    state = reduceOnboardingState(state, { type: "skip-requested" });
    expect(state.status).toBe("skipped");
    state = reduceOnboardingState(state, { type: "resume-requested" });
    expect(state.status).toBe("in-progress");
    expect(state.completed.profile).toBe(true);
  });

  it("records failure diagnostics and recommends recovery action", () => {
    let state = initialOnboardingState();
    state = reduceOnboardingState(state, { type: "profile-created" });
    state = reduceOnboardingState(state, { type: "step-failed", stepId: "save", reason: "sync-conflict" });
    expect(state.status).toBe("blocked");
    expect(state.diagnostics.blockedStep).toBe("save");
    expect(nextOnboardingAction(state)?.stepId).toBe("save");
  });

  it("covers top five failure paths with deterministic blocked-step recovery", () => {
    const failingSteps: Array<"profile" | "tutorial" | "save" | "publish" | "campaign"> = [
      "profile",
      "tutorial",
      "save",
      "publish",
      "campaign"
    ];
    for (const stepId of failingSteps) {
      const blocked = reduceOnboardingState(initialOnboardingState(), {
        type: "step-failed",
        stepId,
        reason: `${stepId}-failed`
      });
      expect(blocked.status).toBe("blocked");
      expect(nextOnboardingAction(blocked)?.stepId).toBe(stepId);
    }
  });

  it("supports bootstrap sample mode for fast first success", () => {
    const state = reduceOnboardingState(initialOnboardingState(), { type: "bootstrap-sample-loaded" });
    expect(state.completed.profile).toBe(true);
    expect(state.completed.tutorial).toBe(true);
    expect(state.completed.save).toBe(true);
    expect(state.status).toBe("in-progress");
    expect(nextOnboardingAction(state)?.stepId).toBe("publish");
  });

  it("serializes and parses persisted checklist state safely", () => {
    const progressed = reduceOnboardingState(initialOnboardingState(), { type: "profile-created" });
    const serialized = serializeOnboardingState(progressed);
    const parsed = parseOnboardingState(serialized);
    expect(parsed.completed.profile).toBe(true);
    expect(parsed.status).toBe("in-progress");
  });
});
