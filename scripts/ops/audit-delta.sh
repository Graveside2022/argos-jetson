#!/usr/bin/env bash
#
# Audit-delta gate. Runs `npm audit --json`, extracts the current GHSA IDs,
# and compares them to the baseline in `.audit-baseline.json`. Fails only on
# advisories that are NOT already in the baseline — i.e. regressions, not
# the pre-existing 26 advisories already tracked for Track B remediation.
#
# Exit codes:
#   0 — no new advisories (current ⊆ baseline)
#   1 — new advisories found; details printed to stderr
#   2 — tooling/environment failure (jq missing, baseline missing, etc.)
#
# Usage:
#   ./scripts/ops/audit-delta.sh                  — check delta
#   ./scripts/ops/audit-delta.sh --update         — rewrite baseline to current
#
# The `--update` flag is the intended path for closing Track-B stages:
# after a force-upgrade resolves advisories, baseline is narrowed so the
# gate catches future regressions against the new, smaller set.
#
set -euo pipefail

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
BASELINE="${REPO_ROOT}/.audit-baseline.json"

if ! command -v jq >/dev/null 2>&1; then
	echo "audit-delta: jq not installed. Install via \`apt install jq\` or \`brew install jq\`." >&2
	exit 2
fi

if [ ! -f "$BASELINE" ]; then
	echo "audit-delta: baseline file $BASELINE missing. Run with --update to create." >&2
	exit 2
fi

AUDIT_TMP=$(mktemp)
trap 'rm -f "$AUDIT_TMP"' EXIT

if ! (cd "$REPO_ROOT" && npm audit --json 2>/dev/null) > "$AUDIT_TMP"; then
	# npm audit exits non-zero when vulns exist; that is informational, not a
	# failure for this script. Only care about JSON parse success next.
	:
fi

if ! jq . "$AUDIT_TMP" >/dev/null 2>&1; then
	echo "audit-delta: \`npm audit --json\` did not produce valid JSON" >&2
	exit 2
fi

if [ "${1:-}" = "--update" ]; then
	jq -c '[.. | objects | select(.url?) | {ghsa: (.url | split("/") | last), pkg: (.name // "unknown"), severity: (.severity // "unknown"), title: (.title // "")}] | unique_by(.ghsa) | sort_by(.severity, .ghsa)' "$AUDIT_TMP" > /tmp/audit-advs.json
	jq -n \
		--argjson advs "$(cat /tmp/audit-advs.json)" \
		--argjson counts "$(jq '.metadata.vulnerabilities' "$AUDIT_TMP")" \
		'{
			baselinedAt: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
			counts: $counts,
			advisories: $advs,
			note: "This file gates the `npm audit` delta check. Regenerate with: scripts/ops/audit-delta.sh --update"
		}' > "$BASELINE"
	echo "audit-delta: baseline updated ($(jq -r '.counts.total' "$BASELINE") advisories, $(jq -r '.advisories | length' "$BASELINE") unique GHSA IDs)" >&2
	rm -f /tmp/audit-advs.json
	exit 0
fi

# Delta check: GHSA IDs in current but not in baseline.
BASELINE_GHSAS=$(jq -r '.advisories[].ghsa' "$BASELINE" | sort -u)
CURRENT_GHSAS=$(jq -r '[.. | objects | select(.url?) | .url | split("/") | last] | unique | .[]' "$AUDIT_TMP" | sort -u)

NEW_GHSAS=$(comm -23 <(echo "$CURRENT_GHSAS") <(echo "$BASELINE_GHSAS") || true)

if [ -z "$NEW_GHSAS" ]; then
	echo "audit-delta: ✓ no new advisories (baseline covers $(echo "$BASELINE_GHSAS" | wc -l | tr -d ' ') known)" >&2
	exit 0
fi

echo "audit-delta: ✗ new advisories not covered by baseline:" >&2
while IFS= read -r ghsa; do
	[ -z "$ghsa" ] && continue
	# Pull details from current audit for the new GHSA.
	DETAILS=$(jq -r --arg g "$ghsa" '[.. | objects | select(.url? | test($g))] | .[0] | "  \(.name // "?") [\(.severity // "?")] \(.title // "")"' "$AUDIT_TMP" 2>/dev/null || echo "  $ghsa")
	echo "  $ghsa"
	echo "$DETAILS"
done <<< "$NEW_GHSAS"

echo "" >&2
echo "audit-delta: to accept as new baseline, run: scripts/ops/audit-delta.sh --update" >&2
exit 1
