# Argos CLAUDE.md

Inherits user-global `~/.claude/CLAUDE.md` (3 mandatory rule sets: Karpathy rules, mcpmu for ALL MCP tools, aai-gateway for ALL skills). Project files add invariants only — NEVER override.

## Argos invariants

| Item             | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| Prod UI port     | `:5173` (argos-final, customer-facing)                   |
| Dev server port  | `:5193` (per-worktree; v2/:5174 retired)                 |
| Sentry project   | `us-army-2k/argos` (id `4511395679043584`)               |
| OTel env flag    | `OTEL_ENABLED=1`                                         |
| GitHub repo      | `christianpeirson/argos-jetson`                          |
| Node engine      | `>=22.11` (pinned)                                       |
| Daily PR LOC cap | 2000 (admin override RESERVED for dev→main rollups only) |
| Branch model     | prod=`origin/main`, dev=`origin/dev`                     |

## Repowise index

`.repowise/` indexed in **index-only mode** (no LLM, 1454 files, 22MB `wiki.db`). Repowise tools (`mcp__mcpmu__repowise_*`, via the mcpmu gateway) add the risk / health / history / decisions lane that codegraph (structural) and semble (semantic) cannot compute. Auto-generated tool-routing card lives at `.claude/CLAUDE.md` between `<!-- REPOWISE:START -->` / `<!-- REPOWISE:END -->` markers. Recovery if `.repowise/` is missing:

```bash
repowise init --index-only -y -x "docs/carbon-design-system/" -x "docs/carbon-website/" -x "tactical/blue-dragon/"
```

## Argos-specific @-imports

@AGENTS.md

## Refs

User-global: `~/.claude/CLAUDE.md` (3 mandatory rule sets). Skills route through aai-gateway (`listAllAaiApps` → `enableApp` → `aai_exec`); discovery via tessl through mcpmu. Skill-routing doctrine is no longer a static doc — the gateway IS the index.
