import { describe, expect, it } from "vitest";

import { createRuntimeState } from "../apps/web/state-store.js";

describe("frontend runtime state store", () => {
  it("builds deterministic defaults with isolated nested objects", () => {
    const first = createRuntimeState();
    const second = createRuntimeState();

    expect(first.activeSurface).toBe("dashboard");
    expect(first.experienceMode).toBe("setup");
    expect(first.helpPanelOpen).toBe(false);
    expect(first.progress).toEqual({
      tutorial: false,
      saved: false,
      published: false,
      campaignStarted: false
    });
    expect(first.progress).not.toBe(second.progress);
    expect(first.accessibility).not.toBe(second.accessibility);
    expect(first.retryQueue).toEqual([]);
    expect(first.socialInvites).toEqual([]);
  });
});
