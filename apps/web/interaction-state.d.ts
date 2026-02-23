export type InteractionPhase = "idle" | "loading" | "retrying" | "success" | "error";

export type InteractionState = {
  actionId: string | null;
  phase: InteractionPhase;
  attempt: number;
  message: string | null;
  errorCode: string | null;
};

export function initialInteractionState(): InteractionState;
export function beginAction(previous: InteractionState, actionId: string): InteractionState;
export function completeAction(previous: InteractionState, message: string): InteractionState;
export function failAction(previous: InteractionState, errorCode: string, message: string): InteractionState;
export function retryAction(previous: InteractionState): InteractionState;
