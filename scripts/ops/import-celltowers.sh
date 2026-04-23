#!/usr/bin/env bash
# Populate data/celltowers/towers.db for offline cell-tower lookups.
#
# Tries three paths in order, short-circuits on the first that works:
#   [1]  Download a pre-built towers.db from a GitHub Release asset.
#        Fastest. No import step. Controlled by CELLTOWERS_PREBUILT_URL
#        (default points at this repo's "celltowers-latest" release).
#        Skip this path entirely with SKIP_PREBUILT=1.
#   [2]  Use a pre-placed data/celltowers/cell_towers.csv.gz (bring your own
#        OpenCellID dump). No API key needed.
#   [3]  Download the OpenCellID full dump (~500 MB gzipped). Needs
#        OPENCELLID_API_KEY (in .env or passed as $1).
#
# Usage:
#   bash scripts/ops/import-celltowers.sh                     # auto-detect
#   bash scripts/ops/import-celltowers.sh pk.your_api_key     # explicit key
#   CELLTOWERS_PREBUILT_URL=https://... bash scripts/ops/import-celltowers.sh
#   SKIP_PREBUILT=1 bash scripts/ops/import-celltowers.sh pk.your_api_key
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$PROJECT_DIR/data/celltowers"
DB_PATH="$DATA_DIR/towers.db"
CSV_GZ="$DATA_DIR/cell_towers.csv.gz"
CSV_FILE="$DATA_DIR/cell_towers.csv"

DEFAULT_PREBUILT_URL="https://github.com/Graveside2022/argos-jetson/releases/download/celltowers-latest/towers.db"
PREBUILT_URL="${CELLTOWERS_PREBUILT_URL:-$DEFAULT_PREBUILT_URL}"

# Load .env if present (may set OPENCELLID_API_KEY)
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090,SC1091
  source <(grep -v '^#' "$PROJECT_DIR/.env" | grep -v '^\s*$' | sed 's/\s*#.*//')
  set +a
fi

# --- prereq check ------------------------------------------------------------
require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' not found on PATH."
    case "$1" in
      sqlite3) echo "  Install: sudo apt install -y sqlite3" ;;
      curl)    echo "  Install: sudo apt install -y curl" ;;
      gunzip)  echo "  Install: sudo apt install -y gzip" ;;
      *)       echo "  Install via your platform's package manager." ;;
    esac
    exit 1
  fi
}
require_cmd sqlite3
require_cmd curl
require_cmd gunzip

echo "=== Argos Cell Tower Import ==="
echo "Database: $DB_PATH"
echo ""

mkdir -p "$DATA_DIR"

# Short-circuit: already have a populated DB.
if [[ -f "$DB_PATH" ]]; then
  EXISTING_ROWS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM towers;" 2>/dev/null || echo 0)
  if [[ "$EXISTING_ROWS" -gt 0 ]]; then
    echo "towers.db already populated ($EXISTING_ROWS rows). Nothing to do."
    echo "  To rebuild: rm $DB_PATH"
    exit 0
  fi
  # Empty/corrupt DB — remove and continue.
  rm -f "$DB_PATH"
fi

# --- [1] Try pre-built DB from a GitHub Release asset ------------------------
if [[ "${SKIP_PREBUILT:-0}" != "1" ]]; then
  echo "[1] Trying pre-built DB from release asset…"
  echo "    $PREBUILT_URL"
  TMP_DB="$DB_PATH.download"
  if curl -fsSL --connect-timeout 10 --retry 2 --retry-delay 2 \
         -o "$TMP_DB" "$PREBUILT_URL" 2>/dev/null; then
    # Verify SQLite magic header (first 16 bytes = "SQLite format 3\0")
    if head -c 16 "$TMP_DB" 2>/dev/null | grep -q '^SQLite format 3'; then
      mv "$TMP_DB" "$DB_PATH"
      PREBUILT_ROWS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM towers;" 2>/dev/null || echo 0)
      if [[ "$PREBUILT_ROWS" -gt 0 ]]; then
        DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
        echo ""
        echo "=== Pre-built DB installed ==="
        echo "  Database: $DB_PATH ($DB_SIZE)"
        echo "  Towers:   $PREBUILT_ROWS"
        echo ""
        echo "  No API key needed. No import step run."
        echo "  To rebuild from OpenCellID: rm $DB_PATH && SKIP_PREBUILT=1 bash $0"
        exit 0
      fi
      echo "    ✗ Downloaded DB is empty/corrupt, falling through to CSV flow"
      rm -f "$DB_PATH"
    else
      echo "    ✗ Downloaded file isn't SQLite, falling through to CSV flow"
      rm -f "$TMP_DB"
    fi
  else
    echo "    ✗ Release asset unreachable (404 / network), falling through to CSV flow"
    rm -f "$TMP_DB"
  fi
  echo ""
fi

# --- [2] CSV.gz: pre-placed, or [3] download from OpenCellID -----------------
DOWNLOADED_FRESH_GZ=0
if [[ -f "$CSV_GZ" ]]; then
  echo "[2] $CSV_GZ present — skipping OpenCellID download"
  echo "    (Delete $CSV_GZ to force re-download)"
else
  # Only now do we need the API key.
  API_KEY="${1:-${OPENCELLID_API_KEY:-}}"
  if [[ -z "$API_KEY" ]]; then
    echo "Error: no local cell_towers.csv.gz and OPENCELLID_API_KEY not set."
    echo ""
    echo "  Either (a) drop your OpenCellID dump at $CSV_GZ and re-run,"
    echo "  or (b) set OPENCELLID_API_KEY in .env / pass as argument:"
    echo "       bash $0 pk.your_key_here"
    echo ""
    echo "  (Tip: if you just want a working DB quickly, ask the repo maintainer"
    echo "   to publish a 'celltowers-latest' release so [1] succeeds without a key.)"
    exit 1
  fi
  DOWNLOAD_URL="https://opencellid.org/ocid/downloads?token=${API_KEY}&type=full&file=cell_towers.csv.gz"
  echo "[3] Downloading full cell tower database from OpenCellID (~500 MB)…"
  echo "    This may take several minutes depending on your connection."
  curl -fSL --progress-bar -o "$CSV_GZ" "$DOWNLOAD_URL"
  DOWNLOADED_FRESH_GZ=1
  echo "    Downloaded: $(du -h "$CSV_GZ" | cut -f1)"
fi

# --- Decompress --------------------------------------------------------------
# If we just downloaded a fresh gz, force re-decompress so stale cached CSV
# from a previous run doesn't masquerade as the new dataset.
if [[ "$DOWNLOADED_FRESH_GZ" -eq 1 && -f "$CSV_FILE" ]]; then
  echo "[decompress] Fresh gz downloaded — invalidating stale $CSV_FILE"
  rm -f "$CSV_FILE"
fi
if [[ -f "$CSV_FILE" ]]; then
  echo "[decompress] $CSV_FILE already present — skipping"
else
  echo "[decompress] Expanding gz (~3 GB CSV on disk)…"
  gunzip -k "$CSV_GZ"
  echo "    Size: $(du -h "$CSV_FILE" | cut -f1)"
fi

# --- Create DB and import ----------------------------------------------------
echo "[import] Creating SQLite DB and bulk-loading CSV…"
echo "    This takes several minutes on a Raspberry Pi 5."

# Remove any partial DB before create.
rm -f "$DB_PATH"

# OpenCellID CSV columns:
#   radio,mcc,net,area,cell,unit,lon,lat,range,samples,changeable,created,updated,averageSignal
sqlite3 "$DB_PATH" <<'SQL'
CREATE TABLE towers (
    radio TEXT NOT NULL,
    mcc INTEGER NOT NULL,
    net INTEGER NOT NULL,
    area INTEGER NOT NULL,
    cell INTEGER NOT NULL,
    unit INTEGER,
    lon REAL NOT NULL,
    lat REAL NOT NULL,
    range INTEGER DEFAULT 0,
    samples INTEGER DEFAULT 0,
    changeable INTEGER,
    created INTEGER,
    updated INTEGER,
    averageSignal REAL DEFAULT 0
);
.mode csv
.separator ","
SQL

TOTAL_LINES=$(wc -l <"$CSV_FILE")
echo "    Total lines in CSV: $TOTAL_LINES"

# Skip header, stream into sqlite3 .import.
tail -n +2 "$CSV_FILE" | sqlite3 "$DB_PATH" \
  ".mode csv" \
  ".import /dev/stdin towers"

ROW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM towers;")
echo "    Imported $ROW_COUNT towers"

# Fail-fast: don't index / "complete" a DB that has zero rows. An empty DB
# would short-circuit future runs at step [0] and silently serve empty
# results to the cell-tower repo. Remove it and exit non-zero instead.
if [[ "$ROW_COUNT" -le 0 ]]; then
  echo "Error: import produced zero rows. Removing invalid DB."
  echo "  Likely causes: corrupted CSV, truncated download, schema drift in source."
  rm -f "$DB_PATH"
  exit 1
fi

# --- Indexes + analyze -------------------------------------------------------
echo "[index] Building spatial indexes…"
sqlite3 "$DB_PATH" <<'SQL'
-- Spatial index for bounding-box queries (the main query pattern)
CREATE INDEX idx_towers_lat_lon ON towers (lat, lon);
-- Identity lookup for GSM Evil tower-location fallback
CREATE INDEX idx_towers_identity ON towers (mcc, net, area, cell);
ANALYZE;
SQL

DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
echo ""
echo "=== Import Complete ==="
echo "  Database: $DB_PATH ($DB_SIZE)"
echo "  Towers:   $ROW_COUNT"
echo ""
echo "  To refresh the data later: delete $CSV_GZ and re-run this script."
