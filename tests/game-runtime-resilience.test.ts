import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createGameRuntimeServer } from "../src/game/runtime.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<{ status: number; payload: T }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  return {
    status: response.status,
    payload: (await response.json()) as T
  };
}

describe("game runtime resilience", () => {
  it("persists onboarding progress across runtime restarts", async () => {
    const projectDir = makeTempDir("runwright-runtime-restart-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");

    const firstRuntime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "restart-salt"
    });

    let profileId = "";
    try {
      const signup = await jsonRequest<{ profile: { id: string } }>(`${firstRuntime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "restart-user", locale: "en-US" })
      });
      profileId = signup.payload.profile.id;
      await jsonRequest(`${firstRuntime.baseUrl}/v1/saves`, {
        method: "POST",
        body: JSON.stringify({
          profileId,
          strategy: "last-write-wins",
          baseVersion: 0,
          payload: { checkpoint: "before-restart" }
        })
      });
    } finally {
      await firstRuntime.close();
    }

    const secondRuntime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "restart-salt"
    });
    try {
      const onboarding = await jsonRequest<{ completionPercent: number }>(
        `${secondRuntime.baseUrl}/v1/onboarding/${profileId}`
      );
      expect(onboarding.status).toBe(200);
      expect(onboarding.payload.completionPercent).toBeGreaterThanOrEqual(50);
    } finally {
      await secondRuntime.close();
    }
  });

  it("keeps telemetry retries idempotent via eventId dedupe", async () => {
    const projectDir = makeTempDir("runwright-runtime-retry-idempotent-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile
    });

    try {
      const signup = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "retry-user", locale: "en-US" })
      });
      const profileId = signup.payload.profile.id;

      const first = await jsonRequest<{ duplicate: boolean }>(`${runtime.baseUrl}/v1/telemetry/events`, {
        method: "POST",
        body: JSON.stringify({
          profileId,
          eventId: "retry-safe-event",
          type: "tutorial.started",
          payload: { source: "resilience-test" }
        })
      });
      const second = await jsonRequest<{ duplicate: boolean }>(`${runtime.baseUrl}/v1/telemetry/events`, {
        method: "POST",
        body: JSON.stringify({
          profileId,
          eventId: "retry-safe-event",
          type: "tutorial.started",
          payload: { source: "resilience-test" }
        })
      });

      expect(first.status).toBe(202);
      expect(first.payload.duplicate).toBe(false);
      expect(second.status).toBe(202);
      expect(second.payload.duplicate).toBe(true);
    } finally {
      await runtime.close();
    }
  });
});
