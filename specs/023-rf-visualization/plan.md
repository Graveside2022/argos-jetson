# Plan 023 — RF Visualization (Flying-Squirrel style)

Implementation plan backing `spec.md`. Retro-filled to match what actually shipped in Phase A.1–A.3, plus an architecture sketch for Phase A.4.

## Architecture summary

```
rf_signals.db (SQLite WAL)
  ▲
  │ (session_id tagged at write time)
  │
signal-persistence.ts ──► session-tracker.ts ──► migration 006 (sessions + index)
                                │
                                ▼
                     /api/rf/aggregate  ◄── rf-aggregation.ts (H3 binning, Node-side)
                     /api/rf/observations  ◄── signal-repository (per-device samples)
                     /api/sessions  ◄── session-tracker.listSessions / startNewSession
                                │
                                ▼
                     rf-visualization.svelte.ts (client store, LRU cache)
                                │
                                ▼
                     dashboard map layers (MapLibre GL)
                       - heatmap / hex     (fill layer, cell color by meanDbm)
                       - centroids         (symbol layer, rings + dim on select)
                       - drive-path        (line layer)
                       - highlight         (observation rings + rays to centroid)
```

## Tech choices

- **H3 binning in Node, not SQLite.** SQLite has no H3 extension on Argos. Rows are filtered server-side via the existing `signals` indexes on `(session_id, timestamp)` and spatial grid, then the reduce happens in TypeScript with `h3-js`. For 10k–500k rows per session, the TS reduce is sub-500 ms on the Pi 5 / Jetson. An H3 extension would add ARM-build complexity for no measurable gain.
- **Session = mission bucket, not stream.** Sessions are rows in a `sessions` table (migration 006). Each incoming signal is stamped with the current open session id at write time. This means historical sessions are queryable without a separate cross-reference table; the filter is a single `WHERE session_id = ?`.
- **LRU cache on the client.** The store caches up to 5 filter-fingerprint → response entries. Fingerprint is `{sessionId, deviceIds, bbox, h3res}`. Pan/zoom that does not change those fields hits the cache; session switch or bbox change invalidates.
- **MapLibre GL over custom canvas.** Every Flying-Squirrel layer maps to a standard MapLibre source + layer pair. No custom WebGL. This keeps the layer panel toggle simple and delegates pan/zoom performance to MapLibre.
- **Highlight stale-guard via response tokens.** When the user clicks AP-A, we mint a fetch token. When AP-B is clicked before AP-A's response arrives, AP-A's response is discarded on arrival (token mismatch). Prevents the "click fast, see flashing wrong rings" bug.

## API surface

| Route                  | Verb | Query / body                                                                                     | Returns                                       |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `/api/rf/aggregate`    | GET  | `layer=heatmap\|centroids\|path\|all`, `session`, `bssid` (csv), `bbox`, `start`, `end`, `h3res` | `{heatmap?, centroids?, path?}`               |
| `/api/rf/observations` | GET  | `device` (required), `session`, `limit`                                                          | `{observations: ObservationPoint[]}`          |
| `/api/sessions`        | GET  | `limit` (1–200, default 50)                                                                      | `{currentId, sessions: Session[]}`            |
| `/api/sessions`        | POST | `{label?, metadata?}`                                                                            | `{id, label}` (closes any open session first) |

All routes inherit auth from `hooks.server.ts`. No route-specific gate.

## Data model (added)

Migration `006_add_sessions_and_device_time_index.sql`:

- `sessions(id TEXT PK, started_at INTEGER, ended_at INTEGER NULL, label TEXT NULL, source TEXT, metadata TEXT NULL)`
- `signals.session_id` column, backfilled to synthetic `'legacy'` bucket for pre-migration rows.
- Index `idx_signals_device_time` on `(device_id, timestamp)` — powers centroid and observation queries.

Source values: `'kismet-start'` | `'manual'` | `'auto'` | `'legacy'`.

## Code layout

| File                                                       | Role                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/lib/server/db/rf-aggregation.ts`                      | `getRssiHexCells`, `getApCentroids`, `getDrivePath`, `getDeviceObservations`  |
| `src/lib/server/services/session/session-tracker.ts`       | `startNewSession`, `endCurrentSession`, `getCurrentSessionId`, `listSessions` |
| `src/lib/server/services/bluedragon/signal-persistence.ts` | Stamps every incoming signal with `getCurrentSessionId()`                     |
| `src/lib/stores/rf-visualization.svelte.ts`                | Client store: filters, layer mode, LRU cache, fetch orchestration             |
| `src/routes/api/rf/aggregate/+server.ts`                   | Zod-validated query → `runLayer()`                                            |
| `src/routes/api/rf/observations/+server.ts`                | Per-device points for highlight layer                                         |
| `src/routes/api/sessions/+server.ts`                       | List + start manual session                                                   |
| `src/routes/api/kismet/start/+server.ts`                   | Emits `startNewSession('kismet-start')`                                       |

## Testing strategy

- **Unit:** `tests/unit/rf-aggregation.test.ts` covers H3 binning, centroid math, empty-session edge cases. `tests/integration/api-rf-aggregate.test.ts` covers the HTTP surface end-to-end.
- **Browser verification:** per CLAUDE.md Rule 1, Phase A.4 UI work must be checked in a real browser with Chrome DevTools MCP before calling it done — heatmap toggle, session switch, highlight-on-select, no console errors.

## Known follow-ups

- **`process-manager.js` is 1.86 MB** in the server bundle (observed on the Phase A.3 build). Not an A.3 blocker but a candidate for a code-splitting ticket adjacent to Phase A.4.
- **`hooks.server.ts` top-level `scanAllHardware()`** runs at import time — confirmed by build log emitting Alfa-adapter detection during SSR assembly. Tracked in memory as a followup to A.3.
- **Cross-session AP fusion** (US-out-of-scope) will need a `device_seen_across_sessions` view or similar. Defer to Phase B.
