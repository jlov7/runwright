export function createRuntimeState() {
  return {
    profileId: null,
    sessionId: null,
    score: 1200,
    activeSurface: "dashboard",
    showAdvancedNav: false,
    profileHandle: null,
    locale: "en-US",
    progress: {
      tutorial: false,
      saved: false,
      published: false,
      campaignStarted: false
    },
    accessibility: {
      textScale: 1,
      reducedMotion: false,
      highContrast: false,
      remapProfile: "default"
    },
    coachmarkDismissed: false,
    lastReversibleAction: null,
    lastError: null,
    socialInvites: [],
    retryQueue: [],
    requestMetrics: [],
    interaction: null,
    helperModulePromise: null,
    lastAnnouncedMessage: null,
    personaMode: "builder",
    experienceMode: "setup",
    welcomeDismissed: false,
    exploreHubOpen: false,
    helpPanelOpen: false
  };
}
