// ── Imports ──────────────────────────────────────────────────────────────────

import {
  EXPERIENCE_MODE_META,
  SURFACE_META,
  getSurfaceLockReason,
  getVisibleSurfaces,
  isAdvancedSurface,
  normalizeSurfaceInput
} from "/navigation.js";
import {
  beginAction,
  completeAction,
  failAction,
  initialInteractionState,
  retryAction
} from "/interaction-state.js";
import { formatActionableErrorMessage } from "/feedback.js";
import { createRuntimeState } from "/state-store.js";

// ── State & Constants ────────────────────────────────────────────────────────

const state = createRuntimeState();
state.interaction = initialInteractionState();
const ONBOARDING_STORAGE_KEY = "runwright-onboarding-v1";
const LATENCY_BUDGET_MS = 1200;
const DEV_LATENCY_ALERT =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.search.includes("debugLatency=1");
const RESPONSE_CACHE_TTL_MS = 5000;

// ── DOM References ───────────────────────────────────────────────────────────

const feedback = document.querySelector("#feedback");
const nextAction = document.querySelector("#next-action");
const stepsList = document.querySelector("#onboarding-steps");
const tipsList = document.querySelector("#tips");
const recoveryPlaybook = document.querySelector("#recovery-playbook");
const breadcrumbHome = document.querySelector("#breadcrumb-home");
const breadcrumbSurface = document.querySelector("#breadcrumb-surface");
const surfaceTitle = document.querySelector("#surface-title");
const surfaceIntent = document.querySelector("#surface-intent");
const surfaceStatus = document.querySelector("#surface-status");
const inlineHelp = document.querySelector("#inline-help");
const surfacePrimaryAction = document.querySelector("#surface-primary-action");
const ledeCopy = document.querySelector(".lede");
const surfaceCriteria = document.querySelector("#surface-success-criteria");
const journeyStripSteps = document.querySelector("#journey-strip-steps");
const journeyWhy = document.querySelector("#journey-why");
const surfaceSearch = document.querySelector("#surface-search");
const surfaceSearchFeedback = document.querySelector("#surface-search-feedback");
const surfacePanels = [...document.querySelectorAll("[data-surface-panel]")];
const navItems = [...document.querySelectorAll(".nav-item[data-surface]")];
const emptyState = document.querySelector("#surface-empty-state");
const emptyTitle = document.querySelector("#surface-empty-title");
const emptyCopy = document.querySelector("#surface-empty-copy");
const emptyAction = document.querySelector("#surface-empty-action");
const emptyFallback = document.querySelector("#surface-empty-fallback");
const dashboardSummary = document.querySelector("#dashboard-summary");
const profileSummary = document.querySelector("#profile-summary");
const profileSessionStatus = document.querySelector("#profile-session-status");
const logoutSessionButton = document.querySelector("#logout-session");
const challengeBrief = document.querySelector("#challenge-brief");
const campaignSummary = document.querySelector("#campaign-summary");
const onboardingDiagnostics = document.querySelector("#onboarding-diagnostics");
const coachmarkBanner = document.querySelector("#coachmark-banner");
const celebrationBanner = document.querySelector("#celebration-banner");
const networkBanner = document.querySelector("#network-banner");
const latencyAlert = document.querySelector("#latency-alert");
const toastStack = document.querySelector("#toast-stack");
const undoLastActionButton = document.querySelector("#undo-last-action");
const globalErrorBoundary = document.querySelector("#global-error-boundary");
const globalErrorMessage = document.querySelector("#global-error-message");
const formError = document.querySelector("#form-error");
const statusLiveRegion = document.querySelector("#status-live-region");
const retryQueuePanel = document.querySelector("#retry-queue-panel");
const retryQueueList = document.querySelector("#retry-queue-list");
const surfaceLoadingSkeleton = document.querySelector("#surface-loading-skeleton");
const surfaceLoadingCopy = document.querySelector("#surface-loading-copy");
const helpLoadingSkeleton = document.querySelector("#help-loading-skeleton");
const diagnosticOutput = document.querySelector("#diagnostic-output");
const coopInvites = document.querySelector("#coop-invites");
const rankedLeaderboard = document.querySelector("#ranked-leaderboard");
const creatorDiscover = document.querySelector("#creator-discover");
const moderationSummary = document.querySelector("#moderation-summary");
const liveopsSummary = document.querySelector("#liveops-summary");
const analyticsSummary = document.querySelector("#analytics-summary");
const mobileSurfaceSelect = document.querySelector("#mobile-surface-select");
const openExploreHubButton = document.querySelector("#open-explore-hub");
const closeExploreHubButton = document.querySelector("#close-explore-hub");
const exploreHub = document.querySelector("#explore-hub");
const exploreHubList = document.querySelector("#explore-hub-list");
const overlayBackdrop = document.querySelector("#overlay-backdrop");
const toggleHelpPanelButton = document.querySelector("#toggle-help-panel");
const helpPanel = document.querySelector("#help-panel");
const navModeHint = document.querySelector("#nav-mode-hint");
const runTutorialButton = document.querySelector("#run-tutorial");
const saveProgressButton = document.querySelector("#save-progress");
const publishLevelButton = document.querySelector("#publish-level");
const submitRankedButton = document.querySelector("#submit-ranked");
const welcomeOverlay = document.querySelector("#welcome-overlay");
const welcomeStartButton = document.querySelector("#welcome-start");
const welcomeDismissButton = document.querySelector("#welcome-dismiss");
const personaModeSelect = document.querySelector("#persona-mode");
const reopenOnboardingGuideButton = document.querySelector("#reopen-onboarding-guide");
const jumpToNextStepButton = document.querySelector("#jump-to-next-step");
const toggleThemeButton = document.querySelector("#toggle-theme");
const modeToggleButtons = [...document.querySelectorAll(".mode-toggle[data-mode]")];
const modeName = document.querySelector("#mode-name");
const modePrimaryIntent = document.querySelector("#mode-primary-intent");
const modePrimaryAction = document.querySelector("#mode-primary-action");

const PERSONA_GUIDANCE = {
  builder: "Builder focus: publish your first level, then jump to Challenge and Creator surfaces.",
  operator: "Operator focus: complete onboarding, then move into Moderation and LiveOps safety checks.",
  analyst: "Analyst focus: complete onboarding, then validate Ranked and Analytics health."
};

let retryTimer = null;
let overlayFocusReturnElement = null;
const responseCache = new Map();
const pendingGetRequests = new Map();

// ── Derived State Helpers ─────────────────────────────────────────────────────

function profileReady() {
  return Boolean(state.profileId);
}

function onboardingReady() {
  return state.progress.tutorial && state.progress.saved && state.progress.published;
}

function campaignReady() {
  return state.progress.published;
}

function applyAccessibilityStyles() {
  document.body.style.fontSize = `${state.accessibility.textScale}rem`;
  document.body.classList.toggle("reduced-motion", state.accessibility.reducedMotion);
  document.body.classList.toggle("high-contrast", state.accessibility.highContrast);
  const textScale = document.querySelector("#text-scale");
  const reducedMotion = document.querySelector("#reduced-motion");
  const highContrast = document.querySelector("#high-contrast");
  const remapProfile = document.querySelector("#remap-profile");
  if (textScale) textScale.value = String(state.accessibility.textScale);
  if (reducedMotion) reducedMotion.checked = state.accessibility.reducedMotion;
  if (highContrast) highContrast.checked = state.accessibility.highContrast;
  if (remapProfile) remapProfile.value = state.accessibility.remapProfile;
}

// ── UI Rendering ─────────────────────────────────────────────────────────────

function announceStatus(message) {
  if (state.lastAnnouncedMessage === message) return;
  state.lastAnnouncedMessage = message;
  statusLiveRegion.textContent = message;
}

function setInlineHelp(message) {
  if (!inlineHelp || !message) return;
  inlineHelp.textContent = message;
}

function skeletonRowCountForSurface(surface) {
  if (surface === "analytics" || surface === "ranked") return 4;
  if (surface === "onboarding" || surface === "campaign") return 3;
  return 2;
}

function syncSkeletonRows(count) {
  if (!surfaceLoadingSkeleton) return;
  const rows = [...surfaceLoadingSkeleton.querySelectorAll(".skeleton-row")];
  while (rows.length < count) {
    const row = document.createElement("div");
    row.className = "skeleton-row";
    surfaceLoadingSkeleton.appendChild(row);
    rows.push(row);
  }
  rows.forEach((row, index) => {
    row.hidden = index >= count;
  });
}

function setLoading(active, label) {
  surfaceLoadingSkeleton.hidden = !active;
  if (active) {
    syncSkeletonRows(skeletonRowCountForSurface(state.activeSurface));
    const loadingLabel = label || `Loading ${SURFACE_META[state.activeSurface]?.label || "surface"}...`;
    if (surfaceLoadingCopy) {
      surfaceLoadingCopy.textContent = loadingLabel;
    }
    announceStatus(loadingLabel);
    if (inlineHelp) {
      inlineHelp.textContent = "Loading in progress. You can continue navigating while data resolves.";
    }
  }
}

async function withButtonLoading(button, loadingText, fn) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = loadingText;
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function successCriteriaRows() {
  return [
    { label: "Profile created", complete: profileReady() },
    { label: "Tutorial hint recorded", complete: state.progress.tutorial },
    { label: "Progress saved", complete: state.progress.saved },
    { label: "First level published", complete: state.progress.published },
    { label: "Campaign chapter started", complete: state.progress.campaignStarted }
  ];
}

function renderCriteria() {
  surfaceCriteria.replaceChildren();
  for (const row of successCriteriaRows()) {
    const li = document.createElement("li");
    li.textContent = `${row.complete ? "Done" : "Todo"}: ${row.label}`;
    surfaceCriteria.appendChild(li);
  }
}

function guidedJourneySteps() {
  return [
    {
      id: "profile",
      label: "Create profile",
      complete: profileReady(),
      actionId: "create-profile",
      focusSurface: "onboarding",
      why: "Creates your identity and unlocks save/auth boundaries."
    },
    {
      id: "tutorial",
      label: "Record tutorial",
      complete: state.progress.tutorial,
      actionId: "run-tutorial",
      focusSurface: "onboarding",
      why: "Confirms your first core action and unlocks save progression."
    },
    {
      id: "save",
      label: "Save progress",
      complete: state.progress.saved,
      actionId: "save-progress",
      focusSurface: "onboarding",
      why: "Proves your progress persists and can recover after interruptions."
    },
    {
      id: "publish",
      label: "Publish first level",
      complete: state.progress.published,
      actionId: "publish-level",
      focusSurface: "onboarding",
      why: "Marks your first success and unlocks deeper gameplay loops."
    },
    {
      id: "campaign",
      label: "Start campaign chapter",
      complete: state.progress.campaignStarted,
      actionId: "start-campaign",
      focusSurface: "campaign",
      why: "Transitions from onboarding into the repeatable core loop."
    }
  ];
}

function nextGuidedStep() {
  return guidedJourneySteps().find((step) => !step.complete) || null;
}

function renderJourneyStrip() {
  const steps = guidedJourneySteps();
  journeyStripSteps.replaceChildren();
  const currentStep = nextGuidedStep();
  for (const step of steps) {
    const li = document.createElement("li");
    li.className = "journey-step";
    if (step.complete) li.classList.add("is-complete");
    if (currentStep && currentStep.id === step.id) li.classList.add("is-current");
    const stateLabel = step.complete ? "Done" : currentStep && currentStep.id === step.id ? "Now" : "Next";
    li.textContent = `${stateLabel}: ${step.label}`;
    journeyStripSteps.appendChild(li);
  }
  journeyWhy.textContent = currentStep
    ? `Why now: ${currentStep.why}`
    : "Guided path complete. Explore advanced surfaces or continue campaign progression.";
}

function setActionButtonAvailability(button, enabled, hint) {
  button.disabled = !enabled;
  if (enabled) button.removeAttribute("aria-disabled");
  else button.setAttribute("aria-disabled", "true");
  if (hint) button.title = hint;
}

function syncOnboardingActionSequencing() {
  const profile = profileReady();
  const tutorialReady = profile;
  const saveReady = profile && state.progress.tutorial;
  const publishReady = profile && state.progress.tutorial && state.progress.saved;
  const rankedReady = onboardingReady();

  setActionButtonAvailability(
    runTutorialButton,
    tutorialReady,
    tutorialReady ? runTutorialButton.dataset.help : "Create profile first to unlock tutorial."
  );
  setActionButtonAvailability(
    saveProgressButton,
    saveReady,
    saveReady ? saveProgressButton.dataset.help : "Complete tutorial before saving progress."
  );
  setActionButtonAvailability(
    publishLevelButton,
    publishReady,
    publishReady ? publishLevelButton.dataset.help : "Save progress before publishing a level."
  );
  setActionButtonAvailability(
    submitRankedButton,
    rankedReady,
    rankedReady ? submitRankedButton.dataset.help : "Finish onboarding first to unlock ranked."
  );

  for (const button of [runTutorialButton, saveProgressButton, publishLevelButton, submitRankedButton]) {
    button.classList.remove("is-recommended");
  }
  const currentStep = nextGuidedStep();
  if (!currentStep) return;
  if (currentStep.actionId === "run-tutorial") runTutorialButton.classList.add("is-recommended");
  if (currentStep.actionId === "save-progress") saveProgressButton.classList.add("is-recommended");
  if (currentStep.actionId === "publish-level") publishLevelButton.classList.add("is-recommended");
}

function statusTextFor(surface) {
  if (surface === "dashboard") {
    return onboardingReady() ? "Status: Ready" : "Status: Needs action";
  }
  if (surface === "challenge") {
    return onboardingReady() ? "Status: Ready to generate" : "Status: Blocked - onboarding incomplete";
  }
  if (surface === "campaign") {
    return campaignReady() ? "Status: Ready for chapter start" : "Status: Blocked - publish level first";
  }
  if (surface === "profile") {
    return profileReady() ? "Status: Profile active" : "Status: No profile";
  }
  if (surface === "onboarding") {
    return onboardingReady() ? "Status: First success complete" : "Status: In progress";
  }
  if (surface === "coop") {
    return profileReady() ? "Status: Invite flow available" : "Status: Blocked - create profile";
  }
  if (surface === "ranked") {
    return onboardingReady() ? "Status: Submission pipeline ready" : "Status: Blocked - onboarding incomplete";
  }
  if (surface === "creator") {
    return profileReady() ? "Status: Publish pipeline ready" : "Status: Blocked - create profile";
  }
  if (surface === "moderation") {
    return profileReady() ? "Status: Reporting available" : "Status: Blocked - create profile";
  }
  if (surface === "liveops") {
    return "Status: Monitoring";
  }
  if (surface === "analytics") {
    return "Status: Monitoring";
  }
  return "Status: Informational";
}

function primaryActionLabel(actionId) {
  if (actionId === "create-profile") return "Create profile";
  if (actionId === "open-profile") return "Open profile settings";
  if (actionId === "run-onboarding") return "Open onboarding controls";
  if (actionId === "run-tutorial") return "Run tutorial hint";
  if (actionId === "save-progress") return "Save progress";
  if (actionId === "publish-level") return "Publish first level";
  if (actionId === "generate-challenge") return "Generate challenge";
  if (actionId === "start-campaign") return "Start campaign chapter";
  if (actionId === "open-coop") return "Open co-op invites";
  if (actionId === "refresh-ranked") return "Refresh leaderboard";
  if (actionId === "refresh-creator") return "Refresh creator feed";
  if (actionId === "open-moderation") return "Open moderation";
  if (actionId === "refresh-liveops") return "Refresh seasonal event";
  if (actionId === "refresh-analytics") return "Refresh analytics";
  if (actionId === "open-help") return "Open help docs";
  return "Open onboarding controls";
}

function activeModeMeta() {
  return EXPERIENCE_MODE_META[state.experienceMode] || EXPERIENCE_MODE_META.setup;
}

function modePrimaryActionId() {
  if (state.experienceMode === "setup") {
    if (!profileReady()) return "create-profile";
    if (!onboardingReady()) return "run-onboarding";
    return "open-help";
  }
  if (state.experienceMode === "operate") {
    if (!onboardingReady()) return "run-onboarding";
    return "generate-challenge";
  }
  if (!onboardingReady()) return "run-onboarding";
  return "refresh-analytics";
}

function modeHintCopy() {
  if (state.experienceMode === "setup") {
    return "Setup mode: complete first success with minimal surface noise.";
  }
  if (state.experienceMode === "operate") {
    return "Operate mode: challenge, campaign, creator, and moderation loops are prioritized.";
  }
  return "Analyze mode: ranked integrity and analytics health are prioritized.";
}

function renderExperienceMode() {
  const meta = activeModeMeta();
  if (modeName) {
    modeName.textContent = `Mode: ${meta.label}`;
  }
  if (modePrimaryIntent) {
    modePrimaryIntent.textContent = meta.intent;
  }
  const modeActionId = modePrimaryActionId();
  if (modePrimaryAction) {
    modePrimaryAction.dataset.actionId = modeActionId;
    modePrimaryAction.textContent = primaryActionLabel(modeActionId);
  }
  for (const button of modeToggleButtons) {
    const active = button.dataset.mode === state.experienceMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

function navContext() {
  return {
    profileReady: profileReady(),
    onboardingReady: onboardingReady(),
    showAdvancedNav: state.showAdvancedNav || state.exploreHubOpen,
    activeSurface: state.activeSurface,
    experienceMode: state.experienceMode
  };
}

function syncNavigationDisclosure() {
  const visible = new Set(getVisibleSurfaces(navContext()));
  for (const item of navItems) {
    const surface = item.dataset.surface || "";
    item.hidden = !visible.has(surface);
  }

  for (const option of [...mobileSurfaceSelect.options]) {
    option.hidden = !visible.has(option.value);
  }
  if (!visible.has(state.activeSurface)) {
    const activeOption = [...mobileSurfaceSelect.options].find((option) => option.value === state.activeSurface);
    if (activeOption) activeOption.hidden = false;
  }

  navModeHint.textContent = state.exploreHubOpen
    ? "Explore mode: advanced surfaces are visible in the explorer."
    : modeHintCopy();
  if (openExploreHubButton) {
    openExploreHubButton.setAttribute("aria-expanded", state.exploreHubOpen ? "true" : "false");
  }
}

function syncSurfacePanels(surface) {
  for (const panel of surfacePanels) {
    const visible = panel.dataset.surfacePanel === surface;
    panel.hidden = !visible;
  }

  let emptyMessage = null;
  let emptySeverity = "Needs action";
  let actionLabel = "Create profile";
  let actionTarget = "onboarding";
  let fallbackCopy = "Need help? Open docs/help/README.md from the help panel.";

  if (surface === "dashboard" && !profileReady()) {
    emptyMessage = "Dashboard is empty because no profile exists yet.";
    emptySeverity = "Prerequisite required";
  } else if (surface === "profile" && !profileReady()) {
    emptyMessage = "Profile settings are unavailable until a profile is created.";
    emptySeverity = "Prerequisite required";
  } else if (surface === "onboarding" && !profileReady()) {
    emptyMessage = "Onboarding actions are locked until you create a profile.";
    emptySeverity = "Blocked";
  } else if (surface === "campaign" && !campaignReady()) {
    emptyMessage = "Campaign starts after you publish your first level.";
    emptySeverity = "Blocked";
    actionLabel = "Open onboarding controls";
  }

  const lockReason = getSurfaceLockReason(surface, navContext());
  if (!emptyMessage && lockReason) {
    emptyMessage = lockReason.message;
    emptySeverity = "Locked";
    actionLabel = lockReason.actionLabel;
    actionTarget = lockReason.actionTarget;
    fallbackCopy = lockReason.fallback;
  }

  if (emptyMessage) {
    emptyState.hidden = false;
    if (emptyTitle) {
      emptyTitle.textContent = emptySeverity;
    }
    emptyCopy.textContent = emptyMessage;
    emptyAction.textContent = actionLabel;
    emptyAction.dataset.targetSurface = actionTarget;
    emptyFallback.textContent = fallbackCopy;
  } else {
    emptyState.hidden = true;
  }
}

function setExploreHubOpen(open) {
  if (open && document.activeElement instanceof HTMLElement) {
    overlayFocusReturnElement = document.activeElement;
  }
  state.exploreHubOpen = open;
  if (exploreHub) {
    exploreHub.hidden = !open;
  }
  if (open && !state.showAdvancedNav) {
    state.showAdvancedNav = true;
  }
  syncNavigationDisclosure();
  if (open) {
    document.addEventListener("keydown", trapFocusInOverlay);
    renderExploreHub();
    surfaceSearch.focus();
  } else if (overlayFocusReturnElement) {
    overlayFocusReturnElement.focus();
    overlayFocusReturnElement = null;
  }
  if (!open && !activeOverlay()) {
    document.removeEventListener("keydown", trapFocusInOverlay);
  }
  syncOverlayBackdrop();
  persistLocalState();
}

function syncHelpPanelVisibility() {
  if (helpPanel) {
    helpPanel.hidden = !state.helpPanelOpen;
  }
  if (toggleHelpPanelButton) {
    toggleHelpPanelButton.setAttribute("aria-expanded", state.helpPanelOpen ? "true" : "false");
    toggleHelpPanelButton.textContent = state.helpPanelOpen ? "Hide Help Panel" : "Show Help Panel";
  }
}

function renderExploreHub() {
  if (!exploreHubList) return;
  exploreHubList.replaceChildren();
  for (const [surface, meta] of Object.entries(SURFACE_META)) {
    if (!isAdvancedSurface(surface)) continue;
    const lock = getSurfaceLockReason(surface, navContext());
    const card = document.createElement("article");
    card.className = "explore-card rw-stack";

    const title = document.createElement("h3");
    title.textContent = meta.label;
    card.appendChild(title);

    const intent = document.createElement("p");
    intent.className = "muted";
    intent.textContent = meta.intent;
    card.appendChild(intent);

    const action = document.createElement("button");
    action.type = "button";
    action.textContent = lock ? lock.actionLabel : `Open ${meta.label}`;
    action.dataset.surface = lock ? lock.actionTarget : surface;
    action.dataset.originSurface = surface;
    card.appendChild(action);

    exploreHubList.appendChild(card);
  }
}

function personaHint() {
  return PERSONA_GUIDANCE[state.personaMode] || PERSONA_GUIDANCE.builder;
}

function activeOverlay() {
  if (welcomeOverlay && !welcomeOverlay.hidden) return welcomeOverlay;
  if (exploreHub && !exploreHub.hidden) return exploreHub;
  return null;
}

function syncOverlayBackdrop() {
  const overlayOpen = Boolean(activeOverlay());
  if (overlayBackdrop) {
    overlayBackdrop.hidden = !overlayOpen;
  }
  document.body.classList.toggle("overlay-open", overlayOpen);
}

function trapFocusInElement(event, element) {
  if (event.key !== "Tab" || !element) return;
  const focusable = [...element.querySelectorAll(
    'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function trapFocusInOverlay(event) {
  const overlay = activeOverlay();
  if (!overlay) return;
  trapFocusInElement(event, overlay);
}

function setWelcomeOverlayOpen(open) {
  if (!welcomeOverlay) return;
  if (open && document.activeElement instanceof HTMLElement) {
    overlayFocusReturnElement = document.activeElement;
  }
  welcomeOverlay.hidden = !open;
  if (open) {
    announceStatus("Guided onboarding is ready. Start setup or choose explore mode.");
    document.addEventListener("keydown", trapFocusInOverlay);
    welcomeStartButton.focus();
  } else {
    if (!activeOverlay()) {
      document.removeEventListener("keydown", trapFocusInOverlay);
    }
    if (overlayFocusReturnElement) {
      overlayFocusReturnElement.focus();
      overlayFocusReturnElement = null;
    }
  }
  syncOverlayBackdrop();
}

function renderSurfaceChrome(stepLabel = null) {
  const surface = state.activeSurface;
  const meta = SURFACE_META[surface] || SURFACE_META.dashboard;
  syncNavigationDisclosure();
  renderExperienceMode();
  const activeItem = navItems.find((item) => item.dataset.surface === surface) || navItems[0];

  for (const item of navItems) {
    const isActive = item === activeItem;
    item.classList.toggle("is-active", isActive);
    if (isActive) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }

  mobileSurfaceSelect.value = surface;
  const label = meta.label;
  breadcrumbSurface.textContent = stepLabel ? `${label} / ${stepLabel}` : label;
  surfaceTitle.textContent = label;
  surfaceIntent.textContent = meta.intent;
  surfaceStatus.textContent = statusTextFor(surface);
  setInlineHelp(`Tip: ${meta.intent}`);
  const guidedStep = nextGuidedStep();
  if (guidedStep && (surface === "dashboard" || surface === "onboarding")) {
    const steps = guidedJourneySteps();
    const position = steps.findIndex((step) => step.id === guidedStep.id) + 1;
    surfaceStatus.textContent = `Status: Guided step ${position}/${steps.length}`;
    surfacePrimaryAction.textContent = primaryActionLabel(guidedStep.actionId);
    surfacePrimaryAction.dataset.actionId = guidedStep.actionId;
    setInlineHelp(`Recommended now: ${guidedStep.label}. Why: ${guidedStep.why}`);
  } else {
    surfacePrimaryAction.textContent = primaryActionLabel(meta.primaryAction);
    surfacePrimaryAction.dataset.actionId = meta.primaryAction;
  }

  renderCriteria();
  renderJourneyStrip();
  syncSurfacePanels(surface);
  syncHelpPanelVisibility();
}

function renderOnboardingGuidance() {
  coachmarkBanner.hidden = state.coachmarkDismissed || !profileReady();
  celebrationBanner.hidden = !onboardingReady();
}

function renderUndoAvailability() {
  undoLastActionButton.hidden = !state.lastReversibleAction;
}

function renderRetryQueue() {
  retryQueueList.replaceChildren();
  if (state.retryQueue.length === 0) {
    retryQueuePanel.hidden = true;
    return;
  }
  retryQueuePanel.hidden = false;
  for (const entry of state.retryQueue) {
    const item = document.createElement("li");
    const waitMs = Math.max(0, entry.nextRunAt - Date.now());
    item.textContent = `${entry.label} | attempt ${entry.attempt} | next retry in ${Math.ceil(waitMs / 1000)}s`;
    retryQueueList.appendChild(item);
  }
}

function renderSocialInvites() {
  coopInvites.replaceChildren();
  if (state.socialInvites.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No invites queued in this session.";
    coopInvites.appendChild(li);
    return;
  }
  for (const invite of state.socialInvites) {
    const li = document.createElement("li");
    li.textContent = `${invite.status}: ${invite.friendCode}`;
    coopInvites.appendChild(li);
  }
}

function renderSummaries() {
  const hint = personaHint();
  dashboardSummary.textContent = profileReady()
    ? `Profile ${state.profileHandle} is active. ${hint}`
    : `No profile yet. Create one to unlock onboarding guidance. ${hint}`;
  profileSummary.textContent = profileReady()
    ? `Handle: ${state.profileHandle} | Locale: ${state.locale}`
    : "No profile is active yet.";
  profileSessionStatus.textContent = state.sessionId
    ? "Session: active and attached to mutating requests."
    : "Session: none (mutating requests run in local mode).";
  logoutSessionButton.disabled = !state.sessionId;
  campaignSummary.textContent = state.progress.campaignStarted
    ? "Campaign chapter active: Chapter 1 - Stabilize the relay line."
    : "Campaign has not started yet.";
  renderOnboardingGuidance();
  syncOnboardingActionSequencing();
  renderUndoAvailability();
  renderRetryQueue();
  renderSocialInvites();
  if (ledeCopy) {
    if (!onboardingReady()) {
      ledeCopy.textContent = "Complete onboarding quickly, then move into challenge, ranked, and creator loops.";
    } else if (state.experienceMode === "operate") {
      ledeCopy.textContent = "Operate mode active: execute gameplay and moderation loops while keeping setup noise low.";
    } else if (state.experienceMode === "analyze") {
      ledeCopy.textContent = "Analyze mode active: track ranked integrity and funnel health before shipping changes.";
    } else {
      ledeCopy.textContent = "Setup mode active: review profile and onboarding foundations before expanding scope.";
    }
  }
  debouncedPersist();
}

// ── Navigation & Surface Management ──────────────────────────────────────────

function setActiveSurface(surface, stepLabel = null) {
  const nextSurface = SURFACE_META[surface] ? surface : "dashboard";
  if (isAdvancedSurface(nextSurface)) {
    state.showAdvancedNav = true;
  }
  if (nextSurface === "help" && state.activeSurface !== "help") {
    // Navigate to help surface without auto-opening the sidebar
  }
  if (state.exploreHubOpen) {
    setExploreHubOpen(false);
  }
  if (state.activeSurface === nextSurface && stepLabel === null) return;
  state.activeSurface = nextSurface;
  renderSurfaceChrome(stepLabel);
  renderSummaries();
  requestAnimationFrame(() => {
    surfaceTitle.focus();
  });
  if (nextSurface === "ranked") void refreshLeaderboard();
  else if (nextSurface === "creator") void refreshCreatorFeed();
  else if (nextSurface === "liveops") void refreshLiveOps();
  else if (nextSurface === "analytics") void refreshAnalytics();
}

function setExperienceMode(mode, stepLabel = null) {
  if (!EXPERIENCE_MODE_META[mode]) return;
  state.experienceMode = mode;
  const visible = getVisibleSurfaces(navContext());
  const target = visible.includes(state.activeSurface) ? state.activeSurface : activeModeMeta().defaultSurface;
  renderExperienceMode();
  setActiveSurface(target, stepLabel);
}

async function loadSurfaceHelpers() {
  if (!state.helperModulePromise) {
    state.helperModulePromise = import("/surfaces.js");
  }
  return state.helperModulePromise;
}

// ── Networking & API ─────────────────────────────────────────────────────────

function trackRequestMetric(label, durationMs) {
  state.requestMetrics.push({
    label,
    durationMs,
    at: Date.now()
  });
  if (state.requestMetrics.length > 40) {
    state.requestMetrics = state.requestMetrics.slice(-40);
  }
}

function averageRequestLatencyMs() {
  if (state.requestMetrics.length === 0) return 0;
  const total = state.requestMetrics.reduce((sum, entry) => sum + entry.durationMs, 0);
  return Math.round(total / state.requestMetrics.length);
}

function cloneRequestInit(init) {
  return {
    method: init.method,
    body: typeof init.body === "string" ? init.body : undefined,
    headers: { ...(init.headers || {}) }
  };
}

function scheduleRetryProcessing() {
  if (retryTimer !== null || state.retryQueue.length === 0 || !navigator.onLine) {
    return;
  }
  const nextRunAt = Math.min(...state.retryQueue.map((entry) => entry.nextRunAt));
  const delay = Math.max(20, nextRunAt - Date.now());
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void processRetryQueue();
  }, delay);
}

async function processRetryQueue(forceNow = false) {
  if (!navigator.onLine) return;
  const now = Date.now();
  const due = state.retryQueue.filter((entry) => forceNow || entry.nextRunAt <= now);
  for (const entry of due) {
    try {
      await api(entry.path, entry.init, {
        label: `${entry.label} (retry)`,
        skipRetryQueue: true
      });
      state.retryQueue = state.retryQueue.filter((candidate) => candidate.id !== entry.id);
      pushToast(`Retry succeeded: ${entry.label}`, "success");
    } catch (error) {
      entry.attempt += 1;
      const backoff = Math.min(16000, 500 * 2 ** entry.attempt);
      entry.nextRunAt = Date.now() + backoff;
      state.lastError = error.message;
      state.interaction = retryAction(state.interaction);
      setInlineHelp(`Retry queued: ${entry.label} (attempt ${entry.attempt}).`);
    }
  }
  renderRetryQueue();
  scheduleRetryProcessing();
}

function enqueueRetry(path, init, label) {
  const id = `retry-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  state.retryQueue.push({
    id,
    path,
    init: cloneRequestInit(init),
    label,
    attempt: 1,
    nextRunAt: Date.now() + 500
  });
  renderRetryQueue();
  scheduleRetryProcessing();
}

function applyLatencyAlert(durationMs, label) {
  if (!DEV_LATENCY_ALERT) return;
  if (durationMs <= LATENCY_BUDGET_MS) return;
  latencyAlert.hidden = false;
  latencyAlert.textContent = `Latency alert: ${label} took ${durationMs}ms (budget ${LATENCY_BUDGET_MS}ms).`;
  announceStatus(latencyAlert.textContent);
}

async function api(path, init = {}, options = {}) {
  const method = String(init.method || "GET").toUpperCase();
  const actionLabel = options.label || `${method} ${path}`;
  state.interaction = beginAction(state.interaction, actionLabel);
  const isMutating = ["POST", "PATCH", "PUT", "DELETE"].includes(method);
  const cacheKey = `${method} ${path}`;
  const cached = responseCache.get(cacheKey);
  if (method === "GET" && cached && Date.now() - cached.storedAt < RESPONSE_CACHE_TTL_MS) {
    return cached.payload;
  }
  if (method === "GET" && pendingGetRequests.has(cacheKey)) {
    return pendingGetRequests.get(cacheKey);
  }

  const requestInit = {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(isMutating ? { "x-runwright-csrf": "same-origin" } : {}),
      ...(isMutating && state.sessionId ? { "x-session-id": state.sessionId } : {}),
      ...(init.headers || {})
    }
  };
  const startedAt = performance.now();
  if (!navigator.onLine) {
    state.interaction = failAction(state.interaction, "network-offline", "Network is offline.");
    if (!options.skipRetryQueue) {
      enqueueRetry(path, requestInit, options.label || `${requestInit.method || "GET"} ${path}`);
      state.interaction = retryAction(state.interaction);
    }
    throw new Error("network-offline");
  }

  const requestPromise = (async () => {
    let response;
    let payload;
    try {
      response = await fetch(path, requestInit);
      payload = await response.json();
    } catch {
      state.interaction = failAction(
        state.interaction,
        "network-transient-failure",
        "Network request failed before server response."
      );
      if (!options.skipRetryQueue) {
        enqueueRetry(path, requestInit, options.label || `${requestInit.method || "GET"} ${path}`);
        state.interaction = retryAction(state.interaction);
      }
      throw new Error("network-transient-failure");
    } finally {
      const durationMs = Math.round(performance.now() - startedAt);
      trackRequestMetric(options.label || path, durationMs);
      applyLatencyAlert(durationMs, options.label || path);
    }

    if (!response.ok) {
      const error = payload?.error?.message || "Request failed";
      const code = payload?.error?.code || "unknown-error";
      const transient = response.status >= 500 || response.status === 429 || code === "network-offline";
      state.interaction = failAction(state.interaction, code, error);
      if (transient && !options.skipRetryQueue) {
        enqueueRetry(path, requestInit, options.label || `${requestInit.method || "GET"} ${path}`);
        state.interaction = retryAction(state.interaction);
      }
      throw new Error(error);
    }

    if (method === "GET") {
      responseCache.set(cacheKey, { payload, storedAt: Date.now() });
    }
    state.interaction = completeAction(state.interaction, `${actionLabel} completed.`);
    return payload;
  })();

  if (method === "GET") {
    pendingGetRequests.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      pendingGetRequests.delete(cacheKey);
    }
  }

  return requestPromise;
}

// ── Persistence ──────────────────────────────────────────────────────────────
// TODO: Replace with src/app/state-store.ts persistence layer once wired

let persistTimer = null;
function debouncedPersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistLocalState, 300);
}

function persistLocalState() {
  try {
    const snapshot = {
      profileId: state.profileId,
      profileHandle: state.profileHandle,
      locale: state.locale,
      showAdvancedNav: state.showAdvancedNav,
      experienceMode: state.experienceMode,
      personaMode: state.personaMode,
      welcomeDismissed: state.welcomeDismissed,
      helpPanelOpen: state.helpPanelOpen,
      progress: state.progress,
      accessibility: state.accessibility,
      coachmarkDismissed: state.coachmarkDismissed
    };
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore persistence errors in restricted environments.
  }
}

function restoreLocalState() {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    if (typeof parsed.profileId === "string" && parsed.profileId.length > 0) state.profileId = parsed.profileId;
    if (typeof parsed.profileHandle === "string") state.profileHandle = parsed.profileHandle;
    if (typeof parsed.locale === "string") state.locale = parsed.locale;
    if (parsed.showAdvancedNav === true) state.showAdvancedNav = true;
    if (typeof parsed.experienceMode === "string" && EXPERIENCE_MODE_META[parsed.experienceMode]) {
      state.experienceMode = parsed.experienceMode;
    }
    if (typeof parsed.personaMode === "string" && PERSONA_GUIDANCE[parsed.personaMode]) {
      state.personaMode = parsed.personaMode;
    }
    if (parsed.welcomeDismissed === true) state.welcomeDismissed = true;
    if (parsed.helpPanelOpen === true) state.helpPanelOpen = true;
    if (parsed.progress && typeof parsed.progress === "object") {
      state.progress.tutorial = parsed.progress.tutorial === true;
      state.progress.saved = parsed.progress.saved === true;
      state.progress.published = parsed.progress.published === true;
      state.progress.campaignStarted = parsed.progress.campaignStarted === true;
    }
    if (parsed.accessibility && typeof parsed.accessibility === "object") {
      state.accessibility.textScale = Number(parsed.accessibility.textScale || 1);
      state.accessibility.reducedMotion = parsed.accessibility.reducedMotion === true;
      state.accessibility.highContrast = parsed.accessibility.highContrast === true;
      state.accessibility.remapProfile = String(parsed.accessibility.remapProfile || "default");
    }
    state.coachmarkDismissed = parsed.coachmarkDismissed === true;
  } catch {
    // Ignore malformed persisted state.
  }
}

function setFeedback(message, isError = false) {
  const rendered = isError ? formatActionableErrorMessage(message) : message;
  feedback.textContent = rendered;
  feedback.className = isError ? "feedback error" : "feedback success";
  state.lastError = isError ? rendered : state.lastError;
  announceStatus(rendered);
  if (isError) {
    setInlineHelp(`Recovery: ${rendered}`);
  }
  pushToast(rendered, isError ? "error" : "info");
}

// ── Toasts & Feedback ────────────────────────────────────────────────────────

function pushToast(message, tone) {
  const item = document.createElement("div");
  item.className = `toast-item ${tone}`;
  item.setAttribute("role", "status");
  const text = document.createElement("span");
  text.textContent = message;
  item.appendChild(text);
  const dismiss = document.createElement("button");
  dismiss.className = "toast-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss notification");
  dismiss.textContent = "\u00d7";
  dismiss.addEventListener("click", () => item.remove());
  item.appendChild(dismiss);
  toastStack.prepend(item);
  const prefersReducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.body.classList.contains("reduced-motion");
  if (!prefersReducedMotion) {
    setTimeout(() => item.remove(), 3800);
  }
}

// ── Data Fetching ────────────────────────────────────────────────────────────

async function refreshHelp() {
  helpLoadingSkeleton.hidden = false;
  try {
    const help = await api("/v1/help", {}, { label: "load help" });
    tipsList.replaceChildren();
    for (const item of help.tooltips) {
      const li = document.createElement("li");
      li.textContent = item.copy;
      tipsList.appendChild(li);
    }

    recoveryPlaybook.replaceChildren();
    const playbooks = [
      "Sync conflict: open save details, merge manually, then retry save with latest base version.",
      "Ranked anti-tamper: regenerate score payload from trusted runtime and resubmit.",
      "Network disruption: stay in offline mode and use Retry Now once connection returns.",
      "Unclear error: copy the diagnostic packet and attach it to your support handoff."
    ];
    for (const entry of playbooks) {
      const li = document.createElement("li");
      li.textContent = entry;
      recoveryPlaybook.appendChild(li);
    }
  } finally {
    helpLoadingSkeleton.hidden = true;
  }
}

async function emitOnboardingTelemetry(type, payload = {}) {
  if (!state.profileId) return;
  try {
    await api(
      "/v1/telemetry/events",
      {
        method: "POST",
        body: JSON.stringify({
          profileId: state.profileId,
          type,
          payload
        })
      },
      { label: type }
    );
  } catch {
    // Telemetry failures should not block user progression flows.
  }
}

async function refreshOnboarding() {
  if (!state.profileId) return;
  setLoading(true, "Loading onboarding checklist...");
  try {
    const payload = await api(`/v1/onboarding/${state.profileId}`, {}, { label: "load onboarding" });
    stepsList.replaceChildren();
    for (const step of payload.steps) {
      const li = document.createElement("li");
      li.textContent = `${step.complete ? "Done" : "Todo"}: ${step.title}`;
      stepsList.appendChild(li);
    }
    nextAction.textContent = payload.nextAction
      ? `Next action: ${payload.nextAction.title}`
      : "Next action: Launch-ready onboarding complete";
  } finally {
    setLoading(false, "");
  }
}

async function createProfileFromForm() {
  const form = document.querySelector("#profile-form");
  const handleInput = document.querySelector("#handle");
  const handle = form.handle.value.trim();
  const locale = form.locale.value;
  if (handle.length < 2) {
    formError.textContent = "Handle must be at least 2 characters.";
    if (handleInput) {
      handleInput.setAttribute("aria-invalid", "true");
      handleInput.focus();
    }
    throw new Error("Handle must be at least 2 characters.");
  }
  if (handleInput) {
    handleInput.setAttribute("aria-invalid", "false");
  }
  formError.textContent = "";
  setLoading(true, "Creating profile...");
  try {
    const payload = await api(
      "/v1/auth/signup",
      {
        method: "POST",
        body: JSON.stringify({ handle, locale })
      },
      { label: "create profile" }
    );
    state.profileId = payload.profile.id;
    state.profileHandle = payload.profile.handle;
    state.locale = payload.profile.locale;
    try {
      const login = await api(
        "/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            handle: payload.profile.handle,
            provider: "email",
            deviceId: "web-shell"
          })
        },
        { label: "create profile session" }
      );
      state.sessionId = login.session.id;
    } catch {
      state.sessionId = null;
    }
    state.lastReversibleAction = null;
    await emitOnboardingTelemetry("onboarding.profile_created", { surface: "web-shell" });
    setActiveSurface("onboarding", "Profile Created");
    setFeedback(`Profile created: ${payload.profile.handle}`);
    await refreshOnboarding();
  } finally {
    setLoading(false, "");
  }
}

async function refreshLeaderboard() {
  if (!state.profileId) {
    setFeedback("Create a profile first.", true);
    return;
  }
  setLoading(true, "Refreshing leaderboard...");
  try {
    const helpers = await loadSurfaceHelpers();
    const payload = await api("/v1/ranked/leaderboard", {}, { label: "refresh leaderboard" });
    rankedLeaderboard.replaceChildren();
    const rows = helpers.mapLeaderboardRows(payload);
    for (const row of rows) {
      const li = document.createElement("li");
      li.textContent = row;
      rankedLeaderboard.appendChild(li);
    }
  } catch (error) {
    setFeedback(`Failed to refresh leaderboard: ${error.message}`, true);
  } finally {
    setLoading(false, "");
  }
}

async function refreshCreatorFeed() {
  if (!state.profileId) {
    setFeedback("Create a profile first.", true);
    return;
  }
  setLoading(true, "Refreshing creator feed...");
  try {
    const helpers = await loadSurfaceHelpers();
    const payload = await api("/v1/ugc/discover", {}, { label: "refresh creator feed" });
    creatorDiscover.replaceChildren();
    const rows = helpers.mapCreatorRows(payload);
    for (const row of rows) {
      const li = document.createElement("li");
      li.textContent = row;
      creatorDiscover.appendChild(li);
    }
  } catch (error) {
    setFeedback(`Failed to refresh creator feed: ${error.message}`, true);
  } finally {
    setLoading(false, "");
  }
}

async function refreshLiveOps() {
  setLoading(true, "Loading seasonal event...");
  try {
    const helpers = await loadSurfaceHelpers();
    const payload = await api("/v1/liveops/season", {}, { label: "refresh liveops" });
    liveopsSummary.textContent = helpers.formatSeasonSummary(payload);
  } catch (error) {
    liveopsSummary.textContent = `LiveOps unavailable: ${error.message}`;
    setFeedback(`LiveOps refresh failed: ${error.message}`, true);
  } finally {
    setLoading(false, "");
  }
}

async function refreshAnalytics() {
  setLoading(true, "Loading analytics funnel...");
  try {
    const helpers = await loadSurfaceHelpers();
    const payload = await api("/v1/analytics/funnel", {}, { label: "refresh analytics" });
    analyticsSummary.textContent = helpers.formatAnalyticsSummary(payload, averageRequestLatencyMs());
  } catch (error) {
    analyticsSummary.textContent = `Analytics unavailable: ${error.message}`;
    setFeedback(`Analytics refresh failed: ${error.message}`, true);
  } finally {
    setLoading(false, "");
  }
}

// ── Action Routing & Event Handlers ──────────────────────────────────────────

function runPrimaryAction(actionIdOverride = null) {
  const actionId = actionIdOverride || surfacePrimaryAction.dataset.actionId;
  if (actionId === "create-profile") {
    setActiveSurface("onboarding", "Create Profile");
    document.querySelector("#handle").focus();
    return;
  }
  if (actionId === "open-profile") {
    setActiveSurface("profile");
    return;
  }
  if (actionId === "run-onboarding") {
    setActiveSurface("onboarding");
    return;
  }
  if (actionId === "run-tutorial") {
    setActiveSurface("onboarding", "Tutorial Hint");
    runTutorialButton.click();
    return;
  }
  if (actionId === "save-progress") {
    setActiveSurface("onboarding", "Save Progress");
    saveProgressButton.click();
    return;
  }
  if (actionId === "publish-level") {
    setActiveSurface("onboarding", "Publish Level");
    publishLevelButton.click();
    return;
  }
  if (actionId === "generate-challenge") {
    setActiveSurface("challenge", "Challenge Brief");
    document.querySelector("#challenge-generate").click();
    return;
  }
  if (actionId === "start-campaign") {
    setActiveSurface("campaign", "Chapter Start");
    document.querySelector("#campaign-start").click();
    return;
  }
  if (actionId === "open-coop") {
    setActiveSurface("coop", "Invites");
    document.querySelector("#friend-code").focus();
    return;
  }
  if (actionId === "refresh-ranked") {
    setActiveSurface("ranked", "Leaderboard");
    document.querySelector("#ranked-refresh").click();
    return;
  }
  if (actionId === "refresh-creator") {
    setActiveSurface("creator", "Discover Feed");
    document.querySelector("#creator-refresh").click();
    return;
  }
  if (actionId === "open-moderation") {
    setActiveSurface("moderation", "Report");
    document.querySelector("#moderation-target-id").focus();
    return;
  }
  if (actionId === "refresh-liveops") {
    setActiveSurface("liveops", "Season");
    document.querySelector("#liveops-refresh").click();
    return;
  }
  if (actionId === "refresh-analytics") {
    setActiveSurface("analytics", "Funnel");
    document.querySelector("#analytics-refresh").click();
    return;
  }
  if (actionId === "open-help") {
    setActiveSurface("help");
    state.helpPanelOpen = true;
    syncHelpPanelVisibility();
    return;
  }
  setActiveSurface("onboarding");
}

document.querySelector("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await createProfileFromForm();
  } catch (error) {
    setFeedback(error.message, true);
  }
});

document.querySelector("#accessibility-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.profileId) {
    setFeedback("Create a profile first.", true);
    return;
  }
  const payload = {
    accessibility: {
      textScale: Number(document.querySelector("#text-scale").value),
      reducedMotion: document.querySelector("#reduced-motion").checked,
      highContrast: document.querySelector("#high-contrast").checked,
      remapProfile: document.querySelector("#remap-profile").value
    }
  };
  try {
    await api(
      `/v1/profiles/${state.profileId}/preferences`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      },
      { label: "save accessibility" }
    );
    state.accessibility = payload.accessibility;
    applyAccessibilityStyles();
    setFeedback("Accessibility preferences saved.");
  } catch (error) {
    setFeedback(`Accessibility update failed: ${error.message}`, true);
  }
});

document.querySelector("#logout-session").addEventListener("click", async () => {
  if (!state.sessionId) {
    setFeedback("No active session to log out.");
    return;
  }
  try {
    await api(
      "/v1/auth/logout",
      {
        method: "POST",
        body: JSON.stringify({ sessionId: state.sessionId })
      },
      { label: "logout session" }
    );
    state.sessionId = null;
    renderSummaries();
    setFeedback("Session logged out.");
  } catch (error) {
    setFeedback(`Session logout failed: ${error.message}`, true);
  }
});

document.querySelector("#run-tutorial").addEventListener("click", async function () {
  if (!state.profileId) return setFeedback("Create a profile first.", true);
  await withButtonLoading(this, "Recording…", async () => {
    try {
      await api(
        "/v1/telemetry/events",
        {
          method: "POST",
          body: JSON.stringify({
            profileId: state.profileId,
            type: "tutorial.started",
            payload: { source: "web-shell" }
          })
        },
        { label: "record tutorial" }
      );
      state.progress.tutorial = true;
      onboardingDiagnostics.textContent = "Diagnostics: tutorial transition passed.";
      await emitOnboardingTelemetry("onboarding.tutorial_recorded", { surface: "web-shell" });
      setActiveSurface("onboarding", "Tutorial Hint");
      setFeedback("Tutorial progress recorded.");
      await refreshOnboarding();
    } catch (error) {
      onboardingDiagnostics.textContent = "Diagnostics: tutorial step failed; retry recommended.";
      setFeedback(error.message, true);
    }
  });
});

document.querySelector("#save-progress").addEventListener("click", async function () {
  if (!state.profileId) return setFeedback("Create a profile first.", true);
  await withButtonLoading(this, "Saving…", async () => {
    try {
      await api(
        "/v1/saves",
        {
          method: "POST",
          body: JSON.stringify({
            profileId: state.profileId,
            strategy: "last-write-wins",
            baseVersion: 0,
            payload: { chapter: 1, checkpoint: "shell-save" }
          })
        },
        { label: "save progress" }
      );
      state.progress.saved = true;
      onboardingDiagnostics.textContent = "Diagnostics: save transition passed.";
      await emitOnboardingTelemetry("onboarding.progress_saved", { strategy: "last-write-wins" });
      setActiveSurface("onboarding", "Save Progress");
      setFeedback("Progress saved.");
      await refreshOnboarding();
    } catch (error) {
      onboardingDiagnostics.textContent = "Diagnostics: save step failed; inspect sync state.";
      setFeedback(error.message, true);
    }
  });
});

document.querySelector("#publish-level").addEventListener("click", async function () {
  if (!state.profileId) return setFeedback("Create a profile first.", true);
  const previousPublished = state.progress.published;
  const previousAction = state.lastReversibleAction;
  state.progress.published = true;
  state.lastReversibleAction = { type: "publish-level", previousPublished };
  setActiveSurface("creator", "Publish Level (Pending)");
  setFeedback("Publishing level (optimistic update)...");
  await withButtonLoading(this, "Publishing…", async () => {
    try {
      await api(
        "/v1/ugc/levels",
        {
          method: "POST",
          body: JSON.stringify({
            profileId: state.profileId,
            title: "First Victory Sprint",
            difficulty: "silver"
          })
        },
        { label: "publish level" }
      );
      onboardingDiagnostics.textContent = "Diagnostics: publish transition passed.";
      await emitOnboardingTelemetry("onboarding.level_published", { difficulty: "silver" });
      setActiveSurface("creator", "Publish Level");
      setFeedback("Level published. First success should now be complete.");
      await refreshOnboarding();
    } catch (error) {
      state.progress.published = previousPublished;
      state.lastReversibleAction = previousAction;
      onboardingDiagnostics.textContent = "Diagnostics: publish failed; optimistic update rolled back.";
      setActiveSurface("onboarding", "Publish Rollback");
      setFeedback(`Publish failed and was rolled back: ${error.message}`, true);
    }
  });
});

document.querySelector("#submit-ranked").addEventListener("click", async function () {
  if (!state.profileId) return setFeedback("Create a profile first.", true);
  await withButtonLoading(this, "Submitting…", async () => {
    try {
      await api(
        "/v1/ranked/submit",
        {
          method: "POST",
          body: JSON.stringify({
            profileId: state.profileId,
            score: state.score,
            clientDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          })
        },
        { label: "submit ranked" }
      );
      setActiveSurface("ranked", "Score Submitted");
      setFeedback("Ranked score accepted.");
    } catch (error) {
      setActiveSurface("ranked", "Submission Error");
      setFeedback(`Ranked submission rejected: ${error.message}`, true);
    }
  });
});

document.querySelector("#challenge-generate").addEventListener("click", () => {
  if (!onboardingReady()) {
    challengeBrief.textContent = "Challenge generation is blocked until onboarding criteria are complete.";
    setFeedback("Finish onboarding criteria before generating a challenge.", true);
    return;
  }
  setLoading(true, "Generating challenge brief (Demo)...");
  setTimeout(() => {
    setLoading(false, "");
    challengeBrief.textContent = "(Demo) Challenge: Iron Relay. Objective: Clear three waves without dropping below 40% stability.";
    setFeedback("Challenge brief generated (demo mode).");
  }, 320);
});

document.querySelector("#campaign-start").addEventListener("click", async () => {
  if (!campaignReady()) {
    campaignSummary.textContent = "Campaign start blocked: publish your first level to unlock progression.";
    setFeedback("Publish a level before starting campaign progression.", true);
    onboardingDiagnostics.textContent = "Diagnostics: campaign start blocked by missing publish milestone.";
    return;
  }
  state.progress.campaignStarted = true;
  await emitOnboardingTelemetry("onboarding.campaign_started", { chapter: 1 });
  setActiveSurface("campaign", "Chapter 1");
  setFeedback("Campaign chapter started.");
});

document.querySelector("#coop-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.profileId) return setFeedback("Create a profile first.", true);
  const input = document.querySelector("#friend-code");
  const friendCode = input.value.trim();
  if (friendCode.length < 3) {
    setFeedback("Friend code must be at least 3 characters.", true);
    return;
  }

  const optimisticInvite = { id: `invite-${Date.now()}`, friendCode, status: "Pending" };
  state.socialInvites.unshift(optimisticInvite);
  renderSocialInvites();
  setFeedback("Invite queued (optimistic update)...");

  try {
    await api(
      "/v1/social/friends",
      {
        method: "POST",
        body: JSON.stringify({ profileId: state.profileId, friendCode })
      },
      { label: "send coop invite" }
    );
    optimisticInvite.status = "Sent";
    renderSocialInvites();
    setFeedback("Invite sent.");
    input.value = "";
  } catch (error) {
    state.socialInvites = state.socialInvites.filter((invite) => invite.id !== optimisticInvite.id);
    renderSocialInvites();
    setFeedback(`Invite failed and was rolled back: ${error.message}`, true);
  }
});

document.querySelector("#moderation-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.profileId) return setFeedback("Create a profile first.", true);
  const payload = {
    profileId: state.profileId,
    targetType: document.querySelector("#moderation-target-type").value,
    targetId: document.querySelector("#moderation-target-id").value.trim(),
    reason: document.querySelector("#moderation-reason").value.trim()
  };
  try {
    const response = await api(
      "/v1/moderation/report",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      { label: "submit moderation report" }
    );
    moderationSummary.textContent = `Report submitted: ${response.report.id}.`;
    setFeedback("Moderation report submitted.");
  } catch (error) {
    moderationSummary.textContent = `Report failed: ${error.message}`;
    setFeedback(`Moderation report failed: ${error.message}`, true);
  }
});

document.querySelector("#ranked-refresh").addEventListener("click", () => {
  void refreshLeaderboard();
});
document.querySelector("#creator-refresh").addEventListener("click", () => {
  void refreshCreatorFeed();
});
document.querySelector("#liveops-refresh").addEventListener("click", () => {
  void refreshLiveOps();
});
document.querySelector("#analytics-refresh").addEventListener("click", () => {
  void refreshAnalytics();
});

document.querySelector("#onboarding-skip").addEventListener("click", async () => {
  onboardingDiagnostics.textContent = "Diagnostics: onboarding skipped; resume when ready.";
  await emitOnboardingTelemetry("onboarding.skip_requested", { surface: "web-shell" });
  setActiveSurface("dashboard", "Skipped");
  setFeedback("Onboarding skipped for now. Resume anytime from the onboarding surface.");
});

document.querySelector("#onboarding-resume").addEventListener("click", async () => {
  onboardingDiagnostics.textContent = "Diagnostics: onboarding resumed.";
  await emitOnboardingTelemetry("onboarding.resume_requested", { surface: "web-shell" });
  setActiveSurface("onboarding", "Resumed");
  setFeedback("Onboarding resumed.");
});

document.querySelector("#onboarding-bootstrap").addEventListener("click", async () => {
  state.progress.tutorial = true;
  state.progress.saved = true;
  onboardingDiagnostics.textContent = "Diagnostics: bootstrap loaded (tutorial + save complete).";
  await emitOnboardingTelemetry("onboarding.bootstrap_loaded", { preset: "sample-progress" });
  setActiveSurface("onboarding", "Bootstrap");
  setFeedback("Sample progress loaded.");
});

document.querySelector("#coachmark-dismiss").addEventListener("click", () => {
  state.coachmarkDismissed = true;
  persistLocalState();
  renderOnboardingGuidance();
  setFeedback("Coachmark dismissed. Use Revisit Tips to show it again.");
});

document.querySelector("#coachmark-revisit").addEventListener("click", () => {
  state.coachmarkDismissed = false;
  persistLocalState();
  setActiveSurface("onboarding", "Tips");
  setFeedback("Coachmark tips restored.");
});

undoLastActionButton.addEventListener("click", () => {
  const action = state.lastReversibleAction;
  if (!action) return;
  if (action.type === "publish-level") {
    state.progress.published = action.previousPublished;
    state.progress.campaignStarted = false;
    state.lastReversibleAction = null;
    onboardingDiagnostics.textContent = "Diagnostics: last publish action was reverted.";
    setActiveSurface("onboarding", "Undo");
    setFeedback("Last reversible action has been undone.");
    return;
  }
  state.lastReversibleAction = null;
  renderUndoAvailability();
});

document.querySelector("#surface-command").addEventListener("submit", (event) => {
  event.preventDefault();
  const surface = normalizeSurfaceInput(surfaceSearch.value);
  if (!surface) {
    const visible = getVisibleSurfaces(navContext()).join(", ");
    surfaceSearchFeedback.textContent =
      `Unknown surface. Try ${visible}. Use Explore to reveal advanced navigation.`;
    return;
  }
  surfaceSearchFeedback.textContent = "";
  setActiveSurface(surface);
});

document.querySelector("#mobile-surface-nav").addEventListener("submit", (event) => {
  event.preventDefault();
  setActiveSurface(mobileSurfaceSelect.value);
});

openExploreHubButton.addEventListener("click", () => {
  setExploreHubOpen(!state.exploreHubOpen);
  if (!state.exploreHubOpen) {
    openExploreHubButton.focus();
  }
});

closeExploreHubButton.addEventListener("click", () => {
  setExploreHubOpen(false);
  openExploreHubButton.focus();
});

overlayBackdrop?.addEventListener("click", () => {
  if (welcomeOverlay && !welcomeOverlay.hidden) {
    state.welcomeDismissed = true;
    setWelcomeOverlayOpen(false);
    persistLocalState();
    return;
  }
  if (state.exploreHubOpen) {
    setExploreHubOpen(false);
    openExploreHubButton.focus();
  }
});

welcomeOverlay?.addEventListener("click", (event) => {
  if (event.target !== welcomeOverlay) return;
  state.welcomeDismissed = true;
  setWelcomeOverlayOpen(false);
  persistLocalState();
});

toggleHelpPanelButton.addEventListener("click", () => {
  state.helpPanelOpen = !state.helpPanelOpen;
  syncHelpPanelVisibility();
  persistLocalState();
});

welcomeStartButton.addEventListener("click", () => {
  state.welcomeDismissed = true;
  setWelcomeOverlayOpen(false);
  setActiveSurface("onboarding", "Guided Setup");
  document.querySelector("#handle").focus();
  persistLocalState();
});

welcomeDismissButton.addEventListener("click", () => {
  state.welcomeDismissed = true;
  setWelcomeOverlayOpen(false);
  setExploreHubOpen(true);
  setFeedback("Guided overlay dismissed. Explore mode is open for advanced workflows.");
  persistLocalState();
});

personaModeSelect.addEventListener("change", () => {
  const mode = personaModeSelect.value;
  if (PERSONA_GUIDANCE[mode]) {
    state.personaMode = mode;
    if (mode === "analyst") state.experienceMode = "analyze";
    else if (mode === "operator") state.experienceMode = "operate";
    else state.experienceMode = "setup";
    renderSummaries();
    renderExperienceMode();
    syncNavigationDisclosure();
    setFeedback(`Persona mode updated: ${mode}.`);
  }
});

reopenOnboardingGuideButton.addEventListener("click", () => {
  state.welcomeDismissed = false;
  setWelcomeOverlayOpen(true);
  setActiveSurface("onboarding", "Guide");
  persistLocalState();
});

jumpToNextStepButton.addEventListener("click", () => {
  const step = nextGuidedStep();
  if (!step) {
    setExploreHubOpen(true);
    setFeedback("Guided steps are complete. Use Explore for advanced workflows.");
    return;
  }
  setActiveSurface(step.focusSurface, step.label);
  surfacePrimaryAction.dataset.actionId = step.actionId;
  surfacePrimaryAction.classList.add("is-recommended");
  announceStatus(`Next step: ${step.label}. Use the primary action button to proceed.`);
});

for (const modeButton of modeToggleButtons) {
  modeButton.addEventListener("click", () => {
    const mode = modeButton.dataset.mode;
    if (!mode || mode === state.experienceMode) return;
    setExperienceMode(mode, `${activeModeMeta().label} Mode`);
    setFeedback(`${activeModeMeta().label} mode active.`);
  });
}

toggleThemeButton.addEventListener("click", () => {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  const nextTheme = isDark ? "light" : "dark";
  document.body.setAttribute("data-theme", nextTheme);
  toggleThemeButton.textContent = isDark ? "Dark Mode" : "Light Mode";
  toggleThemeButton.setAttribute("aria-label", `Switch to ${isDark ? "dark" : "light"} mode`);
});

breadcrumbHome.addEventListener("click", () => {
  setActiveSurface("dashboard");
});

exploreHubList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest("button[data-surface]");
  if (!(button instanceof HTMLButtonElement)) return;
  const surface = button.dataset.surface || "dashboard";
  const origin = button.dataset.originSurface;
  setActiveSurface(surface, origin ? `Explore ${origin}` : null);
});

surfacePrimaryAction.addEventListener("click", runPrimaryAction);
modePrimaryAction?.addEventListener("click", () => {
  runPrimaryAction(modePrimaryAction.dataset.actionId || "run-onboarding");
});

emptyAction.addEventListener("click", () => {
  const target = emptyAction.dataset.targetSurface || "onboarding";
  setActiveSurface(target);
});

for (const navItem of navItems) {
  navItem.addEventListener("click", () => {
    setActiveSurface(navItem.dataset.surface || "dashboard");
  });
}

for (const button of document.querySelectorAll("[data-help]")) {
  const helpText = button.getAttribute("data-help") || "Action help unavailable.";
  button.setAttribute("title", helpText);
  button.addEventListener("focus", () => {
    setInlineHelp(helpText);
  });
  button.addEventListener("mouseenter", () => {
    setInlineHelp(helpText);
  });
  button.addEventListener("blur", () => {
    const meta = SURFACE_META[state.activeSurface] || SURFACE_META.dashboard;
    setInlineHelp(`Tip: ${meta.intent}`);
  });
  button.addEventListener("mouseleave", () => {
    const meta = SURFACE_META[state.activeSurface] || SURFACE_META.dashboard;
    setInlineHelp(`Tip: ${meta.intent}`);
  });
}

// ── Keyboard Shortcuts & Global Events ────────────────────────────────────────

window.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName;
  const inFormField = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";
  if (event.key === "/" && !inFormField && document.activeElement !== surfaceSearch) {
    event.preventDefault();
    if (!state.exploreHubOpen) {
      setExploreHubOpen(true);
    }
    surfaceSearch.focus();
    return;
  }
  if (event.key === "?" && !inFormField) {
    event.preventDefault();
    state.helpPanelOpen = true;
    syncHelpPanelVisibility();
    persistLocalState();
    return;
  }
  if (event.key === "Escape" && welcomeOverlay && !welcomeOverlay.hidden) {
    state.welcomeDismissed = true;
    setWelcomeOverlayOpen(false);
    persistLocalState();
    return;
  }
  if (event.key === "Escape" && state.exploreHubOpen) {
    setExploreHubOpen(false);
    openExploreHubButton.focus();
  }
});

document.querySelector("#retry-queue-run").addEventListener("click", () => {
  void processRetryQueue(true);
});

document.querySelector("#retry-queue-clear").addEventListener("click", () => {
  state.retryQueue = [];
  renderRetryQueue();
  setFeedback("Retry queue cleared.");
});

document.querySelector("#copy-diagnostics").addEventListener("click", async () => {
  const packet = {
    generatedAt: new Date().toISOString(),
    surface: state.activeSurface,
    profile: state.profileHandle,
    locale: state.locale,
    progress: state.progress,
    accessibility: state.accessibility,
    retryQueue: state.retryQueue.map((entry) => ({
      label: entry.label,
      attempt: entry.attempt,
      nextRunAt: new Date(entry.nextRunAt).toISOString()
    })),
    lastError: state.lastError
  };
  const serialized = JSON.stringify(packet, null, 2);
  diagnosticOutput.value = serialized;
  try {
    await navigator.clipboard.writeText(serialized);
    setFeedback("Diagnostic packet copied.");
  } catch {
    diagnosticOutput.focus();
    diagnosticOutput.select();
    setFeedback("Clipboard unavailable. Diagnostic packet selected for manual copy.");
  }
});

window.addEventListener("offline", () => {
  networkBanner.hidden = false;
  setFeedback("Network offline. Actions will retry when the connection returns.", true);
});

window.addEventListener("online", () => {
  networkBanner.hidden = true;
  setFeedback("Connection restored.");
  void processRetryQueue(true);
});

window.addEventListener("error", (event) => {
  globalErrorBoundary.hidden = false;
  globalErrorMessage.textContent = `Unexpected issue: ${event.message}`;
});

window.addEventListener("unhandledrejection", (event) => {
  globalErrorBoundary.hidden = false;
  const reason = event.reason instanceof Error ? event.reason.message : "Unknown rejection";
  globalErrorMessage.textContent = `Unexpected issue: ${reason}`;
});

// ── Initialization ───────────────────────────────────────────────────────────

restoreLocalState();
applyAccessibilityStyles();
renderSocialInvites();
setActiveSurface("dashboard");
syncHelpPanelVisibility();
syncOverlayBackdrop();
if (personaModeSelect) {
  personaModeSelect.value = state.personaMode;
}
if (!state.welcomeDismissed && !onboardingReady()) {
  setWelcomeOverlayOpen(true);
}
refreshHelp().catch(() => setFeedback("Help service unavailable.", true));
