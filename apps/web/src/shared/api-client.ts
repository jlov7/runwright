import type {
  HelpResponse,
  OnboardingResponse,
  PublishLevelRequest,
  RankedSubmitRequest,
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
    submitRanked(input: RankedSubmitRequest): Promise<{ result: { accepted: boolean; rankTier: string } }> {
      return requestJson<{ result: { accepted: boolean; rankTier: string } }>(baseUrl, "/v1/ranked/submit", {
        method: "POST",
        body: JSON.stringify(input)
      });
    }
  };
}
