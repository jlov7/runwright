#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="${1:-$ROOT_DIR/docs/demos/runwright-web-runtime-demo.md}"
ASSET_DIR="${ASSET_DIR:-$ROOT_DIR/docs/demos/assets}"
RUNTIME_URL="${RUNTIME_URL:-http://127.0.0.1:4242}"
RUNTIME_LOG="${RUNTIME_LOG:-$ROOT_DIR/reports/demos/runtime.log}"
START_SERVER="${START_SERVER:-1}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    echo "install details: $2" >&2
    exit 1
  fi
}

need_cmd showboat "https://github.com/simonw/showboat"
need_cmd rodney "https://github.com/simonw/rodney"
need_cmd curl "https://curl.se/"
if [[ "$START_SERVER" != "0" ]]; then
  need_cmd pnpm "https://pnpm.io/"
fi

mkdir -p "$(dirname "$OUT_FILE")" "$ASSET_DIR" "$(dirname "$RUNTIME_LOG")"

RUNTIME_PID=""
RODNEY_STARTED=0

cleanup() {
  if [[ "$RODNEY_STARTED" == "1" ]]; then
    rodney stop >/dev/null 2>&1 || true
  fi

  if [[ -n "$RUNTIME_PID" ]] && kill -0 "$RUNTIME_PID" >/dev/null 2>&1; then
    kill "$RUNTIME_PID" >/dev/null 2>&1 || true
    wait "$RUNTIME_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ "$START_SERVER" != "0" ]]; then
  pnpm --dir "$ROOT_DIR" game:runtime >"$RUNTIME_LOG" 2>&1 &
  RUNTIME_PID="$!"
fi

ready=0
for _ in $(seq 1 40); do
  if curl -fsS "$RUNTIME_URL/v1/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.5
done

if [[ "$ready" != "1" ]]; then
  echo "runtime did not become ready at $RUNTIME_URL" >&2
  echo "check log: $RUNTIME_LOG" >&2
  exit 1
fi

HOME_SCREENSHOT="$ASSET_DIR/runtime-home.png"
HELP_SCREENSHOT="$ASSET_DIR/runtime-help.png"

if [[ -f "$OUT_FILE" ]]; then
  while IFS= read -r image_ref; do
    image_path="${image_ref#*\(}"
    image_path="${image_path%\)}"
    if [[ -n "$image_path" && "$image_path" != http* ]]; then
      rm -f "$(dirname "$OUT_FILE")/$image_path"
    fi
  done < <(grep -oE '!\[[^]]*\]\([^)]*\)' "$OUT_FILE" || true)
fi

rm -f "$OUT_FILE"
showboat init "$OUT_FILE" "Runwright Web Runtime Walkthrough"
showboat note "$OUT_FILE" "Runwright runtime walkthrough generated on $(date -u +%Y-%m-%dT%H:%M:%SZ)."
showboat exec "$OUT_FILE" bash "curl -sS $RUNTIME_URL/v1/health"
showboat exec "$OUT_FILE" bash "curl -sS $RUNTIME_URL/v1/release/readiness"

rodney start >/dev/null
RODNEY_STARTED=1

opened=0
for _ in $(seq 1 40); do
  if rodney open "$RUNTIME_URL" >/dev/null 2>&1; then
    opened=1
    break
  fi
  sleep 0.5
done
if [[ "$opened" != "1" ]]; then
  echo "rodney failed to open $RUNTIME_URL after retries" >&2
  exit 1
fi
rodney waitidle >/dev/null || true
rodney screenshot "$HOME_SCREENSHOT" >/dev/null

showboat note "$OUT_FILE" "Web runtime entry shell with guided onboarding and mode navigation."
showboat image "$OUT_FILE" "$HOME_SCREENSHOT"

rodney js "(() => { const button = [...document.querySelectorAll('button')].find((el) => /help/i.test(el.textContent || '')); if (button) { button.click(); return 'help-opened'; } return 'help-button-not-found'; })()" >/dev/null || true
rodney waitstable >/dev/null || true
rodney screenshot "$HELP_SCREENSHOT" >/dev/null

showboat note "$OUT_FILE" "Contextual help panel state captured for onboarding/recovery guidance evidence."
showboat image "$OUT_FILE" "$HELP_SCREENSHOT"
showboat verify "$OUT_FILE"

echo "showboat demo created: $OUT_FILE"
