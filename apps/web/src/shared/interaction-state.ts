export type InteractionPhase = "idle" | "loading" | "retrying" | "success" | "error";

export type InteractionState = {
  actionId: string | null;
  phase: InteractionPhase;
  attempt: number;
  message: string | null;
  errorCode: string | null;
};

export function initialInteractionState(): InteractionState {
  return {
    actionId: null,
    phase: "idle",
    attempt: 0,
    message: null,
    errorCode: null
  };
}

export function beginAction(previous: InteractionState, actionId: string): InteractionState {
  return {
    actionId,
    phase: "loading",
    attempt: previous.actionId === actionId ? previous.attempt + 1 : 1,
    message: null,
    errorCode: null
  };
}

export function completeAction(previous: InteractionState, message: string): InteractionState {
  return {
    ...previous,
    phase: "success",
    message,
    errorCode: null
  };
}

export function failAction(previous: InteractionState, errorCode: string, message: string): InteractionState {
  return {
    ...previous,
    phase: "error",
    errorCode,
    message
  };
}

export function retryAction(previous: InteractionState): InteractionState {
  return {
    ...previous,
    phase: "retrying",
    attempt: previous.attempt + 1,
    message: "Retrying..."
  };
}
