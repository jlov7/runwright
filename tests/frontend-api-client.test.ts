import { describe, expect, it, vi } from "vitest";

import { createRuntimeApiClient } from "../apps/web/src/shared/api-client";

describe("frontend runtime api client", () => {
  it("sends typed signup requests and returns payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { id: "p1", handle: "pilot", locale: "en-US", createdAt: "now", accessibility: { preset: "default", textScale: 1, reducedMotion: false, highContrast: false, remapProfile: "default" } } })
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createRuntimeApiClient("http://localhost:7777");
    const result = await client.signup({ handle: "pilot", locale: "en-US" });

    expect(result.profile.handle).toBe("pilot");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:7777/v1/auth/signup",
      expect.objectContaining({ method: "POST" })
    );
    vi.unstubAllGlobals();
  });

  it("throws normalized message on non-ok responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: "invalid", message: "Invalid request" } })
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createRuntimeApiClient();
    await expect(client.getOnboarding("missing")).rejects.toThrow("Invalid request");
    vi.unstubAllGlobals();
  });
});
