export function initialInteractionState() {
  return {
    actionId: null,
    phase: "idle",
    attempt: 0,
    message: null,
    errorCode: null
  };
}

export function beginAction(previous, actionId) {
  return {
    actionId,
    phase: "loading",
    attempt: previous.actionId === actionId ? previous.attempt + 1 : 1,
    message: null,
    errorCode: null
  };
}

export function completeAction(previous, message) {
  return {
    ...previous,
    phase: "success",
    message,
    errorCode: null
  };
}

export function failAction(previous, errorCode, message) {
  return {
    ...previous,
    phase: "error",
    errorCode,
    message
  };
}

export function retryAction(previous) {
  return {
    ...previous,
    phase: "retrying",
    attempt: previous.attempt + 1,
    message: "Retrying..."
  };
}
