export type RuntimeErrorInput = {
  code?: string;
  message?: string;
};

export type RuntimeErrorCategory = "recoverable" | "permission" | "validation" | "unknown";

export type ClassifiedRuntimeError = {
  code: string;
  message: string;
  category: RuntimeErrorCategory;
  nextAction: string;
  supportCode: string;
};

export type FormattedRuntimeError = {
  title: string;
  body: string;
  nextAction: string;
  supportCode: string;
};

const ERROR_MAP: Record<string, Omit<ClassifiedRuntimeError, "code" | "message">> = {
  "sync-conflict": {
    category: "recoverable",
    nextAction: "Run a manual merge or retry with the latest save version.",
    supportCode: "RW-SYNC-409"
  },
  "anti-tamper-failed": {
    category: "validation",
    nextAction: "Re-run the action with an untampered payload.",
    supportCode: "RW-RANK-422"
  },
  "profile-not-found": {
    category: "validation",
    nextAction: "Create or select a valid profile, then retry.",
    supportCode: "RW-PROFILE-404"
  },
  "payload-too-large": {
    category: "validation",
    nextAction: "Reduce payload size and submit again.",
    supportCode: "RW-REQ-413"
  },
  "permission-denied": {
    category: "permission",
    nextAction: "Check access rights and session status before retrying.",
    supportCode: "RW-AUTH-403"
  }
};

export function classifyRuntimeError(input: RuntimeErrorInput): ClassifiedRuntimeError {
  const code = (input.code ?? "unknown").trim() || "unknown";
  const message = (input.message ?? "Unexpected runtime failure").trim() || "Unexpected runtime failure";
  const mapped = ERROR_MAP[code];
  if (!mapped) {
    return {
      code,
      message,
      category: "unknown",
      nextAction: "Open help docs and retry with diagnostics enabled.",
      supportCode: "RW-UNKNOWN"
    };
  }
  return {
    code,
    message,
    category: mapped.category,
    nextAction: mapped.nextAction,
    supportCode: mapped.supportCode
  };
}

export function formatRuntimeError(error: ClassifiedRuntimeError): FormattedRuntimeError {
  const title = error.category === "unknown" ? "Unexpected issue" : `Action failed: ${error.code}`;
  return {
    title,
    body: error.message,
    nextAction: error.nextAction,
    supportCode: error.supportCode
  };
}
