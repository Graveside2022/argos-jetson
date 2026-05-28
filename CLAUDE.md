# Argos CLAUDE.md

Inherits user-global `~/.claude/CLAUDE.md` (Karpathy + per-turn disclosure + halt rule + 8 workflow @-imports). Project files add invariants only — NEVER override.

## Argos invariants

| Item             | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| v1 UI port       | `:5173` (customer-facing)                                |
| v2 Mk II UI port | `:5174`                                                  |
| Sentry project   | `us-army-2k/argos` (id `4511395679043584`)               |
| OTel env flag    | `OTEL_ENABLED=1`                                         |
| GitHub repo      | `christianpeirson/argos-jetson`                          |
| Node engine      | `>=22.11` (pinned)                                       |
| Daily PR LOC cap | 2000 (admin override RESERVED for dev→main rollups only) |
| Branch model     | v1=`origin/v1`, v2=`origin/main`, dev=`origin/dev`       |

## Repowise index

`.repowise/` indexed in **index-only mode** (no LLM, 1454 files, 22MB `wiki.db`). MCP tools `mcp__repowise__*` add the risk / health / history / decisions lane that codegraph (structural) and semble (semantic) cannot compute. Auto-generated tool-routing card lives at `.claude/CLAUDE.md` between `<!-- REPOWISE:START -->` / `<!-- REPOWISE:END -->` markers. Recovery if `.repowise/` is missing:

```bash
repowise init --index-only -y -x "docs/carbon-design-system/" -x "docs/carbon-website/" -x "tactical/blue-dragon/"
```

## Argos-specific @-imports

@RUFLO.md
@SKILL-ROUTING.md
@AGENTS.md

## Refs

User-global: `~/.claude/CLAUDE.md` + 8 workflow files.
Project memory: cross-session via `mcp__ruflo__memory_*` namespace `argos-decisions` / `argos-<task>-scope`.
