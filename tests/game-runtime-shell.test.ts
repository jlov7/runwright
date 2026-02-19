import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createGameRuntimeServer } from "../src/game/runtime.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("game runtime web shell", () => {
  it("includes onboarding/help markup and accessibility affordances", () => {
    const html = readFileSync(resolve(process.cwd(), "apps", "web", "index.html"), "utf8");
    expect(html).toContain('id="profile-form"');
    expect(html).toContain('id="onboarding-steps"');
    expect(html).toContain('id="global-nav"');
    expect(html).toContain('id="breadcrumb-trail"');
    expect(html).toContain('id="surface-search"');
    expect(html).toContain('id="mobile-surface-select"');
    expect(html).toContain('id="surface-title"');
    expect(html).toContain('id="surface-status"');
    expect(html).toContain('id="surface-primary-action"');
    expect(html).toContain('id="surface-empty-state"');
    expect(html).toContain('id="surface-loading-skeleton"');
    expect(html).toContain('id="dashboard-surface"');
    expect(html).toContain('id="profile-surface"');
    expect(html).toContain('id="onboarding-surface"');
    expect(html).toContain('id="challenge-surface"');
    expect(html).toContain('id="campaign-surface"');
    expect(html).toContain('id="coop-surface"');
    expect(html).toContain('id="ranked-surface"');
    expect(html).toContain('id="creator-surface"');
    expect(html).toContain('id="moderation-surface"');
    expect(html).toContain('id="liveops-surface"');
    expect(html).toContain('id="analytics-surface"');
    expect(html).toContain('id="help-surface"');
    expect(html).toContain('id="onboarding-skip"');
    expect(html).toContain('id="onboarding-resume"');
    expect(html).toContain('id="onboarding-bootstrap"');
    expect(html).toContain('id="onboarding-diagnostics"');
    expect(html).toContain('id="coachmark-banner"');
    expect(html).toContain('id="coachmark-dismiss"');
    expect(html).toContain('id="coachmark-revisit"');
    expect(html).toContain('id="celebration-banner"');
    expect(html).toContain('id="network-banner"');
    expect(html).toContain('id="latency-alert"');
    expect(html).toContain('id="retry-queue-panel"');
    expect(html).toContain('id="copy-diagnostics"');
    expect(html).toContain('id="diagnostic-output"');
    expect(html).toContain('id="toast-stack"');
    expect(html).toContain('id="undo-last-action"');
    expect(html).toContain('id="global-error-boundary"');
    expect(html).toContain('id="status-live-region"');
    expect(html).toContain('id="form-error"');
    expect(html).toContain('href="#workspace-title"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("docs/help/README.md");
    expect(html).toContain("Run Tutorial Hint");
    expect(html).toContain("Save Progress");
  });

  it("serves the shell through runtime static hosting", async () => {
    const projectDir = makeTempDir("runwright-web-shell-runtime-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      staticRoot: resolve(process.cwd(), "apps", "web")
    });
    try {
      const response = await fetch(`${runtime.baseUrl}/`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("First Success Control Room");
      expect(html).toContain("Surface Command Bar");
      expect(html).toContain("Campaign Progression");
      expect(html).toContain("Help &amp; Tooltips");
      expect(html).toContain("Retry Backoff Queue");
      expect(html).toContain("Diagnostic Packet");

      const docs = await fetch(`${runtime.baseUrl}/docs/help/README.md`);
      expect(docs.status).toBe(200);
      expect(await docs.text()).toContain("# Help Center");

      const surfaceHelpers = await fetch(`${runtime.baseUrl}/surfaces.js`);
      expect(surfaceHelpers.status).toBe(200);
      expect(await surfaceHelpers.text()).toContain("formatSeasonSummary");
    } finally {
      await runtime.close();
    }
  });
});
