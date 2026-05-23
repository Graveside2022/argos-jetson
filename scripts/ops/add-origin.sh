#!/usr/bin/env bash
# Append an Origin URL to ARGOS_CORS_ORIGINS in .env. Idempotent.
#
# Usage:
#   ./scripts/ops/add-origin.sh http://100.119.153.120:5173
#
# After running, restart argos-final to apply:
#   sudo systemctl restart argos-final
#
# See docs/security/multi-vpn-origin-setup.md for the full layered-defense
# model (overlay ACLs + ARGOS_API_KEY + rate limit + this allowlist).
set -euo pipefail

ORIGIN="${1:-}"
if [ -z "$ORIGIN" ]; then
  echo "Usage: $0 <origin-url>" >&2
  echo "  e.g. $0 http://100.119.153.120:5173" >&2
  exit 1
fi

# Validate URL shape — http(s) scheme + host (DNS or IPv4) + optional port.
# Rejects schemes other than http/https, paths, query strings, fragments,
# and IPv6 literals (Argos has not been tested with IPv6 Origin headers).
if ! [[ "$ORIGIN" =~ ^https?://[a-zA-Z0-9][a-zA-Z0-9.-]*(:[0-9]+)?$ ]]; then
  echo "ERROR: '$ORIGIN' is not a valid http(s)://host[:port] URL" >&2
  exit 1
fi

# Locate .env relative to this script (scripts/ops/ → repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

if grep -qE '^ARGOS_CORS_ORIGINS=' "$ENV_FILE"; then
  current=$(grep -E '^ARGOS_CORS_ORIGINS=' "$ENV_FILE" | head -1 | cut -d= -f2-)
  # Idempotency check — guard with commas so we match whole-entry only
  if echo ",$current," | grep -qF ",$ORIGIN,"; then
    echo "Already present: $ORIGIN"
    exit 0
  fi
  new_value="${current:+$current,}$ORIGIN"
  # Escape for sed — '|' delimiter avoids '/' clashes in URLs
  sed -i "s|^ARGOS_CORS_ORIGINS=.*|ARGOS_CORS_ORIGINS=$new_value|" "$ENV_FILE"
else
  echo "ARGOS_CORS_ORIGINS=$ORIGIN" >> "$ENV_FILE"
fi

echo "Added: $ORIGIN"
echo ""
echo "Restart argos-final to apply:"
echo "  sudo systemctl restart argos-final"
