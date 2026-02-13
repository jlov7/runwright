import { join } from "node:path";

export const codexAdapter = {
  name: "codex" as const,
  resolveInstallDir(scope: "global" | "project", cwd: string, homeDir: string): string {
    if (scope === "project") return join(cwd, ".codex", "skills");
    return join(homeDir, ".codex", "skills");
  }
};
