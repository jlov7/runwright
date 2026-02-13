import { join } from "node:path";

export const cursorAdapter = {
  name: "cursor" as const,
  resolveInstallDir(scope: "global" | "project", cwd: string, homeDir: string): string {
    if (scope === "project") return join(cwd, ".cursor", "skills");
    return join(homeDir, ".cursor", "skills");
  }
};
