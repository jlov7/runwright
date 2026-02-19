import { describe, expect, it } from "vitest";

import {
  beginAction,
  completeAction,
  failAction,
  initialInteractionState,
  retryAction
} from "../apps/web/src/shared/interaction-state";

describe("frontend interaction state model", () => {
  it("moves from idle to loading and success", () => {
    const loading = beginAction(initialInteractionState(), "profile-create");
    expect(loading.phase).toBe("loading");
    const success = completeAction(loading, "Profile created");
    expect(success.phase).toBe("success");
    expect(success.message).toContain("Profile created");
  });

  it("captures retry transitions with deterministic attempt count", () => {
    const loading = beginAction(initialInteractionState(), "save-progress");
    const failed = failAction(loading, "sync-conflict", "Retry save");
    expect(failed.phase).toBe("error");
    expect(failed.attempt).toBe(1);
    const retrying = retryAction(failed);
    expect(retrying.phase).toBe("retrying");
    expect(retrying.attempt).toBe(2);
  });
});
