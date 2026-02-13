#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ARTIFACT_PATH=""
CHECKSUMS_PATH=""
VERIFY_JSON_PATH=""
PUBLIC_KEY_PATH=""
REPO=""
BUNDLE_PATH=""
TRUSTED_ROOT_PATH=""
SIGNER_WORKFLOW=""
ATTESTATION_OUT_PATH=""
PREDICATE_TYPE="https://slsa.dev/provenance/v1"
SKIP_ATTESTATION="false"
CLI_OVERRIDE=""

usage() {
  cat <<'USAGE'
Usage:
  verify_release_consumer_artifact.sh \
    --artifact <path-to-zip> \
    --checksums <path-to-SHA256SUMS> \
    --verify-json <path-to-verify.json> \
    --public-key <path-to-ed25519-public-key> \
    [--repo <owner/repo>] \
    [--bundle <path-to-attestation.jsonl>] \
    [--trusted-root <path-to-trusted_root.jsonl>] \
    [--signer-workflow <owner/repo/.github/workflows/file.yml>] \
    [--attestation-out <path-to-json-output>] \
    [--predicate-type <predicate-uri>] \
    [--cli <path-to-cli-js>] \
    [--skip-attestation]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --artifact)
      ARTIFACT_PATH="$2"
      shift 2
      ;;
    --checksums)
      CHECKSUMS_PATH="$2"
      shift 2
      ;;
    --verify-json)
      VERIFY_JSON_PATH="$2"
      shift 2
      ;;
    --public-key)
      PUBLIC_KEY_PATH="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    --bundle)
      BUNDLE_PATH="$2"
      shift 2
      ;;
    --trusted-root)
      TRUSTED_ROOT_PATH="$2"
      shift 2
      ;;
    --signer-workflow)
      SIGNER_WORKFLOW="$2"
      shift 2
      ;;
    --attestation-out)
      ATTESTATION_OUT_PATH="$2"
      shift 2
      ;;
    --predicate-type)
      PREDICATE_TYPE="$2"
      shift 2
      ;;
    --cli)
      CLI_OVERRIDE="$2"
      shift 2
      ;;
    --skip-attestation)
      SKIP_ATTESTATION="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$ARTIFACT_PATH" || -z "$CHECKSUMS_PATH" || -z "$VERIFY_JSON_PATH" || -z "$PUBLIC_KEY_PATH" ]]; then
  echo "Missing required arguments" >&2
  usage
  exit 1
fi

for path_value in "$ARTIFACT_PATH" "$CHECKSUMS_PATH" "$VERIFY_JSON_PATH" "$PUBLIC_KEY_PATH"; do
  if [[ ! -f "$path_value" ]]; then
    echo "Required file not found: $path_value" >&2
    exit 1
  fi
done

resolve_cli_command() {
  if [[ -n "$CLI_OVERRIDE" ]]; then
    echo "node $CLI_OVERRIDE"
    return
  fi
  if [[ -f "$ROOT_DIR/dist/cli.js" ]]; then
    echo "node $ROOT_DIR/dist/cli.js"
    return
  fi
  echo "$ROOT_DIR/node_modules/.bin/tsx $ROOT_DIR/src/cli.ts"
}

CLI_CMD="$(resolve_cli_command)"
ARTIFACT_BASENAME="$(basename "$ARTIFACT_PATH")"

EXPECTED_HASH="$(awk -v artifact="$ARTIFACT_BASENAME" '
  {
    file=$2;
    gsub(/^\*+/, "", file);
    gsub(/^\.\//, "", file);
    if (file == artifact) {
      print $1;
      exit;
    }
  }
' "$CHECKSUMS_PATH")"

if [[ -z "$EXPECTED_HASH" ]]; then
  EXPECTED_HASH="$(awk 'NF > 0 {print $1; exit}' "$CHECKSUMS_PATH")"
fi

if [[ -z "$EXPECTED_HASH" ]]; then
  echo "Unable to extract expected checksum from $CHECKSUMS_PATH" >&2
  exit 1
fi

ACTUAL_HASH="$(shasum -a 256 "$ARTIFACT_PATH" | awk '{print $1}')"
if [[ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]]; then
  echo "Checksum verification failed: expected=$EXPECTED_HASH actual=$ACTUAL_HASH" >&2
  exit 1
fi

node -e '
const fs = require("node:fs");
const filePath = process.argv[1];
const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
if (!payload || payload.integrityOk !== true || payload.signatureVerified !== true) {
  throw new Error("verify-json payload must contain integrityOk=true and signatureVerified=true");
}
' "$VERIFY_JSON_PATH"

TMP_VERIFY_OUTPUT="$(mktemp)"
# shellcheck disable=SC2086
$CLI_CMD verify-bundle --bundle "$ARTIFACT_PATH" --sign-public-key "$PUBLIC_KEY_PATH" --require-signature --json > "$TMP_VERIFY_OUTPUT"
node -e '
const fs = require("node:fs");
const filePath = process.argv[1];
const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
if (!payload || payload.integrityOk !== true || payload.signatureVerified !== true) {
  throw new Error("live verify-bundle check failed");
}
' "$TMP_VERIFY_OUTPUT"
rm -f "$TMP_VERIFY_OUTPUT"

if [[ "$SKIP_ATTESTATION" == "true" ]]; then
  echo "consumer verification: checksum + signature checks passed (attestation skipped)"
  exit 0
fi

if [[ -z "$REPO" ]]; then
  echo "Attestation verification requires --repo <owner/repo> (or pass --skip-attestation)" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required for attestation verification" >&2
  exit 1
fi

ATTESTATION_OUT_PATH="${ATTESTATION_OUT_PATH:-$(dirname "$ARTIFACT_PATH")/$(basename "$ARTIFACT_PATH").attestation.verify.json}"
mkdir -p "$(dirname "$ATTESTATION_OUT_PATH")"

ATTEST_VERIFY_CMD=(
  gh attestation verify "$ARTIFACT_PATH"
  --repo "$REPO"
  --predicate-type "$PREDICATE_TYPE"
  --format json
)

if [[ -n "$BUNDLE_PATH" ]]; then
  if [[ ! -f "$BUNDLE_PATH" ]]; then
    echo "Attestation bundle not found: $BUNDLE_PATH" >&2
    exit 1
  fi
  ATTEST_VERIFY_CMD+=(--bundle "$BUNDLE_PATH")
fi

if [[ -n "$TRUSTED_ROOT_PATH" ]]; then
  if [[ ! -f "$TRUSTED_ROOT_PATH" ]]; then
    echo "Trusted root file not found: $TRUSTED_ROOT_PATH" >&2
    exit 1
  fi
  ATTEST_VERIFY_CMD+=(--custom-trusted-root "$TRUSTED_ROOT_PATH")
fi

if [[ -n "$SIGNER_WORKFLOW" ]]; then
  ATTEST_VERIFY_CMD+=(--signer-workflow "$SIGNER_WORKFLOW")
fi

"${ATTEST_VERIFY_CMD[@]}" > "$ATTESTATION_OUT_PATH"
node -e '
const fs = require("node:fs");
const filePath = process.argv[1];
const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
if (!Array.isArray(payload) || payload.length === 0) {
  throw new Error("attestation verification did not return any verified bundles");
}
' "$ATTESTATION_OUT_PATH"

echo "consumer verification: checksum + signature + attestation checks passed"
echo "attestation output: $ATTESTATION_OUT_PATH"
