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
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("frontend runtime api contract", () => {
  it("stays compatible with runtime endpoints used by the web shell", async () => {
    const projectDir = makeTempDir("runwright-frontend-runtime-contract-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "test-salt"
    });

    try {
      const client = createRuntimeApiClient(runtime.baseUrl);
      const signup = await client.signup({ handle: "frontend-contract", locale: "en-US" });
      const profileId = signup.profile.id;
      expect(profileId.length).toBeGreaterThan(1);

      const help = await client.getHelp();
      expect(help.docsPath).toContain("docs/help/README.md");
      expect(help.tooltips.length).toBeGreaterThan(0);

      const onboardingBefore = await client.getOnboarding(profileId);
      expect(onboardingBefore.completionPercent).toBe(25);
      expect(onboardingBefore.nextAction?.id).toBe("tutorial");

      const telemetry = await client.postTelemetry({
        profileId,
        type: "tutorial.started",
        payload: { source: "frontend-contract" }
      });
      expect(telemetry.ok).toBe(true);

      const save = await client.save({
        profileId,
        strategy: "last-write-wins",
        baseVersion: 0,
        payload: { chapter: 1 }
      });
      expect(save.save.version).toBe(1);

      const publish = await client.publishLevel({
        profileId,
        title: "Contract Level",
        difficulty: "silver"
      });
      expect(publish.level.title).toBe("Contract Level");

      const rankedDigest = createRankedDigest(profileId, 1777, "test-salt");
      const ranked = await client.submitRanked({
        profileId,
        score: 1777,
        clientDigest: rankedDigest
      });
      expect(ranked.accepted).toBe(true);

      const leaderboard = await client.getLeaderboard();
      expect(leaderboard.leaderboard[0]?.profileId).toBe(profileId);

      const discover = await client.getCreatorDiscover();
      expect(discover.levels[0]?.title).toBe("Contract Level");

      const social = await client.postSocialInvite({ profileId, friendCode: "friend-777" });
      expect(social.added).toBe(true);
      expect(social.friends[0]?.friendCode).toBe("friend-777");

      const moderation = await client.postModeration({
        profileId,
        targetType: "ugc",
        targetId: publish.level.id,
        reason: "test-case"
      });
      expect(moderation.report.status).toBe("open");

      const season = await client.getLiveOpsSeason();
      expect(season.seasonId.length).toBeGreaterThan(1);
      expect(season.events.length).toBeGreaterThan(0);

      const analytics = await client.getAnalyticsFunnel();
      expect(typeof analytics.conversionPercent).toBe("number");

      const patched = await client.patchAccessibility(profileId, {
        accessibility: {
          textScale: 1.5,
          reducedMotion: true,
          highContrast: false,
          remapProfile: "single-stick"
        }
      });
      expect(patched.profile.accessibility.textScale).toBe(1.5);

      const onboardingAfter = await client.getOnboarding(profileId);
      expect(onboardingAfter.completionPercent).toBe(100);
      expect(onboardingAfter.firstSuccess).toBe(true);
    } finally {
      await runtime.close();
    }
  });
});
