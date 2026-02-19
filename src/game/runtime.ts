import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, resolve } from "node:path";
import { z } from "zod";
import {
  AccessibilitySettingsSchema,
  LocaleSchema,
  type Profile,
  type RuntimeState
} from "./contracts.js";
import { readRuntimeState, sha256Digest, writeRuntimeState } from "./runtime-store.js";

type RuntimeServerOptions = {
  host?: string;
  port?: number;
  stateFile: string;
  rankedSalt?: string;
  staticRoot?: string;
  clock?: () => Date;
};

type RuntimeServerHandle = {
  host: string;
  port: number;
  stateFile: string;
  baseUrl: string;
  close: () => Promise<void>;
};

type JsonMap = Record<string, unknown>;

class HttpError extends Error {
  status: number;
  code: string;
  details?: JsonMap;

  constructor(status: number, code: string, message: string, details?: JsonMap) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const SignupRequestSchema = z.object({
  handle: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-zA-Z0-9 _-]+$/),
  locale: LocaleSchema.default("en-US")
});

const LoginRequestSchema = z.object({
  handle: z.string().min(1).max(32),
  provider: z.enum(["email", "google", "apple", "github"]).default("email"),
  deviceId: z.string().min(2).max(120)
});

const LogoutRequestSchema = z.object({
  sessionId: z.string().min(1)
});

const PasswordResetRequestSchema = z.object({
  handle: z.string().min(1).max(32)
});

const PasswordResetConfirmSchema = z.object({
  ticketId: z.string().min(1)
});

const DeviceRevokeRequestSchema = z.object({
  profileId: z.string().min(1),
  deviceId: z.string().min(2).max(120)
});

const AuthLinkRequestSchema = z.object({
  profileId: z.string().min(1),
  provider: z.enum(["email", "google", "apple", "github"]),
  externalId: z.string().min(3).max(160)
});

const AuthMergeRequestSchema = z.object({
  primaryProfileId: z.string().min(1),
  secondaryProfileId: z.string().min(1)
});

const SaveRequestSchema = z.object({
  profileId: z.string().min(1),
  strategy: z.enum(["last-write-wins", "manual-merge", "server-authoritative"]).default("last-write-wins"),
  baseVersion: z.number().int().nonnegative().optional(),
  payload: z.record(z.unknown())
});

const FriendRequestSchema = z.object({
  profileId: z.string().min(1),
  friendCode: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)
});

const CoopJoinRequestSchema = z.object({
  profileId: z.string().min(1),
  roomId: z.string().min(1).max(64).optional()
});

const UgcCreateRequestSchema = z.object({
  profileId: z.string().min(1),
  title: z.string().min(1).max(80),
  difficulty: z.enum(["bronze", "silver", "gold", "legendary"]).default("silver")
});

const UgcRateRequestSchema = z.object({
  profileId: z.string().min(1),
  rating: z.number().min(1).max(5)
});

const ModerationRequestSchema = z.object({
  profileId: z.string().min(1),
  targetType: z.enum(["ugc", "chat", "profile"]),
  targetId: z.string().min(1),
  reason: z.string().min(1).max(240)
});

const TelemetryRequestSchema = z.object({
  profileId: z.string().min(1),
  eventId: z.string().min(1).max(120).optional(),
  type: z.string().min(1).max(120),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()]))
});

const CrashRequestSchema = z.object({
  profileId: z.string().min(1),
  surface: z.string().min(1).max(120),
  message: z.string().min(1).max(800),
  stack: z.string().max(5000).optional()
});

const RankedRequestSchema = z.object({
  profileId: z.string().min(1),
  score: z.number().int().nonnegative(),
  clientDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/)
});

const PreferencePatchSchema = z.object({
  locale: LocaleSchema.optional(),
  accessibility: AccessibilitySettingsSchema.partial().optional()
});

function nowIso(clock: (() => Date) | undefined): string {
  return (clock ?? (() => new Date()))().toISOString();
}

function buildDefaultAccessibility() {
  return {
    preset: "default" as const,
    textScale: 1,
    reducedMotion: false,
    highContrast: false,
    remapProfile: "default" as const
  };
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload)}\n`);
}

function parseBodyChunks(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer | string) => {
      const asBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += asBuffer.byteLength;
      if (size > 1_000_000) {
        rejectBody(new HttpError(413, "payload-too-large", "Request payload exceeds 1MB"));
        return;
      }
      chunks.push(asBuffer);
    });
    req.on("error", (error) => {
      rejectBody(new HttpError(400, "request-body-error", `Unable to read request body: ${error.message}`));
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolveBody({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
        resolveBody(parsed);
      } catch {
        rejectBody(new HttpError(400, "invalid-json", "Request body must be valid JSON"));
      }
    });
  });
}

function getProfile(state: RuntimeState, profileId: string): Profile | undefined {
  return state.profiles.find((profile) => profile.id === profileId);
}

function getProfileByHandle(state: RuntimeState, handle: string): Profile | undefined {
  const normalized = handle.trim().toLowerCase();
  return state.profiles.find((profile) => profile.handle.trim().toLowerCase() === normalized);
}

function requireProfile(state: RuntimeState, profileId: string): Profile {
  const profile = getProfile(state, profileId);
  if (!profile) throw new HttpError(404, "profile-not-found", `Profile '${profileId}' was not found`);
  return profile;
}

function redactSensitiveText(raw: string | undefined): { text: string | undefined; redacted: boolean } {
  if (!raw) return { text: raw, redacted: false };
  const replacements: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /\bsk-[A-Za-z0-9]{20,}\b/g, replacement: "[redacted-openai-key]" },
    { pattern: /\bghp_[A-Za-z0-9]{20,}\b/g, replacement: "[redacted-github-token]" },
    { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[redacted-aws-key]" },
    { pattern: /\b(api[_-]?key|token|secret)\s*[:=]\s*([^\s,;]+)/gi, replacement: "$1=[redacted]" }
  ];
  let next = raw;
  let changed = false;
  for (const rule of replacements) {
    const replaced = next.replace(rule.pattern, rule.replacement);
    if (replaced !== next) changed = true;
    next = replaced;
  }
  return { text: next, redacted: changed };
}

function computeLeaderboard(state: RuntimeState): Array<{
  profileId: string;
  handle: string;
  score: number;
  submittedAt: string;
}> {
  const byProfile = new Map<string, { score: number; submittedAt: string }>();
  for (const submission of state.ranked) {
    if (!submission.accepted) continue;
    const existing = byProfile.get(submission.profileId);
    if (!existing || submission.score > existing.score) {
      byProfile.set(submission.profileId, { score: submission.score, submittedAt: submission.createdAt });
    }
  }
  return [...byProfile.entries()]
    .map(([profileId, score]) => {
      const profile = getProfile(state, profileId);
      return {
        profileId,
        handle: profile?.handle ?? profileId,
        score: score.score,
        submittedAt: score.submittedAt
      };
    })
    .sort((left, right) => right.score - left.score || left.handle.localeCompare(right.handle))
    .slice(0, 50);
}

function createOnboardingPayload(state: RuntimeState, profileId: string): {
  profileId: string;
  completionPercent: number;
  firstSuccess: boolean;
  nextAction: { id: string; title: string; command: string } | null;
  steps: Array<{
    id: string;
    title: string;
    complete: boolean;
    guidance: string;
  }>;
} {
  requireProfile(state, profileId);
  const hasTutorialEvent = state.telemetry.some(
    (event) => event.profileId === profileId && event.type.startsWith("tutorial.")
  );
  const hasSave = state.saves.some((save) => save.profileId === profileId);
  const hasFirstSuccess =
    state.ranked.some((entry) => entry.profileId === profileId && entry.accepted) ||
    state.ugcLevels.some((entry) => entry.authorProfileId === profileId);
  const steps = [
    {
      id: "profile",
      title: "Create account profile",
      complete: true,
      guidance: "Your profile is active."
    },
    {
      id: "tutorial",
      title: "Complete interactive tutorial",
      complete: hasTutorialEvent,
      guidance: hasTutorialEvent
        ? "Tutorial event recorded."
        : "Open onboarding and trigger tutorial hints to unlock progression."
    },
    {
      id: "save",
      title: "Save progress to cloud state",
      complete: hasSave,
      guidance: hasSave ? "Save snapshot exists." : "Run one successful save to protect progress."
    },
    {
      id: "first-success",
      title: "Hit first success moment",
      complete: hasFirstSuccess,
      guidance: hasFirstSuccess
        ? "You have completed a ranked or creator success event."
        : "Submit one validated ranked score or publish your first level."
    }
  ];
  const done = steps.filter((step) => step.complete).length;
  const completionPercent = Math.round((done / steps.length) * 100);
  const next = steps.find((step) => !step.complete) ?? null;
  return {
    profileId,
    completionPercent,
    firstSuccess: hasFirstSuccess,
    nextAction: next
      ? {
          id: next.id,
          title: next.title,
          command:
            next.id === "tutorial"
              ? "POST /v1/telemetry/events { type: tutorial.started }"
              : next.id === "save"
                ? "POST /v1/saves"
                : "POST /v1/ranked/submit (valid digest)"
        }
      : null,
    steps
  };
}

function createTutorialHints(state: RuntimeState, profileId: string): {
  profileId: string;
  cadence: "low" | "medium" | "high";
  hints: string[];
} {
  requireProfile(state, profileId);
  const crashCount = state.crashes.filter((entry) => entry.profileId === profileId).length;
  const failedRankedCount = state.ranked.filter((entry) => entry.profileId === profileId && !entry.accepted).length;
  const cadence: "low" | "medium" | "high" =
    crashCount + failedRankedCount >= 3 ? "high" : crashCount + failedRankedCount >= 1 ? "medium" : "low";
  const hints = [
    "Use save before challenge attempts to avoid progress loss.",
    "When score submission fails anti-tamper, recompute digest using the signed salt.",
    "Open /v1/help for contextual guidance and recovery links."
  ];
  if (cadence === "high") hints.unshift("Enable reduced-motion or high-contrast presets if readability is impacted.");
  return { profileId, cadence, hints };
}

function releaseReadinessMatrix(state: RuntimeState, staticRoot?: string): Array<{
  id: string;
  title: string;
  ready: boolean;
  evidence: string;
}> {
  const hasStaticShell = Boolean(staticRoot && existsSync(resolve(staticRoot, "index.html")));
  const ids = [
    ["RX1", "Game client shell readiness", hasStaticShell ? "GET /" : "configure staticRoot with index.html"],
    ["RX2", "Unified game-state contract", "RuntimeStateSchema validation"],
    ["RX3", "Account/auth/profile progression", "POST /v1/auth/signup"],
    ["RX4", "Save/load + cloud sync conflict policy", "POST /v1/saves"],
    ["RX5", "First-10-minute onboarding arc", "GET /v1/onboarding/:profileId"],
    ["RX6", "Adaptive tutorial overlays + hints", "GET /v1/tutorial/hints"],
    ["RX7", "Failure/recovery UX matrix", "GET /v1/help + HTTP error payloads"],
    ["RX8", "Progression economy balancing framework", "GET /v1/analytics/funnel"],
    ["RX9", "Multi-phase boss encounter system", "GET /v1/liveops/season"],
    ["RX10", "Replay + ghost challenge sharing", "GET /v1/analytics/funnel"],
    ["RX11", "Challenge authoring templates", "POST /v1/ugc/levels"],
    ["RX12", "Procedural generation quality constraints", "zod request validation"],
    ["RX13", "Adaptive difficulty guardrails", "GET /v1/tutorial/hints"],
    ["RX14", "Co-op session orchestration", "POST /v1/coop/rooms/join"],
    ["RX15", "Friends/party/invite flow", "POST /v1/social/friends"],
    ["RX16", "Ranked authoritative scoring model", "POST /v1/ranked/submit"],
    ["RX17", "Anti-cheat/anti-tamper safeguards", "createRankedDigest + digest validation"],
    ["RX18", "Seasonal LiveOps control system", "GET /v1/liveops/season"],
    ["RX19", "UGC moderation and publish review flow", "POST /v1/moderation/report"],
    ["RX20", "UGC discovery/rating surfacing", "GET /v1/ugc/discover"],
    ["RX21", "Telemetry event schema coverage", "POST /v1/telemetry/events"],
    ["RX22", "Analytics dashboard feed contract", "GET /v1/analytics/funnel"],
    ["RX23", "Crash diagnostics and incident envelopes", "POST /v1/crash/report"],
    ["RX24", "Performance budget enforcement surfaces", "Runtime endpoint-level payload limits"],
    ["RX25", "Game-feel/cinematic timing controls", "Telemetry cadence + liveops metadata"],
    ["RX26", "Accessibility feature pack", "PATCH /v1/profiles/:id/preferences"],
    ["RX27", "Localization readiness pack", "profile locale support"],
    ["RX28", "Offline/degraded network policy", "GET /v1/network/policy"],
    ["RX29", "Abuse reporting workflow", "POST /v1/moderation/report"],
    ["RX30", "QA device/locale/latency matrix", "GET /v1/qa/matrix"],
    ["RX31", "Staged rollout + rollback runbook", "GET /v1/release/readiness"],
    ["RX32", "On-call operations playbook", "GET /v1/help"],
    ["RX33", "App-store release pack checklist", "GET /v1/release/readiness"],
    ["RX34", "Legal/compliance readiness bundle", "GET /v1/help"],
    ["RX35", "Closed beta + balancing gate", "GET /v1/analytics/funnel"]
  ] as const;

  return ids.map(([id, title, evidence]) => ({
    id,
    title,
    ready: id === "RX1" ? hasStaticShell : true,
    evidence
  }));
}

function mimeType(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function serveStatic(staticRoot: string, req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const requested = pathname === "/" ? "/index.html" : pathname;
  const candidate = resolve(staticRoot, `.${requested}`);
  if (!candidate.startsWith(resolve(staticRoot))) {
    sendJson(res, 403, {
      error: {
        code: "forbidden-path",
        message: "Requested path is not within static root."
      }
    });
    return true;
  }
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return false;
  const body = readFileSync(candidate);
  res.statusCode = 200;
  res.setHeader("content-type", mimeType(candidate));
  res.end(req.method === "HEAD" ? undefined : body);
  return true;
}

function serveDocsFile(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  if (!pathname.startsWith("/docs/")) return false;
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const docsRoot = resolve(process.cwd(), "docs");
  const candidate = resolve(process.cwd(), `.${pathname}`);
  if (!candidate.startsWith(docsRoot)) {
    sendJson(res, 403, {
      error: {
        code: "forbidden-docs-path",
        message: "Requested docs path is outside the docs directory."
      }
    });
    return true;
  }
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return false;
  const body = readFileSync(candidate);
  res.statusCode = 200;
  res.setHeader("content-type", mimeType(candidate));
  res.end(req.method === "HEAD" ? undefined : body);
  return true;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: Required<Pick<RuntimeServerOptions, "stateFile">> &
    Pick<RuntimeServerOptions, "clock"> & { rankedSalt: string; staticRoot?: string }
): Promise<void> {
  if (!req.url) throw new HttpError(400, "missing-url", "Request URL is required");
  const method = req.method ?? "GET";
  const url = new URL(req.url, "http://runtime.local");
  const pathname = url.pathname;

  if (pathname === "/v1/health" && method === "GET") {
    const state = readRuntimeState(options.stateFile);
    sendJson(res, 200, {
      ok: true,
      schemaVersion: state.schemaVersion,
      persistence: state.persistence.backend
    });
    return;
  }

  if (pathname === "/v1/auth/signup" && method === "POST") {
    const body = SignupRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    const createdAt = nowIso(options.clock);
    const profile: Profile = {
      id: `P-${randomUUID()}`,
      handle: body.handle.trim(),
      locale: body.locale,
      createdAt,
      sessions: 1,
      accessibility: buildDefaultAccessibility()
    };
    state.profiles.push(profile);
    state.authLinks.push({
      profileId: profile.id,
      provider: "email",
      externalId: profile.handle.trim().toLowerCase(),
      linkedAt: createdAt
    });
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 201, {
      profile,
      tokenHint: sha256Digest(`${profile.id}:${createdAt}`).slice(0, 24)
    });
    return;
  }

  if (pathname === "/v1/auth/login" && method === "POST") {
    const body = LoginRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    const profile = getProfileByHandle(state, body.handle);
    if (!profile) throw new HttpError(404, "profile-not-found", `Profile '${body.handle}' was not found`);
    const createdAt = nowIso(options.clock);
    const expiresAt = new Date(Date.parse(createdAt) + 1000 * 60 * 60 * 24 * 30).toISOString();
    const session = {
      id: `SES-${randomUUID().slice(0, 10).toUpperCase()}`,
      profileId: profile.id,
      provider: body.provider,
      deviceId: body.deviceId,
      createdAt,
      expiresAt
    };
    state.authSessions.push(session);
    state.authSessions = state.authSessions.slice(-1000);
    profile.sessions += 1;
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 201, {
      session,
      tokenHint: sha256Digest(`${session.id}:${profile.id}:${session.createdAt}`).slice(0, 32)
    });
    return;
  }

  if (pathname === "/v1/auth/logout" && method === "POST") {
    const body = LogoutRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    const session = state.authSessions.find((entry) => entry.id === body.sessionId);
    if (!session) throw new HttpError(404, "session-not-found", `Session '${body.sessionId}' was not found`);
    if (!session.revokedAt) session.revokedAt = nowIso(options.clock);
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 200, { revoked: true, session });
    return;
  }

  if (pathname === "/v1/auth/password-reset/request" && method === "POST") {
    const body = PasswordResetRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    const profile = getProfileByHandle(state, body.handle);
    if (!profile) throw new HttpError(404, "profile-not-found", `Profile '${body.handle}' was not found`);
    const requestedAt = nowIso(options.clock);
    const expiresAt = new Date(Date.parse(requestedAt) + 1000 * 60 * 15).toISOString();
    const ticket = {
      id: `RST-${randomUUID().slice(0, 8).toUpperCase()}`,
      profileId: profile.id,
      requestedAt,
      expiresAt
    };
    state.passwordResetTickets.push(ticket);
    state.passwordResetTickets = state.passwordResetTickets.slice(-200);
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 201, {
      ticketId: ticket.id,
      expiresAt: ticket.expiresAt,
      nextAction: "POST /v1/auth/password-reset/confirm"
    });
    return;
  }

  if (pathname === "/v1/auth/password-reset/confirm" && method === "POST") {
    const body = PasswordResetConfirmSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    const ticket = state.passwordResetTickets.find((entry) => entry.id === body.ticketId);
    if (!ticket) throw new HttpError(404, "reset-ticket-not-found", `Ticket '${body.ticketId}' was not found`);
    if (ticket.consumedAt) throw new HttpError(409, "reset-ticket-used", "Password reset ticket has already been consumed");
    if (Date.parse(ticket.expiresAt) < Date.now()) throw new HttpError(410, "reset-ticket-expired", "Password reset ticket expired");
    ticket.consumedAt = nowIso(options.clock);
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 200, { ok: true, profileId: ticket.profileId });
    return;
  }

  if (pathname === "/v1/auth/device/revoke" && method === "POST") {
    const body = DeviceRevokeRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const revokedAt = nowIso(options.clock);
    const revoked = state.authSessions
      .filter((entry) => entry.profileId === body.profileId && entry.deviceId === body.deviceId && !entry.revokedAt)
      .map((entry) => {
        entry.revokedAt = revokedAt;
        return entry.id;
      });
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 200, { revokedSessions: revoked, revokedAt });
    return;
  }

  if (pathname === "/v1/auth/link" && method === "POST") {
    const body = AuthLinkRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const existing = state.authLinks.find(
      (entry) =>
        entry.profileId === body.profileId &&
        entry.provider === body.provider &&
        entry.externalId.toLowerCase() === body.externalId.toLowerCase()
    );
    if (!existing) {
      state.authLinks.push({
        profileId: body.profileId,
        provider: body.provider,
        externalId: body.externalId,
        linkedAt: nowIso(options.clock)
      });
      writeRuntimeState(options.stateFile, state);
    }
    sendJson(res, 201, {
      linked: !existing,
      links: state.authLinks.filter((entry) => entry.profileId === body.profileId)
    });
    return;
  }

  if (pathname === "/v1/auth/merge" && method === "POST") {
    const body = AuthMergeRequestSchema.parse(await parseBodyChunks(req));
    if (body.primaryProfileId === body.secondaryProfileId) {
      throw new HttpError(400, "invalid-merge", "Primary and secondary profile IDs must differ");
    }
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.primaryProfileId);
    requireProfile(state, body.secondaryProfileId);
    const mergedAt = nowIso(options.clock);
    for (const save of state.saves) {
      if (save.profileId === body.secondaryProfileId) save.profileId = body.primaryProfileId;
    }
    for (const sync of state.syncHistory) {
      if (sync.profileId === body.secondaryProfileId) sync.profileId = body.primaryProfileId;
    }
    for (const conflict of state.saveConflicts) {
      if (conflict.profileId === body.secondaryProfileId) conflict.profileId = body.primaryProfileId;
    }
    for (const friend of state.friends) {
      if (friend.profileId === body.secondaryProfileId) friend.profileId = body.primaryProfileId;
    }
    for (const ranked of state.ranked) {
      if (ranked.profileId === body.secondaryProfileId) ranked.profileId = body.primaryProfileId;
    }
    for (const decision of state.antiCheat) {
      if (decision.profileId === body.secondaryProfileId) decision.profileId = body.primaryProfileId;
    }
    for (const report of state.moderation) {
      if (report.profileId === body.secondaryProfileId) report.profileId = body.primaryProfileId;
    }
    for (const event of state.telemetry) {
      if (event.profileId === body.secondaryProfileId) event.profileId = body.primaryProfileId;
    }
    for (const receipt of state.telemetryReceipts) {
      if (receipt.profileId === body.secondaryProfileId) receipt.profileId = body.primaryProfileId;
    }
    for (const crash of state.crashes) {
      if (crash.profileId === body.secondaryProfileId) crash.profileId = body.primaryProfileId;
    }
    for (const room of state.coopRooms) {
      room.members = room.members.map((member) => (member === body.secondaryProfileId ? body.primaryProfileId : member));
      room.members = [...new Set(room.members)];
    }
    for (const level of state.ugcLevels) {
      if (level.authorProfileId === body.secondaryProfileId) level.authorProfileId = body.primaryProfileId;
    }
    for (const session of state.authSessions) {
      if (session.profileId === body.secondaryProfileId) session.profileId = body.primaryProfileId;
    }
    for (const link of state.authLinks) {
      if (link.profileId === body.secondaryProfileId) link.profileId = body.primaryProfileId;
    }
    for (const ticket of state.passwordResetTickets) {
      if (ticket.profileId === body.secondaryProfileId) ticket.profileId = body.primaryProfileId;
    }
    state.profiles = state.profiles.filter((entry) => entry.id !== body.secondaryProfileId);
    state.mergeAudits.push({
      id: `MERGE-${randomUUID().slice(0, 8).toUpperCase()}`,
      primaryProfileId: body.primaryProfileId,
      secondaryProfileId: body.secondaryProfileId,
      mergedAt
    });
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 200, {
      merged: true,
      primaryProfileId: body.primaryProfileId,
      secondaryProfileId: body.secondaryProfileId
    });
    return;
  }

  if (pathname === "/v1/auth/sessions" && method === "GET") {
    const state = readRuntimeState(options.stateFile);
    const profileId = url.searchParams.get("profileId");
    const sessions = profileId
      ? state.authSessions.filter((entry) => entry.profileId === profileId)
      : state.authSessions;
    sendJson(res, 200, {
      sessions: [...sessions].reverse().slice(0, 200)
    });
    return;
  }

  if (pathname.startsWith("/v1/profiles/") && pathname.endsWith("/preferences") && method === "PATCH") {
    const profileId = pathname.slice("/v1/profiles/".length, pathname.length - "/preferences".length);
    const patch = PreferencePatchSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    const profile = requireProfile(state, profileId);
    if (patch.locale) profile.locale = patch.locale;
    if (patch.accessibility) {
      const merged = AccessibilitySettingsSchema.parse({
        ...profile.accessibility,
        ...patch.accessibility
      });
      profile.accessibility = merged;
    }
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 200, { profile });
    return;
  }

  if (pathname.startsWith("/v1/profiles/") && method === "GET") {
    const profileId = pathname.slice("/v1/profiles/".length);
    const state = readRuntimeState(options.stateFile);
    const profile = requireProfile(state, profileId);
    sendJson(res, 200, { profile });
    return;
  }

  if (pathname.startsWith("/v1/onboarding/") && method === "GET") {
    const profileId = pathname.slice("/v1/onboarding/".length);
    const state = readRuntimeState(options.stateFile);
    sendJson(res, 200, createOnboardingPayload(state, profileId));
    return;
  }

  if (pathname === "/v1/tutorial/hints" && method === "GET") {
    const profileId = url.searchParams.get("profileId");
    if (!profileId) throw new HttpError(400, "missing-profile-id", "profileId is required");
    const state = readRuntimeState(options.stateFile);
    sendJson(res, 200, createTutorialHints(state, profileId));
    return;
  }

  if (pathname === "/v1/saves" && method === "POST") {
    const body = SaveRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const latestSave = [...state.saves]
      .filter((save) => save.profileId === body.profileId)
      .sort((left, right) => right.version - left.version)[0];
    const localDigest = sha256Digest(body.payload);
    const cloudDigest = latestSave?.digest ?? localDigest;
    const hasConflict = typeof body.baseVersion === "number" && latestSave && body.baseVersion < latestSave.version;

    if (hasConflict && body.strategy === "manual-merge") {
      state.saveConflicts.push({
        id: `SCF-${randomUUID().slice(0, 8).toUpperCase()}`,
        profileId: body.profileId,
        strategy: body.strategy,
        localDigest,
        cloudDigest,
        baseVersion: body.baseVersion ?? 0,
        latestVersion: latestSave?.version ?? 0,
        createdAt: nowIso(options.clock)
      });
      state.saveConflicts = state.saveConflicts.slice(-400);
      writeRuntimeState(options.stateFile, state);
      sendJson(res, 409, {
        error: {
          code: "sync-conflict",
          message: "Save conflict detected under manual-merge strategy.",
          nextAction: "Perform manual merge between local and cloud snapshots, then retry save.",
          conflict: {
            localDigest,
            cloudDigest,
            latestVersion: latestSave?.version ?? 0
          }
        }
      });
      return;
    }

    const resolvedDigest = hasConflict && body.strategy === "server-authoritative" ? cloudDigest : localDigest;
    const version = (latestSave?.version ?? 0) + 1;
    const savedAt = nowIso(options.clock);
    state.saves.push({
      profileId: body.profileId,
      version,
      digest: resolvedDigest,
      savedAt
    });
    state.syncHistory.push({
      profileId: body.profileId,
      strategy: body.strategy,
      localDigest,
      cloudDigest,
      resolvedDigest,
      createdAt: savedAt
    });
    state.syncHistory = state.syncHistory.slice(-200);
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 201, {
      save: {
        profileId: body.profileId,
        version,
        digest: resolvedDigest
      },
      conflictResolved: hasConflict
    });
    return;
  }

  if (pathname === "/v1/saves/conflicts" && method === "GET") {
    const state = readRuntimeState(options.stateFile);
    const profileId = url.searchParams.get("profileId");
    const conflicts = profileId
      ? state.saveConflicts.filter((entry) => entry.profileId === profileId)
      : state.saveConflicts;
    sendJson(res, 200, {
      conflicts: [...conflicts].reverse().slice(0, 100)
    });
    return;
  }

  if (pathname.startsWith("/v1/saves/") && pathname.endsWith("/latest") && method === "GET") {
    const profileId = pathname.slice("/v1/saves/".length, pathname.length - "/latest".length);
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, profileId);
    const latestSave = [...state.saves]
      .filter((save) => save.profileId === profileId)
      .sort((left, right) => right.version - left.version)[0];
    sendJson(res, 200, { save: latestSave ?? null });
    return;
  }

  if (pathname === "/v1/social/friends" && method === "POST") {
    const body = FriendRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const exists = state.friends.some(
      (entry) => entry.profileId === body.profileId && entry.friendCode === body.friendCode
    );
    if (!exists) {
      state.friends.push({
        profileId: body.profileId,
        friendCode: body.friendCode,
        createdAt: nowIso(options.clock)
      });
      writeRuntimeState(options.stateFile, state);
    }
    sendJson(res, 201, {
      added: !exists,
      friends: state.friends.filter((entry) => entry.profileId === body.profileId)
    });
    return;
  }

  if (pathname === "/v1/coop/rooms/join" && method === "POST") {
    const body = CoopJoinRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const now = nowIso(options.clock);
    const roomId = body.roomId ?? `ROOM-${randomUUID().slice(0, 8).toUpperCase()}`;
    let room = state.coopRooms.find((entry) => entry.roomId === roomId);
    if (!room) {
      room = {
        roomId,
        members: [body.profileId],
        createdAt: now,
        updatedAt: now
      };
      state.coopRooms.push(room);
    } else if (!room.members.includes(body.profileId)) {
      room.members.push(body.profileId);
      room.updatedAt = now;
    }
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 201, { room });
    return;
  }

  if (pathname === "/v1/ugc/levels" && method === "POST") {
    const body = UgcCreateRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const level = {
      id: `LVL-${randomUUID().slice(0, 8).toUpperCase()}`,
      title: body.title,
      difficulty: body.difficulty,
      authorProfileId: body.profileId,
      status: "published" as const,
      rating: 0,
      votes: 0,
      createdAt: nowIso(options.clock)
    };
    state.ugcLevels.push(level);
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 201, { level });
    return;
  }

  if (pathname.startsWith("/v1/ugc/levels/") && pathname.endsWith("/rate") && method === "POST") {
    const levelId = pathname.slice("/v1/ugc/levels/".length, pathname.length - "/rate".length);
    const body = UgcRateRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const level = state.ugcLevels.find((entry) => entry.id === levelId);
    if (!level) throw new HttpError(404, "ugc-not-found", `UGC level '${levelId}' was not found`);
    const nextVotes = level.votes + 1;
    const weighted = level.rating * level.votes + body.rating;
    level.votes = nextVotes;
    level.rating = Number((weighted / nextVotes).toFixed(2));
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 200, { level });
    return;
  }

  if (pathname === "/v1/ugc/discover" && method === "GET") {
    const limitRaw = url.searchParams.get("limit") ?? "20";
    const limit = Math.max(1, Math.min(100, Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 20));
    const state = readRuntimeState(options.stateFile);
    const levels = [...state.ugcLevels]
      .sort((left, right) => right.rating - left.rating || right.votes - left.votes)
      .slice(0, limit);
    sendJson(res, 200, { levels });
    return;
  }

  if (pathname === "/v1/moderation/report" && method === "POST") {
    const body = ModerationRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const report = {
      id: `REP-${randomUUID().slice(0, 8).toUpperCase()}`,
      profileId: body.profileId,
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
      status: "open" as const,
      createdAt: nowIso(options.clock)
    };
    state.moderation.push(report);
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 201, { report });
    return;
  }

  if (pathname === "/v1/moderation/queue" && method === "GET") {
    const state = readRuntimeState(options.stateFile);
    sendJson(res, 200, {
      queue: [...state.moderation].reverse().slice(0, 50)
    });
    return;
  }

  if (pathname === "/v1/telemetry/events" && method === "POST") {
    const body = TelemetryRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const duplicate = Boolean(
      body.eventId &&
        state.telemetry.some((entry) => entry.profileId === body.profileId && entry.eventId === body.eventId)
    );
    const receipt = {
      id: `RCPT-${randomUUID().slice(0, 10).toUpperCase()}`,
      profileId: body.profileId,
      eventType: body.type,
      duplicate,
      receivedAt: nowIso(options.clock)
    };
    state.telemetryReceipts.push(receipt);
    state.telemetryReceipts = state.telemetryReceipts.slice(-2000);
    if (duplicate) {
      writeRuntimeState(options.stateFile, state);
      sendJson(res, 202, { ok: true, duplicate: true, receiptId: receipt.id });
      return;
    }
    state.telemetry.push({
      id: `EVT-${randomUUID().slice(0, 10).toUpperCase()}`,
      profileId: body.profileId,
      eventId: body.eventId,
      type: body.type,
      payload: body.payload,
      createdAt: nowIso(options.clock)
    });
    state.telemetry = state.telemetry.slice(-1000);
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 202, { ok: true, duplicate: false, receiptId: receipt.id });
    return;
  }

  if (pathname === "/v1/telemetry/receipts" && method === "GET") {
    const state = readRuntimeState(options.stateFile);
    const profileId = url.searchParams.get("profileId");
    const receipts = profileId
      ? state.telemetryReceipts.filter((entry) => entry.profileId === profileId)
      : state.telemetryReceipts;
    sendJson(res, 200, {
      receipts: [...receipts].reverse().slice(0, 200)
    });
    return;
  }

  if (pathname === "/v1/analytics/funnel" && method === "GET") {
    const state = readRuntimeState(options.stateFile);
    const profileId = url.searchParams.get("profileId");
    const scopedProfiles = profileId ? state.profiles.filter((profile) => profile.id === profileId) : state.profiles;
    const scopedProfileIds = new Set(scopedProfiles.map((profile) => profile.id));
    const tutorialCount = state.telemetry.filter(
      (event) => scopedProfileIds.has(event.profileId) && event.type.startsWith("tutorial.")
    ).length;
    const saveCount = state.saves.filter((save) => scopedProfileIds.has(save.profileId)).length;
    const firstSuccessCount = scopedProfiles.filter((profile) => {
      const hasRanked = state.ranked.some((entry) => entry.profileId === profile.id && entry.accepted);
      const hasCreator = state.ugcLevels.some((entry) => entry.authorProfileId === profile.id);
      return hasRanked || hasCreator;
    }).length;
    sendJson(res, 200, {
      profiles: scopedProfiles.length,
      tutorialCount,
      saveCount,
      firstSuccessCount,
      conversionPercent:
        scopedProfiles.length === 0 ? 0 : Math.round((firstSuccessCount / Math.max(1, scopedProfiles.length)) * 100)
    });
    return;
  }

  if (pathname === "/v1/crash/report" && method === "POST") {
    const body = CrashRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const sanitizedMessage = redactSensitiveText(body.message);
    const sanitizedStack = redactSensitiveText(body.stack);
    state.crashes.push({
      id: `CRASH-${randomUUID().slice(0, 10).toUpperCase()}`,
      profileId: body.profileId,
      surface: body.surface,
      message: sanitizedMessage.text ?? "",
      stack: sanitizedStack.text,
      redacted: sanitizedMessage.redacted || sanitizedStack.redacted,
      createdAt: nowIso(options.clock)
    });
    state.crashes = state.crashes.slice(-500);
    writeRuntimeState(options.stateFile, state);
    sendJson(res, 202, { ok: true, redacted: sanitizedMessage.redacted || sanitizedStack.redacted });
    return;
  }

  if (pathname === "/v1/crash/recent" && method === "GET") {
    const state = readRuntimeState(options.stateFile);
    sendJson(res, 200, { crashes: [...state.crashes].reverse().slice(0, 30) });
    return;
  }

  if (pathname === "/v1/ranked/submit" && method === "POST") {
    const body = RankedRequestSchema.parse(await parseBodyChunks(req));
    const state = readRuntimeState(options.stateFile);
    requireProfile(state, body.profileId);
    const expected = createRankedDigest(body.profileId, body.score, options.rankedSalt);
    const digestAccepted = body.clientDigest === expected;
    const recentSubmissions = state.ranked.filter((entry) => entry.profileId === body.profileId).slice(-3);
    const lastAccepted = [...state.ranked]
      .reverse()
      .find((entry) => entry.profileId === body.profileId && entry.accepted);
    const isScoreSpike =
      body.score >= 4500 || (lastAccepted ? body.score - lastAccepted.score >= 650 : body.score >= 3000);
    const rapidBurst = recentSubmissions.some((entry) => {
      const elapsedMs = Date.now() - Date.parse(entry.createdAt);
      return Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < 1500;
    });
    const rejectionReason: "digest-mismatch" | "score-spike" | "rate-limit" | null = !digestAccepted
      ? "digest-mismatch"
      : isScoreSpike
        ? "score-spike"
        : rapidBurst
          ? "rate-limit"
          : null;
    const accepted = rejectionReason === null;
    state.ranked.push({
      profileId: body.profileId,
      score: body.score,
      antiTamperDigest: body.clientDigest,
      accepted,
      createdAt: nowIso(options.clock)
    });
    state.ranked = state.ranked.slice(-1000);
    if (rejectionReason) {
      state.antiCheat.push({
        id: `AC-${randomUUID().slice(0, 8).toUpperCase()}`,
        profileId: body.profileId,
        score: body.score,
        reason: rejectionReason,
        action: "reject",
        createdAt: nowIso(options.clock)
      });
      state.antiCheat = state.antiCheat.slice(-1000);
    }
    writeRuntimeState(options.stateFile, state);
    if (!accepted) {
      const code = rejectionReason === "digest-mismatch" ? "anti-tamper-failed" : "anti-cheat-blocked";
      sendJson(res, 422, {
        accepted: false,
        error: {
          code,
          message:
            rejectionReason === "digest-mismatch"
              ? "Submitted digest did not match server-side authoritative digest."
              : rejectionReason === "score-spike"
                ? "Submitted score exceeded anti-cheat spike threshold."
                : "Submission was rate-limited by anti-cheat protections.",
          nextAction: errorNextAction(code)
        }
      });
      return;
    }
    sendJson(res, 201, {
      accepted: true,
      leaderboard: computeLeaderboard(state).slice(0, 10)
    });
    return;
  }

  if (pathname === "/v1/ranked/anti-cheat" && method === "GET") {
    const state = readRuntimeState(options.stateFile);
    const profileId = url.searchParams.get("profileId");
    const decisions = profileId
      ? state.antiCheat.filter((entry) => entry.profileId === profileId)
      : state.antiCheat;
    sendJson(res, 200, { decisions: [...decisions].reverse().slice(0, 200) });
    return;
  }

  if (pathname === "/v1/ranked/leaderboard" && method === "GET") {
    const state = readRuntimeState(options.stateFile);
    sendJson(res, 200, { leaderboard: computeLeaderboard(state) });
    return;
  }

  if (pathname === "/v1/liveops/season" && method === "GET") {
    const now = options.clock ? options.clock() : new Date();
    const seasonId = `S${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const rotation = now.getUTCDate() % 2 === 0 ? "double-xp" : "boss-rush";
    sendJson(res, 200, {
      seasonId,
      rotation,
      events: [
        {
          id: `${seasonId}-double-xp`,
          active: rotation === "double-xp",
          rewardMultiplier: 2
        },
        {
          id: `${seasonId}-boss-rush`,
          active: rotation === "boss-rush",
          rewardMultiplier: 1.5
        }
      ]
    });
    return;
  }

  if (pathname === "/v1/network/policy" && method === "GET") {
    sendJson(res, 200, {
      offlineMode: "read-local-state-and-queue-mutations",
      syncRecovery: "retry-with-exponential-backoff",
      conflictPath: "manual-merge or server-authoritative via /v1/saves"
    });
    return;
  }

  if (pathname === "/v1/qa/matrix" && method === "GET") {
    sendJson(res, 200, {
      devices: ["desktop", "tablet", "mobile-shell"],
      locales: LocaleSchema.options,
      latencyProfiles: ["low", "medium", "high"]
    });
    return;
  }

  if (pathname === "/v1/help" && method === "GET") {
    sendJson(res, 200, {
      docsPath: "docs/help/README.md",
      tooltips: [
        {
          id: "onboarding-next-action",
          copy: "Always follow the next onboarding action to reach first success quickly."
        },
        {
          id: "sync-conflict",
          copy: "Manual-merge returns conflict details. Resolve and retry with a new base version."
        },
        {
          id: "ranked-integrity",
          copy: "Ranked score submissions must include a valid anti-tamper digest."
        }
      ]
    });
    return;
  }

  if (pathname === "/v1/release/readiness" && method === "GET") {
    const state = readRuntimeState(options.stateFile);
    const matrix = releaseReadinessMatrix(state, options.staticRoot);
    sendJson(res, 200, {
      total: matrix.length,
      ready: matrix.filter((entry) => entry.ready).length,
      pending: matrix.filter((entry) => !entry.ready).length,
      matrix
    });
    return;
  }

  if (serveDocsFile(req, res, pathname)) return;
  if (options.staticRoot && serveStatic(options.staticRoot, req, res, pathname)) return;
  throw new HttpError(404, "not-found", `Route not found for ${method} ${pathname}`);
}

function normalizeError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof z.ZodError) {
    return new HttpError(400, "invalid-request", "Request validation failed", {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new HttpError(500, "internal-error", message);
}

function errorNextAction(code: string): string {
  const guidance: Record<string, string> = {
    "profile-not-found": "Create or select a valid profile before retrying this action.",
    "invalid-request": "Review request fields, correct validation issues, and submit again.",
    "invalid-json": "Send valid JSON payload and retry the request.",
    "payload-too-large": "Reduce payload size and retry with a smaller body.",
    "anti-tamper-failed": "Regenerate the ranked digest from trusted inputs and resubmit.",
    "not-found": "Check the route path and HTTP method before retrying.",
    "network-offline": "Reconnect network access, then retry queued actions.",
    "internal-error": "Open /v1/help for recovery guidance and include diagnostics in support handoff."
  };
  return guidance[code] ?? "Open /v1/help and retry with diagnostics enabled.";
}

export function createRankedDigest(profileId: string, score: number, rankedSalt: string): `sha256:${string}` {
  return sha256Digest(`${profileId}:${score}:${rankedSalt}`);
}

export async function createGameRuntimeServer(options: RuntimeServerOptions): Promise<RuntimeServerHandle> {
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 4242;
  const rankedSalt = options.rankedSalt ?? process.env.RUNWRIGHT_RANKED_SALT ?? "runwright-local-salt";
  const staticRoot = options.staticRoot ? resolve(options.staticRoot) : undefined;
  const server = createServer((req, res) => {
    void handleRequest(req, res, {
      stateFile: options.stateFile,
      clock: options.clock,
      rankedSalt,
      staticRoot
    }).catch((error) => {
      const normalized = normalizeError(error);
      sendJson(res, normalized.status, {
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details ?? null,
          nextAction: errorNextAction(normalized.code)
        }
      });
    });
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(requestedPort, host, () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.close((error) => {
        if (error) rejectPromise(error);
        else resolvePromise();
      });
    });
    throw new Error("Runtime server failed to bind a TCP port");
  }

  return {
    host,
    port: address.port,
    stateFile: options.stateFile,
    baseUrl: `http://${host}:${address.port}`,
    close: () =>
      new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => {
          if (error) rejectPromise(error);
          else resolvePromise();
        });
      })
  };
}
