# CLAUDE.md

<!-- SKIP AUTO-UPDATE -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- MANUAL ADDITIONS START -->

## Codebase Overview

SvelteKit SDR & Network Analysis Console for Army EW training on RPi 5 (Kali, native — no Docker for the main app). Wraps native CLI tools (`hackrf_sweep`, `gpsd`, `kismet`, `grgsm_livemon`) into a real-time web dashboard with WebSocket push, MapLibre GL mapping, and MIL-STD-2525C symbology.

**Stack**: SvelteKit 2 + Svelte 5 runes, TypeScript strict, Tailwind CSS v4, better-sqlite3 (WAL), MapLibre GL, ws, node-pty
**Structure**: 36 API domains (118 routes, 107 via `createHandler`), 23 Zod-validated stores, 10 UI component families, 7 always-on MCP servers
**Active port**: branch `install/jetson-port` runs on NVIDIA Jetson AGX Orin (Ubuntu 22.04 aarch64) — see `jetson-port-notes.md`.

## Project rules + conventions

Loaded automatically via the `.claude/rules/` contract ([Anthropic memory docs](https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/)). Files without `paths:` frontmatter load every session at the same priority as this CLAUDE.md; files with `paths:` lazy-load only when Claude reads matching files.

**Always-load (no `paths:` frontmatter):**

- `.claude/rules/workflow.md` — Rules 1-10 (chrome-devtools, claude-mem, Svelte MCP+LSP, octocode, context7, sentrux, ci/cd canon, explain-as-you-go, parallel-during-bg-waits, batched-commit cadence)
- `.claude/rules/mcp-and-plugins.md` — active MCP servers, installed plugins, Jetson chrome-devtools wiring, Svelte MCP+LSP sequence
- `.claude/rules/platform-and-deps.md` — RPi 5 / Jetson Orin constraints, git workflow, dependency rules

**Path-scoped (`paths:` frontmatter):**

- `.claude/rules/architecture.md` — `src/**`, `tests/**`, `scripts/**`, `config/**`, `deployment/**` — server patterns, data flow, source layout, code conventions
- `.claude/rules/design-system.md` — `**/*.svelte`, `src/lib/components/**`, `src/lib/styles/**`, `src/app.css`, `specs/026-lunaris-design-system/**` — Carbon + Lunaris + Geist
- `.claude/rules/tactical.md` — `tactical/**` — kill chain framework pointer

Use `/memory` to inspect what is currently loaded.

## Commands

```bash
# Dev server (tmux + OOM protection — never run multiple svelte-check concurrently)
npm run dev              # tmux session, oom_score_adj=-500
npm run dev:simple       # direct vite, lower memory limit
npm run dev:clean        # kill + restart
npm run dev:logs         # tail dev output

# Build / check
npm run build            # production build (catches errors tsc alone misses)
npm run typecheck        # svelte-check + tsc (~650 MB RAM — single instance only)
npm run lint             # ESLint with config/eslint.config.js
npm run lint:fix         # auto-fix

# Tests
npx vitest run <file>    # single test file
npm run test:unit        # unit (src/ + tests/unit/)
npm run test:integration # tests/integration/
npm run test:security    # tests/security/
npm run test:e2e         # Playwright (config/playwright.config.ts)
npm run test:all         # unit + integration + visual + performance

# DB
npm run db:migrate       # SQLite migrations
npm run db:rollback      # rollback last

# File-scoped pre-commit verification
npx tsc --noEmit src/lib/FILE.ts
npx eslint src/lib/FILE.ts --config config/eslint.config.js
npx vitest run src/lib/FILE.test.ts
```

## graphify

Knowledge graph at `graphify-out/`. Read `graphify-out/GRAPH_REPORT.md` for god nodes + community structure before architecture questions. Navigate `graphify-out/wiki/index.md` if it exists, instead of raw files. After modifying code files, run `graphify update .` to keep the graph current (AST-only, no API cost).
