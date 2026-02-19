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

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<{ status: number; payload: T; headers: Headers }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  return {
    status: response.status,
    payload: (await response.json()) as T,
    headers: response.headers
  };
}

describe("game runtime security hardening", () => {
  it("rejects browser mutating requests without CSRF header", async () => {
    const projectDir = makeTempDir("runwright-runtime-csrf-");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile: join(projectDir, ".skillbase", "runtime-state.json")
    });

    try {
      const blocked = await jsonRequest<{ error: { code: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        headers: {
          origin: runtime.baseUrl
        },
        body: JSON.stringify({ handle: "pilot", locale: "en-US" })
      });
      expect(blocked.status).toBe(403);
      expect(blocked.payload.error.code).toBe("csrf-missing");

      const allowed = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        headers: {
          origin: runtime.baseUrl,
          "x-runwright-csrf": "same-origin"
        },
        body: JSON.stringify({ handle: "pilot-safe", locale: "en-US" })
      });
      expect(allowed.status).toBe(201);
      expect(allowed.payload.profile.id).toMatch(/^P-/);
    } finally {
      await runtime.close();
    }
  });

  it("rejects foreign origins for browser requests", async () => {
    const projectDir = makeTempDir("runwright-runtime-origin-");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile: join(projectDir, ".skillbase", "runtime-state.json")
    });

    try {
      const blocked = await jsonRequest<{ error: { code: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "x-runwright-csrf": "same-origin"
        },
        body: JSON.stringify({ handle: "pilot", locale: "en-US" })
      });
      expect(blocked.status).toBe(403);
      expect(blocked.payload.error.code).toBe("origin-not-allowed");
    } finally {
      await runtime.close();
    }
  });

  it("enforces configured endpoint rate limits", async () => {
    const projectDir = makeTempDir("runwright-runtime-rate-limit-");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile: join(projectDir, ".skillbase", "runtime-state.json"),
      rateLimitConfig: {
        authLogin: { max: 1, windowMs: 60_000 }
      }
    });

    try {
      const signup = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "throttle", locale: "en-US" })
      });
      expect(signup.status).toBe(201);

      const firstLogin = await jsonRequest<{ session: { id: string } }>(`${runtime.baseUrl}/v1/auth/login`, {
        method: "POST",
        body: JSON.stringify({ handle: "throttle", provider: "email", deviceId: "dev-1" })
      });
      expect(firstLogin.status).toBe(201);

      const secondLogin = await jsonRequest<{ error: { code: string; details: { limit: number } } }>(
        `${runtime.baseUrl}/v1/auth/login`,
        {
          method: "POST",
          body: JSON.stringify({ handle: "throttle", provider: "email", deviceId: "dev-1" })
        }
      );
      expect(secondLogin.status).toBe(429);
      expect(secondLogin.payload.error.code).toBe("rate-limit-exceeded");
      expect(secondLogin.payload.error.details.limit).toBe(1);
    } finally {
      await runtime.close();
    }
  });

  it("rejects session/profile mismatches on profile-scoped mutations", async () => {
    const projectDir = makeTempDir("runwright-runtime-session-boundary-");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile: join(projectDir, ".skillbase", "runtime-state.json")
    });

    try {
      const first = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "owner-a", locale: "en-US" })
      });
      const second = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "owner-b", locale: "en-US" })
      });
      const primaryProfileId = first.payload.profile.id;
      const secondaryProfileId = second.payload.profile.id;

      const login = await jsonRequest<{ session: { id: string } }>(`${runtime.baseUrl}/v1/auth/login`, {
        method: "POST",
        body: JSON.stringify({ handle: "owner-a", provider: "email", deviceId: "secure-device" })
      });
      expect(login.status).toBe(201);

      const blocked = await jsonRequest<{ error: { code: string } }>(`${runtime.baseUrl}/v1/auth/link`, {
        method: "POST",
        headers: {
          "x-session-id": login.payload.session.id
        },
        body: JSON.stringify({
          profileId: secondaryProfileId,
          provider: "github",
          externalId: "wrong-owner"
        })
      });
      expect(blocked.status).toBe(403);
      expect(blocked.payload.error.code).toBe("session-profile-mismatch");

      const allowed = await jsonRequest<{ linked: boolean }>(`${runtime.baseUrl}/v1/auth/link`, {
        method: "POST",
        headers: {
          "x-session-id": login.payload.session.id
        },
        body: JSON.stringify({
          profileId: primaryProfileId,
          provider: "github",
          externalId: "owner-a-gh"
        })
      });
      expect(allowed.status).toBe(201);
      expect(allowed.payload.linked).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it("adds baseline defensive response headers", async () => {
    const projectDir = makeTempDir("runwright-runtime-response-headers-");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile: join(projectDir, ".skillbase", "runtime-state.json")
    });

    try {
      const response = await fetch(`${runtime.baseUrl}/v1/health`);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    } finally {
      await runtime.close();
    }
  });
});
