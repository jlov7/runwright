import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(pathSegments: string[]): string {
  const path = join(process.cwd(), ...pathSegments);
  if (!existsSync(path)) {
    throw new Error(`Missing required governance file: ${path}`);
  }
  return readFileSync(path, "utf8");
}

describe("governance policy", () => {
  it("enforces OSS license and repository ownership policy files", () => {
    const license = read(["LICENSE"]);
    expect(license).toContain("Apache License");
    expect(license).toContain("Version 2.0");

    const codeowners = read([".github", "CODEOWNERS"]);
    expect(codeowners).toMatch(/\*\s+@/);

    const support = read([".github", "SUPPORT.md"]);
    expect(support).toContain("Triage and response targets");
    expect(support).toContain("2 business days");
  });

  it("enforces semver/deprecation and disclosure SLA policy docs", () => {
    const versioning = read(["docs", "policies", "versioning-and-deprecation.md"]);
    expect(versioning).toContain("Semantic Versioning");
    expect(versioning).toContain("Deprecation process");
    expect(versioning).toContain("Support windows");

    const security = read(["SECURITY.md"]);
    expect(security).toContain("Vulnerability disclosure SLA");
    expect(security).toContain("within 24 hours");
  });
});
