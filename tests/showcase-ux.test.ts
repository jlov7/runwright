import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const showcaseRoot = join(process.cwd(), "apps", "showcase");

function read(path: string): string {
  return readFileSync(join(showcaseRoot, path), "utf8");
}

describe("showcase UX contract", () => {
  it("exposes core UX lanes and interaction script wiring", () => {
    const html = read("index.html");
    expect(html).toContain('id="product"');
    expect(html).toContain('id="get-started"');
    expect(html).toContain('id="evidence"');
    expect(html).toContain('id="troubleshooting"');
    expect(html).toContain('id="docs-hub"');
    expect(html).toContain('id="persona-switcher"');
    expect(html).toContain('id="evidence-switcher"');
    expect(html).toContain('id="troubleshooting-grid"');
    expect(html).toContain('src="./app.js"');
  });

  it("ships artifact-driven data files for onboarding and evidence", () => {
    expect(existsSync(join(showcaseRoot, "data", "persona-paths.json"))).toBe(true);
    expect(existsSync(join(showcaseRoot, "data", "evidence-snapshots.json"))).toBe(true);
    expect(existsSync(join(showcaseRoot, "data", "troubleshooting.json"))).toBe(true);
  });

  it("includes high-quality visual system tokens and responsive behavior", () => {
    const css = read("styles.css");
    expect(css).toContain("--color-ink");
    expect(css).toContain("--color-accent");
    expect(css).toContain("--radius-xl");
    expect(css).toContain("@media (max-width: 980px)");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("contains interaction logic for persona, evidence, and troubleshooting flows", () => {
    const js = read("app.js");
    expect(js).toContain("renderPersona");
    expect(js).toContain("renderEvidenceScenario");
    expect(js).toContain("renderTroubleshooting");
    expect(js).toContain("copyCommand");
  });
});

