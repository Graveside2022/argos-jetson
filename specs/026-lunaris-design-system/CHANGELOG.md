# Spec 026 — Changelog

Phase-by-phase changelog for the IBM Carbon Design System migration. Each entry: phase tag + key commits + landed deliverables.

---

## Phase 0 — Pre-flight scaffold (in review)

**Branch:** `feature/spec-026-carbon-phase-0-scaffold` → `feature/spec-024-mk2-phase-3-pr-b2-tools-flyout`
**Tag:** `spec-026-phase-0-complete` at `e7640830`
**PR:** #59
**Status:** ready for review (732 lines / 12 files / 1 deletion against the corrected base)

**Landed:**

- `specs/026-lunaris-design-system/` scaffold (`spec.md`, `authorities.md`, `migration-roadmap.md`, `tokens.md`, `components/.gitkeep`, this CHANGELOG)
- `src/lib/styles/lunaris-carbon-theme.scss` — Phase-0 stub (no `@carbon/styles` imports yet)
- `package.json` + `package-lock.json` — `carbon-components-svelte@^0.107.0` + `@carbon/styles@^1.105.0` + `carbon-icons-svelte@^13.10.0`
- `CLAUDE.md` — new "Design System Authority" section pointing at `specs/026-lunaris-design-system/spec.md`
- `.gitignore` — entries for `docs/argos-v2-mockup/`, `docs/carbon-design-system/`, `docs/carbon-website/`
- `config/eslint.config.js` — ignore patterns for the same 3 reference doc dirs

**Verification:**

- ✅ `npm run build` clean (✓ done in 1m44s)
- ✅ `argos-final.service` restart HTTP 200 within ~6s
- ✅ chrome-devtools MCP visual diff: identical to pre-Phase-0 (zero user-visible change — Phase 0 is invisible to users)
- ✅ Sentrux quality_signal=6733, signal_delta=0, 2/2 rules pass, 0 violations
- ✅ Trunk hold-the-line: ✔ No new issues across 7 commits
- ✅ Pre-push full-repo ESLint: clean (with `SKIP_TESTS=1` per `.husky/pre-push` documented agent-runtime SIGTERM bypass)

**Memories added:**

- `~/.claude/projects/.../memory/reference_argos_design_authorities.md` — 3 doc paths + Carbon-source-wins-over-site-docs precedence
- `~/.claude/projects/.../memory/feedback_lunaris_spec_first.md` — no component change without spec doc

**Pre-Phase-0 cleanup** (commits on the predecessor branch, also in this PR's diff range):

- Revert `f8bdc233` (centered headers) → commit `4c29ebc2`
- Revert `86b49fad` (hybrid widths + center for time/tag) → commit `625160ef`
- Kept `64fbb2af` (`Column<Row>.kind` taxonomy — useful as future `<DataTable>` column metadata)

---

## Phase 1 — Foundation + IconBtn migration (in review, stacked)

**Branches:**

- `feature/spec-026-carbon-phase-1-datatable` → `feature/spec-026-carbon-phase-0-scaffold` (foundation, PR #60)
- `feature/spec-026-carbon-phase-1-canary-migration` → `feature/spec-026-carbon-phase-1-datatable` (canary + tier, PR #61)

**Tags:**

- `spec-026-phase-1-foundation-complete` at `7515560e`
- `spec-026-phase-1-complete` at `dfc8c63d`

**PRs:** #60 (foundation), #61 (canary + tier)

**Reorder:** Phase 1 ↔ Phase 2 swap. Buttons before DataTable per Strangler Fig pattern (Fowler) + Carbon's own v10→v11 migration guide. Smallest validation surface first — DataTable has 2 Argos extensions Carbon doesn't ship + 8 variants.

**Foundation deliverables (PR #60):**

- 4 data-table spec docs (Phase 2 prep, landed early per memory `feedback_lunaris_spec_first.md`)
- `sass-embedded@^1.83.0` devDep (Vite v7 SCSS preprocessor)
- `lunaris-carbon-theme.scss` import wired in `src/routes/+layout.svelte`
- 4 button spec docs (Phase 1 canonical reference)
- `src/lib/components/mk2/IconBtnCarbon.svelte` — Carbon-wrapped IconBtn parallel impl (Adapter pattern)

**Canary + tier deliverables (PR #61):**

- Canary: `Tweaks.svelte` close button → IconBtnCarbon (commit `9737b433`)
- Bug fix: CSS class prefix `cds--btn` → `bx--btn` (carbon-components-svelte uses LEGACY v10 prefix)
- Tier: `Topbar.svelte` + `MissionStrip.svelte` + `CapturesTab.svelte` (commit `dfc8c63d`)

**Verification:**

- ✅ chrome-devtools MCP DOM probe: 6 Carbon `<Button>` instances rendered, 6 `lunaris-icon-btn` wrapper class applied, 0 bespoke IconBtn on page
- ✅ Computed: 28×28 + 1px transparent border + transparent bg + `var(--mk2-ink-3)` color (matches bespoke spec)
- ✅ Sentrux quality_signal=6733 unchanged, 0 violations
- ✅ Build clean, restart HTTP 200, screenshots captured

**Architecture proven:**

- Carbon owns: `<Button>` anatomy, focus, a11y, tooltip, click handling
- Lunaris owns: visual identity via `:global(.lunaris-icon-btn.bx--btn)` overrides
- Argos consumers: zero call-site code changes (import path swap only)

**Bespoke `IconBtn.svelte` STILL ALIVE** as parallel-impl rollback layer.

---

## Phase 2 — DrawerTable → Carbon `<DataTable>` ✅ Done 2026-04-29

**Branch:** `feature/spec-026-carbon-phase-2-datatable`
**PR:** #65 (squash-merged, tip `ad76f374`, 5 commits `ba7d04a9` → `78eeb762`)
**Tag:** `spec-026-phase-2-complete`

Bespoke `DrawerTable.svelte` replaced with Carbon `<DataTable size="compact">` wrapper. Strangler Fig: parallel impl → canary on LogsTab → tier 4 remaining tabs → atomic swap. Same public API (`Column<Row>` kind discriminant + storageKey + cell snippet) preserved via Adapter pattern; consumer code change = 1 import line per tab.

Implementation deviations from initial plan (captured in `data-table/code.md`):
- External sort (kind-aware compareValues in wrapper) instead of Carbon per-header sort fns
- PointerEvents drag-reorder (6.5× P95 win per spec-024 wave-1 spike T039) instead of HTML5 DnD
- Side `Map<string, R>` for original-row retrieval — keeps Carbon's `DataTableKey` type permissive

CR Major findings addressed in `78eeb762`:
- `commitReorder` uses `orderedColumns` (not stale `order`) so appended columns can reorder
- Row `id` field set LAST so column projections never overwrite it

Sentrux: signal stable at 6733 (signal_delta=0). Visual diff via chrome-devtools MCP confirmed Lunaris identity 100% preserved across all 5 drawer tabs.

**Bespoke `DrawerTable.svelte` REMOVED** — Carbon implementation now canonical.

---

## Phase 2 follow-up — code.md actuals + Phase 3 prep ⏳ In review

**Branch:** `feature/spec-026-phase-2-followup`
**PR:** #66 (open as of 2026-04-29)

Documentation-only follow-up:
- `data-table/code.md` rewritten to match shipped implementation (external sort + PointerEvents + side-Map)
- `migration-roadmap.md` phase board updated (Phases 0/1/2 ✅, Phase 3 ⏳)
- Phase 3 form spec drafts: `text-input/{usage.md, style.md}`, `checkbox/usage.md`, `select/usage.md`

---

## Phase 3 — Form fields ⏳ Spec prep

**Planned branch:** `feature/spec-026-carbon-phase-3-forms`
**Planned tag:** `spec-026-phase-3-complete`

Canary spec docs landing via PR #66. Phase 3 implementation work scopes ~30-50 bespoke form-input call sites across screens (Tweaks, FilterBar, GpServerForm, TAK forms, RFPropagationControls, FrequencyTuner, etc.). Migration order proposal: tools-flyout (low-traffic canary) → filter-bar (high visibility) → forms → screen inspectors. Expected effort: 5-7 days.

---

## Phases 4-7 (not started)

Per `migration-roadmap.md`:

- Phase 4 — Modal + Notification + Tooltip
- Phase 5 — Tabs
- Phase 6 — Pagination + Loading + Search
- Phase 7 — A11y audit + dead-code cleanup

---

## Reference

Full plan: `/home/jetson2/.claude/plans/create-the-plan-clearly-humble-badger.md` (approved 2026-04-28)
