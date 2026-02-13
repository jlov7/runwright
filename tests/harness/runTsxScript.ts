import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type TsxRunResult = {
  status: number;
  stdout: string;
  stderr: string;
  elapsedMs: number;
};

const PROJECT_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const NODE_COMMAND = process.execPath;
const TSX_CLI_PATH = resolve(PROJECT_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

export function runTsxScript(params: {
  scriptRelativePath: string;
  args: string[];
  cwd: string;
  envOverrides?: Record<string, string>;
}): TsxRunResult {
  const startedAtNs = process.hrtime.bigint();
  const result = spawnSync(
    NODE_COMMAND,
    [TSX_CLI_PATH, resolve(PROJECT_ROOT, params.scriptRelativePath), ...params.args],
    {
      cwd: params.cwd,
      encoding: "utf8",
      env: params.envOverrides ? { ...process.env, ...params.envOverrides } : process.env
    }
  );
  const elapsedMs = Number((process.hrtime.bigint() - startedAtNs) / BigInt(1_000_000));
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
    elapsedMs
  };
}
