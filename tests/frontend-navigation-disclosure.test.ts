import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getSurfaceLockReason,
  getVisibleSurfaces,
  normalizeSurfaceInput
} from "../apps/web/navigation.js";

describe("frontend navigation disclosure", () => {
  it("defaults to core surfaces for first-run context", () => {
    const visible = getVisibleSurfaces({
      profileReady: false,
      onboardingReady: false,
      showAdvancedNav: false,
      activeSurface: "dashboard"
    });
    expect(visible).toEqual(["dashboard", "profile", "onboarding", "help"]);
  });

  it("shows advanced surfaces when expanded mode is enabled", () => {
    const visible = getVisibleSurfaces({
      profileReady: true,
      onboardingReady: false,
      showAdvancedNav: true,
      activeSurface: "dashboard"
    });
    const advanced = ["challenge", "campaign", "coop", "ranked", "creator", "moderation", "liveops", "analytics"];
    for (const surface of advanced) {
      expect(visible).toContain(surface);
    }
  });

  it("returns lock guidance for blocked advanced surfaces", () => {
    const profileLock = getSurfaceLockReason("creator", {
      profileReady: false,
      onboardingReady: false
    });
    expect(profileLock?.message).toContain("Create a profile");
    expect(profileLock?.actionTarget).toBe("onboarding");

    const onboardingLock = getSurfaceLockReason("ranked", {
      profileReady: true,
      onboardingReady: false
    });
    expect(onboardingLock?.message).toContain("Finish onboarding");
    expect(onboardingLock?.actionLabel).toContain("onboarding");
  });

  it("normalizes aliases used by command-bar navigation", () => {
    expect(normalizeSurfaceInput("support")).toBe("help");
    expect(normalizeSurfaceInput("quest")).toBe("challenge");
    expect(normalizeSurfaceInput("unknown")).toBeNull();
  });

  it("ships focused-mode controls in the shell markup", () => {
    const html = readFileSync(resolve(process.cwd(), "apps", "web", "index.html"), "utf8");
    expect(html).toContain('id="toggle-advanced-nav"');
    expect(html).toContain('id="nav-mode-hint"');
    expect(html).toContain('id="journey-strip-steps"');
    expect(html).toContain('id="journey-why"');
  });
});
