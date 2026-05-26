# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Project rules clean-slate as of 2026-05-20. Four rule surfaces are active in this repo: the **Karpathy coding guidelines** below, **RTK shell-output compression**, **CodeGraph MCP**, and **Ruflo cross-session memory** (added 2026-05-26 PR #251). All prior surfaces (legacy `.claude/rules/*.md`, `AGENTS.md`, `.tessl/RULES.md`, codebase overview, commands, graphify, narrate/parallel-work directives, sentrux/ci/danger/spec-kit/Lunaris conventions) have been retired and moved to `*-retired-2026-05-20.*` paths under git history.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

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

## Skill routing (tessl + ruflo)

13 tessl skills + ~50 ruflo skills are installed for the v1 audit + ongoing work. **Before planning or doing a code task, match the work to the right skill and invoke it via the Skill tool** — same deliberate-routing discipline as the MCP-PREFLIGHT walk. The full trigger map, per-skill cards, and overlap/disambiguation rules live in `@SKILL-ROUTING.md`. Skills are guidance; the measurement engines remain native MCP (sentrux/codegraph/chrome-devtools/CodeQL/Sentry).

**Skill catalog scan order** (cheapest → most expensive): scan ruflo cards (`~/.claude/plugins/cache/.../ruflo-*`) + tessl skills (`@SKILL-ROUTING.md` trigger map) FIRST. If neither covers the task, run `mcp__tessl__search` and gate any new install by the 5-check safe-install protocol.

## Ruflo cross-session memory

Ruflo is registered at user-scope MCP. Use it for what's real (memory_store/search, agentdb_pattern-store/search, agent-type taxonomy) and skip the theater (coordination_orchestrate, hive-mind, wasm_agent, neural_*, autopilot_*). Full audit + usage patterns + decision tree in `@RUFLO.md`. Per-phase workflow: `memory_store` scope at start → `agentdb_pattern-store` findings → `memory_store` decisions → `agentdb_pattern-store` completion record. Phase 4 was the prototype (entries `entry_1779794724890...` through `entry_1779802424186...`).

@SKILL-ROUTING.md

@RUFLO.md

@AGENTS.md
