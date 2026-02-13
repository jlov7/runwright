# Manifest spec — `skillbase.yml`

## Goals

- Human-readable
- Works in mono-repos
- Supports multiple tools and multiple profiles
- Deterministic with lockfile

## `skillbase.yml` schema (proposal)

```yaml
version: 1

defaults:
  mode: link              # link | copy | mirror
  scope: global           # global | project
  verify: true            # run verify step after apply
  scan:
    lint: true
    security: warn        # off | warn | fail
    allowRuleIds: [remote-shell-curl-pipe]
    severityOverrides:
      remote-shell-curl-pipe: medium  # high | medium
    allowlist:
      - ruleId: remote-shell-curl-pipe
        source: local:./skills         # optional
        skill: bootstrap               # optional
        expiresAt: 2027-01-01T00:00:00Z # optional
        reason: "temporary acceptance for bootstrap scripts"

targets:
  codex:
    enabled: true
    mode: link
    scope: global         # where to install (global or project)
  claude-code:
    enabled: true
    mode: link
    scope: project
  cursor:
    enabled: true
    mode: copy            # recommended default (symlink issues)
    scope: global

skillsets:
  base:
    description: "core daily-driver skills"
    skills:
      - source: vercel-labs/agent-skills
        pick: [react-best-practices, web-design-review]
      - source: anthropics/skills
        pick: [skill-creator]
  security:
    description: "security review helpers"
    skills:
      - source: your-org/skills-security
        pick: [dependency-audit, secret-scan]

apply:
  useSkillsets: [base]
  extraSkills:
    - source: local:./skills/custom-team-skill
```

### Source formats

- `owner/repo` (GitHub)
- `https://skills.sh/owner/repo[/skill]`
- `local:/abs/path` or `local:./relative/path`

### Selecting skills

- `pick: [skill-a, skill-b]` installs only those
- omit `pick` to install all skills from that source

## Lockfile — `skillbase.lock.json`

- Written after successful resolution
- Records:
  - source
  - commit/tag
  - resolved skill list + digests
  - adapter mode chosen per target
  - timestamp

Example:

```json
{
  "version": 1,
  "generatedAt": "2026-02-12T00:00:00Z",
  "sources": {
    "vercel-labs/agent-skills": {
      "type": "github",
      "resolved": { "ref": "commit", "value": "abc123..." },
      "skills": {
        "react-best-practices": {
          "digest": "sha256:...",
          "path": "~/.skillbase/store/..."
        }
      }
    }
  }
}
```
