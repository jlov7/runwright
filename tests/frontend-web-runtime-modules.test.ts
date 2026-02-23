import { describe, expect, it } from "vitest";
import { formatActionableErrorMessage } from "../apps/web/feedback.js";
import {
  beginAction,
  completeAction,
  failAction,
  initialInteractionState,
  retryAction
} from "../apps/web/interaction-state.js";

describe("frontend web runtime modules", () => {
  it("formats actionable network and profile errors", () => {
    expect(formatActionableErrorMessage("network-offline")).toContain("offline");
    expect(formatActionableErrorMessage("network-transient-failure")).toContain("Temporary network issue");
    expect(formatActionableErrorMessage("profile mismatch")).toContain("Profile context");
    expect(formatActionableErrorMessage("unknown crash")).toContain("Next:");
  });

  it("tracks interaction phases through loading, retry, success, and error", () => {
    const initial = initialInteractionState();
    const loading = beginAction(initial, "load onboarding");
    expect(loading.phase).toBe("loading");
    expect(loading.attempt).toBe(1);

    const retrying = retryAction(loading);
    expect(retrying.phase).toBe("retrying");
    expect(retrying.attempt).toBe(2);

    const success = completeAction(retrying, "ok");
    expect(success.phase).toBe("success");
    expect(success.message).toBe("ok");

    const failed = failAction(success, "unknown-error", "failed");
    expect(failed.phase).toBe("error");
    expect(failed.errorCode).toBe("unknown-error");
  });
});
