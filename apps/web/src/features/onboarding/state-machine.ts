export type OnboardingStepId = "profile" | "tutorial" | "save" | "publish" | "campaign";

export type OnboardingStatus = "not-started" | "in-progress" | "blocked" | "skipped" | "completed";

export type OnboardingChecklist = Record<OnboardingStepId, boolean>;

export type OnboardingTransition = {
  event: string;
  stepId: OnboardingStepId | null;
  status: OnboardingStatus;
  occurredAt: string;
};

export type OnboardingState = {
  status: OnboardingStatus;
  completed: OnboardingChecklist;
  celebration: boolean;
  diagnostics: {
    blockedStep: OnboardingStepId | null;
    reason: string | null;
    lastEvent: string | null;
    transitionCount: number;
  };
  transitions: OnboardingTransition[];
};

export type OnboardingEvent =
  | { type: "profile-created" }
  | { type: "tutorial-recorded" }
  | { type: "progress-saved" }
  | { type: "level-published" }
  | { type: "campaign-started" }
  | { type: "skip-requested" }
  | { type: "resume-requested" }
  | { type: "bootstrap-sample-loaded" }
  | { type: "step-failed"; stepId: OnboardingStepId; reason: string };

const STEP_ORDER: OnboardingStepId[] = ["profile", "tutorial", "save", "publish", "campaign"];

function defaultChecklist(): OnboardingChecklist {
  return {
    profile: false,
    tutorial: false,
    save: false,
    publish: false,
    campaign: false
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function allStepsComplete(checklist: OnboardingChecklist): boolean {
  return STEP_ORDER.every((step) => checklist[step]);
}

function firstIncompleteStep(checklist: OnboardingChecklist): OnboardingStepId | null {
  for (const step of STEP_ORDER) {
    if (!checklist[step]) return step;
  }
  return null;
}

function statusFromChecklist(checklist: OnboardingChecklist): OnboardingStatus {
  if (allStepsComplete(checklist)) return "completed";
  if (STEP_ORDER.some((step) => checklist[step])) return "in-progress";
  return "not-started";
}

function appendTransition(
  state: OnboardingState,
  event: string,
  stepId: OnboardingStepId | null,
  status: OnboardingStatus
): OnboardingState {
  return {
    ...state,
    diagnostics: {
      ...state.diagnostics,
      lastEvent: event,
      transitionCount: state.diagnostics.transitionCount + 1
    },
    transitions: [...state.transitions, { event, stepId, status, occurredAt: nowIso() }]
  };
}

export function initialOnboardingState(): OnboardingState {
  return {
    status: "not-started",
    completed: defaultChecklist(),
    celebration: false,
    diagnostics: {
      blockedStep: null,
      reason: null,
      lastEvent: null,
      transitionCount: 0
    },
    transitions: []
  };
}

export function nextOnboardingAction(state: OnboardingState): { stepId: OnboardingStepId; title: string } | null {
  if (state.status === "completed") return null;

  const blockedStep = state.diagnostics.blockedStep;
  if (blockedStep) {
    return {
      stepId: blockedStep,
      title: `Recover ${blockedStep}`
    };
  }

  const stepId = firstIncompleteStep(state.completed);
  if (!stepId) return null;
  return {
    stepId,
    title: `Complete ${stepId}`
  };
}

function completeStep(state: OnboardingState, stepId: OnboardingStepId, event: string): OnboardingState {
  const completed = {
    ...state.completed,
    [stepId]: true
  };
  const status = statusFromChecklist(completed);
  const next = appendTransition(
    {
      ...state,
      status,
      completed,
      celebration: status === "completed",
      diagnostics: {
        ...state.diagnostics,
        blockedStep: null,
        reason: null
      }
    },
    event,
    stepId,
    status
  );
  return next;
}

export function reduceOnboardingState(state: OnboardingState, event: OnboardingEvent): OnboardingState {
  if (event.type === "profile-created") return completeStep(state, "profile", event.type);
  if (event.type === "tutorial-recorded") return completeStep(state, "tutorial", event.type);
  if (event.type === "progress-saved") return completeStep(state, "save", event.type);
  if (event.type === "level-published") return completeStep(state, "publish", event.type);
  if (event.type === "campaign-started") return completeStep(state, "campaign", event.type);

  if (event.type === "bootstrap-sample-loaded") {
    const merged: OnboardingChecklist = {
      ...state.completed,
      profile: true,
      tutorial: true,
      save: true
    };
    const status = statusFromChecklist(merged);
    return appendTransition(
      {
        ...state,
        status,
        completed: merged,
        celebration: status === "completed",
        diagnostics: {
          ...state.diagnostics,
          blockedStep: null,
          reason: null
        }
      },
      event.type,
      "save",
      status
    );
  }

  if (event.type === "skip-requested") {
    return appendTransition(
      {
        ...state,
        status: "skipped"
      },
      event.type,
      nextOnboardingAction(state)?.stepId ?? null,
      "skipped"
    );
  }

  if (event.type === "resume-requested") {
    const status = statusFromChecklist(state.completed);
    return appendTransition(
      {
        ...state,
        status,
        diagnostics: {
          ...state.diagnostics,
          blockedStep: null,
          reason: null
        }
      },
      event.type,
      nextOnboardingAction(state)?.stepId ?? null,
      status
    );
  }

  return appendTransition(
    {
      ...state,
      status: "blocked",
      celebration: false,
      diagnostics: {
        ...state.diagnostics,
        blockedStep: event.stepId,
        reason: event.reason
      }
    },
    event.type,
    event.stepId,
    "blocked"
  );
}

export function serializeOnboardingState(state: OnboardingState): string {
  return JSON.stringify(state);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseOnboardingState(serialized: string): OnboardingState {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!isObject(parsed)) return initialOnboardingState();

    const checklist = isObject(parsed.completed) ? parsed.completed : {};
    const completed: OnboardingChecklist = {
      profile: checklist.profile === true,
      tutorial: checklist.tutorial === true,
      save: checklist.save === true,
      publish: checklist.publish === true,
      campaign: checklist.campaign === true
    };

    const fallback = initialOnboardingState();
    return {
      ...fallback,
      ...parsed,
      status: statusFromChecklist(completed),
      completed,
      celebration: allStepsComplete(completed)
    };
  } catch {
    return initialOnboardingState();
  }
}
