import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntimeApiClient } from "../apps/web/src/shared/api-client";
import { createGameRuntimeServer, createRankedDigest } from "../src/game/runtime";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("frontend user journeys e2e", () => {
  it("covers onboarding, core loop, ranked failure recovery, and creator success", async () => {
    const projectDir = makeTempDir("runwright-frontend-journey-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "test-salt"
    });

    try {
      const client = createRuntimeApiClient(runtime.baseUrl);
      const signup = await client.signup({ handle: "journey-user", locale: "en-US" });
      const profileId = signup.profile.id;

      const onboardingStart = await client.getOnboarding(profileId);
      expect(onboardingStart.completionPercent).toBe(25);

      await client.postTelemetry({
        profileId,
        type: "tutorial.started",
        payload: { source: "journey-e2e" }
      });
      await client.save({
        profileId,
        strategy: "last-write-wins",
        baseVersion: 0,
        payload: { chapter: 1, checkpoint: "tutorial-complete" }
      });

      await expect(
        client.submitRanked({
          profileId,
          score: 4500,
          clientDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        })
      ).rejects.toThrow("digest");

      await client.publishLevel({
        profileId,
        title: "Journey Success",
        difficulty: "silver"
      });
      const creatorFeed = await client.getCreatorDiscover();
      expect(creatorFeed.levels[0]?.title).toBe("Journey Success");

      await new Promise((resolve) => setTimeout(resolve, 1600));
      const validRanked = await client.submitRanked({
        profileId,
        score: 1550,
        clientDigest: createRankedDigest(profileId, 1550, "test-salt")
      });
      expect(validRanked.accepted).toBe(true);

      const leaderboard = await client.getLeaderboard();
      expect(leaderboard.leaderboard[0]?.profileId).toBe(profileId);

      const onboardingDone = await client.getOnboarding(profileId);
      expect(onboardingDone.completionPercent).toBe(100);
      expect(onboardingDone.nextAction).toBeNull();

      const analytics = await client.getAnalyticsFunnel();
      expect(analytics.profiles).toBe(1);
      expect(analytics.conversionPercent).toBe(100);
    } finally {
      await runtime.close();
    }
  });
});
