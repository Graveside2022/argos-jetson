#!/usr/bin/env bash
# Switch the active NovaSDR preset (HackRF is single-tuner; only one receiver
# can hold the RX stream at a time). Updates docker/novasdr/config and
# restarts the novasdr-hackrf container.
#
# Usage:
#   scripts/ops/novasdr-preset.sh                 # list presets
#   scripts/ops/novasdr-preset.sh <preset-id>     # activate one
#
# Preset IDs are the `id` fields in docker/novasdr/config/receivers.json
# (ism-915, ism-2g4, fpv-5g8, wifi-5g-unii1, gps-l1, fm-broadcast,
#  airband-vhf, ham-2m, frs-gmrs, p25-lmr-800).

set -euo pipefail

CONFIG_DIR="$(dirname "$(readlink -f "$0")")/../../docker/novasdr/config"
RECEIVERS="$CONFIG_DIR/receivers.json"
CONFIG="$CONFIG_DIR/config.json"
CONTAINER="novasdr-hackrf"

if [[ ! -r "$RECEIVERS" || ! -r "$CONFIG" ]]; then
    echo "error: cannot read $RECEIVERS or $CONFIG" >&2
    exit 1
fi

list_presets() {
    jq -r '.receivers[] | "  \(.id)\t\(if .enabled then "[ACTIVE]" else "" end)\t\(.name)"' "$RECEIVERS" \
        | column -t -s $'\t'
}

if [[ $# -eq 0 ]]; then
    echo "NovaSDR presets:"
    list_presets
    echo
    echo "Usage: $0 <preset-id>"
    exit 0
fi

TARGET="$1"

if ! jq -e --arg id "$TARGET" '.receivers[] | select(.id == $id)' "$RECEIVERS" >/dev/null; then
    echo "error: preset '$TARGET' not found" >&2
    echo "Available:" >&2
    list_presets >&2
    exit 1
fi

# Enable only TARGET, disable all others. Update active_receiver_id in config.json.
tmp="$(mktemp)"
jq --arg id "$TARGET" \
    '.receivers |= map(.enabled = (.id == $id))' \
    "$RECEIVERS" > "$tmp" && mv "$tmp" "$RECEIVERS"

tmp="$(mktemp)"
jq --arg id "$TARGET" '.active_receiver_id = $id' "$CONFIG" > "$tmp" && mv "$tmp" "$CONFIG"

echo "Preset set to '$TARGET'. Restarting $CONTAINER..."
docker restart "$CONTAINER" >/dev/null

# Wait for DSP to open the device, up to 15s
for _ in $(seq 1 15); do
    if docker logs --tail 80 "$CONTAINER" 2>&1 | grep -q "input opened receiver_id=$TARGET"; then
        echo "active: $TARGET"
        docker logs --tail 40 "$CONTAINER" 2>&1 | grep -E "active receiver|Opening HackRF|input opened" | tail -3
        exit 0
    fi
    sleep 1
done

echo "warning: DSP open not confirmed within 15s. Tail of log:" >&2
docker logs --tail 20 "$CONTAINER" 2>&1 | tail -10 >&2
exit 2
