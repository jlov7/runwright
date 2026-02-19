export type RuntimeErrorPayload = {
  error?: {
    code?: string;
    message?: string;
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
  steps: OnboardingStep[];
  nextAction: { id: string; title: string; command: string } | null;
  firstSuccessReady: boolean;
};

export type HelpResponse = {
  docsPath: string;
  troubleshootingPath: string;
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
  submitRanked(input: RankedSubmitRequest): Promise<{ result: { accepted: boolean; rankTier: string } }>;
};
