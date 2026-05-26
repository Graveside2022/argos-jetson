# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Project rules clean-slate as of 2026-05-20. Four rule surfaces are active in this repo: the **Karpathy coding guidelines** below, **RTK shell-output compression**, **CodeGraph MCP**, and **Ruflo cross-session memory** (added 2026-05-26 PR #251). All prior surfaces (legacy `.claude/rules/*.md`, `AGENTS.md`, `.tessl/RULES.md`, codebase overview, commands, graphify, narrate/parallel-work directives, sentrux/ci/danger/spec-kit/Lunaris conventions) have been retired and moved to `*-retired-2026-05-20.*` paths under git history.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 0. Ruflo PRIMARY orchestrator — ALL tasks + prompts route through ruflo FIRST

**Established 2026-05-26 (post PR #251 ruflo integration + PR #252 106-skill catalog).** Every Argos task and every user prompt — bug fix, feature, refactor, audit, swarm dispatch, doc update, ANY code-action verb — MUST start with ruflo memory recall + scope store + swarm-vs-single decision. Tessl skills, codegraph, sentrux, etc. are COMBINATIONS that layer on top of the ruflo flow; they are NOT alternatives to ruflo and they do NOT come first.

### Mandatory per-task flow (see [`RUFLO.md`](./RUFLO.md) §Per-phase ruflo workflow pattern)

1. **Recall** → `mcp__ruflo__memory_search` + `mcp__ruflo__agentdb_pattern-search` for prior context ("did we already solve this?", scope/methodology decisions, prior PR findings).
2. **Scope store + swarm-vs-single decision** → `mcp__ruflo__memory_store` task scope + goals in `argos-<task-name>-scope` namespace. Decision: parallel/swarm work needed? Spawn N native `Agent` calls (use ruflo 60+ `subagent_type` labels). Single-shot? Proceed inline.
3. **Skill match (ruflo-first)** → match the work to ruflo skills FIRST via [`SKILL-ROUTING.md`](./SKILL-ROUTING.md) §Ruflo skill catalog (skip ⚠️ STUB / 🎯 DOMAIN / 📦 DEPRECATED / 📝 GUIDANCE tags), then tessl skills as COMBINATION layer.
4. **Findings as they land** → `mcp__ruflo__agentdb_pattern-store` per finding (severity + file:line).
5. **Decisions / pivots** → `mcp__ruflo__memory_store` each in `argos-decisions` namespace.
6. **Task end** → `mcp__ruflo__agentdb_pattern-store` completion record (score, deferred items, PR number).

### Intelligence-graph layer (always-on for fix/audit/review/debug verbs)

Steps 1-6 are MINIMUM. For Argos prompts containing `fix add implement debug refactor build run test review migrate deploy wire port patch update audit`, ALSO use the Learning Loop **RETRIEVE → JUDGE → DISTILL → CONSOLIDATE → ROUTE** — see [`RUFLO.md`](./RUFLO.md) §Per-task intelligence-graph flow for the full tool mapping table + the Phase 7 worked example.

Mandatory on every fix/audit/review/debug task:
- `memory_search smart=true` at RETRIEVE (RRF + MMR + recency, not default false)
- per-finding `agentdb_causal-edge` linking → completion patternId
- per-finding `agentdb_hierarchical-store` tier=`semantic` (HIGH) / `episodic` (MED) / `working` (LOW)
- task-end `agentdb_feedback {taskId, success, quality}` to close the loop
- review tasks → `Agent({subagent_type: 'security-architect'|'tdd-london-swarm'|'sparc-refine'|...})`

Acceptance: ≥3 of these 4 deep-layer tools fire in first task turn without explicit user prompting.

### Theater tools to SKIP (per RUFLO.md audit + Argos Phase 4 demo)

`coordination_orchestrate`, `agent_spawn`, `swarm_init`, `hive-mind_*` (verifySignature returns true), `wasm_agent_*` (echoes input), `neural_train` (hardcoded += 100), `autopilot_*`, `claims_*`, `daa_*`. Skip these — use native equivalents (`Agent` tool for orchestration, `/loop` + `ScheduleWakeup` for autonomous loops, git+PR for cross-machine sync).

### Hook enforcement

PreToolUse hook `~/.claude/hooks/ruflo-task-routing-gate.sh` BLOCKS code-action tools (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `TaskCreate`, `Agent`, `ScheduleWakeup`, `CronCreate`, github writes, file-mutating Bash) if the same turn does not include `mcp__ruflo__memory_store` or `mcp__ruflo__memory_search`. Bypass: `CLAUDE_RUFLO_BYPASS=1` in env. Mechanical enforcement is the only way this discipline survives.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## RTK shell-output compression

`rtk` (Rust Token Killer, `~/.cargo/bin/rtk` v0.34.3) is a CLI proxy that filters and summarizes verbose tool output before it enters the LLM context window. Config at `~/.config/rtk/{config.toml, filters.toml}`. Global usage rules auto-loaded via `~/.claude/CLAUDE.md` → `@RTK.md`. PreToolUse hook `rtk hook claude` transparently rewrites supported commands (`git`, `gh`, `ls`, `tree`, `grep`, `find`, `log`, `docker`, `kubectl`, `psql`, `pnpm`, `aws`, `dotnet`, `wget`, etc.) into `rtk <cmd>` form. Use `rtk gain` to inspect savings; `rtk proxy <cmd>` to bypass for debug.

## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

### When to prefer codegraph over native search

Use codegraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question                                                       | Tool                                         |
| -------------------------------------------------------------- | -------------------------------------------- |
| "How does X work? / trace X / explain a system / architecture" | `codegraph_explore` (seed with symbol names) |
| "Where is X defined?" / "Find symbol named X"                  | `codegraph_search`                           |
| "What calls function Y?"                                       | `codegraph_callers`                          |
| "What does Y call?"                                            | `codegraph_callees`                          |
| "What would break if I changed Z?"                             | `codegraph_impact`                           |
| "Show me Y's signature / source / docstring"                   | `codegraph_node`                             |
| "Give me focused context for a task/area"                      | `codegraph_context`                          |
| "What files exist under path/"                                 | `codegraph_files`                            |
| "Is the index healthy?"                                        | `codegraph_status`                           |

### Rules of thumb

- **`codegraph_explore` is the workhorse for understanding questions** ("how does X work", "trace…", "explain the Y system"). Feed it the key symbol/file names and read its output (line-numbered source from many files in one call). If the question names nothing concrete, do one quick `codegraph_search`/`codegraph_context` to surface the names, then explore with them. Fill gaps with `codegraph_node`/Read — don't grep-and-read your way through; that's the loop explore replaces.
- **Delegating exploration to a subagent?** Tell it to call `codegraph_explore` first and trust the result. A generic "explore"-style agent defaults to grep+Read and treats codegraph as just a search index, throwing away the token savings.
- **Trust codegraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Index lag**: the file watcher debounces ~500ms behind writes; don't re-query immediately after editing a file in the same turn.

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: _"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"_

## Skill routing (ruflo PRIMARY, tessl COMBINATIONS)

13 tessl skills + 106 ruflo skill cards (69 REAL, 16 STUB, 16 DOMAIN, 4 GUIDANCE, 1 DEPRECATED — full enumeration in `@SKILL-ROUTING.md`) are installed. **Before planning or doing a code task, route through ruflo FIRST per §0 above, THEN match tessl skills as combination layers.** Full trigger map + disambiguation in `@SKILL-ROUTING.md`. Skills are guidance; measurement engines stay native MCP (sentrux/codegraph/chrome-devtools/CodeQL/Sentry).

**Skill catalog scan order (INVERTED 2026-05-26)**:
1. `mcp__ruflo__memory_search` + `agentdb_pattern-search` — prior context recall (PRIMARY entry point per §0)
2. Ruflo skill cards (per-plugin catalog in `@SKILL-ROUTING.md`) — match to ruflo executor; skip ⚠️ STUB / 🎯 DOMAIN / 📦 DEPRECATED / 📝 GUIDANCE tags
3. Tessl skills — match as COMBINATION layer on top of ruflo flow (e.g. `tessl__sqlite-node-best-practices` LAYERED INTO a ruflo `test-gaps` + `memory_store` flow)
4. Gap → `mcp__tessl__search` and gate any new install by the 5-check safe-install protocol from §Tessl install discipline below.

## Ruflo cross-session memory

Ruflo is registered at user-scope MCP. Use it for what's real (memory_store/search, agentdb_pattern-store/search, agent-type taxonomy) and skip the theater (coordination_orchestrate, hive-mind, wasm_agent, neural_*, autopilot_*). Full audit + usage patterns + decision tree in `@RUFLO.md`. Per-phase workflow: `memory_store` scope at start → `agentdb_pattern-store` findings → `memory_store` decisions → `agentdb_pattern-store` completion record. Phase 4 was the prototype (entries `entry_1779794724890...` through `entry_1779802424186...`).

@SKILL-ROUTING.md

@RUFLO.md

@AGENTS.md
