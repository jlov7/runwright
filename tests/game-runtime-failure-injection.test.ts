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

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    nextAction?: string;
    details?: unknown;
  };
};

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

describe("game runtime failure injection", () => {
  it("returns actionable guidance for top endpoint failures", async () => {
    const projectDir = makeTempDir("runwright-runtime-failures-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "test-salt"
    });

    try {
      const invalidJson = await fetch(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{"
      });
      const invalidJsonPayload = (await invalidJson.json()) as ErrorPayload;
      expect(invalidJson.status).toBe(400);
      expect(invalidJsonPayload.error.code).toBe("invalid-json");
      expect(invalidJsonPayload.error.nextAction).toContain("valid JSON");

      const signup = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "failure-injector", locale: "en-US" })
      });
      expect(signup.status).toBe(201);

      const antiTamper = await jsonRequest<ErrorPayload>(`${runtime.baseUrl}/v1/ranked/submit`, {
        method: "POST",
        body: JSON.stringify({
          profileId: signup.payload.profile.id,
          score: 9000,
          clientDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        })
      });
      expect(antiTamper.status).toBe(422);
      expect(antiTamper.payload.error.code).toBe("anti-tamper-failed");
      expect(antiTamper.payload.error.nextAction).toContain("digest");

      const conflictBaseline = await jsonRequest<{ save: { version: number } }>(`${runtime.baseUrl}/v1/saves`, {
        method: "POST",
        body: JSON.stringify({
          profileId: signup.payload.profile.id,
          strategy: "last-write-wins",
          baseVersion: 0,
          payload: { chapter: 1 }
        })
      });
      expect(conflictBaseline.status).toBe(201);

      const conflict = await jsonRequest<ErrorPayload>(`${runtime.baseUrl}/v1/saves`, {
        method: "POST",
        body: JSON.stringify({
          profileId: signup.payload.profile.id,
          strategy: "manual-merge",
          baseVersion: 0,
          payload: { chapter: 2 }
        })
      });
      expect(conflict.status).toBe(409);
      expect(conflict.payload.error.code).toBe("sync-conflict");
      expect(conflict.payload.error.nextAction).toContain("manual merge");

      const notFound = await jsonRequest<ErrorPayload>(`${runtime.baseUrl}/v1/nope`, {
        method: "GET"
      });
      expect(notFound.status).toBe(404);
      expect(notFound.payload.error.code).toBe("not-found");
      expect(notFound.payload.error.nextAction).toContain("route path");
    } finally {
      await runtime.close();
    }
  });
});
