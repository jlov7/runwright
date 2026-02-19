import { describe, expect, it, vi } from "vitest";

import {
  createFrontendStore,
  DEFAULT_FRONTEND_STATE,
  reduceFrontendState
} from "../apps/web/src/app/state-store";

describe("frontend state store", () => {
  it("reduces navigation, error, and completion deterministically", () => {
    const navigated = reduceFrontendState(DEFAULT_FRONTEND_STATE, { type: "navigate", surface: "profile" });
    expect(navigated.activeSurface).toBe("profile");
    const failed = reduceFrontendState(navigated, { type: "set-error", message: "Request failed" });
    expect(failed.asyncState).toBe("error");
    expect(failed.lastError).toBe("Request failed");
    const clamped = reduceFrontendState(failed, { type: "set-completion", completionPercent: 144 });
    expect(clamped.completionPercent).toBe(100);
  });

  it("supports subscribers and unsubscribe semantics", () => {
    const listener = vi.fn();
    const store = createFrontendStore();
    const unsubscribe = store.subscribe(listener);
    store.dispatch({ type: "set-profile", profileId: "p1" });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.dispatch({ type: "set-profile", profileId: "p2" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
