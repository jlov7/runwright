import { describe, expect, it } from "vitest";

import { badgeTone, buttonLabel, feedbackClass, panelClass } from "../apps/web/src/shared/ui/primitives";

describe("frontend ui primitives", () => {
  it("maps panel variants to stable classes", () => {
    expect(panelClass("primary")).toBe("panel panel-primary");
    expect(panelClass("help")).toBe("panel panel-help");
    expect(panelClass("surface")).toBe("panel");
  });

  it("derives async button labels", () => {
    expect(buttonLabel("Save", "idle")).toBe("Save");
    expect(buttonLabel("Save", "loading")).toBe("Save...");
    expect(buttonLabel("Save", "success")).toBe("Save Done");
    expect(buttonLabel("Save", "error")).toBe("Save Retry");
  });

  it("maps feedback and scoring tones", () => {
    expect(feedbackClass("error")).toBe("feedback error");
    expect(feedbackClass("success")).toBe("feedback success");
    expect(badgeTone(30)).toBe("critical");
    expect(badgeTone(60)).toBe("warning");
    expect(badgeTone(80)).toBe("good");
    expect(badgeTone(97)).toBe("excellent");
  });
});
