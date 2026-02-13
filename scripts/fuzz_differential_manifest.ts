import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseManifest } from "../src/manifest.js";

type Classification = {
  parseValid: boolean;
  cliInvalidManifest: boolean;
  cliStatus: number;
  cliCode?: string;
  stderr: string;
  stdout: string;
};

type RunSummary = {
  schemaVersion: "1.0";
  seed: number;
  cases: number;
  parseValid: number;
  parseInvalid: number;
  cliInvalidManifest: number;
  mismatches: number;
  artifactDir: string;
  cliMode: "dist" | "tsx";
};

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

function randomLine(rng: () => number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789[]:{}_-";
  const length = 6 + randInt(rng, 22);
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[randInt(rng, alphabet.length)] ?? "x";
  return out;
}

function mutateManifest(base: string, rng: () => number): string {
  const lines = base.split("\n");
  const operations = 1 + randInt(rng, 6);

  for (let opIndex = 0; opIndex < operations; opIndex += 1) {
    const operation = randInt(rng, 5);
    if (operation === 0 && lines.length > 0) {
      const lineIndex = randInt(rng, lines.length);
      lines[lineIndex] = (lines[lineIndex] ?? "").replace(/skillsets|skills|source|apply|useSkillsets|version/g, (token) => {
        if (token === "version") return "versoin";
        if (token === "skillsets") return "skillsetss";
        if (token === "skills") return "skils";
        if (token === "source") return "soruce";
        if (token === "apply") return "aply";
        return "useSkillsetz";
      });
    } else if (operation === 1 && lines.length > 0) {
      const lineIndex = randInt(rng, lines.length);
      lines.splice(lineIndex, 1);
    } else if (operation === 2) {
      const lineIndex = randInt(rng, lines.length + 1);
      lines.splice(lineIndex, 0, `${randomLine(rng)}: ${randomLine(rng)}`);
    } else if (operation === 3 && lines.length > 2) {
      const left = randInt(rng, lines.length);
      const right = randInt(rng, lines.length);
      const tmp = lines[left];
      lines[left] = lines[right] ?? "";
      lines[right] = tmp ?? "";
    } else if (operation === 4 && lines.length > 0) {
      const lineIndex = randInt(rng, lines.length);
      lines[lineIndex] = `${lines[lineIndex] ?? ""}${rng() > 0.5 ? " [" : " ]"}`;
    }
  }

  return `${lines.join("\n")}\n`;
}

function classifyManifest(rawManifest: string, projectDir: string, rootDir: string): Classification {
  let parseValid = true;
  try {
    parseManifest(rawManifest, { filename: "skillbase.yml" });
  } catch {
    parseValid = false;
  }

  writeFileSync(join(projectDir, "skillbase.yml"), rawManifest, "utf8");

  const distCli = join(rootDir, "dist", "cli.js");
  const hasDistCli = existsSync(distCli);
  const command = hasDistCli ? "node" : join(rootDir, "node_modules", ".bin", "tsx");
  const commandArgs = hasDistCli ? [distCli, "scan", "--json"] : [join(rootDir, "src", "cli.ts"), "scan", "--json"];
  const result = spawnSync(command, commandArgs, {
    cwd: projectDir,
    encoding: "utf8"
  });

  const status = result.status ?? 1;
  let code: string | undefined;
  try {
    const payload = JSON.parse(result.stdout);
    if (payload && typeof payload === "object" && typeof (payload as { code?: unknown }).code === "string") {
      code = (payload as { code: string }).code;
    }
  } catch {
    // no-op; non-json output becomes mismatch signal below via missing code/status
  }

  const cliInvalidManifest = status === 10 || code === "invalid-manifest";

  return {
    parseValid,
    cliInvalidManifest,
    cliStatus: status,
    cliCode: code,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function mismatch(classification: Classification): boolean {
  return classification.parseValid === classification.cliInvalidManifest;
}

function minimizeManifest(rawManifest: string, checker: (candidate: string) => boolean): string {
  let lines = rawManifest.split("\n");
  if (lines.length <= 1) return rawManifest;

  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (let index = 0; index < lines.length; index += 1) {
      if (lines.length <= 1) break;
      const candidateLines = [...lines.slice(0, index), ...lines.slice(index + 1)];
      const candidate = `${candidateLines.join("\n")}\n`;
      if (!candidate.trim()) continue;
      if (checker(candidate)) {
        lines = candidateLines;
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return `${lines.join("\n")}\n`;
}

function main(): number {
  const rootDir = process.cwd();
  const seed = Number(process.env.SKILLBASE_FUZZ_SEED ?? "12648430");
  const cases = Number(process.env.SKILLBASE_FUZZ_CASES ?? "128");
  const artifactRoot = resolve(rootDir, process.env.SKILLBASE_FUZZ_ARTIFACT_DIR ?? ".fuzz-artifacts/manifest-differential");

  if (!Number.isSafeInteger(seed) || !Number.isFinite(seed)) {
    throw new Error("SKILLBASE_FUZZ_SEED must be a finite integer");
  }
  if (!Number.isSafeInteger(cases) || cases <= 0) {
    throw new Error("SKILLBASE_FUZZ_CASES must be a positive integer");
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = join(artifactRoot, runId);
  mkdirSync(runDir, { recursive: true });

  const tempProjectDir = mkdtempSync(join(tmpdir(), "skillbase-fuzz-diff-"));
  try {
    mkdirSync(join(tempProjectDir, "skills", "safe"), { recursive: true });
    writeFileSync(
      join(tempProjectDir, "skills", "safe", "SKILL.md"),
      `---\nname: safe\ndescription: safe\n---\n\n# Safe\n`,
      "utf8"
    );

    const baseManifest = `version: 1\nskillsets:\n  base:\n    skills:\n      - source: local:./skills\napply:\n  useSkillsets: [base]\n`;
    const rng = createRng(seed);

    const mismatchDirs: string[] = [];
    let parseValidCount = 0;
    let parseInvalidCount = 0;
    let cliInvalidManifestCount = 0;

    for (let index = 0; index < cases; index += 1) {
      const candidate = mutateManifest(baseManifest, rng);
      const classification = classifyManifest(candidate, tempProjectDir, rootDir);

      if (classification.parseValid) parseValidCount += 1;
      else parseInvalidCount += 1;
      if (classification.cliInvalidManifest) cliInvalidManifestCount += 1;

      if (!mismatch(classification)) continue;

      const caseLabel = `case-${String(index).padStart(4, "0")}`;
      const caseDir = join(runDir, caseLabel);
      mkdirSync(caseDir, { recursive: true });

      const minimized = minimizeManifest(candidate, (input) => mismatch(classifyManifest(input, tempProjectDir, rootDir)));
      const minimizedClassification = classifyManifest(minimized, tempProjectDir, rootDir);

      writeFileSync(join(caseDir, "original.skillbase.yml"), candidate, "utf8");
      writeFileSync(join(caseDir, "minimized.skillbase.yml"), minimized, "utf8");
      writeFileSync(
        join(caseDir, "classification.json"),
        `${JSON.stringify({ original: classification, minimized: minimizedClassification }, null, 2)}\n`,
        "utf8"
      );
      mismatchDirs.push(caseLabel);
    }

    const summary: RunSummary = {
      schemaVersion: "1.0",
      seed,
      cases,
      parseValid: parseValidCount,
      parseInvalid: parseInvalidCount,
      cliInvalidManifest: cliInvalidManifestCount,
      mismatches: mismatchDirs.length,
      artifactDir: runDir,
      cliMode: existsSync(join(rootDir, "dist", "cli.js")) ? "dist" : "tsx"
    };

    writeFileSync(join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

    if (mismatchDirs.length > 0) {
      process.stderr.write(`manifest differential fuzz: ${mismatchDirs.length} mismatch(es). See ${runDir}\n`);
      return 1;
    }

    process.stdout.write(`manifest differential fuzz: no mismatches across ${cases} cases (seed=${seed})\n`);
    process.stdout.write(`artifact summary: ${join(runDir, "summary.json")}\n`);
    return 0;
  } finally {
    rmSync(tempProjectDir, { recursive: true, force: true });
  }
}

process.exit(main());
