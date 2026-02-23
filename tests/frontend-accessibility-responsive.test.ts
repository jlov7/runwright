import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function loadShellHtml(): string {
  return readFileSync(resolve(process.cwd(), "apps", "web", "index.html"), "utf8");
}

function loadShellCss(): string {
  return readFileSync(resolve(process.cwd(), "apps", "web", "styles.css"), "utf8");
}

describe("frontend accessibility and responsive guards", () => {
  it("keeps landmarks, keyboard skip link, and live regions for primary flows", () => {
    const html = loadShellHtml();
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('href="#workspace-title"');
    expect(html).toContain('id="overlay-backdrop"');
    expect(html).toContain('id="status-live-region"');
    expect(html).toContain('id="global-nav"');
    expect(html).toContain("<main class=\"layout rw-page\"");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('id="surface-title" tabindex="-1"');
    expect(html).toContain('id="inline-help"');
    expect(html).toContain('id="explore-hub"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("keeps explicit labels and input relationships for interactive controls", () => {
    const html = loadShellHtml();
    expect(html).toContain('<label for="surface-search">');
    expect(html).toContain('<label for="mobile-surface-select">');
    expect(html).toContain('<label for="handle">');
    expect(html).toContain('<label for="locale">');
    expect(html).toContain('<label for="friend-code">');
    expect(html).toContain('<label for="moderation-target-id">');
    expect(html).toContain('<label for="moderation-reason">');
    expect(html).toContain('<label for="text-scale">');
    expect(html).toContain('<label for="remap-profile">');
    expect(html).toContain('id="handle"');
    expect(html).toContain('aria-invalid="false"');
    expect(html).toContain('aria-errormessage="form-error"');
    expect(html).toContain('id="form-error" class="feedback error" role="alert" aria-live="assertive"');
    expect(html).toContain('id="surface-empty-title"');
    expect(html).toContain('id="surface-loading-copy"');
  });

  it("enforces reduced-motion and mobile breakpoint behavior in CSS", () => {
    const css = loadShellCss();
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("body.reduced-motion");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain(".mobile-surface-nav");
    expect(css).toContain(".global-nav");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });

  it("keeps minimum tap target sizing and orientation resilience styles", () => {
    const css = loadShellCss();
    expect(css).toContain("button {");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain(".nav-item {");
    expect(css).toContain("@media (orientation: landscape) and (max-width: 900px)");
    expect(css).toContain("var(--color-focus-ring)");
  });
});
