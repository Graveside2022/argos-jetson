#!/usr/bin/env bash
# audit-pipeline-config.sh — L3 mechanical drift detector for the Argos
# CI/CD pipeline. Verifies actual config matches the canon spec at
# docs/ci-cd-pipeline-spec.md.
#
# Per the approved plan
#   /home/jetson2/.claude/plans/based-off-all-this-starry-cloud.md
# this script ships in PR-AUD-1b as warning-only (workflow uses `|| true`).
# After 2 weeks of clean runs, a follow-up PR flips it to hard-fail.
#
# Checks performed (each is independent; one failure does NOT short-circuit):
#   1. Every hook command's referenced config file exists.
#      (Catches the "lint-staged silently no-op" pattern.)
#   2. ESLint --cache + --cache-strategy content flags present everywhere
#      ESLint is invoked (npm scripts, husky hooks, GH workflows).
#   3. Spec doc YAML frontmatter `last_validated` date < 90 days old.
#      Forces periodic re-audit of canonical sources.
#   4. GH Actions SHA-pinned action versions
#      (allowlist for first-party actions/* repos and reusable workflows).
#
# Gate-matrix canonical-owner check (proposed check 5) is deferred
# until docs/ci-cd-pipeline-spec.md gains a machine-readable gate matrix
# (currently it's in §5 markdown table). Tracked as L3 v2.

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

EXIT_CODE=0
FINDINGS=()

note() { FINDINGS+=("[ok]   $1"); }
warn() { FINDINGS+=("[warn] $1"); EXIT_CODE=1; }

echo "[audit] Argos pipeline config drift check"
echo "[audit] repo: $REPO_ROOT"
echo

# ── Check 1 ──────────────────────────────────────────────────────────
# Hook commands reference real config files. Specifically: if a hook
# invokes `lint-staged`, then a lint-staged config must exist somewhere.
# Same for commitlint, eslint, prettier.
check_lint_staged_config() {
	local hook=".husky/pre-commit"
	[ -f "$hook" ] || { warn "missing $hook"; return; }
	if grep -qE '\bnpx[[:space:]]+(--no-install[[:space:]]+)?lint-staged\b' "$hook"; then
		# lint-staged supports several config paths
		if ls .lintstagedrc.json .lintstagedrc.cjs .lintstagedrc.mjs \
		      .lintstagedrc.js lint-staged.config.cjs \
		      lint-staged.config.mjs lint-staged.config.js >/dev/null 2>&1; then
			note "lint-staged config present (hook + config aligned)"
		elif grep -q '"lint-staged"' package.json 2>/dev/null; then
			note "lint-staged config present in package.json"
		else
			warn "lint-staged invoked from $hook but NO config file found"
		fi
	fi
}

check_commitlint_config() {
	local hook=".husky/commit-msg"
	[ -f "$hook" ] || { warn "missing $hook"; return; }
	if grep -qE '\bnpx[[:space:]]+(--no-install[[:space:]]+)?commitlint\b' "$hook"; then
		if [ -f commitlint.config.mjs ] || [ -f commitlint.config.js ] \
		   || [ -f commitlint.config.cjs ] || [ -f .commitlintrc.json ]; then
			note "commitlint config present (hook + config aligned)"
		else
			warn "commitlint invoked from $hook but NO config file found"
		fi
	fi
}

# ── Check 2 ──────────────────────────────────────────────────────────
# ESLint cache flags present in every invocation site. The single biggest
# velocity win identified in the audit was wiring --cache to npm run lint.
check_eslint_cache_flags() {
	# package.json scripts
	for script in lint lint:fix; do
		invocation=$(jq -r ".scripts[\"$script\"] // empty" package.json 2>/dev/null)
		[ -z "$invocation" ] && continue
		case "$invocation" in
			*"--cache"*) note "package.json#$script wires --cache" ;;
			*) warn "package.json#$script missing --cache flag" ;;
		esac
	done
	# husky pre-push
	if [ -f .husky/pre-push ]; then
		if grep -qE 'eslint[^|]*--cache' .husky/pre-push; then
			note ".husky/pre-push wires --cache"
		else
			warn ".husky/pre-push runs eslint without --cache"
		fi
	fi
	# GH Actions
	if [ -f .github/workflows/lint.yml ]; then
		if grep -qE 'eslint[^|]*--cache' .github/workflows/lint.yml; then
			note "lint.yml wires --cache"
		else
			warn "lint.yml runs eslint without --cache"
		fi
	fi
}

# ── Check 3 ──────────────────────────────────────────────────────────
# Spec doc last_validated < 90 days old. Drift protection per plan-agent
# feedback (otherwise spec rots into a lying source of truth).
check_spec_freshness() {
	local spec="docs/ci-cd-pipeline-spec.md"
	[ -f "$spec" ] || { warn "missing $spec — canonical reference not present"; return; }
	local last=$(awk '/^last_validated:/ { print $2; exit }' "$spec")
	if [ -z "$last" ]; then
		warn "$spec has no last_validated frontmatter date"
		return
	fi
	local last_epoch=$(date -d "$last" +%s 2>/dev/null || echo 0)
	local now_epoch=$(date +%s)
	local days_old=$(( (now_epoch - last_epoch) / 86400 ))
	if [ "$days_old" -le 90 ]; then
		note "spec doc last_validated $last ($days_old days ago, ≤90)"
	else
		warn "spec doc last_validated $last is $days_old days old (>90 — re-audit due)"
	fi
}

# ── Check 4 ──────────────────────────────────────────────────────────
# SHA-pinned actions. GitHub Actions security canon
#   (https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions)
# requires pinning to commit SHAs, not floating tags. Allowlist:
#   - actions/*  (first-party, audited)
#   - github/*   (first-party)
#   - reusable workflows referenced via ./.github/workflows/*.yml
ALLOWLIST_REGEX='^(actions|github)/[a-zA-Z0-9._-]+@(v[0-9]+(\.[0-9]+)*|main|master)$'
check_sha_pinned_actions() {
	local issues=0
	while IFS= read -r line; do
		# Strip leading whitespace + 'uses:' + quotes + trailing comment
		local ref=$(echo "$line" | sed -E 's/^[[:space:]]*uses:[[:space:]]*"?//; s/"?[[:space:]]*(#.*)?$//; s/[[:space:]]+$//')
		# Reusable workflow (./.github/workflows/X.yml)
		[[ "$ref" =~ ^\./ ]] && continue
		# Allowlisted first-party with tag
		[[ "$ref" =~ $ALLOWLIST_REGEX ]] && continue
		# SHA-pinned (40-char hex anywhere after @)
		[[ "$ref" =~ @[a-f0-9]{40}([[:space:]].*)?$ ]] && continue
		warn "unpinned action ref: $ref"
		issues=$((issues+1))
	done < <(grep -hE '^[[:space:]]*uses:[[:space:]]+' .github/workflows/*.yml 2>/dev/null)
	[ "$issues" -eq 0 ] && note "all action refs SHA-pinned or first-party tagged"
}

# ── Run all checks ────────────────────────────────────────────────────
check_lint_staged_config
check_commitlint_config
check_eslint_cache_flags
check_spec_freshness
check_sha_pinned_actions

# ── Report ────────────────────────────────────────────────────────────
echo "[audit] findings:"
for f in "${FINDINGS[@]}"; do
	echo "  $f"
done

if [ "$EXIT_CODE" -ne 0 ]; then
	echo
	echo "[audit] ⚠ drift detected — see warnings above"
	echo "[audit] (warning-only mode; will become hard-fail after 2-week soak)"
fi

exit "$EXIT_CODE"
