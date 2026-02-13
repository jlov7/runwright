import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function requireFile(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Missing required operations artifact: ${path}`);
  }
  return readFileSync(path, "utf8");
}

describe("operations readiness policy", () => {
  it("requires operator and incident runbooks", () => {
    const root = join(process.cwd(), "docs", "operations");
    const operatorRunbook = requireFile(join(root, "operator-runbook.md"));
    const incidentPlaybook = requireFile(join(root, "incident-playbook.md"));
    const failureCatalog = requireFile(join(root, "failure-mode-catalog.md"));
    const breakGlass = requireFile(join(root, "break-glass-recovery.md"));

    expect(operatorRunbook).toContain("Daily health checks");
    expect(incidentPlaybook).toContain("First 30 minutes");
    expect(failureCatalog).toContain("Integrity failures");
    expect(breakGlass).toContain("Hard constraints");
  });

  it("requires external scrutiny workflow artifacts", () => {
    const root = join(process.cwd(), "docs", "operations");
    const scrutiny = requireFile(join(root, "external-scrutiny-program.md"));
    expect(scrutiny).toContain("Entry criteria");
    expect(scrutiny).toContain("Exit criteria");

    const issueTemplateRoot = join(process.cwd(), ".github", "ISSUE_TEMPLATE");
    const templateConfig = requireFile(join(issueTemplateRoot, "config.yml"));
    const securityTemplate = requireFile(join(issueTemplateRoot, "external-security-review.md"));
    const pilotTemplate = requireFile(join(issueTemplateRoot, "pilot-feedback.md"));

    expect(templateConfig).toContain("blank_issues_enabled: false");
    expect(securityTemplate).toContain("External Security Review Finding");
    expect(pilotTemplate).toContain("Pilot User Feedback");
  });
});
