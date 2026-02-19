export function formatSeasonSummary(payload) {
  const activeCount = Array.isArray(payload?.events) ? payload.events.filter((event) => event.active).length : 0;
  return `Season ${payload?.seasonId ?? "unknown"}: rotation ${payload?.rotation ?? "unknown"}. Active events: ${activeCount}.`;
}

export function formatAnalyticsSummary(payload, latencyAvgMs) {
  return `Conversion: ${payload?.conversionPercent ?? 0}% | Profiles: ${payload?.profiles ?? 0} | First success count: ${payload?.firstSuccessCount ?? 0} | Avg request latency: ${latencyAvgMs}ms.`;
}

export function mapCreatorRows(payload) {
  if (!Array.isArray(payload?.levels) || payload.levels.length === 0) {
    return ["No published levels yet."];
  }

  return payload.levels.slice(0, 5).map((row) => `${row.title} | difficulty ${row.difficulty} | rating ${row.rating}`);
}

export function mapLeaderboardRows(payload) {
  if (!Array.isArray(payload?.leaderboard) || payload.leaderboard.length === 0) {
    return ["No ranked entries yet."];
  }

  return payload.leaderboard.map((row) => `${row.handle}: ${row.score}`);
}
