import type { AsyncUiState } from "../shared/ui/primitives";

export type FrontendSurface =
  | "dashboard"
  | "profile"
  | "onboarding"
  | "challenge"
  | "campaign"
  | "coop"
  | "ranked"
  | "creator"
  | "moderation"
  | "liveops"
  | "analytics"
  | "help";

export type FrontendState = {
  activeSurface: FrontendSurface;
  profileId: string | null;
  asyncState: AsyncUiState;
  lastError: string | null;
  completionPercent: number;
};

export type FrontendAction =
  | { type: "navigate"; surface: FrontendSurface }
  | { type: "set-profile"; profileId: string | null }
  | { type: "set-async"; asyncState: AsyncUiState }
  | { type: "set-error"; message: string | null }
  | { type: "set-completion"; completionPercent: number };

export type FrontendStore = {
  getState(): FrontendState;
  dispatch(action: FrontendAction): FrontendState;
  subscribe(listener: (state: FrontendState) => void): () => void;
};

export const DEFAULT_FRONTEND_STATE: FrontendState = {
  activeSurface: "dashboard",
  profileId: null,
  asyncState: "idle",
  lastError: null,
  completionPercent: 0
};

export function reduceFrontendState(state: FrontendState, action: FrontendAction): FrontendState {
  if (action.type === "navigate") {
    return { ...state, activeSurface: action.surface, lastError: null };
  }
  if (action.type === "set-profile") {
    return { ...state, profileId: action.profileId };
  }
  if (action.type === "set-async") {
    return { ...state, asyncState: action.asyncState };
  }
  if (action.type === "set-error") {
    return { ...state, lastError: action.message, asyncState: action.message ? "error" : state.asyncState };
  }
  const completionPercent = Math.max(0, Math.min(100, Math.round(action.completionPercent)));
  return { ...state, completionPercent };
}

export function createFrontendStore(initial: FrontendState = DEFAULT_FRONTEND_STATE): FrontendStore {
  let current = initial;
  const listeners = new Set<(state: FrontendState) => void>();
  return {
    getState(): FrontendState {
      return current;
    },
    dispatch(action: FrontendAction): FrontendState {
      current = reduceFrontendState(current, action);
      for (const listener of listeners) listener(current);
      return current;
    },
    subscribe(listener: (state: FrontendState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
