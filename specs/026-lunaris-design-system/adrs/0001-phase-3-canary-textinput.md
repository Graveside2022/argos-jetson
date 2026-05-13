# ADR 0001 — Phase 3 canary surface = GpServerForm portal+username

**Status:** Accepted 2026-04-29
**Phase:** 3 (Form fields)
**Authors:** spec-026 owner (solo workflow per `project_review_workflow.md`)
**Supersedes:** none — first ADR in `specs/026-lunaris-design-system/adrs/`

---

## Context

Phase 3 of the Carbon migration roadmap covers 5 form components (TextInput, PasswordInput-implicit, NumberInput, Checkbox, RadioButton, Select). Per the canonical canary pattern established in Phase 1 (PR #63 → #64), Phase 3 ships in two halves: **canary** (parallel adapter + one consumer migrated) → **tier-migrate** (remaining consumers, bespoke deletion).

The canary surface MUST satisfy: smallest blast radius, single Carbon component taxonomy, observable in production, hours-recoverable failure mode.

`text-input/usage.md` (drafted Phase 2) listed five candidate consumer surfaces:

1. Tools flyout filter (`ToolsFlyoutHeader.svelte`)
2. Filter bar (`FilterBar.svelte`)
3. Kismet inspector query (`KismetInspector.svelte`)
4. Frequency tuner (`FrequencyTuner.svelte`)
5. GP server form (`GpServerForm.svelte`)

## Decision

**Canary = GpServerForm `portal` + `username` inputs only.** Password defers to PR3b (Carbon `<PasswordInput>` taxonomy).

## Alternatives rejected

| Candidate                           | Rejected because                                                                                                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ToolsFlyoutHeader filter            | `type="search"` + magnifier prefix + ESC clear-chip is canonically Carbon `<Search>`, NOT `<TextInput>`. Migrating it as TextInput would conflate two Carbon components. Deferred to a future spec set under `components/search/`. |
| FilterBar                           | 221 LOC, single bespoke `<input>` embedded in larger panel chrome. Migration footprint too large for a canary; multiple parent style overrides need spec capture first.                                                            |
| KismetInspector                     | grep finds 0 `<input` literals — `usage.md` inventory was wrong (uses `<Search>`-shaped abstraction or external lib). Verify before migration; not a canary candidate today.                                                       |
| FrequencyTuner                      | Mixed surface — numeric value needs `<NumberInput>`, label half needs `<TextInput>`. Two Carbon components; canary must be single-component.                                                                                       |
| GpServerForm all 3 (incl. password) | `type="password"` is canonically Carbon `<PasswordInput>` (visibility toggle). Mixing taxonomies in one canary defeats the purpose. Password migrates in PR3b.                                                                     |

## Consequences

### Positive

- Smallest reversible unit: 2 `<input>` swaps in a 60 LOC file → ~30 LOC delta.
- Pure TextInput taxonomy: no co-mingling with `<Search>` / `<PasswordInput>` / `<NumberInput>`.
- GpServerForm is a Settings-screen surface (low traffic) — canary failure does not block primary tactical loop.
- Form's natural `labelText` pairing matches Carbon's a11y-required prop directly; no synthetic adapter shim needed.

### Negative

- One-PR-cycle visual inconsistency: portal + username styled by Carbon, password styled by bespoke until PR3b lands. Mitigation: PR3b sequenced same week; readme note in PR3a description.
- Password input still exposes the bespoke focus-border pattern → cannot delete bespoke `<input>` styles in PR3a. Bespoke styles deleted only when ALL three consumer inputs are migrated (PR3b).

## Verification gates (abort criteria)

| Metric                       | Tool                                          | Pass criterion                                       | Abort criterion                 |
| ---------------------------- | --------------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| WCAG 2.1 AA on form          | `@axe-core/playwright`                        | `violations: []`                                     | any non-zero `violations`       |
| Visual diff vs pre-migration | chrome-devtools MCP `take_snapshot`           | a11y tree equivalent (same labels, same focus order) | label/role/name regression      |
| Sentrux quality_signal       | `mcp__plugin_sentrux_sentrux__session_end`    | Δ ≥ 0 vs worktree baseline                           | any negative Δ                  |
| Bundle size delta            | `npm run build` size report                   | < +5 KB gzip                                         | > +5 KB gzip                    |
| Type-check                   | `npx tsc --noEmit`                            | 0 errors                                             | any error introduced by adapter |
| Svelte autofixer             | `mcp__plugin_svelte_svelte__svelte-autofixer` | `issues: []`                                         | any unsuppressed warning        |

## Rollback

Single `git revert <PR3a-merge-sha>` restores GpServerForm + deletes the unused adapter file. Roadmap tag `spec-026-phase-2-complete` is the bisect floor.

## Authority citations

- Carbon TextInput component: `node_modules/carbon-components-svelte/src/TextInput/TextInput.svelte`
- Carbon TextInput SCSS: `docs/carbon-design-system/packages/styles/scss/components/text-input/_text-input.scss`
- Carbon Search vs TextInput taxonomy: <https://svelte.carbondesignsystem.com/?path=/docs/components-search--default>
- Strangler Fig pattern: Fowler, "StranglerFigApplication" (2004) <https://martinfowler.com/bliki/StranglerFigApplication.html>
- Branch by Abstraction: Newman, "Building Microservices" 2nd ed §5
- WCAG 2.1: <https://www.w3.org/TR/WCAG21/>
