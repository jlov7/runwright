export const SURFACE_META = {
  dashboard: {
    label: "Dashboard",
    intent: "View launch readiness and choose your next gameplay loop.",
    primaryAction: "create-profile",
    tier: "core",
    unlock: "none"
  },
  profile: {
    label: "Profile",
    intent: "Manage account and settings before deeper gameplay loops.",
    primaryAction: "open-profile",
    tier: "core",
    unlock: "none"
  },
  onboarding: {
    label: "Onboarding",
    intent: "Complete first-run checklist and reach first success quickly.",
    primaryAction: "run-onboarding",
    tier: "core",
    unlock: "none"
  },
  help: {
    label: "Help",
    intent: "Find troubleshooting paths and recovery guidance.",
    primaryAction: "open-help",
    tier: "core",
    unlock: "none"
  },
  challenge: {
    label: "Challenge",
    intent: "Generate challenge runs and validate progression depth.",
    primaryAction: "generate-challenge",
    tier: "advanced",
    unlock: "onboarding"
  },
  campaign: {
    label: "Campaign",
    intent: "Run chapter progression to transition from onboarding into core loop play.",
    primaryAction: "start-campaign",
    tier: "advanced",
    unlock: "onboarding"
  },
  coop: {
    label: "Co-op",
    intent: "Invite friends and stabilize multiplayer readiness.",
    primaryAction: "open-coop",
    tier: "advanced",
    unlock: "profile"
  },
  ranked: {
    label: "Ranked",
    intent: "Submit trusted scores and inspect competitive integrity.",
    primaryAction: "refresh-ranked",
    tier: "advanced",
    unlock: "onboarding"
  },
  creator: {
    label: "Creator",
    intent: "Publish and review levels with moderation-safe defaults.",
    primaryAction: "refresh-creator",
    tier: "advanced",
    unlock: "profile"
  },
  moderation: {
    label: "Moderation",
    intent: "Report abuse and verify moderation pipeline readiness.",
    primaryAction: "open-moderation",
    tier: "advanced",
    unlock: "profile"
  },
  liveops: {
    label: "LiveOps",
    intent: "Inspect seasonal events and rewards cadence health.",
    primaryAction: "refresh-liveops",
    tier: "advanced",
    unlock: "profile"
  },
  analytics: {
    label: "Analytics",
    intent: "Track funnel completion and first-success conversion health.",
    primaryAction: "refresh-analytics",
    tier: "advanced",
    unlock: "profile"
  }
};

const SURFACE_ORDER = [
  "dashboard",
  "profile",
  "onboarding",
  "help",
  "challenge",
  "campaign",
  "coop",
  "ranked",
  "creator",
  "moderation",
  "liveops",
  "analytics"
];

const SURFACE_ALIASES = {
  home: "dashboard",
  account: "profile",
  settings: "profile",
  tutorial: "onboarding",
  quest: "challenge",
  progression: "campaign",
  social: "coop",
  support: "help"
};

export function normalizeSurfaceInput(input) {
  const value = input.trim().toLowerCase();
  if (value.length === 0) return null;
  if (SURFACE_ALIASES[value]) return SURFACE_ALIASES[value];
  if (SURFACE_META[value]) return value;
  return null;
}

export function isAdvancedSurface(surface) {
  return SURFACE_META[surface]?.tier === "advanced";
}

export function getVisibleSurfaces(context) {
  const { showAdvancedNav, onboardingReady, activeSurface } = context;
  const surfaces = SURFACE_ORDER.filter((surface) => {
    if (!SURFACE_META[surface]) return false;
    if (SURFACE_META[surface].tier === "core") return true;
    return showAdvancedNav || onboardingReady;
  });
  if (activeSurface && SURFACE_META[activeSurface] && !surfaces.includes(activeSurface)) {
    surfaces.push(activeSurface);
  }
  return surfaces;
}

export function getSurfaceLockReason(surface, context) {
  const requirement = SURFACE_META[surface]?.unlock || "none";
  if (requirement === "profile" && !context.profileReady) {
    return {
      message: "Create a profile before using this surface.",
      actionLabel: "Create profile",
      actionTarget: "onboarding",
      fallback: "Open onboarding and create a profile to unlock this surface."
    };
  }
  if (requirement === "onboarding" && !context.onboardingReady) {
    return {
      message: "Finish onboarding first: tutorial, save progress, and publish a level.",
      actionLabel: "Open onboarding controls",
      actionTarget: "onboarding",
      fallback: "Use the guided path: record tutorial, save progress, then publish your first level."
    };
  }
  return null;
}
