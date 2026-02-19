export type PanelVariant = "primary" | "help" | "surface";
export type AsyncUiState = "idle" | "loading" | "success" | "error";

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
