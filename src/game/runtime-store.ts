import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { RuntimeStateSchema, type RuntimeState } from "./contracts.js";

function createDefaultState(): RuntimeState {
  return {
    schemaVersion: "1.0",
    profiles: [],
    saves: [],
    syncHistory: [],
    friends: [],
    coopRooms: [],
    ranked: [],
    moderation: [],
    telemetry: [],
    crashes: [],
    ugcLevels: []
  };
}

export function readRuntimeState(stateFile: string): RuntimeState {
  if (!existsSync(stateFile)) return createDefaultState();
  try {
    const raw = JSON.parse(readFileSync(stateFile, "utf8")) as unknown;
    const parsed = RuntimeStateSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  } catch {
    return createDefaultState();
  }
  return createDefaultState();
}

export function writeRuntimeState(stateFile: string, state: RuntimeState): RuntimeState {
  const parsed = RuntimeStateSchema.parse(state);
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return parsed;
}

export function sha256Digest(value: unknown): `sha256:${string}` {
  const hash = createHash("sha256");
  const asString = typeof value === "string" ? value : JSON.stringify(value);
  hash.update(asString, "utf8");
  return `sha256:${hash.digest("hex")}`;
}
