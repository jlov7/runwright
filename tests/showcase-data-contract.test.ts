import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PersonaStep = {
  title: string;
  outcome: string;
  command: string;
};

type Persona = {
  id: string;
  label: string;
  headline: string;
  timeToSuccess: string;
  pathName: string;
  steps: PersonaStep[];
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
};

type EvidenceStage = {
  name: string;
  status: "good" | "warn" | "blocked";
  detail: string;
  duration: string;
};

type EvidenceScenario = {
  id: string;
  label: string;
  status: "good" | "warn" | "blocked";
  evalScore: string;
  snapshotState: string;
  summary: string;
  stages: EvidenceStage[];
  changes: string[];
  nextActions: string[];
};

type TroubleshootingItem = {
  symptom: string;
  signal: string;
  impact: string;
  fixCommand: string;
  verifyCommand: string;
  docHref: string;
};

const showcaseRoot = join(process.cwd(), "apps", "showcase", "data");

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(showcaseRoot, filename), "utf8")) as T;
}

describe("showcase data contracts", () => {
  it("defines three curated onboarding personas with command-led first success paths", () => {
    const payload = readJson<{ generatedAt: string; personas: Persona[] }>("persona-paths.json");

    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.personas.map((persona) => persona.id)).toEqual(["builder", "reviewer", "operator"]);

    payload.personas.forEach((persona) => {
      expect(persona.label.length).toBeGreaterThan(3);
      expect(persona.steps.length).toBeGreaterThanOrEqual(3);
      expect(persona.primaryCta.href).toContain("https://github.com/jlov7/runwright");
      expect(persona.secondaryCta.href).toContain("https://github.com/jlov7/runwright");
      persona.steps.forEach((step) => {
        expect(step.title.length).toBeGreaterThan(4);
        expect(step.command).toMatch(/^(pnpm|runwright)/);
      });
    });
  });

  it("captures evidence states across good, warn, and blocked scenarios", () => {
    const payload = readJson<{ generatedAt: string; source: string; scenarios: EvidenceScenario[] }>(
      "evidence-snapshots.json"
    );

    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.source.length).toBeGreaterThan(5);
    expect(payload.scenarios.map((scenario) => scenario.status).sort()).toEqual(["blocked", "good", "warn"]);

    payload.scenarios.forEach((scenario) => {
      expect(scenario.stages).toHaveLength(3);
      expect(scenario.changes.length).toBeGreaterThan(0);
      expect(scenario.nextActions.length).toBeGreaterThan(0);
      scenario.stages.forEach((stage) => {
        expect(["good", "warn", "blocked"]).toContain(stage.status);
        expect(stage.duration.length).toBeGreaterThan(0);
      });
    });
  });

  it("maps troubleshooting symptoms to executable fix and verify commands", () => {
    const payload = readJson<{ generatedAt: string; items: TroubleshootingItem[] }>("troubleshooting.json");

    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.items.length).toBeGreaterThanOrEqual(4);

    const symptoms = new Set<string>();
    payload.items.forEach((item) => {
      symptoms.add(item.symptom);
      expect(item.fixCommand).toMatch(/^(pnpm|runwright)/);
      expect(item.verifyCommand).toMatch(/^(pnpm|runwright)/);
      expect(item.docHref).toContain("https://github.com/jlov7/runwright");
    });

    expect(symptoms.size).toBe(payload.items.length);
  });
});
