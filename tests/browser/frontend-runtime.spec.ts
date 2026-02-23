import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createGameRuntimeServer } from "../../src/game/runtime";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

test.afterAll(async () => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test.describe("frontend browser journeys", () => {
  test("first visit renders guided overlay and stable shell screenshot", async ({ page }) => {
    const projectDir = makeTempDir("runwright-browser-first-visit-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      staticRoot: resolve(process.cwd(), "apps", "web")
    });

    try {
      await page.goto(runtime.baseUrl, { waitUntil: "networkidle" });
      await expect(page.locator("#welcome-overlay")).toBeVisible();
      await expect(page.locator("#surface-title")).toContainText("Dashboard");
      await expect(page).toHaveScreenshot("first-visit-shell.png", {
        animations: "disabled",
        fullPage: true,
        maxDiffPixelRatio: 0.02
      });
    } finally {
      await runtime.close();
    }
  });

  test("onboarding reaches first success and ranked failure recovery remains actionable", async ({ page }) => {
    const projectDir = makeTempDir("runwright-browser-onboarding-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      rankedSalt: "browser-suite-salt",
      staticRoot: resolve(process.cwd(), "apps", "web")
    });

    try {
      await page.goto(runtime.baseUrl, { waitUntil: "networkidle" });
      await expect(page.locator("#welcome-overlay")).toBeVisible();
      await page.getByRole("button", { name: "Start Guided Setup" }).click();
      await expect(page.locator("#welcome-overlay")).toBeHidden();
      await page.locator("#handle").fill("browserpilot");
      await page.locator("#create-profile").click();

      await page.locator("#run-tutorial").click();
      await page.locator("#save-progress").click();
      await page.locator("#publish-level").click();

      await expect(page.locator("#feedback")).toContainText("First success should now be complete");
      await page.locator('[data-surface="onboarding"]').first().click();
      await expect(page.locator("#submit-ranked")).toBeVisible();
      await page.locator("#submit-ranked").click();
      await expect(page.locator("#feedback")).toContainText("Ranked submission rejected");
      await expect(page.locator("#feedback")).toContainText("Next:");

      await expect(page).toHaveScreenshot("onboarding-success-and-ranked-recovery.png", {
        animations: "disabled",
        fullPage: true,
        maxDiffPixelRatio: 0.025
      });
    } finally {
      await runtime.close();
    }
  });

  test("keyboard traversal and axe scan pass baseline accessibility checks", async ({ page }) => {
    const projectDir = makeTempDir("runwright-browser-a11y-");
    const stateFile = join(projectDir, ".skillbase", "runtime-state.json");
    const runtime = await createGameRuntimeServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
      staticRoot: resolve(process.cwd(), "apps", "web")
    });

    try {
      await page.goto(runtime.baseUrl, { waitUntil: "networkidle" });
      await expect(page.locator("#welcome-overlay")).toBeVisible();
      await expect(page.locator(":focus")).toHaveAttribute("id", "welcome-start");
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toHaveAttribute("id", "welcome-dismiss");
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toHaveAttribute("id", "persona-mode");
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toHaveAttribute("id", "welcome-start");

      await page.keyboard.press("Escape");
      await expect(page.locator("#welcome-overlay")).toBeHidden();
      await page.keyboard.press("Tab");
      const focusedId = await page.evaluate(() => document.activeElement?.id ?? "");
      expect(["welcome-start", "welcome-dismiss", "persona-mode"]).not.toContain(focusedId);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();

      const axeResults = await new AxeBuilder({ page }).analyze();
      const critical = axeResults.violations.filter((violation) => violation.impact === "critical");
      expect(critical).toEqual([]);
    } finally {
      await runtime.close();
    }
  });
});
