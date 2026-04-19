# CLAUDE.md

<!-- SKIP AUTO-UPDATE -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- MANUAL ADDITIONS START -->

## Codebase Overview

SvelteKit SDR & Network Analysis Console for Army EW training on RPi 5. Wraps native CLI tools (hackrf_sweep, gpsd, Kismet, grgsm_livemon) into a real-time web dashboard with WebSocket push, MapLibre GL mapping, and MIL-STD-2525C symbology.

**Stack**: SvelteKit 2 + Svelte 5 runes, TypeScript strict, Tailwind CSS v4, better-sqlite3, MapLibre GL, ws (WebSocket), node-pty
**Structure**: 1,011 files across 19 API domains (66 routes, 53 using createHandler), 20 stores, 10 UI component families, 7 always-on MCP servers

Use `serena` symbolic tools + targeted `Grep`/`Glob` for codebase navigation. No static map file is maintained — read the current source.

## Mandatory Workflow Rules

These rules are non-negotiable. Follow them for every task.

### Rule 1 — BMAD Agent Selection

Before starting any new feature, planning, design, or review work, invoke the correct BMAD agent via the corresponding skill. Do not start implementation without a story/task from the BMAD workflow unless the user explicitly bypasses it.

| Task Type                 | Agent               | Skill                                                                  |
| ------------------------- | ------------------- | ---------------------------------------------------------------------- |
| Requirements & research   | Analyst (Mary)      | `/bmad-agent-analyst`                                                  |
| PRD, epics, stories       | PM (John)           | `/bmad-agent-pm`, `/bmad-create-prd`, `/bmad-create-epics-and-stories` |
| Architecture & API design | Architect (Winston) | `/bmad-agent-architect`, `/bmad-create-architecture`                   |
| UI/UX flows & design      | UX Designer (Sally) | `/bmad-agent-ux-designer`, `/bmad-create-ux-design`                    |
| Sprint planning & stories | Scrum Master (Bob)  | `/bmad-agent-sm`, `/bmad-sprint-planning`, `/bmad-create-story`        |
| Test strategy & reviews   | QA (Quinn)          | `/bmad-agent-qa`, `/bmad-code-review`, `/bmad-testarch-test-design`    |
| Story implementation      | Dev (Amelia)        | `/bmad-agent-dev`, `/bmad-dev-story`                                   |
| Documentation             | Tech Writer (Paige) | `/bmad-agent-tech-writer`                                              |
| Rapid prototyping         | Quick-flow (Barry)  | `/bmad-agent-quick-flow-solo-dev`                                      |

BMAD output goes to `_bmad-output/`. Config at `_bmad/bmm/config.yaml`. Use `/bmad-help` if unsure which agent to invoke.

### Rule 2 — Chrome DevTools for Frontend Debugging

When debugging any frontend, UI rendering, network, or browser-side issue: use the `chrome-devtools` MCP server BEFORE writing speculative fixes. Inspect DOM state, console errors, network requests, and performance traces in the actual running app. Do not guess at UI bugs — observe them first.

### Rule 3 — claude-mem Prior Work Check

Before beginning any significant task, search claude-mem (`smart_search`) to check if this work (or equivalent) has been done in prior sessions. This prevents duplicate effort and surfaces prior decisions, failed approaches, and context that would otherwise be lost.

### Rule 4 — Svelte MCP on every .svelte edit

Before writing or changing any Svelte component, call `mcp__svelte-remote__list-sections` → `get-documentation` → `svelte-autofixer`. Do not send Svelte code to the user unless `svelte-autofixer` returns clean. See the **Svelte MCP** section below for the full sequence.

### Rule 5 — GitHub Access via Octocode Only

For ANY GitHub interaction (repo structure, file content, search, PR history): use `mcp__octocode__*` tools ONLY. Do **not** use `gh` CLI. Do **not** use `WebFetch` on `github.com/*` URLs. Octocode respects token scopes, handles pagination cleanly, and avoids auth prompts that break in hooks.

### Rule 6 — Docs via Context7 before WebFetch

For ANY question about a third-party library, framework, SDK, or CLI tool (React, SvelteKit internals, Puppeteer, node-pty, better-sqlite3, etc.): call `mcp__plugin_context7-plugin_context7__resolve-library-id` then `query-docs`. Only fall back to `WebFetch` if context7 has no entry for the library. This avoids stale training-data answers.

## Active MCP Servers

Verify current state with `claude mcp list`. Authoritative config: `~/.claude.json` (user scope) + each plugin's `.claude-plugin/plugin.json`.

### User + Plugin Scope (always on)

| Tool namespace                                       | Source                                            | Purpose                                                                                     | When to use                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `mcp__serena__*`                                     | user scope (`uv tool`)                            | LSP-backed symbol search, refactor, find-refs                                               | Known symbol name → prefer over Grep/Glob                                                     |
| `mcp__octocode__*`                                   | user scope (`npx octocode-mcp`)                   | GitHub repo/file/code/PR search                                                             | Any `github.com` lookup (**Rule 5**)                                                          |
| `mcp__svelte-remote__*`                              | user scope (`https://mcp.svelte.dev/mcp`)         | Official Svelte 5/SvelteKit docs + autofixer                                                | Every `.svelte` file change (**Rule 4**)                                                      |
| `mcp__chrome-devtools__*`                            | user scope (`--browserUrl http://127.0.0.1:9222`) | Browser DOM/console/network/perf                                                            | Frontend debugging (**Rule 2**). Requires headless chromium pre-launched                      |
| `mcp__plugin_claude-mem_mcp-search__*`               | plugin `claude-mem`                               | Cross-session memory + smart code search                                                    | Prior work check (**Rule 3**), `smart_search`, `timeline`, `smart_outline`, `knowledge-agent` |
| `mcp__plugin_context-mode_context-mode__*`           | plugin `context-mode`                             | Keep raw tool output in sandbox (FTS5) to protect context window                            | `ctx_batch_execute`, `ctx_search`, `ctx_execute` for >20-line outputs                         |
| `mcp__plugin_context7-plugin_context7__*`            | plugin `context7-plugin`                          | Live third-party library docs                                                               | Any library/framework question (**Rule 6**)                                                   |
| `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*` | plugin `chrome-devtools-mcp`                      | Duplicate namespace — **fails on Jetson aarch64** (defaults to `/opt/google/chrome/chrome`) | Ignore on Jetson; prefer user-scope `mcp__chrome-devtools__*`                                 |

### Project-scoped (requires `npm run dev` on :5173)

| Server                     | Purpose                                | When to use                    |
| -------------------------- | -------------------------------------- | ------------------------------ |
| `tailwindcss`              | Tailwind CSS v4 tooling                | Any CSS/styling work           |
| `argos-system-inspector`   | Live system metrics, process state     | Diagnosing RPi resource issues |
| `argos-database-inspector` | SQLite schema, query execution, health | Any database work              |
| `argos-api-debugger`       | Live API endpoint testing              | Debugging API routes           |

These servers hit `localhost:5173` via HTTP; they cannot import SvelteKit internals. If the app runs via `argos-final.service` (`node build`), only HTTP API routes are available — Vite dev middleware (e.g. the terminal `/terminal-ws` plugin) is absent.

### On-Demand Profiles (`--mcp-profile <name>`)

| Profile    | Servers added                                                         | Use case                         |
| ---------- | --------------------------------------------------------------------- | -------------------------------- |
| `hardware` | `hardware-debugger`                                                   | HackRF, GPS, USB hardware issues |
| `full`     | `hardware-debugger`, `streaming-inspector`, `gsm-evil`, `test-runner` | Full diagnostic suite            |

### Jetson aarch64 — chrome-devtools wiring (non-obvious)

Google does NOT ship Chrome for aarch64 Linux. Snap Chromium is the only browser. Plugin-shipped chrome-devtools MCP launches `/opt/google/chrome/chrome` by default → fails. Fix path on Jetson:

```bash
# 1. Pre-launch headless snap Chromium with remote debugging
/snap/bin/chromium --headless=new --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chromium-debug-profile" --no-first-run --disable-gpu &

# 2. Verify
curl -s http://127.0.0.1:9222/json/version | head

# 3. Register user-scope MCP that connects to the running instance (official docs/troubleshooting.md § sandboxes)
claude mcp add -s user chrome-devtools -- npx -y chrome-devtools-mcp@latest \
  --browserUrl http://127.0.0.1:9222

# 4. /reload-plugins — plugin-scope namespace still fails, but user-scope `mcp__chrome-devtools__*` now works
```

The `--browserUrl` flag is camelCase (per `npx chrome-devtools-mcp --help`), not kebab-case despite what some README examples show.

## Installed Plugins

Verify with `/plugin list`. Install more with `/plugin install <name>` (marketplace must be added first via `/plugin marketplace add <repo>`).

| Plugin                | Marketplace                          | Provides                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `context-mode`        | `context-mode`                       | MCP server (ctx\_\*) + skills `ctx-stats`, `ctx-doctor`, `ctx-upgrade`, `ctx-insight`, `ctx-purge`, `context-mode-ops`                                                                                                                                                                                                                                                               |
| `claude-mem`          | `thedotmack`                         | MCP server (smart_search, timeline) + skills `mem-search`, `smart-explore`, `make-plan`, `do`, `knowledge-agent`, `timeline-report`, `version-bump`                                                                                                                                                                                                                                  |
| `caveman`             | `caveman`                            | Token-compression skills `caveman`, `caveman-review`, `caveman-commit`, `compress`, `caveman-help`                                                                                                                                                                                                                                                                                   |
| `superpowers`         | `claude-plugins-official`            | Rigorous workflow skills — `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `using-git-worktrees`, `dispatching-parallel-agents`, `writing-skills`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, `subagent-driven-development`, `finishing-a-development-branch`, `using-superpowers` |
| `context7-plugin`     | `context7-marketplace`               | MCP server for library docs + skills `context7-mcp`, `context7-cli`, `find-docs`                                                                                                                                                                                                                                                                                                     |
| `coderabbit`          | `claude-plugins-official`            | Skills `code-review`, `autofix` — run AI review on diffs                                                                                                                                                                                                                                                                                                                             |
| `chrome-devtools-mcp` | `ChromeDevTools/chrome-devtools-mcp` | MCP server (duplicate namespace — see Jetson note above) + skills `chrome-devtools`, `troubleshooting`, `debug-optimize-lcp`, `a11y-debugging`, `memory-leak-debugging`, `chrome-devtools-cli`                                                                                                                                                                                       |
| `svelte-skills`       | `spences10/svelte-skills-kit`        | 10 passive skills — `svelte-runes`, `svelte-components`, `svelte-styling`, `svelte-template-directives`, `sveltekit-data-flow`, `sveltekit-remote-functions`, `sveltekit-structure`, `svelte-deployment`, `layerchart-svelte5`, `ecosystem-guide`                                                                                                                                    |

### How to use plugins properly

- **Slash commands vs skills**: Some plugins expose slash commands (`/caveman`, `/ctx-stats`). Others are pure SKILL files that activate via keyword match. Ask `/plugin list` if uncertain.
- **Skill invocation**: Call `Skill` tool with the name shown in the system-reminder `available-skills` list. Don't guess names — names not in that list will fail.
- **MCP vs skill**: MCP = live tool calls that return data. Skill = prompt-time instructions loaded into context. Use MCP for data, skill for workflow discipline.
- **Reload after edits**: Editing any plugin config or `.claude.json` requires `/reload-plugins` to respawn MCP server subprocesses with new args. Plain config reload does not update already-running subprocesses — kill stale `pgrep chrome-devtools-mcp` procs if needed.

## Svelte MCP

## Svelte MCP

When working with Svelte or SvelteKit code, you MUST use the Svelte MCP tools in this order:

1. **list-sections** — Call FIRST to discover relevant documentation sections. Analyze the `use_cases` field to find all applicable sections.
2. **get-documentation** — Fetch ALL relevant documentation sections identified above.
3. **svelte-autofixer** — MUST run on all Svelte code before sending to user. Keep calling until no issues remain.
4. **playground-link** — Ask user if they want one after completing code. NEVER generate if code was written to project files.

## Tactical AI Kill Chain Framework

The `tactical/` directory contains an autonomous pentesting framework with **82 Python modules** wrapping Kali Linux security tools, **13 workflow playbooks**, and a TypeScript module runner. For tactical operations (scanning, exploitation, AD attacks, OSINT, forensics, SDR/SIGINT), read the full agent context:

IMPORTANT: READ tactical/CLAUDE.md before any tactical/security work. It contains the complete module inventory, workflow list, database schema, and execution rules.

```bash
# Execute any tactical module
npx tsx tactical/modules/module_runner.ts <module> [args...]

# List all 82 available modules
npx tsx tactical/modules/module_runner.ts --runner-help

# Read a workflow playbook before executing
cat tactical/workflows/<ID>_<name>.md
```

## Commands

```bash
# Dev server (tmux + OOM protection)
npm run dev              # Start in tmux session with oom_score_adj=-500
npm run dev:simple       # Direct vite start (no tmux, lower memory limit)
npm run dev:clean        # Kill existing + restart fresh
npm run dev:logs         # Tail dev server output

# Build & check
npm run build            # Production build (catches errors tsc alone misses)
npm run typecheck        # svelte-check + tsc (uses ~650MB RAM — never run concurrent instances)
npm run lint             # ESLint with config/eslint.config.js
npm run lint:fix         # Auto-fix

# Testing
npx vitest run src/path/to/file.test.ts     # Single test file
npm run test:unit                            # All unit tests (src/ + tests/unit/)
npm run test:integration                     # tests/integration/
npm run test:security                        # tests/security/
npm run test:e2e                             # Playwright (config/playwright.config.ts)
npm run test:all                             # unit + integration + visual + performance

# Database
npm run db:migrate       # Run SQLite migrations
npm run db:rollback      # Rollback last migration

# File-scoped verification (use these before committing)
npx tsc --noEmit src/lib/FILE.ts
npx eslint src/lib/FILE.ts --config config/eslint.config.js
npx vitest run src/lib/FILE.test.ts

# Serena (installed via uv tool, connected via claude mcp add user scope)
uv tool upgrade serena-agent --prerelease=allow   # Update Serena to latest
export MCP_TIMEOUT=60000                          # Raise MCP boot timeout if Serena LSP slow on first init
```

## Architecture

**Argos is a SvelteKit SDR & Network Analysis Console** deployed natively on Raspberry Pi 5 (Kali Linux). No Docker for the main app — Docker is only for third-party tools (OpenWebRX, Bettercap).

### Key Patterns

- **Fail-closed auth**: `ARGOS_API_KEY` required (min 32 chars), system exits without it. All `/api/*` routes (except `/api/health`) require `X-API-Key` header or HMAC session cookie.
- **Zod-validated env**: `src/lib/server/env.ts` validates all env vars at startup via Zod. Process exits on parse failure.
- **Direct SQLite**: `better-sqlite3` with WAL mode, no ORM. Migrations in `scripts/db-migrate.ts`. Repository pattern in `src/lib/server/db/`.
- **Security middleware stack** in `src/hooks.server.ts`: Auth gate → Rate limiter (200/min API, 30/min hardware) → Body size limiter → CSP headers → Event loop monitor.
- **MCP servers** (`src/lib/server/mcp/`): Communicate with the running app via HTTP API (localhost:5173) — they cannot import SvelteKit internals.
- **OpenTelemetry opt-in**: OTel SDK gated behind `OTEL_ENABLED=1`. Default off. All OTel imports are dynamic inside the gate — static imports cause `ERR_AMBIGUOUS_MODULE_SYNTAX` because `require-in-the-middle` (used by OTel auto-instrumentation) intercepts `better-sqlite3` and confuses ESM/CJS boundaries. See `src/instrumentation.ts`.

### Data Flow

```
Hardware (HackRF/Alfa/GPS)
  → src/lib/server/services/        # Hardware/protocol services (native CLI wrappers)
  → src/lib/server/hardware/        # Hardware detection & monitoring
  → src/routes/api/*/+server.ts     # REST API endpoints (createHandler factory)
  → WebSocket (src/hooks.server.ts) # Real-time push via WebSocketManager
  → src/lib/stores/                 # Client-side Svelte stores (Zod-validated)
  → src/lib/components/             # UI components (Svelte 5 runes)
```

### Source Layout

```
src/
├── routes/                    # SvelteKit file-based routing
│   ├── api/                   # 19 API domains (hackrf, kismet, gsm-evil, gps, tak, etc.)
│   ├── dashboard/             # Dashboard page
│   ├── gsm-evil/              # GSM monitoring page
│   └── +page.svelte           # Root page
├── lib/
│   ├── server/                # Server-only code (153 files)
│   │   ├── auth/              # Fail-closed API key + HMAC session cookie
│   │   ├── api/               # createHandler factory + error utilities
│   │   ├── security/          # Rate limiter, CORS, input sanitizer, audit log
│   │   ├── middleware/        # Rate limit, security headers, WS handler
│   │   ├── db/                # RFDatabase facade, repositories, migrations, cleanup
│   │   ├── hardware/          # HardwareRegistry, ResourceManager, detection
│   │   ├── hackrf/            # SweepManager: process lifecycle, frequency cycling
│   │   ├── kismet/            # KismetProxy, WebSocketManager, FusionController
│   │   ├── services/          # gps/, gsm-evil/, kismet/, cloudrf/, cell-towers/, bluehood/, wigletotak/
│   │   ├── tak/               # TakService, SA broadcaster, cert manager
│   │   ├── gsm/               # GSM L3 decoder (pure, no process spawning)
│   │   ├── mcp/               # 7 MCP servers + dynamic server + API client
│   │   └── agent/             # AgentRuntime + tool dispatch (Claude Sonnet 4)
│   ├── components/            # Svelte 5 components (153 files, 10 families)
│   ├── stores/                # 20 Svelte stores (Zod-validated, legacy + runes)
│   ├── types/                 # TypeScript type definitions
│   ├── schemas/               # Zod validation schemas
│   ├── websocket/             # Client-side WebSocket base class + reconnect
│   └── utils/                 # Logger, geo, MGRS, validation
├── hooks.server.ts            # Auth, rate limiting, WebSocket, CSP, ELD monitor
└── hooks.client.ts            # Client-side error handling
config/                        # Vite, ESLint, Playwright, terminal plugin configs
tests/                         # unit/, integration/, security/, e2e/, visual/, performance/
scripts/ops/                   # setup-host.sh (provisioning), install-services.sh, keepalive
deployment/                    # Systemd service files (10 services)
native/apm-runner/             # Navy APM propagation model (C + fork isolation)
tactical/                      # AI kill chain framework (82 modules, 13 workflows)
_bmad/                         # BMAD workflow suite (agents, skills, config)
_bmad-output/                  # BMAD artifacts (planning, implementation, test)
docs/                          # General documentation
specs/                         # Feature specifications (016-025)
plans/                         # Architecture plans and roadmaps
```

## Code Conventions

**TypeScript strict mode** is non-negotiable. No `any` (use `unknown` + type guards). No `@ts-ignore` without issue ID.

**Naming**: camelCase (vars/funcs), PascalCase (Types/Components), UPPER_SNAKE_CASE (constants), kebab-case (files). Booleans use `is/has/should` prefix.

**No barrel files** (`index.ts`) except for `src/lib/components/ui/` (shadcn-svelte). Import directly from the source file.

**No catch-all utils files** (`utils.ts`, `helpers.ts`). Place utility functions in domain-specific modules.

**File limits**: Max 300 lines/file, max 50 lines/function. Single responsibility per file.

**Error handling**: Explicit handling for all external operations. Typed error classes. No swallowed errors. User-visible errors must suggest corrective action.

**Component state handling**: Every component must handle ALL states: Empty, Loading, Default, Active, Error, Success, Disabled, Disconnected.

## Design System — Lunaris

The UI follows the **Lunaris design language** — a military-grade enterprise dashboard aesthetic (not cyberpunk). The definitive visual reference is `pencil-lunaris.pen` and the spec at `specs/012-lunaris-ui-redesign/design-reference.md`.

**Dark mode only**. Light mode removed.

### Color Architecture

Three layers in `src/app.css`, bridged via `src/lib/styles/palantir-design-system.css`:

- **Surface tokens**: `--background` (#111111), `--card` (#1A1A1A), `--border` (#2E2E2E) — deep black base with subtle layered depth
- **Accent**: Steel blue (#A8B8E0 default, Blue ★) — swappable via `--primary` across 13 MIL-STD palette themes. Used for brand text, progress bars, active indicators, AP markers
- **Semantic status** (independent of accent): Healthy #8BBFA0 (muted sage), Warning #D4A054 (warm gold), Error #FF5C33 (high-vis) / #C45B4A (desaturated panel), Inactive #555555

All colors must reference design tokens — no hardcoded hex in component markup. Status colors are always desaturated to harmonize with the dark theme. Color must never be the sole status indicator — always pair with a text label.

### Typography

Dual-font system, not monospace-only:

- **Fira Code** (monospace): ALL data — metrics, labels, IPs, coordinates, status text, section headers, command bar
- **Geist** (sans-serif): Tab labels, UI navigation chrome, weather text only

Six-step size scale: 24px (hero metrics) → 13px (brand) → 12px (secondary data) → 11px (primary rows) → 10px (status text) → 9px (section headers, UPPERCASE with letter-spacing 1.2+)

### Layout Structure

48px icon rail → 280px overview panel → fill map area → 240px bottom panel. 40px command bar fixed top. All spacing uses consistent tokens — no ad-hoc pixel values.

### Icons

Lucide for all navigation and status icons. Material Symbols Sharp for the bottom panel collapse caret only.

## Platform Constraints

**Target hardware**:

- **Primary**: Raspberry Pi 5 (8GB RAM, ARM Cortex-A76) on Kali Linux.
- **Active port** (branch `install/jetson-port`): NVIDIA Jetson AGX Orin on Ubuntu 22.04 (aarch64). Jetson-specific quirks live in `jetson-port-notes.md`. Key deltas: CPU temp must read `/sys/class/thermal/thermal_zone*/temp` first (hwmon paths differ); HDMI boot needs explicit `modprobe nvidia-drm`; TigerVNC xstartup patched to surface snap-packaged Chromium; sudo pw documented in user memory.

Memory is scarce on both platforms.

**OOM risk**: `svelte-check` uses ~650MB. Never run multiple instances concurrently. The `git-quality-gate.sh` hook runs typecheck before commits; no auto-typecheck on every edit.

**Performance budgets**: WebSocket messages < 16ms processing. Initial load < 3s. < 200MB heap. < 15% CPU. Use WebSockets over polling.

**Native execution**: Argos runs directly on the host OS, not in Docker. `src/lib/server/exec.ts` provides `execFileAsync()` for safe child process execution (no shell, argument arrays only).

## Git Workflow

**Branch naming**: `feature/NNN-feature-name` or `NNN-feature-name`.

**Commits**: One commit per task. Format: `type(scope): TXXX — description`. Never commit broken code.

**Forbidden**: WIP commits, mega commits, generic messages, force-push.

**Spec-kit workflow**: Features follow `spec.md` → `plan.md` → `tasks.md` in `specs/NNN-feature-name/`. CLAUDE.md is auto-updated by `.specify/scripts/bash/update-agent-context.sh` — but this file is protected by the SKIP AUTO-UPDATE marker above.

## Dependencies

No `npm install` without user approval. Pin exact versions. No ORMs. No CSS frameworks beyond Tailwind. No state management libraries (Redux/Zustand). No lodash.

**Native addons must stay in `dependencies`, NOT `devDependencies`.** This includes `better-sqlite3` and `node-pty`. `@sveltejs/adapter-node` externalizes only `dependencies` at build time; anything in `devDependencies` gets bundled into the ESM server chunk, which breaks native addons that expect CJS globals (`__filename`, `__dirname`). Symptom: `ReferenceError: __filename is not defined` at server startup.

<!-- MANUAL ADDITIONS END -->

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
