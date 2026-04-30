# Spec 026 — Migration Roadmap (Living Doc)

**Status board for the 8-phase Carbon migration.** Updated as each phase completes. The fully-detailed plan with per-step rationale + rollback layers is in `/home/jetson2/.claude/plans/create-the-plan-clearly-humble-badger.md` (approved 2026-04-28).

---

## Status legend

- ✅ Complete (merged to `dev`)
- ⏳ In progress (branch open, work happening)
- ⏸ Blocked (waiting on dependency or decision)
- ⬜ Not started

---

## Phase board

| #         | Phase                                                                     | Branch                                                             | Status                                                                                  | Tag at completion           | Risk        | Effort   |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------- | ----------- | -------- |
| Pre-0     | Cleanup reverts (`f8bdc233` + `86b49fad`)                                 | `feature/spec-024-mk2-phase-3-pr-b2-tools-flyout`                  | ✅ Done 2026-04-28 (commits `4c29ebc2` + `625160ef`)                                    | n/a (predecessor branch)    | Low         | < 1 day  |
| 0         | Pre-flight scaffold                                                       | `feature/spec-026-carbon-phase-0-scaffold`                         | ✅ Done 2026-04-28 (PR #59, squash `8796ace7`)                                          | `spec-026-phase-0-complete` | Low         | 1-2 days |
| 1         | Buttons + IconBtn (canonical first-bite)                                  | `feature/spec-026-carbon-phase-1-{datatable,canary-migration}`     | ✅ Done 2026-04-28 (PRs #63 + #64, tip `fb7dddea`)                                      | `spec-026-phase-1-complete` | Low-Medium  | 2-3 days |
| 2         | DrawerTable → Carbon `<DataTable>`                                        | `feature/spec-026-carbon-phase-2-datatable`                        | ✅ Done 2026-04-29 (PR #65, squash `ad76f374`)                                          | `spec-026-phase-2-complete` | Medium      | 3-5 days |
| **3**     | **Form fields** (split into per-field PRs)                                | see sub-rows below                                                 | ✅ Done 2026-04-29 (tag `spec-026-phase-3-complete`)                                    | `spec-026-phase-3-complete` | Medium      | 5-7 days |
| 3a        | TextInput canary + GpsServerForm                                          | `feature/spec-026-carbon-phase-3-textinput-canary`                 | ✅ Done 2026-04-29 (PR #69, squash `9ef239bf`)                                          | n/a (sub-phase)             | Low-Medium  | 1 day    |
| 3b        | PasswordInput + Search                                                    | `feature/spec-026-carbon-phase-3-passwordinput-search-prep`        | ✅ Done 2026-04-29 (PR #70, squash `0da0567e`)                                          | n/a (sub-phase)             | Low-Medium  | 1 day    |
| 3c        | Checkbox (5 sites)                                                        | `feature/spec-026-carbon-phase-3c-checkbox`                        | ✅ Done 2026-04-29 (PR #78, squash `fe66f61d`)                                          | n/a (sub-phase)             | Low         | < 1 day  |
| 3d        | RadioButton + RadioButtonGroup (1 file, 2 sites)                          | `feature/spec-026-carbon-phase-3d-radio`                           | ✅ Done 2026-04-29 (PR #80, squash `d4ea8032`)                                          | n/a (sub-phase)             | Medium      | 1-2 days |
| 3e        | NumberInput canary (3 sites: FilterBar + 2× TAK)                          | `feature/spec-026-carbon-phase-3e-numberinput`                     | ✅ Done 2026-04-29 (PR #82, squash `89023ba7`)                                          | n/a (sub-phase)             | Medium      | 1 day    |
| 3e-tier-2 | NumberInput tier-2 (16 sites: RF\*, Spectrum, PresetForm, FrequencyTuner) | `feature/spec-026-carbon-phase-3e-tier-2-{a,b}`                    | ✅ Done 2026-04-29 (PRs #83 + #84, squashes `18067250` + `458b11ad`)                    | n/a (sub-phase)             | Medium      | 1 day    |
| 3f        | Select + Dropdown                                                         | `feature/spec-026-carbon-phase-3f-{select,select-tier-2,dropdown}` | ✅ Done 2026-04-29 (PRs #86 + #87 + #88, squashes `79a6beaf` + `a56f1dbe` + `c0111efb`) | n/a (sub-phase)             | Medium-High | 2 days   |
| 4         | Modal + Notification + Tooltip                                            | `feature/spec-026-carbon-phase-4-overlays-{canary,sweep}`          | ✅ Done 2026-04-30 (PR #91 canary `1f27dba8` + PR-B sweep — see open follow-ups)        | `spec-026-phase-4-complete` | Medium-High | 3-5 days |
| 5         | Tabs                                                                      | `feature/spec-026-carbon-phase-5-tabs`                             | ✅ Done 2026-04-30 (single phase-close PR — see open follow-ups for TerminalTabBar deferral) | `spec-026-phase-5-complete` | Medium      | 2-3 days |
| 6         | Pagination + Loading + Search                                             | `feature/spec-026-carbon-phase-6-misc`                             | ⬜                                                                                      | `spec-026-phase-6-complete` | Low-Medium  | 3-5 days |
| 7         | A11y audit + dead-code cleanup                                            | `feature/spec-026-carbon-phase-7-a11y-cleanup`                     | ⬜                                                                                      | `spec-026-phase-7-complete` | Low         | 2-3 days |

**Total estimated effort:** ~21-33 engineer-days over 6-10 calendar weeks.

---

## Phase 0 (current) — checklist

- [x] Revert `f8bdc233` (centered headers) — commit `4c29ebc2`
- [x] Revert `86b49fad` (hybrid widths) — commit `625160ef`
- [x] Create branch `feature/spec-026-carbon-phase-0-scaffold`
- [x] Sentrux `session_start` baseline (quality_signal=6733)
- [x] `npm install carbon-components-svelte@^0.107.0 @carbon/styles carbon-icons-svelte`
- [x] Scaffold `specs/026-lunaris-design-system/` (this file + spec.md + authorities.md + tokens.md)
- [x] Create `src/lib/styles/lunaris-carbon-theme.scss` (stub — no `@carbon/styles` imports yet)
- [⏭] **Wire theme in `src/routes/+layout.svelte`** — DEFERRED to Phase 1 prerequisite. Vite v7 requires `sass-embedded` devDep (not currently installed) to preprocess `.scss` files. Phase 0 ships the theme file unimported; Phase 1's first step adds `sass-embedded` + wires the import.
- [⏭] Verify `vite.config.ts` SCSS preprocessing handles `@carbon/styles` — folded into the same Phase 1 prerequisite.
- [x] Add `.gitignore` entries for `docs/argos-v2-mockup/`, `docs/carbon-design-system/`, `docs/carbon-website/`
- [ ] `npm run build` clean
- [ ] `sudo systemctl restart argos-final.service`, verify HTTP 200
- [ ] Chrome-devtools MCP visual diff vs pre-Phase-0 (must be IDENTICAL — Phase 0 is invisible to users)
- [ ] Sentrux `rescan` + `session_end` + `check_rules`, verify quality_signal not regressed
- [ ] Update `CLAUDE.md` with Design System Authority section
- [ ] Memory updates: `reference_argos_design_authorities.md` + `feedback_lunaris_spec_first.md`
- [ ] Open PR `feature/spec-026-carbon-phase-0-scaffold` → `dev`
- [ ] Merge to `dev`, tag `spec-026-phase-0-complete`

---

## Rollback per-phase

Five layers, cheapest to slowest:

1. **Per-commit revert** (`git revert <sha>`) — 30s
2. **Per-phase tag rollback** (`git checkout spec-026-phase-N-complete -- <files>`) — 1 min
3. **Per-phase branch isolation** (don't merge if not green) — branch is throwaway
4. **Parallel implementations** during transition (bespoke kept as `*Bespoke.svelte`) — 1-line consumer-side switch back
5. **Production-build rollback** (`git checkout spec-026-phase-N-complete && npm run build && sudo systemctl restart argos-final.service`) — ~2 min

---

## Decisions log

| Date       | Decision                                                    | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-28 | Spec dir = `specs/026-lunaris-design-system/`               | Long-lived cross-cutting reference, sibling to feature spec 024                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-04-28 | Lunaris DS scope = Argos-only, in-repo                      | No package extraction; extract later if reused across sister projects                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-04-28 | Revert strategy = back-to-back atomic reverts               | Bisect-friendly, each independently reviewable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-04-28 | Authority = Carbon source code (precedence over site docs)  | Source last-modified date is the tiebreaker; site docs lag                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-04-28 | Visual identity = Lunaris (preserved 100%)                  | Override Carbon tokens with Lunaris CSS custom properties; visual indistinguishable from current                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-04-28 | Typography = Geist + Geist Mono                             | Already in use; override Carbon `$body-font-family` etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-04-28 | Tokens map approach = per-component grow + category framing | tokens.md starts narrow, grows with each component spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-04-28 | Phasing = 8 phases, per-phase merge to `dev`                | Risk-bounded rollback at every phase boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-04-28 | **Reorder Phase 1 ↔ Phase 2** — Buttons before DataTable   | Strangler Fig (Fowler) + Carbon's own v10→v11 migration guide both recommend smallest-component-first. DataTable has 2 Argos extensions (kind taxonomy, drag-reorder) Carbon doesn't ship + 8 Carbon variants — wrong canonical first-bite. Buttons have 0 Argos extensions + simple Carbon equivalent — validates the Lunaris-on-Carbon adapter pattern with hours-recoverable failure mode. Original ordering reasoned from user pain (recent DataTable iteration), not engineering risk. Reordering now while uncertainty is highest. |

---

## Open follow-ups (not in current phase scope)

- Carbon's `<DataTable>` ships sortable but not drag-to-reorder columns. Phase 1 spec must decide: keep custom drag-handler wrapper OR drop the feature OR contribute upstream.
- 9 other table-rendering surfaces in `src/lib/components/**` (DeviceTable, DevicePriorityTable, IntelCategoryView, BluetoothPanel, UASPanel, ServicesTab, ScreenKismet, ImsiTable, ui/table). Each gets its own component spec when migrated; tracked here as TODO.
- Light theme + high-contrast theme + color-blind-safe theme variants become possible once Lunaris is a token-overlay theme (Phase 7+ stretch).

### Phase 4 PR-B — sites deferred to follow-up sub-phase

PR-B sweep (2026-04-30) migrated the sites where Carbon's overlay primitives fit cleanly. The following sites need a different chassis primitive than what PR-A shipped — deferred to a follow-up Phase 4 sub-phase:

- **`PanelStatus` chassis (extend `PanelEmptyState`) — full-tile error/loading screens.** Sites: `screens/SystemsScreen.svelte` (header status indicator), `dashboard/TerminalErrorOverlay.svelte` (centered overlay w/ icon + code-block), `dashboard/views/webtak/webtak-vnc-viewer.svelte` (overlay-card connecting/error/disconnected states), `dashboard/views/WiresharkView.svelte` (wireshark-status tile + retry), `dashboard/views/SDRppView.svelte` + `SparrowView.svelte` (status-label tiles), `dashboard/views/WebTAKView.svelte` (status-card tile), `dashboard/views/ReportsView.svelte:370` (state-card error-card). These share a tile shape with spinner + title + detail + retry button — Carbon's `InlineNotification` is a 60px banner widget, wrong tool.
- **`TooltipIcon` chassis (Carbon `<TooltipIcon>` wrapper) — icon-button hover tooltips.** Sites: `dashboard/AgentChatToolbar.svelte` (`title="Clear chat"`), `dashboard/AgentChatPanel.svelte` (`title="Send message"`), `dashboard/views/UASScanView.svelte` (`title="Clear buffer"`). The chassis `Tooltip` from PR-A wraps Carbon's inline `<Tooltip>` (info-icon trigger + body — BluetoothPanel pattern); it's the wrong primitive for icon-button hover tooltips. Note: `globalprotect/GpConfigView.svelte:104` `title="GLOBALPROTECT VPN"` was a false positive — that's a `ToolViewWrapper` component prop, not a tooltip.
- **`Popover` chassis (Carbon `<Popover>` wrapper) — anchor-positioned non-modal popovers.** Site: `mk2/Tweaks.svelte` (top-right anchored UI tweaks panel under the topbar). PR-A's chassis `Modal` is a centered modal with backdrop — wrong UX shape.

### Phase 5 — sites deferred to follow-up sub-phase

Phase 5 (2026-04-30) shipped chassis `Tabs` + `TabsSkeleton` and migrated the 1 fitting site (`DeviceSubTabs`). The following site needs a different chassis primitive than Carbon Tabs models — deferred:

- **`EditorTabBar` chassis (separate widget category from Carbon Tabs).** Site: `dashboard/TerminalTabBar.svelte` (per-tab close-X button on each session tab). Carbon Tabs is `<a role="tab">`, single-purpose; **W3C ARIA APG forbids nested interactives inside `role="tab"`** — the existing TerminalTabBar's close-X-inside-tab markup is actually an ARIA anti-pattern. Industry pattern (VS Code editor tabs, Chrome browser tabs) implements this UX with custom non-tablist code, NOT ARIA tablist semantics. A future `EditorTabBar` chassis (separate widget category, optionally with WAI-ARIA's "card-like tab" patterns) is the right home for this site. ToolsFlyout's pillar tabs remain deferred to Phase 4 follow-up sub-phase D.

### Phase 6 — next up

Carbon `<Pagination>` + `<Loading>` + `<Search>` migration. **Engineering reasoning**: Pagination is high-leverage (5+ data tables / lists in Argos use bespoke pagination); `<Loading>` is a small-LOC primitive that finally retires the bespoke spinners scattered across screens; `<Search>` is the field-level search input (distinct from a future combobox). Estimated 5-10 sites, low-medium risk, well-bounded Carbon primitives. Branch: `feature/spec-026-carbon-phase-6-misc`. Effort: 3-5 days. Per Phase 4-5 precedent, expect 1-3 sites to defer to a follow-up sub-phase if Carbon primitives don't fit cleanly (catalog them in this section as they emerge).
- **Bespoke modal restructure with custom focus + kbd nav.** Site: `chassis/ToolsFlyout.svelte` (cmd-K tool launcher with custom focus trap, arrow-key pillar nav, search bar in modal chrome, kbd-hint footer). Mechanical wrap in chassis `Modal` would conflict with Carbon's own focus management. Migration requires carefully integrating Carbon Modal with the existing keyboard logic — its own sub-phase task.

### Phase 5 — next up

Carbon `<Tabs>` migration. **Engineering reasoning**: Tabs is the next high-frequency primitive in Argos (visible in dashboard panels, screens views, and TAK config flows); it's a low-medium risk, well-bounded Carbon component (`tabs/_tabs.scss` + `Tabs.svelte` + `Tab.svelte` + `TabContent.svelte`); the Phase 5 PR estimates 4-7 sites with the Phase 3f-style canary→sweep cadence. Branch: `feature/spec-026-carbon-phase-5-tabs`. Effort: 2-3 days.
