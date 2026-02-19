import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type VisualBaseline = {
  schemaVersion: "1.0";
  htmlHash: string;
  cssHash: string;
  combinedHash: string;
};

function normalize(input: string): string {
  return input.replace(/\r\n/g, "\n").trim();
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

describe("frontend visual regression baseline", () => {
  it("matches committed shell baseline hashes", () => {
    const baseline = JSON.parse(
      readFileSync(resolve(process.cwd(), "tests", "fixtures", "frontend-visual-baseline.json"), "utf8")
    ) as VisualBaseline;

    const html = normalize(readFileSync(resolve(process.cwd(), "apps", "web", "index.html"), "utf8"));
    const css = normalize(readFileSync(resolve(process.cwd(), "apps", "web", "styles.css"), "utf8"));

    const htmlHash = sha256(html);
    const cssHash = sha256(css);
    const combinedHash = sha256(`${html}\n/*--split--*/\n${css}`);

    expect(baseline.schemaVersion).toBe("1.0");
    expect({
      htmlHash,
      cssHash,
      combinedHash
    }).toEqual({
      htmlHash: baseline.htmlHash,
      cssHash: baseline.cssHash,
      combinedHash: baseline.combinedHash
    });
  });
});
