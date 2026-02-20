import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createGameRuntimeServer, createRankedDigest } from "../src/game/runtime.js";

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

describe("game runtime", () => {
  it("runs onboarding to first-success across profile, tutorial, save, and ranked submission", async () => {
    const projectDir = makeTempDir("runwright-runtime-onboarding-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "test-salt"
    });

    try {
      const signup = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "pilot", locale: "en-US" })
      });
      expect(signup.status).toBe(201);
      const profileId = signup.payload.profile.id;
      expect(profileId.length).toBeGreaterThan(1);

      const before = await jsonRequest<{ completionPercent: number; nextAction: { id: string } | null }>(
        `${runtime.baseUrl}/v1/onboarding/${profileId}`
      );
      expect(before.status).toBe(200);
      expect(before.payload.completionPercent).toBe(25);
      expect(before.payload.nextAction?.id).toBe("tutorial");

      const tutorialEvent = await jsonRequest<{ ok: boolean }>(`${runtime.baseUrl}/v1/telemetry/events`, {
        method: "POST",
        body: JSON.stringify({
          profileId,
          type: "tutorial.started",
          payload: { surface: "onboarding" }
        })
      });
      expect(tutorialEvent.status).toBe(202);
      expect(tutorialEvent.payload.ok).toBe(true);

      const save = await jsonRequest<{ save: { version: number } }>(`${runtime.baseUrl}/v1/saves`, {
        method: "POST",
        body: JSON.stringify({
          profileId,
          strategy: "last-write-wins",
          baseVersion: 0,
          payload: { chapter: 1, checkpoint: "first-run" }
        })
      });
      expect(save.status).toBe(201);
      expect(save.payload.save.version).toBe(1);

      const digest = createRankedDigest(profileId, 1320, "test-salt");
      const ranked = await jsonRequest<{ accepted: boolean }>(`${runtime.baseUrl}/v1/ranked/submit`, {
        method: "POST",
        body: JSON.stringify({
          profileId,
          score: 1320,
          clientDigest: digest
        })
      });
      expect(ranked.status).toBe(201);
      expect(ranked.payload.accepted).toBe(true);

      const after = await jsonRequest<{ completionPercent: number; nextAction: { id: string } | null }>(
        `${runtime.baseUrl}/v1/onboarding/${profileId}`
      );
      expect(after.status).toBe(200);
      expect(after.payload.completionPercent).toBe(100);
      expect(after.payload.nextAction).toBeNull();
    } finally {
      await runtime.close();
    }
  });

  it("returns conflict guidance when save versions diverge under manual-merge strategy", async () => {
    const projectDir = makeTempDir("runwright-runtime-sync-conflict-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "test-salt"
    });

    try {
      const signup = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "operator", locale: "en-US" })
      });
      const profileId = signup.payload.profile.id;

      const firstSave = await jsonRequest<{ save: { version: number } }>(`${runtime.baseUrl}/v1/saves`, {
        method: "POST",
        body: JSON.stringify({
          profileId,
          strategy: "last-write-wins",
          baseVersion: 0,
          payload: { chapter: 1 }
        })
      });
      expect(firstSave.status).toBe(201);
      expect(firstSave.payload.save.version).toBe(1);

      const conflict = await jsonRequest<{ error: { code: string; nextAction: string } }>(`${runtime.baseUrl}/v1/saves`, {
        method: "POST",
        body: JSON.stringify({
          profileId,
          strategy: "manual-merge",
          baseVersion: 0,
          payload: { chapter: 2 }
        })
      });
      expect(conflict.status).toBe(409);
      expect(conflict.payload.error.code).toBe("sync-conflict");
      expect(conflict.payload.error.nextAction).toContain("manual merge");

      const conflicts = await jsonRequest<{ conflicts: Array<{ profileId: string; latestVersion: number }> }>(
        `${runtime.baseUrl}/v1/saves/conflicts?profileId=${profileId}`
      );
      expect(conflicts.status).toBe(200);
      expect(conflicts.payload.conflicts[0]).toEqual(
        expect.objectContaining({
          profileId,
          latestVersion: 1
        })
      );
    } finally {
      await runtime.close();
    }
  });

  it("rejects tampered ranked submissions and persists the audit trail", async () => {
    const projectDir = makeTempDir("runwright-runtime-ranked-cheat-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "test-salt"
    });

    try {
      const signup = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "speed-runner", locale: "en-US" })
      });
      const profileId = signup.payload.profile.id;

      const ranked = await jsonRequest<{ accepted: boolean; error?: { code: string } }>(
        `${runtime.baseUrl}/v1/ranked/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            profileId,
            score: 9999,
            clientDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          })
        }
      );
      expect(ranked.status).toBe(422);
      expect(ranked.payload.accepted).toBe(false);
      expect(ranked.payload.error?.code).toBe("anti-tamper-failed");

      const leaderboard = await jsonRequest<{ leaderboard: Array<{ profileId: string }> }>(
        `${runtime.baseUrl}/v1/ranked/leaderboard`
      );
      expect(leaderboard.status).toBe(200);
      expect(leaderboard.payload.leaderboard).toEqual([]);

      const persisted = JSON.parse(readFileSync(stateFile, "utf8")) as { ranked: Array<{ accepted: boolean }> };
      expect(persisted.ranked).toHaveLength(1);
      expect(persisted.ranked[0]?.accepted).toBe(false);

      const antiCheat = await jsonRequest<{ decisions: Array<{ profileId: string; reason: string }> }>(
        `${runtime.baseUrl}/v1/ranked/anti-cheat?profileId=${profileId}`
      );
      expect(antiCheat.status).toBe(200);
      expect(antiCheat.payload.decisions[0]).toEqual(
        expect.objectContaining({
          profileId,
          reason: "digest-mismatch"
        })
      );
    } finally {
      await runtime.close();
    }
  });

  it("supports auth lifecycle, account linking/merge, telemetry dedupe, and crash redaction", async () => {
    const projectDir = makeTempDir("runwright-runtime-auth-lifecycle-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "test-salt"
    });
    try {
      const first = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "pilot-one", locale: "en-US" })
      });
      const second = await jsonRequest<{ profile: { id: string } }>(`${runtime.baseUrl}/v1/auth/signup`, {
        method: "POST",
        body: JSON.stringify({ handle: "pilot-two", locale: "en-US" })
      });
      const primaryProfileId = first.payload.profile.id;
      const secondaryProfileId = second.payload.profile.id;

      const login = await jsonRequest<{ session: { id: string } }>(`${runtime.baseUrl}/v1/auth/login`, {
        method: "POST",
        body: JSON.stringify({ handle: "pilot-one", provider: "email", deviceId: "macbook-pro" })
      });
      expect(login.status).toBe(201);
      const sessionId = login.payload.session.id;

      const link = await jsonRequest<{ linked: boolean; links: Array<{ provider: string }> }>(
        `${runtime.baseUrl}/v1/auth/link`,
        {
          method: "POST",
          body: JSON.stringify({ profileId: primaryProfileId, provider: "github", externalId: "pilot-gh" })
        }
      );
      expect(link.status).toBe(201);
      expect(link.payload.links).toEqual(expect.arrayContaining([expect.objectContaining({ provider: "github" })]));

      const merge = await jsonRequest<{ merged: boolean }>(`${runtime.baseUrl}/v1/auth/merge`, {
        method: "POST",
        body: JSON.stringify({ primaryProfileId, secondaryProfileId })
      });
      expect(merge.status).toBe(200);
      expect(merge.payload.merged).toBe(true);

      const telemetryFirst = await jsonRequest<{ duplicate: boolean }>(`${runtime.baseUrl}/v1/telemetry/events`, {
        method: "POST",
        body: JSON.stringify({
          profileId: primaryProfileId,
          eventId: "evt-onboarding-1",
          type: "tutorial.started",
          payload: { surface: "intro" }
        })
      });
      const telemetryDuplicate = await jsonRequest<{ duplicate: boolean }>(`${runtime.baseUrl}/v1/telemetry/events`, {
        method: "POST",
        body: JSON.stringify({
          profileId: primaryProfileId,
          eventId: "evt-onboarding-1",
          type: "tutorial.started",
          payload: { surface: "intro" }
        })
      });
      expect(telemetryFirst.status).toBe(202);
      expect(telemetryFirst.payload.duplicate).toBe(false);
      expect(telemetryDuplicate.status).toBe(202);
      expect(telemetryDuplicate.payload.duplicate).toBe(true);

      const crash = await jsonRequest<{ redacted: boolean }>(`${runtime.baseUrl}/v1/crash/report`, {
        method: "POST",
        body: JSON.stringify({
          profileId: primaryProfileId,
          surface: "web-shell",
          message: "fatal token=super-secret-session-token exposed",
          stack: "api_key=super-secret-value"
        })
      });
      expect(crash.status).toBe(202);
      expect(crash.payload.redacted).toBe(true);

      const recent = await jsonRequest<{ crashes: Array<{ message: string; stack?: string; redacted: boolean }> }>(
        `${runtime.baseUrl}/v1/crash/recent`
      );
      expect(recent.status).toBe(200);
      expect(recent.payload.crashes[0]?.redacted).toBe(true);
      expect(String(recent.payload.crashes[0]?.message)).not.toContain("super-secret-session-token");
      expect(String(recent.payload.crashes[0]?.stack ?? "")).toContain("[redacted]");

      const logout = await jsonRequest<{ revoked: boolean }>(`${runtime.baseUrl}/v1/auth/logout`, {
        method: "POST",
        body: JSON.stringify({ sessionId })
      });
      expect(logout.status).toBe(200);
      expect(logout.payload.revoked).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it("serves static web shell from apps/web root when configured", async () => {
    const projectDir = makeTempDir("runwright-runtime-web-shell-");
    const staticRoot = join(projectDir, "web");
    mkdirSync(staticRoot, { recursive: true });
    writeFileSync(join(staticRoot, "index.html"), "<!doctype html><html><body>Runtime shell</body></html>\n", "utf8");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "test-salt",
      staticRoot
    });
    try {
      const response = await fetch(`${runtime.baseUrl}/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Runtime shell");
    } finally {
      await runtime.close();
    }
  });
});
