#!/bin/bash
# Argos WAN watchdog — NetworkManager dispatcher hook.
# Fires on connectivity-change; reconnects active wifi when WAN is lost.
# Safe no-ops: non-connectivity events, healthy states, cooldown, already-recovering.
# Exit 0 on every path — dispatcher failures pollute NM journal otherwise.
set -u

ACTION="${2:-}"
[[ "$ACTION" = "connectivity-change" ]] || exit 0

STATE="${CONNECTIVITY_STATE:-UNKNOWN}"
case "$STATE" in
    NONE|LIMITED) ;;
    *) exit 0 ;;
esac

STAMP=/run/argos-wan-watchdog.stamp
COOLDOWN=120
NOW=$(date +%s)
if [[ -f "$STAMP" ]]; then
    LAST=$(grep -E '^[0-9]+$' "$STAMP" 2>/dev/null | head -n1)
    # Force base-10 coercion: leading-zero values (e.g. 08, 09) would
    # otherwise be parsed as octal by bash arithmetic and throw.
    case "$LAST" in ''|*[!0-9]*) LAST=0 ;; *) LAST=$((10#$LAST)) ;; esac
    AGE=$(( NOW - LAST ))
    if [[ "$AGE" -lt "$COOLDOWN" ]]; then
        logger -t argos-wan "cooldown active (${AGE}s < ${COOLDOWN}s); state=$STATE; skip"
        exit 0
    fi
fi

WIFI_PROFILE=$(nmcli -t -f TYPE,NAME connection show --active 2>/dev/null \
    | awk -F: '$1=="802-11-wireless"{print $2; exit}')
WIFI_DEV=$(nmcli -t -f TYPE,DEVICE,STATE device status 2>/dev/null \
    | awk -F: '$1=="wifi" && $3=="connected"{print $2; exit}')

if [[ -z "$WIFI_PROFILE" ]] || [[ -z "$WIFI_DEV" ]]; then
    logger -t argos-wan "no active wifi profile/device; state=$STATE; skip"
    exit 0
fi

DEV_STATE=$(nmcli -t -f GENERAL.STATE device show "$WIFI_DEV" 2>/dev/null | cut -d: -f2)
case "$DEV_STATE" in
    *connecting*|*prepare*|*config*|*ip-check*|*need-auth*|*secondaries*)
        logger -t argos-wan "NM mid-transition ($DEV_STATE); state=$STATE; skip"
        exit 0
        ;;
    *) ;;
esac

FAILFILE=/run/argos-wan-watchdog.fails
MAX_FAILS=3
FAIL_TTL=600
PRIOR_PROFILE=""
PRIOR_COUNT=0
PRIOR_TIME=0
if [[ -f "$FAILFILE" ]]; then
    { read -r PRIOR_PROFILE; read -r PRIOR_COUNT; read -r PRIOR_TIME; } < "$FAILFILE" 2>/dev/null || true
    # Base-10 coerce to avoid octal parse on values like 08/09.
    case "$PRIOR_COUNT" in ''|*[!0-9]*) PRIOR_COUNT=0 ;; *) PRIOR_COUNT=$((10#$PRIOR_COUNT)) ;; esac
    case "$PRIOR_TIME"  in ''|*[!0-9]*) PRIOR_TIME=0  ;; *) PRIOR_TIME=$((10#$PRIOR_TIME))  ;; esac
fi
AGE_FAIL=$(( NOW - PRIOR_TIME ))
if [[ "$PRIOR_PROFILE" != "$WIFI_PROFILE" ]] || [[ "$AGE_FAIL" -gt "$FAIL_TTL" ]]; then
    PRIOR_COUNT=0
fi

if [[ "$PRIOR_COUNT" -ge "$MAX_FAILS" ]]; then
    if [[ "${DRY_RUN:-0}" = "1" ]]; then
        logger -t argos-wan "DRY_RUN would ESCALATE: down '$WIFI_PROFILE' after ${PRIOR_COUNT} fails (let NM autoconnect pick alternate)"
        exit 0
    fi
    echo "$NOW" > "$STAMP"
    logger -t argos-wan "escalate: '$WIFI_PROFILE' failed ${PRIOR_COUNT}x; downing so NM autoconnect picks alternate"
    timeout 15 nmcli connection down "$WIFI_PROFILE" >/dev/null 2>&1 || true
    rm -f "$FAILFILE"
    exit 0
fi

NEW_COUNT=$(( PRIOR_COUNT + 1 ))

if [[ "${DRY_RUN:-0}" = "1" ]]; then
    logger -t argos-wan "DRY_RUN would reconnect profile='$WIFI_PROFILE' dev=$WIFI_DEV state=$STATE (attempt ${NEW_COUNT}/${MAX_FAILS})"
    exit 0
fi

echo "$NOW" > "$STAMP"
logger -t argos-wan "WAN lost (state=$STATE); reconnecting '$WIFI_PROFILE' on $WIFI_DEV (attempt ${NEW_COUNT}/${MAX_FAILS})"
OUT=/run/argos-wan-reconnect.out
if timeout 30 nmcli connection up "$WIFI_PROFILE" ifname "$WIFI_DEV" >"$OUT" 2>&1; then
    logger -t argos-wan "reconnect OK: '$WIFI_PROFILE'"
    rm -f "$FAILFILE"
else
    RC=$?
    printf '%s\n%d\n%d\n' "$WIFI_PROFILE" "$NEW_COUNT" "$NOW" > "$FAILFILE"
    if [[ "$RC" -eq 124 ]]; then
        logger -t argos-wan "reconnect TIMEOUT 30s: '$WIFI_PROFILE' (fail ${NEW_COUNT}/${MAX_FAILS}; stamp held)"
    else
        logger -t argos-wan "reconnect FAILED rc=$RC (fail ${NEW_COUNT}/${MAX_FAILS}): $(head -c 300 "$OUT" 2>/dev/null)"
    fi
fi

exit 0
