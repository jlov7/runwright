export type SurfaceId =
  | "dashboard"
  | "profile"
  | "onboarding"
  | "help"
  | "challenge"
  | "campaign"
  | "coop"
  | "ranked"
  | "creator"
  | "moderation"
  | "liveops"
  | "analytics";

export type SurfaceMeta = {
  label: string;
  intent: string;
  primaryAction: string;
  tier: "core" | "advanced";
  unlock: "none" | "profile" | "onboarding";
};

export const SURFACE_META: Record<SurfaceId, SurfaceMeta>;
export const EXPERIENCE_MODE_META: Record<
  "setup" | "operate" | "analyze",
  {
    label: string;
    intent: string;
    defaultSurface: SurfaceId;
  }
>;

export function normalizeSurfaceInput(input: string): SurfaceId | null;
export function isAdvancedSurface(surface: string): boolean;
export function getVisibleSurfaces(context: {
  showAdvancedNav: boolean;
  onboardingReady?: boolean;
  profileReady?: boolean;
  experienceMode?: "setup" | "operate" | "analyze";
  activeSurface?: string;
}): SurfaceId[];
export function getSurfaceLockReason(
  surface: string,
  context: {
    profileReady: boolean;
    onboardingReady: boolean;
  }
):
  | {
      message: string;
      actionLabel: string;
      actionTarget: string;
      fallback: string;
    }
  | null;
