import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildScorecard, parseArgs, toMarkdown } from "../src/quality/scorecard.js";

function main(): void {
  const args = parseArgs(process.argv);
  const scorecard = buildScorecard(args);
  const jsonPath = resolve(args.out);
  const markdownPath = resolve(args.md);

  mkdirSync(dirname(jsonPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });

  writeFileSync(jsonPath, `${JSON.stringify(scorecard, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, toMarkdown(scorecard), "utf8");

  process.stdout.write(`${jsonPath}\n`);
  process.stdout.write(`${markdownPath}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
