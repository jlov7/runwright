export type AdapterUnderTest = {
  name: string;
  resolveInstallDir: (scope: "global" | "project", cwd: string, homeDir: string) => string;
};

export type AdapterContractResult = {
  projectInstallDir: string;
  globalInstallDir: string;
};

export function evaluateAdapterContract(
  adapter: AdapterUnderTest,
  cwd: string,
  homeDir: string
): AdapterContractResult {
  return {
    projectInstallDir: adapter.resolveInstallDir("project", cwd, homeDir),
    globalInstallDir: adapter.resolveInstallDir("global", cwd, homeDir)
  };
}
