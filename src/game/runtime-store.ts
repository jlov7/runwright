import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { RuntimeStateSchema, type RuntimeState } from "./contracts.js";

function createDefaultState(): RuntimeState {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0",
    persistence: {
      backend: "json-ledger-v2",
      migratedAt: now,
      migrationNotes: ["initialized-with-default-state"]
    },
    profiles: [],
    authSessions: [],
    authLinks: [],
    passwordResetTickets: [],
    mergeAudits: [],
    saves: [],
    syncHistory: [],
    saveConflicts: [],
    friends: [],
    coopRooms: [],
    ranked: [],
    antiCheat: [],
    moderation: [],
    telemetry: [],
    telemetryReceipts: [],
    crashes: [],
    ugcLevels: []
  };
}

function upgradeLegacyState(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const legacy = raw as Record<string, unknown>;
  if (legacy.schemaVersion !== "1.0") return raw;
  const now = new Date().toISOString();
  const existingNotes =
    legacy.persistence && typeof legacy.persistence === "object" && Array.isArray((legacy.persistence as Record<string, unknown>).migrationNotes)
      ? ((legacy.persistence as Record<string, unknown>).migrationNotes as unknown[]).filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
        )
      : [];
  return {
    ...legacy,
    persistence: {
      backend: "json-ledger-v2",
      migratedAt:
        legacy.persistence &&
        typeof legacy.persistence === "object" &&
        typeof (legacy.persistence as Record<string, unknown>).migratedAt === "string"
          ? ((legacy.persistence as Record<string, unknown>).migratedAt as string)
          : now,
      migrationNotes: existingNotes.includes("legacy-runtime-state-upgraded")
        ? existingNotes
        : [...existingNotes, "legacy-runtime-state-upgraded"]
    },
    authSessions: Array.isArray(legacy.authSessions) ? legacy.authSessions : [],
    authLinks: Array.isArray(legacy.authLinks) ? legacy.authLinks : [],
    passwordResetTickets: Array.isArray(legacy.passwordResetTickets) ? legacy.passwordResetTickets : [],
    mergeAudits: Array.isArray(legacy.mergeAudits) ? legacy.mergeAudits : [],
    saveConflicts: Array.isArray(legacy.saveConflicts) ? legacy.saveConflicts : [],
    antiCheat: Array.isArray(legacy.antiCheat) ? legacy.antiCheat : [],
    telemetryReceipts: Array.isArray(legacy.telemetryReceipts) ? legacy.telemetryReceipts : []
  };
}

export function readRuntimeState(stateFile: string): RuntimeState {
  if (!existsSync(stateFile)) return createDefaultState();
  try {
    const raw = JSON.parse(readFileSync(stateFile, "utf8")) as unknown;
    const parsed = RuntimeStateSchema.safeParse(upgradeLegacyState(raw));
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
