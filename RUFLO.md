# RUFLO.md — what ruflo is + how Argos uses it

Ruflo (`npx ruflo@latest`, npm package `ruflo`, github.com/ruvnet/ruflo) is a multi-agent orchestration plugin for Claude Code. It exposes ~270 MCP tools, ~50 skill cards, 60+ subagent-type labels, and ~150 slash commands. Installed at user scope on this Jetson; tools surface via `mcp__ruflo__*` namespace.

This doc is the **honest** routing reference. Most ruflo features are theater (per third-party audit + our own Phase 4 demo). Only a small subset provides real value. Use that subset; skip the rest.

## TL;DR

| Use ruflo FOR | Skip ruflo FOR — use the real tool |
|---|---|
| Cross-session vector memory (`memory_store/search`) | Multi-agent orchestration → Claude Code's `Agent` tool |
| Per-project pattern memory (`agentdb_pattern-store/search`) | Distributed consensus → git + GitHub branch protection |
| Agent-type taxonomy labels (60+ subagent_type names) | Autonomous loops → `/loop` + `ScheduleWakeup` + `Monitor` |
| Cross-session decision recall | Sandboxed execution → native `Agent` subagents |
| | "Neural" learning / SONA / HNSW claims |

## Real capabilities — keep

### `mcp__ruflo__memory_store` / `mcp__ruflo__memory_search`

Vector memory across sessions. Real SQLite-backed HNSW index, real 384-dim ONNX embeddings via Xenova/all-MiniLM-L6-v2. Survives session boundaries.

Use for: engineering decisions, plan checkpoints, "did we already solve this?" recall.

```typescript
mcp__ruflo__memory_store({
  value: "Phase 4 decision: cheap-audit substitute methodology proposed as default for layers with low marginal source-bug detection from mutation testing alone.",
  namespace: "argos-decisions"
});

mcp__ruflo__memory_search({
  query: "Phase 4 hardware bugs",
  namespace: "argos-decisions",
  topK: 5
});
```

### `mcp__ruflo__agentdb_pattern-store` / `agentdb_pattern-search`

Same engine, namespace-scoped for pattern findings. Real persistence (entry IDs returned). Retrieval CAVEAT: substring fallback tier — searches don't always hit. Use both store + search, verify retrieval, don't rely on it as primary lookup.

### Agent-type taxonomy (60+ subagent_type labels)

The 60+ `subagent_type` names ruflo registers (sparc-coder, security-architect, tdd-london-swarm, production-validator, etc.) are useful labels for Claude Code's native `Agent` tool. They DO NOT add execution capability — execution still goes through `Agent({subagent_type: "general-purpose", ...})`.

Pattern: pick the ruflo label that names the work, pass to Agent tool's `subagent_type` (or use `general-purpose` and reference the label in the prompt).

## Theater — skip

Per roman-rr's audit (https://gist.github.com/roman-rr/ed603b676af019b8740423d2bb8e4bf6) + our Phase 4 demo confirming each finding:

| Tool / claim | Reality |
|---|---|
| `coordination_orchestrate` | Records orchestration request; doesn't execute. Ruflo's own note: "use agent_spawn + Task tool for execution" |
| `agent_spawn` | Registers metadata in `.claude-flow/agents/store.json`; doesn't execute. Same note. |
| `swarm_init`, `swarm_status` | Bookkeeping only. State JSON in `.claude-flow/swarm/swarm-state.json`. No live coordination. |
| `hive-mind_*` consensus (Byzantine/Raft/Queen/Gossip/CRDT) | `verifySignature()` unconditionally returns `true`. "Consensus" = majority vote on a JSON dict. Single-process EventEmitter. |
| `wasm_agent_*` | Literally echoes input back. No WASM runtime. No LLM call. |
| `neural_train`, `neural_predict` | Fake metrics. Hardcoded `totalTokensSaved += 100` per cache hit. No real counting. |
| `autopilot_*` | Partial / stub. Real autonomous loops use `/loop` + `ScheduleWakeup`. |
| `claims_*`, `daa_*` | Bookkeeping + ceremony, no executor. |
| Token optimizer "30-50% reduction" | Individually fabricated percentages summed. No real token counting code. |
| `agent_execute` | Calls direct Anthropic API w/ `ANTHROPIC_API_KEY` env var. Bypasses Claude Code session. Risk: separate billing scope, separate auth chain. |

## When to use ruflo in Argos

| Situation | Action |
|---|---|
| Persist engineering decision across sessions | `memory_store` namespace=argos-decisions |
| Store per-PR findings (bug list, methodology, score) | `agentdb_pattern-store` type=phase-completion |
| Recall prior decisions in new session | `memory_search` + `pattern-search` (with retrieval-tier awareness) |
| Multi-agent slice execution | Native `Agent({run_in_background: true})` — NOT ruflo's coordination_orchestrate |
| Long-running task | `/loop` + `ScheduleWakeup` — NOT ruflo's autopilot |
| Cross-machine sync | git + PR — NOT ruflo's hive-mind |
| "Swarm" branding in plan docs | Use as conceptual label; execute via native Agent |

## Argos-specific wiring

| Layer | Status |
|---|---|
| Ruflo MCP server | Registered at user scope (`~/.claude.json` top-level `mcpServers.ruflo`). Available across all projects. |
| Daemon | `npx ruflo@latest mcp start` (auto-launched by Claude Code on MCP handshake) |
| `.claude-flow/` + `.swarm/` directories | Created by `npx ruflo init` (per-machine state). Should be `.gitignore`d. |
| Hooks | NOT integrated into Argos's `.husky/` — explicit decision; ruflo daemon ≠ critical path. |
| Plugins | Marketplace `ruvnet/ruflo` added. Plugin install required for tool surface — see `~/.claude/settings.json` `enabledPlugins`. |

## Per-phase ruflo workflow pattern

For multi-phase work like the mutation testing roadmap:

1. **Phase start** — `memory_store` the phase scope + goals in `argos-phaseN-scope`
2. **Findings as they land** — `agentdb_pattern-store` each finding w/ severity + file:line
3. **Decisions** — `memory_store` each pivot/methodology call in `argos-decisions`
4. **Phase end** — `agentdb_pattern-store` completion record (score, deferred items, PR number)
5. **Next phase start** — `memory_search` + `pattern-search` for prior-phase context

This pattern is what we did in Phase 4 (entries `entry_1779794724890...` through `entry_1779802424186...`). Worked for cross-context persistence.

## Decision tree: ruflo vs alternatives

```
Need to persist something across sessions?
  ├─ Engineering decision / plan / methodology → mcp__ruflo__memory_store
  ├─ Pattern / finding / code-level detail → mcp__ruflo__agentdb_pattern-store
  └─ Project state / commits → git (already covered)

Need to coordinate work?
  ├─ Single agent → native Agent tool subagent_type=...
  ├─ Parallel slices → multiple native Agent tool calls with run_in_background:true
  └─ Cross-machine / cross-team → git PR review (NOT ruflo hive-mind)

Need autonomous execution?
  ├─ Time-based → ScheduleWakeup
  ├─ Event-based → Monitor tool
  ├─ Loop → /loop skill
  └─ NEVER → ruflo autopilot (stub)

Need pattern learning?
  ├─ Project memory of "this works" → agentdb_pattern-store
  ├─ Real ML metrics → fallow + sentrux + Stryker + Sentry (each measures real things)
  └─ NEVER → ruflo neural_train (hardcoded fake metrics)
```

## References

- Ruflo upstream: https://github.com/ruvnet/ruflo
- Ruflo user guide: https://github.com/ruvnet/ruflo/blob/main/docs/USERGUIDE.md
- Ruflo quick start: https://github.com/ruvnet/ruflo/wiki/Quick-Start
- Third-party audit (roman-rr, 2026-04): https://gist.github.com/roman-rr/ed603b676af019b8740423d2bb8e4bf6
- Argos Phase 4 PR (where ruflo bookkeeping was first used in earnest): https://github.com/christianpeirson/argos-jetson/pull/250
