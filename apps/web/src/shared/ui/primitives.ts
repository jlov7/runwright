export type PanelVariant = "primary" | "help" | "surface";
export type AsyncUiState = "idle" | "loading" | "success" | "error";
export type LayoutPrimitive = "page" | "panel" | "stack" | "inline" | "grid";
export type NavIconId = "dashboard" | "onboarding" | "challenge" | "ranked" | "creator" | "help";

export type IconToken = {
  id: NavIconId;
  label: string;
  glyph: "grid" | "spark" | "target" | "trophy" | "tool" | "life-ring";
};

export function panelClass(variant: PanelVariant): string {
  if (variant === "primary") return "panel panel-primary";
  if (variant === "help") return "panel panel-help";
  return "panel";
}

export function buttonLabel(baseLabel: string, state: AsyncUiState): string {
  if (state === "loading") return `${baseLabel}...`;
  if (state === "success") return `${baseLabel} Done`;
  if (state === "error") return `${baseLabel} Retry`;
  return baseLabel;
}

export function feedbackClass(state: AsyncUiState): string {
  if (state === "error") return "feedback error";
  if (state === "success") return "feedback success";
  return "feedback";
}

export function badgeTone(score: number): "critical" | "warning" | "good" | "excellent" {
  if (score < 50) return "critical";
  if (score < 70) return "warning";
  if (score < 90) return "good";
  return "excellent";
}

const LAYOUT_CLASS: Record<LayoutPrimitive, string> = {
  page: "rw-page",
  panel: "rw-panel",
  stack: "rw-stack",
  inline: "rw-inline",
  grid: "rw-grid"
};

const ICON_TOKENS: Record<NavIconId, IconToken> = {
  dashboard: { id: "dashboard", label: "Dashboard", glyph: "grid" },
  onboarding: { id: "onboarding", label: "Onboarding", glyph: "spark" },
  challenge: { id: "challenge", label: "Challenge", glyph: "target" },
  ranked: { id: "ranked", label: "Ranked", glyph: "trophy" },
  creator: { id: "creator", label: "Creator", glyph: "tool" },
  help: { id: "help", label: "Help", glyph: "life-ring" }
};

export function layoutClass(primitive: LayoutPrimitive): string {
  return LAYOUT_CLASS[primitive];
}

export function iconToken(id: NavIconId): IconToken {
  return ICON_TOKENS[id];
}
