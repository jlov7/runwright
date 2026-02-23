import type { InteractionState } from "./interaction-state";

export type RuntimeProgressState = {
  tutorial: boolean;
  saved: boolean;
  published: boolean;
  campaignStarted: boolean;
};

export type RuntimeAccessibilityState = {
  textScale: number;
  reducedMotion: boolean;
  highContrast: boolean;
  remapProfile: string;
};

export type RuntimeState = {
  profileId: string | null;
  sessionId: string | null;
  score: number;
  activeSurface: string;
  showAdvancedNav: boolean;
  profileHandle: string | null;
  locale: string;
  progress: RuntimeProgressState;
  accessibility: RuntimeAccessibilityState;
  coachmarkDismissed: boolean;
  lastReversibleAction: unknown;
  lastError: string | null;
  socialInvites: unknown[];
  retryQueue: unknown[];
  requestMetrics: unknown[];
  interaction: InteractionState | null;
  helperModulePromise: Promise<unknown> | null;
  lastAnnouncedMessage: string | null;
  personaMode: string;
  experienceMode: string;
  welcomeDismissed: boolean;
  exploreHubOpen: boolean;
  helpPanelOpen: boolean;
};

export function createRuntimeState(): RuntimeState;
