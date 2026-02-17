import { z } from "zod";

export const LocaleSchema = z.enum(["en-US", "es-ES", "fr-FR", "de-DE", "ja-JP", "ko-KR", "pt-BR"]);

export const AccessibilityPresetSchema = z.enum(["default", "high-contrast", "reduced-motion", "screen-reader"]);
export const RemapProfileSchema = z.enum(["default", "left-handed", "single-stick"]);

export const AccessibilitySettingsSchema = z.object({
  preset: AccessibilityPresetSchema,
  textScale: z.number().min(0.8).max(2),
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  remapProfile: RemapProfileSchema
});

export const ProfileSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  locale: LocaleSchema,
  createdAt: z.string().min(1),
  sessions: z.number().int().nonnegative(),
  accessibility: AccessibilitySettingsSchema
});

export const SaveSnapshotSchema = z.object({
  profileId: z.string().min(1),
  version: z.number().int().nonnegative(),
  digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  savedAt: z.string().min(1)
});

export const SyncRecordSchema = z.object({
  profileId: z.string().min(1),
  strategy: z.enum(["last-write-wins", "manual-merge", "server-authoritative"]),
  localDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  cloudDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  resolvedDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  createdAt: z.string().min(1)
});

export const FriendLinkSchema = z.object({
  profileId: z.string().min(1),
  friendCode: z.string().min(1),
  createdAt: z.string().min(1)
});

export const CoopRoomSchema = z.object({
  roomId: z.string().min(1),
  members: z.array(z.string().min(1)),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const RankedSubmissionSchema = z.object({
  profileId: z.string().min(1),
  score: z.number().int().nonnegative(),
  antiTamperDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  createdAt: z.string().min(1),
  accepted: z.boolean()
});

export const ModerationReportSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  targetType: z.enum(["ugc", "chat", "profile"]),
  targetId: z.string().min(1),
  reason: z.string().min(1),
  status: z.enum(["open", "triaged", "resolved"]),
  createdAt: z.string().min(1)
});

export const TelemetryEventSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  type: z.string().min(1),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])),
  createdAt: z.string().min(1)
});

export const CrashEnvelopeSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  surface: z.string().min(1),
  message: z.string().min(1),
  stack: z.string().optional(),
  createdAt: z.string().min(1)
});

export const UgcLevelSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  difficulty: z.enum(["bronze", "silver", "gold", "legendary"]),
  authorProfileId: z.string().min(1),
  status: z.enum(["draft", "published", "flagged", "archived"]),
  rating: z.number().min(0).max(5),
  votes: z.number().int().nonnegative(),
  createdAt: z.string().min(1)
});

export const RuntimeStateSchema = z.object({
  schemaVersion: z.literal("1.0"),
  profiles: z.array(ProfileSchema),
  saves: z.array(SaveSnapshotSchema),
  syncHistory: z.array(SyncRecordSchema),
  friends: z.array(FriendLinkSchema),
  coopRooms: z.array(CoopRoomSchema),
  ranked: z.array(RankedSubmissionSchema),
  moderation: z.array(ModerationReportSchema),
  telemetry: z.array(TelemetryEventSchema),
  crashes: z.array(CrashEnvelopeSchema),
  ugcLevels: z.array(UgcLevelSchema)
});

export type Locale = z.infer<typeof LocaleSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type SaveSnapshot = z.infer<typeof SaveSnapshotSchema>;
export type SyncRecord = z.infer<typeof SyncRecordSchema>;
export type FriendLink = z.infer<typeof FriendLinkSchema>;
export type CoopRoom = z.infer<typeof CoopRoomSchema>;
export type RankedSubmission = z.infer<typeof RankedSubmissionSchema>;
export type ModerationReport = z.infer<typeof ModerationReportSchema>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type CrashEnvelope = z.infer<typeof CrashEnvelopeSchema>;
export type UgcLevel = z.infer<typeof UgcLevelSchema>;
export type RuntimeState = z.infer<typeof RuntimeStateSchema>;
