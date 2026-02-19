export type RuntimeErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    nextAction?: string;
    details?: unknown;
  };
};

export type RuntimeProfile = {
  id: string;
  handle: string;
  locale: string;
  createdAt: string;
  accessibility: {
    preset: string;
    textScale: number;
    reducedMotion: boolean;
    highContrast: boolean;
    remapProfile: string;
  };
};

export type SignupRequest = {
  handle: string;
  locale: string;
};

export type SignupResponse = {
  profile: RuntimeProfile;
};

export type OnboardingStep = {
  id: string;
  title: string;
  complete: boolean;
  guidance: string;
};

export type OnboardingResponse = {
  profileId: string;
  completionPercent: number;
  steps: OnboardingStep[];
  nextAction: { id: string; title: string; command: string } | null;
  firstSuccess: boolean;
};

export type HelpResponse = {
  docsPath: string;
  tooltips: Array<{ id: string; copy: string }>;
};

export type TelemetryEventRequest = {
  profileId: string;
  type: string;
  eventId?: string;
  payload?: Record<string, unknown>;
};

export type SaveRequest = {
  profileId: string;
  strategy: "last-write-wins" | "manual-merge" | "server-authoritative";
  baseVersion: number;
  payload: Record<string, unknown>;
};

export type PublishLevelRequest = {
  profileId: string;
  title: string;
  difficulty: "bronze" | "silver" | "gold" | "legendary";
};

export type RankedSubmitRequest = {
  profileId: string;
  score: number;
  clientDigest: string;
};

export type RuntimeApiClient = {
  signup(input: SignupRequest): Promise<SignupResponse>;
  getOnboarding(profileId: string): Promise<OnboardingResponse>;
  getHelp(): Promise<HelpResponse>;
  postTelemetry(input: TelemetryEventRequest): Promise<{ ok: boolean }>;
  save(input: SaveRequest): Promise<{ save: { id: string; version: number; digest: string } }>;
  publishLevel(input: PublishLevelRequest): Promise<{ level: { id: string; title: string; difficulty: string } }>;
  submitRanked(input: RankedSubmitRequest): Promise<{ accepted: boolean; leaderboard?: Array<{ profileId: string; score: number; handle: string }> }>;
  getLeaderboard(): Promise<{ leaderboard: Array<{ profileId: string; handle: string; score: number; submittedAt: string }> }>;
  getCreatorDiscover(): Promise<{ levels: Array<{ id: string; title: string; difficulty: string; rating: number }> }>;
  postModeration(input: {
    profileId: string;
    targetType: "ugc" | "chat" | "profile";
    targetId: string;
    reason: string;
  }): Promise<{ report: { id: string; status: "open"; createdAt: string } }>;
  getLiveOpsSeason(): Promise<{
    seasonId: string;
    rotation: string;
    events: Array<{ id: string; active: boolean; rewardMultiplier: number }>;
  }>;
  getAnalyticsFunnel(): Promise<{
    profiles: number;
    tutorialCount: number;
    saveCount: number;
    firstSuccessCount: number;
    conversionPercent: number;
  }>;
  postSocialInvite(input: {
    profileId: string;
    friendCode: string;
  }): Promise<{ added: boolean; friends: Array<{ profileId: string; friendCode: string; createdAt: string }> }>;
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
  ): Promise<{ profile: RuntimeProfile }>;
};
