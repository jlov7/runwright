import type {
  HelpResponse,
  OnboardingResponse,
  PublishLevelRequest,
  RankedSubmitRequest,
  RuntimeProfile,
  RuntimeApiClient,
  RuntimeErrorPayload,
  SaveRequest,
  SignupRequest,
  SignupResponse,
  TelemetryEventRequest
} from "../types";

function extractErrorMessage(payload: RuntimeErrorPayload, fallback: string): string {
  if (payload.error?.message && payload.error.message.trim().length > 0) {
    return payload.error.message;
  }
  return fallback;
}

async function requestJson<TResponse>(baseUrl: string, path: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json()) as TResponse & RuntimeErrorPayload;
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Request failed: ${path}`));
  }
  return payload;
}

export function createRuntimeApiClient(baseUrl = ""): RuntimeApiClient {
  return {
    signup(input: SignupRequest): Promise<SignupResponse> {
      return requestJson<SignupResponse>(baseUrl, "/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    getOnboarding(profileId: string): Promise<OnboardingResponse> {
      return requestJson<OnboardingResponse>(baseUrl, `/v1/onboarding/${profileId}`);
    },
    getHelp(): Promise<HelpResponse> {
      return requestJson<HelpResponse>(baseUrl, "/v1/help");
    },
    postTelemetry(input: TelemetryEventRequest): Promise<{ ok: boolean }> {
      return requestJson<{ ok: boolean }>(baseUrl, "/v1/telemetry/events", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    save(input: SaveRequest): Promise<{ save: { id: string; version: number; digest: string } }> {
      return requestJson<{ save: { id: string; version: number; digest: string } }>(baseUrl, "/v1/saves", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    publishLevel(input: PublishLevelRequest): Promise<{ level: { id: string; title: string; difficulty: string } }> {
      return requestJson<{ level: { id: string; title: string; difficulty: string } }>(baseUrl, "/v1/ugc/levels", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    submitRanked(input: RankedSubmitRequest): Promise<{
      accepted: boolean;
      leaderboard?: Array<{ profileId: string; score: number; handle: string }>;
    }> {
      return requestJson<{
        accepted: boolean;
        leaderboard?: Array<{ profileId: string; score: number; handle: string }>;
      }>(baseUrl, "/v1/ranked/submit", {
        method: "POST",
        body: JSON.stringify(input)
      });
    },
    getLeaderboard(): Promise<{ leaderboard: Array<{ profileId: string; handle: string; score: number; submittedAt: string }> }> {
      return requestJson<{ leaderboard: Array<{ profileId: string; handle: string; score: number; submittedAt: string }> }>(
        baseUrl,
        "/v1/ranked/leaderboard"
      );
    },
    getCreatorDiscover(): Promise<{ levels: Array<{ id: string; title: string; difficulty: string; rating: number }> }> {
      return requestJson<{ levels: Array<{ id: string; title: string; difficulty: string; rating: number }> }>(
        baseUrl,
        "/v1/ugc/discover"
      );
    },
    postModeration(input: {
      profileId: string;
      targetType: "ugc" | "chat" | "profile";
      targetId: string;
      reason: string;
    }): Promise<{ report: { id: string; status: "open"; createdAt: string } }> {
      return requestJson<{ report: { id: string; status: "open"; createdAt: string } }>(
        baseUrl,
        "/v1/moderation/report",
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      );
    },
    getLiveOpsSeason(): Promise<{
      seasonId: string;
      rotation: string;
      events: Array<{ id: string; active: boolean; rewardMultiplier: number }>;
    }> {
      return requestJson<{
        seasonId: string;
        rotation: string;
        events: Array<{ id: string; active: boolean; rewardMultiplier: number }>;
      }>(baseUrl, "/v1/liveops/season");
    },
    getAnalyticsFunnel(): Promise<{
      profiles: number;
      tutorialCount: number;
      saveCount: number;
      firstSuccessCount: number;
      conversionPercent: number;
    }> {
      return requestJson<{
        profiles: number;
        tutorialCount: number;
        saveCount: number;
        firstSuccessCount: number;
        conversionPercent: number;
      }>(baseUrl, "/v1/analytics/funnel");
    },
    postSocialInvite(input: { profileId: string; friendCode: string }): Promise<{
      added: boolean;
      friends: Array<{ profileId: string; friendCode: string; createdAt: string }>;
    }> {
      return requestJson<{ added: boolean; friends: Array<{ profileId: string; friendCode: string; createdAt: string }> }>(
        baseUrl,
        "/v1/social/friends",
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      );
    },
    patchAccessibility(
      profileId: string,
      input: {
        accessibility: {
          textScale: number;
          reducedMotion: boolean;
          highContrast: boolean;
          remapProfile: "default" | "left-handed" | "single-stick";
        };
      }
    ): Promise<{ profile: RuntimeProfile }> {
      return requestJson<{ profile: RuntimeProfile }>(
        baseUrl,
        `/v1/profiles/${profileId}/preferences`,
        {
          method: "PATCH",
          body: JSON.stringify(input)
        }
      );
    }
  };
}
