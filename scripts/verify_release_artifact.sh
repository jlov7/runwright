#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/keys" "$TMP_DIR/project/skills/safe"

node -e "const { generateKeyPairSync } = require('node:crypto'); const { writeFileSync } = require('node:fs'); const pair = generateKeyPairSync('ed25519'); writeFileSync(process.argv[1], pair.privateKey.export({ format: 'pem', type: 'pkcs8' })); writeFileSync(process.argv[2], pair.publicKey.export({ format: 'pem', type: 'spki' }));" \
  "$TMP_DIR/keys/private.pem" "$TMP_DIR/keys/public.pem"

cat > "$TMP_DIR/project/skills/safe/SKILL.md" <<'SKILL'
---
name: safe
description: safe skill
---

# Safe
SKILL

cat > "$TMP_DIR/project/skillbase.yml" <<'MANIFEST'
version: 1
skillsets:
  base:
    skills:
      - source: local:./skills
apply:
  useSkillsets: [base]
MANIFEST

pnpm -C "$ROOT_DIR" build

(
  cd "$TMP_DIR/project"
  export SOURCE_DATE_EPOCH=1704067200
  node "$ROOT_DIR/dist/cli.js" update --json >/dev/null
  node "$ROOT_DIR/dist/cli.js" export --out skillbase-release.zip --sign-private-key "$TMP_DIR/keys/private.pem" --deterministic --json >/dev/null
  node "$ROOT_DIR/dist/cli.js" verify-bundle --bundle skillbase-release.zip --sign-public-key "$TMP_DIR/keys/public.pem" --require-signature --json > skillbase-release.verify.json
  shasum -a 256 skillbase-release.zip > SHA256SUMS
  pnpm --dir "$ROOT_DIR" exec tsx scripts/generate_quality_scorecard.ts \
    --out "$TMP_DIR/project/release-scorecard.json" \
    --md "$TMP_DIR/project/release-scorecard.md" \
    --title "Skillbase Local Release Verification Scorecard" \
    --check verify=success \
    --check signed-bundle=success
  pnpm --dir "$ROOT_DIR" exec tsx scripts/verify_quality_evidence.ts \
    --scorecard "$TMP_DIR/project/release-scorecard.json" \
    --require-check verify \
    --require-check signed-bundle \
    --out "$TMP_DIR/project/release-scorecard.verify.json"
  pnpm --dir "$ROOT_DIR" exec tsx scripts/verify_release_tag_signature.ts \
    --ref-name local \
    --ref-type branch \
    --out "$TMP_DIR/project/tag-signature.verify.json"
  pnpm --dir "$ROOT_DIR" exec tsx scripts/generate_release_notes.ts \
    --tag local \
    --scorecard "$TMP_DIR/project/release-scorecard.json" \
    --evidence "$TMP_DIR/project/release-scorecard.verify.json" \
    --out "$TMP_DIR/project/release-notes.md"
  pnpm --dir "$ROOT_DIR" exec tsx scripts/generate_artifact_manifest.ts \
    --base-dir "$TMP_DIR/project" \
    --out "$TMP_DIR/project/release-artifact-manifest.json" \
    --file skillbase-release.zip \
    --file SHA256SUMS \
    --file skillbase-release.verify.json \
    --file release-scorecard.json \
    --file release-scorecard.md \
    --file release-scorecard.verify.json \
    --file tag-signature.verify.json \
    --file release-notes.md
  pnpm --dir "$ROOT_DIR" exec tsx scripts/verify_artifact_manifest.ts \
    --manifest "$TMP_DIR/project/release-artifact-manifest.json" \
    --out "$TMP_DIR/project/release-artifact-manifest.verify.json"
)

echo "release artifact verification: ok"
