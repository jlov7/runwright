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
      expect(html).toContain("Help & Tooltips");

      const docs = await fetch(`${runtime.baseUrl}/docs/help/README.md`);
      expect(docs.status).toBe(200);
      expect(await docs.text()).toContain("# Help Center");
    } finally {
      await runtime.close();
    }
  });
});
