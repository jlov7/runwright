export function formatActionableErrorMessage(message) {
  const value = String(message || "Unexpected runtime failure");
  const lower = value.toLowerCase();
  if (lower.includes("network-offline")) {
    return "You are offline. Next: keep working and the retry queue will flush after reconnect.";
  }
  if (lower.includes("network-transient-failure")) {
    return "Temporary network issue. Next: wait for automatic retry or press Retry Now.";
  }
  if (lower.includes("digest")) {
    return "Ranked submission rejected by anti-tamper checks. Next: resubmit with a trusted payload.";
  }
  if (lower.includes("profile")) {
    return "Profile context is missing or invalid. Next: create/select a profile and retry.";
  }
  if (value.includes("Next:")) return value;
  return `${value} Next: open Help if this repeats and include the diagnostic packet.`;
}
