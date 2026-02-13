import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseManifest } from "../src/manifest.js";
import { canonicalizeLockfile, lockfilesEqual, type SkillbaseLockfile } from "../src/lockfile.js";

const manifestSourceChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-";

function digestFromChar(char: string): string {
  return `sha256:${char.repeat(64)}`;
}

describe("property-based contracts", () => {
  it("accepts valid owner/repo source patterns", () => {
    const token = fc
      .array(fc.constantFrom(...manifestSourceChars.split("")), { minLength: 1, maxLength: 16 })
      .map((chars) => chars.join(""));

    fc.assert(
      fc.property(token, token, (owner, repo) => {
        const source = `${owner}/${repo}`;
        const manifest = `version: 1\nskillsets:\n  base:\n    skills:\n      - source: ${source}\napply:\n  useSkillsets: [base]\n`;
        const parsed = parseManifest(manifest, { filename: "skillbase.yml" });
        expect(parsed.skillsets?.base.skills[0]?.source).toBe(source);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects whitespace-only local source payloads", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.constantFrom(" ", "\t"), { minLength: 1, maxLength: 12 })
          .map((chars) => chars.join("")),
        (spaces) => {
          const manifest = `version: 1\nskillsets:\n  base:\n    skills:\n      - source: "local:${spaces}"\napply:\n  useSkillsets: [base]\n`;
          expect(() => parseManifest(manifest, { filename: "skillbase.yml" })).toThrow(/source/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("is order-insensitive for canonical lockfile equality", () => {
    const skillName = fc
      .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), {
        minLength: 1,
        maxLength: 10
      })
      .map((chars) => chars.join(""));

    fc.assert(
      fc.property(skillName, skillName, (leftNameRaw, rightNameRaw) => {
        const leftName = leftNameRaw;
        const rightName = rightNameRaw === leftNameRaw ? `${rightNameRaw}-b` : rightNameRaw;

        const left: SkillbaseLockfile = {
          version: 1,
          generatedAt: "2026-02-13T00:00:00.000Z",
          sources: {
            "local:./skills": {
              type: "local",
              resolved: { ref: "local", value: "local" },
              skills: {
                [rightName]: { digest: digestFromChar("b"), path: "/tmp/right" },
                [leftName]: { digest: digestFromChar("a"), path: "/tmp/left" }
              }
            }
          }
        };

        const right: SkillbaseLockfile = {
          version: 1,
          generatedAt: "2026-02-13T00:00:00.000Z",
          sources: {
            "local:./skills": {
              type: "local",
              resolved: { ref: "local", value: "local" },
              skills: {
                [leftName]: { digest: digestFromChar("a"), path: "/tmp/left" },
                [rightName]: { digest: digestFromChar("b"), path: "/tmp/right" }
              }
            }
          }
        };

        expect(lockfilesEqual(left, right)).toBe(true);
        expect(JSON.stringify(canonicalizeLockfile(left))).toBe(JSON.stringify(canonicalizeLockfile(right)));
      }),
      { numRuns: 100 }
    );
  });
});
