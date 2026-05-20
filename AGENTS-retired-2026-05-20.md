# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Summary

Argos is a SvelteKit SDR & Network Analysis Console for Army EW training, deployed natively on Raspberry Pi 5 (Kali Linux). It wraps native CLI tools (hackrf_sweep, gpsd, Kismet, grgsm_livemon) into a real-time web dashboard with WebSocket push, MapLibre GL mapping, and MIL-STD-2525C symbology.

**Stack**: SvelteKit 2, Svelte 5 runes, TypeScript strict, Tailwind CSS 4, better-sqlite3, MapLibre GL, ws (WebSocket), node-pty

Use `serena` symbolic tools + `Grep`/`Glob` to explore the current source. No static architecture map is maintained.

## Commands

```bash
# Dev server (runs in tmux with OOM protection)
npm run dev
npm run dev:simple       # Direct vite start (no tmux)
npm run dev:clean        # Kill existing + restart fresh
npm run dev:logs         # Tail dev server output

# Build & typecheck
npm run build            # Production build (catches errors tsc alone misses)
npm run typecheck        # svelte-check + tsc (~650MB RAM — never run concurrent instances)

# Lint
npm run lint             # ESLint (config/eslint.config.js)
npm run lint:fix         # Auto-fix

# Testing
npx vitest run src/path/to/file.test.ts     # Single test file
npm run test:unit                            # All unit tests (src/ + tests/unit/)
npm run test:integration                     # tests/integration/
npm run test:security                        # tests/security/
npm run test:e2e                             # Playwright (config/playwright.config.ts)
npm run test:all                             # unit + integration + visual + performance

# File-scoped verification (use before committing)
npx tsc --noEmit src/lib/FILE.ts
npx eslint src/lib/FILE.ts --config config/eslint.config.js
npx vitest run src/lib/FILE.test.ts

# Database
npm run db:migrate       # Run SQLite migrations
npm run db:rollback      # Rollback last migration
```

## Architecture

### Data Flow

```
Hardware (HackRF/Alfa/GPS)
  → src/lib/server/services/        # CLI wrappers (hackrf_sweep, gpsd, Kismet, grgsm)
  → src/lib/server/hardware/        # Hardware detection & monitoring
  → src/routes/api/*/+server.ts     # 19 REST API domains (66 routes, 53 use createHandler)
  → WebSocket / SSE                 # Real-time push (hooks.server.ts + SSE endpoints)
  → src/lib/stores/                 # 17 client-side Svelte stores
  → src/lib/components/             # Svelte 5 UI components (Lunaris design system)
```

### Key Patterns

**API route handlers**: Use `createHandler()` factory from `src/lib/server/api/create-handler.ts` for all new routes (provides try-catch, logging, JSON wrapping, optional Zod validation). Only use manual handlers for SSE/streaming endpoints.

**Server singletons**: Use `globalThis.__argos_*` for HMR survival, typed in `src/app.d.ts`. Used by SweepManager, WebSocketManager, RateLimiter, RFDatabase.

**Error handling**: `createHandler()` for routes (primary), `safe()`/`safeSync()` result tuples from `src/lib/server/result.ts` for service-layer code.

**Auth is fail-closed**: `ARGOS_API_KEY` required (min 32 chars). All `/api/*` routes except `/api/health` require API key header or HMAC session cookie. WebSocket auth uses `?token=` (HMAC session token only, NOT raw API key).

**Environment**: `src/lib/server/env.ts` uses Zod to validate all env vars at startup. Import `env` for typed access.

**Database**: Direct `better-sqlite3` against `rf_signals.db`. No ORM. Migrations via `scripts/db-migrate.ts`.

**Dual API namespaces**: Both `/api/hackrf/` and `/api/rf/` share the same `sweepManager` singleton — changes via one affect the other.

### Security Middleware Chain (hooks.server.ts)

Auth gate → Rate limiter (200/min API, 30/min hardware, 60/min Tailscale) → Body size limiter → CSP + security headers.

### Source Layout

```
src/
├── routes/api/                # 19 API domains (hackrf, kismet, gsm-evil, gps, tak, etc.)
├── routes/dashboard/          # Dashboard page (DashboardShell snippet-slot architecture)
├── lib/server/                # Server-only: services/, auth/, db/, hardware/, security/, mcp/
├── lib/components/            # Svelte 5 components (Lunaris design system)
├── lib/stores/                # 17 reactive stores
├── lib/schemas/               # 7 Zod validation schemas
├── lib/types/                 # TypeScript type definitions
├── lib/websocket/             # Client-side WebSocket (BaseWebSocket + decomposed modules)
├── lib/map/                   # Map symbols, layers, visibility engine
├── hooks.server.ts            # Security middleware + WebSocket upgrade
config/                        # Vite, ESLint, Playwright configs
tests/                         # unit/, integration/, security/, e2e/, visual/, performance/
scripts/ops/                   # setup-host.sh, install-services.sh
deployment/                    # Systemd service files
```

## Code Conventions

**TypeScript strict mode**. No `any` (use `unknown` + type guards). No `@ts-ignore` without issue ID.

**ESLint enforces**: cyclomatic complexity ≤ 5, cognitive complexity ≤ 5 (hard errors, no exceptions). Config at `config/eslint.config.js`.

**File limits**: Max 300 lines/file, max 50 lines/function.

**Naming**: camelCase (vars/funcs), PascalCase (Types/Components), UPPER_SNAKE_CASE (constants), kebab-case (files). Booleans use `is/has/should` prefix.

**No barrel files** (`index.ts`) except `src/lib/components/ui/` (shadcn-svelte). Import directly from source.

**No catch-all utils files**. Place utility functions in domain-specific modules.

**Svelte 5 runes only**: `$state`, `$derived`, `$effect`, `$props`, `$bindable`. DashboardShell uses snippet slots for layout composition.

**Component state handling**: Every component must handle ALL states: Empty, Loading, Default, Active, Error, Success, Disabled, Disconnected.

## Design System — Lunaris

Dark mode only. Military-grade enterprise dashboard aesthetic.

### CSS Token Architecture (three layers)

1. **Base tokens** (`src/app.css :root`) — source of truth: `--background`, `--card`, `--border`, `--primary`, `--surface-elevated`, `--success`, `--warning`, `--destructive`, etc.
2. **Palantir bridge** (`src/lib/styles/palantir-design-system.css`) — maps `--palantir-*` → base tokens. **Being eliminated by spec-019. Do NOT add new `--palantir-*` tokens.**
3. **Tailwind utilities** (`src/app.css @theme inline`) — `--color-*` mappings enabling `bg-success`, `text-warning`, etc.

New components must use base tokens directly or Tailwind utilities. For contexts where CSS vars aren't available (MapLibre GL, xterm.js, Leaflet), use `resolveThemeColor()` from `src/lib/utils/theme-colors.ts`.

### Typography

Dual-font system: **Fira Code** (monospace) for all data/metrics/labels, **Geist** (sans-serif) for tab labels and UI navigation chrome only.

### Layout

48px icon rail → 280px overview panel → fill map area → 240px bottom panel. 40px command bar fixed top. Icons: Lucide for all navigation/status.

### Palette

13 MIL-STD accent palettes via `[data-palette='...']` selectors overriding `--primary`. Status colors are semantic and independent of accent: `--success` (#8BBFA0), `--warning` (#D4A054), `--destructive` (#FF5C33).

## Platform Constraints

**Target**: Raspberry Pi 5 (8GB RAM, ARM). Memory is scarce (~2.7GB effective headroom).

- `svelte-check` uses ~650MB — never run multiple instances. Lock file at `/tmp/argos-typecheck.lock`.
- Running full test suite is unsafe while VS Code Server is active. Use targeted: `npx vitest run --no-coverage <file>`.
- Vitest uses single worker (`maxWorkers: 1`) to prevent OOM.
- WebSocket messages must process in < 16ms. Initial load < 3s. < 200MB heap.
- Argos runs natively on host — Docker is only for third-party tools (OpenWebRX, Bettercap).
- `src/lib/server/exec.ts` provides `execFileAsync()` for safe child process execution (no shell, argument arrays only).

## Dependencies

No `npm install` without user approval. Pin exact versions. No ORMs. No CSS frameworks beyond Tailwind. No state management libraries. No lodash.

## Git Workflow

**Branch naming**: `feature/NNN-feature-name` or `NNN-feature-name`.

**Commits**: One per task. Format: `type(scope): TXXX — description`. Never commit broken code.

**Spec-kit workflow**: Features follow `spec.md` → `plan.md` → `tasks.md` in `specs/NNN-feature-name/`.

---

## AI Code Reviewer Conventions (CodeRabbit & equivalents)

This section is read by AI code reviewers (CodeRabbit auto-detects via `knowledge_base.code_guidelines.filePatterns` default `**/AGENTS.md`). Sections above describe the project; rules below describe how to review PRs against it.

### Hard rules — REJECT changes that violate any of these

1. **Never propose Gemini Code Assist.** User has excluded it from the project. Filter alternatives to: CodeRabbit, Qodo, Greptile, Sourcery, Codacy, OSS options. (Hard-failed by `.coderabbit.yaml` `pre_merge_checks.custom_checks`.)

2. **Never inject synthetic / mock data into `data/rf_signals.db` or any production DB.** Real capture data only. For demos use `:memory:` SQLite or throwaway DB in `/tmp/`. Reject any PR adding rows from a fixture, seed, or migration.

3. **Never invoke `npx vitest` directly — always `npm run test:*`.** All test commands MUST go through the npm scripts, which wrap `scripts/ops/mem-guard.sh` (lockfile + RAM-aware `NODE_OPTIONS` tiering required to avoid OOM on RPi5). Same rule for build/lint/typecheck. Reject suggestions like `npx vitest run X` in scripts/READMEs/CI.

4. **Never set `NoNewPrivileges=true` in `argos-final.service` or any sudo-calling unit.** Argos control endpoints shell out to `sudo /usr/bin/systemctl start <unit>`; that flag blocks sudo's setuid → 500 on every control call, invisible in UI. Privilege is scoped via narrow NOPASSWD rules in `/etc/sudoers.d/argos`.

5. **Never propose deleting files inside `/home/jetson2/code/Argos/**`while live services are active.** Disk-cleanup stays confined to`~/.cache/\*` and system stores. Even gitignored paths (`coverage/`, `build/`, `.svelte-kit/`, `node_modules/`) risk corrupting in-flight state. Reject `rm -rf node_modules && npm install` style cleanup in deployment PRs.

6. **Never propose `npm install <X>` without explicit user authorization.** Research is fine; adding a dependency requires the user to type "install X" verbatim. Reject PRs that grow `package.json` dependencies/devDependencies without an authorization line in the commit message.

### Strong recommendations — fix or document the deviation

7. **Cite official documentation URLs for any config/library/API/hook/CI/3rd-party change.** PRs touching `config/*`, `package.json`, `.github/workflows/*`, `.husky/*`, `scripts/ops/*`, `dangerfile.js`, `eslint.config.*`, `vitest.config.*`, `.coderabbit.yaml`, `.sentrux/rules.toml`, or any third-party SDK call MUST include a "Sources cited" section with the official docs URL. Source code is type-authoritative but NOT usage-authoritative.

8. **Absolute rules apply to ALL violators, not top-N.** 300 LOC/file, 50 LOC/function, cyclomatic ≤ 5, cognitive ≤ 5 have no severity gradient. Reject "fix top 3 worst offenders" framing. Either fix all violators OR explicitly document deferred ones with a follow-up issue link.

9. **Mechanical enforcement over audit review.** New rules in CLAUDE.md / AGENTS.md / docs/ MUST come with a corresponding gate (ESLint, ruff, pre-commit hook, danger rule). Documentation alone rots. Argos has three-tier defense for layer rules (sentrux + eslint-plugin-boundaries + ArchUnitTS) — new conventions follow the same pattern.

10. **Tests required for `src/lib/server/**`changes — type-only carve-out exists.** Default: any non-test`.ts/.js`change under`src/lib/server/` requires a matching test delta. Carve-out (`dangerfile.js:90-205`): micro-PRs (< 10 LOC) where every diff line matches `^[+-]\s*(import|export)\s+type\b|^[+-]\s*$|^[+-]\s*\/\/|^[+-]\s*\*` skip the requirement. CR should still ask for tests on substantive server changes — defense-in-depth.

### Domain-specific review hints

#### Server-only code (`src/lib/server/**`)

- Native addons (`better-sqlite3`, `node-pty`) MUST stay in `dependencies` not `devDependencies`. `@sveltejs/adapter-node` only externalizes `dependencies`; native addons in devDeps get bundled and break with `ReferenceError: __filename is not defined`.
- All `/api/*` routes (except `/api/health`) require `X-API-Key` header or HMAC session cookie — fail-closed via `src/hooks.server.ts`.
- OpenTelemetry imports MUST be dynamic inside the `OTEL_ENABLED=1` gate. Static OTel imports cause `ERR_AMBIGUOUS_MODULE_SYNTAX` (require-in-the-middle intercepts `better-sqlite3`).
- Direct SQLite via `better-sqlite3` (WAL mode, no ORM). Repository pattern in `src/lib/server/db/`. Don't suggest Prisma/Drizzle/Knex.

#### Client code (`src/lib/components/**`, `src/lib/stores/**`, `src/lib/state/**`, `src/routes/**`)

- Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`). Reject Svelte 4 `$:` syntax in new code.
- Tailwind CSS v4 only. No CSS-in-JS, no Emotion, no styled-components.
- Client must call `/api/*` endpoints — NEVER import from `src/lib/server/**` directly. Enforced by `eslint-plugin-boundaries` `boundaries/dependencies` rule + sentrux + ArchUnitTS.

#### Files that should NEVER be edited (review noise)

- `static/webtak/**` — vendored noVNC + WebTAK; upstream MPL-2.0 code
- `**/.svelte-kit/**` — generated by `svelte-kit sync`
- `data/**` — runtime data store, gitignored
- `tactical/modules/__pycache__/**`, vendored Python tools

### Test conventions

- Vitest only. No Jest, no Mocha. Vitest config at `vitest.config.ts` has `globals: true` for ArchUnitTS.
- Single worker on RPi5 (`maxWorkers: 1, pool: 'forks'`). Tests must be IO-deterministic, not parallel-coupled.
- Integration tests in `tests/integration/`. Unit tests inline (`*.test.ts`) OR in `tests/unit/`. E2E uses Playwright (`tests/e2e/`).
- Reject tests that hit live hardware (HackRF, GPS, USB) in `tests/unit/` — those go in `tests/integration/` with explicit gating.

### Sentrux MCP cadence (informational)

Per `feedback_sentrux_tool_cadence.md`: sentrux core tools (`scan`, `health`, `session_start/end`, `check_rules`, `rescan`) bracket every PR per CLAUDE.md Rule 6. Three secondary tools have specific cadences:

- `dsm` — fire post-`session_end` if `signal_delta == 0` AND bottleneck is not acyclicity (a hook auto-suggests)
- `test_gaps` — fire before scoping any feature PR touching an undertested domain
- `evolution` — fire every 5 merged PRs OR monthly

CR doesn't invoke these directly, but PRs scoped against modularity/coverage gaps SHOULD reference relevant `dsm`/`test_gaps` output in their bodies.

### Prior-PR refactor patterns (use as templates)

Three landed Day-0 cleanup PRs demonstrate the project's preferred refactor style:

- **PR #46** — TAK SCC kill via `CotSender` interface (dependency inversion to a leaf `types.ts` file)
- **PR #47** — cell-towers SCC kill via direct repo-type import (drop barrel re-export → import from owner)
- **PR #48** — 4 layer-direction violations via leaf-type extraction (relocate types to `src/lib/types/*`)

When suggesting a refactor that involves type ownership, prefer "relocate to `src/lib/types/*` leaf and have all consumers import from there" — it's the canonical Argos pattern.
