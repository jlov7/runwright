import { describe, expect, it } from "vitest";

import { classifyRuntimeError, formatRuntimeError } from "../apps/web/src/shared/error-taxonomy";

describe("frontend runtime error taxonomy", () => {
  it("maps known error codes to plain-language recovery guidance", () => {
    const classified = classifyRuntimeError({ code: "sync-conflict", message: "Version mismatch" });
    expect(classified.category).toBe("recoverable");
    const formatted = formatRuntimeError(classified);
    expect(formatted.nextAction).toContain("manual merge");
    expect(formatted.supportCode).toContain("RW-SYNC");
  });

  it("maps unknown errors to safe generic support guidance", () => {
    const classified = classifyRuntimeError({ code: "unknown", message: "Unexpected failure" });
    expect(classified.category).toBe("unknown");
    const formatted = formatRuntimeError(classified);
    expect(formatted.title).toContain("Unexpected issue");
    expect(formatted.nextAction).toContain("help");
  });
});
