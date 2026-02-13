import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { claudeAdapter } from "../src/adapters/claude.js";
import { codexAdapter } from "../src/adapters/codex.js";
import { cursorAdapter } from "../src/adapters/cursor.js";
import { evaluateAdapterContract } from "./harness/adapterContractHarness.js";

describe("adapter contract harness", () => {
  const cwd = resolve(join(process.cwd(), ".tmp-contract", "skillbase-project"));
  const homeDir = resolve(join(process.cwd(), ".tmp-contract", "skillbase-home"));

  const cases = [
    { adapter: codexAdapter, expectedSegment: ".codex" },
    { adapter: claudeAdapter, expectedSegment: ".claude" },
    { adapter: cursorAdapter, expectedSegment: ".cursor" }
  ];

  for (const testCase of cases) {
    it(`${testCase.adapter.name} satisfies adapter path contract`, () => {
      const result = evaluateAdapterContract(testCase.adapter, cwd, homeDir);
      expect(result.projectInstallDir).toBe(resolve(result.projectInstallDir));
      expect(result.globalInstallDir).toBe(resolve(result.globalInstallDir));
      expect(result.projectInstallDir).toContain(cwd);
      expect(result.globalInstallDir).toContain(homeDir);
      expect(result.projectInstallDir).toContain(testCase.expectedSegment);
      expect(result.globalInstallDir).toContain(testCase.expectedSegment);
      expect(result.projectInstallDir.endsWith("skills")).toBe(true);
      expect(result.globalInstallDir.endsWith("skills")).toBe(true);
      expect(result.projectInstallDir).not.toBe(result.globalInstallDir);
    });
  }
});
