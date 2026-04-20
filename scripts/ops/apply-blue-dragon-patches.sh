#!/bin/bash
# Apply local security/hardening patches to the embedded tactical/blue-dragon repo.
# Idempotent: patches already applied are detected via --reverse check and skipped.
#
# Part of Sprint 1 P0 remediation: tactical/blue-dragon/ is an embedded upstream
# git repo from alphafox02/blue-dragon (pinned at 58c8cf2). Local fixes cannot
# be committed to the outer repo because git refuses to descend into nested .git
# dirs, so we carry them as patch files here and apply at install time.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PATCH_DIR="$REPO_ROOT/tactical/blue-dragon-patches"
TARGET="$REPO_ROOT/tactical/blue-dragon"

if [[ ! -d "$TARGET/.git" ]]; then
	echo "[apply-blue-dragon-patches] ERROR: $TARGET is not a git repo — clone it first" >&2
	exit 1
fi

shopt -s nullglob
patches=("$PATCH_DIR"/*.patch)
shopt -u nullglob

if [[ ${#patches[@]} -eq 0 ]]; then
	echo "[apply-blue-dragon-patches] no patches in $PATCH_DIR — nothing to apply"
	exit 0
fi

for patch in "${patches[@]}"; do
	name=$(basename "$patch")
	if git -C "$TARGET" apply --check "$patch" 2>/dev/null; then
		echo "[apply-blue-dragon-patches] applying $name"
		git -C "$TARGET" apply "$patch"
	elif git -C "$TARGET" apply --check --reverse "$patch" 2>/dev/null; then
		echo "[apply-blue-dragon-patches] already applied: $name"
	else
		echo "[apply-blue-dragon-patches] SKIP $name — conflicts with current tree" >&2
	fi
done
