import { join } from "node:path";

export const claudeAdapter = {
  name: "claude-code" as const,
  resolveInstallDir(scope: "global" | "project", cwd: string, homeDir: string): string {
    if (scope === "project") return join(cwd, ".claude", "skills");
    return join(homeDir, ".claude", "skills");
  }
};
