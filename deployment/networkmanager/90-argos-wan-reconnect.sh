#!/bin/bash
# Argos WAN watchdog — NetworkManager dispatcher hook.
# Fires on connectivity-change; reconnects active wifi when WAN is lost.
# Safe no-ops: non-connectivity events, healthy states, cooldown, already-recovering.
# Exit 0 on every path — dispatcher failures pollute NM journal otherwise.
set -u

ACTION="${2:-}"
[ "$ACTION" = "connectivity-change" ] || exit 0

STATE="${CONNECTIVITY_STATE:-UNKNOWN}"
case "$STATE" in
    NONE|LIMITED) ;;
    *) exit 0 ;;
esac

STAMP=/run/argos-wan-watchdog.stamp
COOLDOWN=120
NOW=$(date +%s)
if [ -f "$STAMP" ]; then
    LAST=$(cat "$STAMP" 2>/dev/null || echo 0)
    AGE=$(( NOW - LAST ))
    if [ "$AGE" -lt "$COOLDOWN" ]; then
        logger -t argos-wan "cooldown active (${AGE}s < ${COOLDOWN}s); state=$STATE; skip"
        exit 0
    fi
fi

WIFI_PROFILE=$(nmcli -t -f TYPE,NAME connection show --active 2>/dev/null \
    | awk -F: '$1=="802-11-wireless"{print $2; exit}')
WIFI_DEV=$(nmcli -t -f TYPE,DEVICE,STATE device status 2>/dev/null \
    | awk -F: '$1=="wifi" && $3=="connected"{print $2; exit}')

if [ -z "$WIFI_PROFILE" ] || [ -z "$WIFI_DEV" ]; then
    logger -t argos-wan "no active wifi profile/device; state=$STATE; skip"
    exit 0
fi

DEV_STATE=$(nmcli -t -f GENERAL.STATE device show "$WIFI_DEV" 2>/dev/null | cut -d: -f2)
case "$DEV_STATE" in
    *connecting*|*prepare*|*config*|*ip-check*|*need-auth*|*secondaries*)
        logger -t argos-wan "NM mid-transition ($DEV_STATE); state=$STATE; skip"
        exit 0
        ;;
esac

if [ "${DRY_RUN:-0}" = "1" ]; then
    logger -t argos-wan "DRY_RUN would reconnect profile='$WIFI_PROFILE' dev=$WIFI_DEV state=$STATE"
    exit 0
fi

echo "$NOW" > "$STAMP"
logger -t argos-wan "WAN lost (state=$STATE); reconnecting '$WIFI_PROFILE' on $WIFI_DEV"
OUT=/run/argos-wan-reconnect.out
if timeout 30 nmcli connection up "$WIFI_PROFILE" ifname "$WIFI_DEV" >"$OUT" 2>&1; then
    logger -t argos-wan "reconnect OK: '$WIFI_PROFILE'"
else
    RC=$?
    if [ "$RC" -eq 124 ]; then
        logger -t argos-wan "reconnect TIMEOUT 30s: '$WIFI_PROFILE' (stamp held; cooldown active)"
    else
        logger -t argos-wan "reconnect FAILED rc=$RC: $(head -c 300 "$OUT" 2>/dev/null)"
    fi
fi

exit 0
