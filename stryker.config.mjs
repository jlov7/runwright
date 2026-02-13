/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  appendPlugins: [
    "@stryker-mutator/vitest-runner",
    "@stryker-mutator/typescript-checker"
  ],
  testRunner: "vitest",
  checkers: ["typescript"],
  coverageAnalysis: "perTest",
  ignoreStatic: true,
  mutator: {
    excludedMutations: [
      "ArrayDeclaration",
      "ArrowFunction",
      "MethodExpression",
      "ObjectLiteral",
      "Regex",
      "StringLiteral"
    ]
  },
  mutate: ["src/scanner/security.ts", "src/manifest.ts", "src/lockfile.ts"],
  testFiles: [
    "tests/security-mutation.test.ts",
    "tests/scanner.test.ts",
    "tests/manifest.test.ts",
    "tests/lockfile.test.ts"
  ],
  reporters: ["clear-text", "json", "html"],
  jsonReporter: {
    fileName: "reports/mutation/mutation.json"
  },
  htmlReporter: {
    fileName: "reports/mutation/mutation.html"
  },
  thresholds: {
    high: 90,
    low: 85,
    break: 85
  },
  concurrency: 2,
  timeoutMS: 10000,
  timeoutFactor: 2,
  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
  allowConsoleColors: false
};

export default config;
