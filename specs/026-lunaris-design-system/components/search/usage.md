# Search — Usage

**Status:** Phase 3 PR3b prep (deferred from PR3a per ADR-0001)
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/Search.svelte`
**Carbon component:** `<Search>` from `carbon-components-svelte` v0.107.0+

---

## When to use

Search-specific input — anywhere the user filters / queries a list, table, log stream, or tools catalog. Carbon explicitly separates `<Search>` from `<TextInput>`:

- `<TextInput>` — generic single-line text capture (form fields).
- `<Search>` — `type="search"` semantics, magnifier prefix icon, clear-button suffix, expandable variant, dedicated `clear` event.

PR3a's spec-set audit reclassified the Argos tools-flyout filter out of TextInput's scope and into `<Search>`'s scope (ADR-0001).

## When NOT to use

- Plain form text fields → use `<TextInput>` (parent spec).
- Numeric values → use `<NumberInput>` (separate spec).
- Multi-line filter expressions → not currently in scope; would use `<TextArea>` if surfaced.
- Type-ahead with suggestions list → out of Phase 3 scope; deferred to a future autocomplete spec.

## Argos surface inventory

Bespoke search-style inputs migrated to `<Search>` in Phase 3 PR3b:

| Surface                | File                                                      | Current pattern                                                                           | Phase 3 target             |
| ---------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------- |
| Tools flyout filter    | `src/lib/components/chassis/ToolsFlyoutHeader.svelte`     | `<input type="search">` + Lucide `<Search>` prefix + ESC chip + bespoke focus-within ring | PR3b primary canary        |
| Kismet inspector query | `src/lib/components/screens/parts/KismetInspector.svelte` | (re-verify — `grep '<input'` returned 0; may already use a different abstraction)         | PR3b if confirmed; else NA |

Total bespoke search-input call sites confirmed: **1** (Tools flyout). Kismet inspector pending re-verification.

## Anatomy

Per Carbon `search/usage.mdx`:

1. **Magnifier icon** (default — overridable via `icon` prop) — visual affordance signalling search semantics.
2. **Search input field** — `type="search"` semantics; browser auto-renders the native clear "x" on some platforms; Carbon supplements with its own clear button.
3. **Clear button** — appears once `value !== ''`. Click fires `on:clear` event with `detail: null`. Argos's existing ToolsFlyout uses ESC to clear; Carbon adds a click-to-clear button as well.
4. **Optional label** — Carbon supports both visible and `hideLabel`-with-`labelText` patterns. ToolsFlyout currently uses `aria-label="Search tools"` — migrate to Carbon's `labelText="Search tools" hideLabel={true}`.
5. **Expandable variant** (`expandable={true}`) — collapses to icon-only when not focused, expands on click. Argos likely doesn't use this in PR3b (ToolsFlyout is always-expanded), but reserved.

## States to handle

Eight Argos lifecycle states (Empty, Loading, Default, Active, Error, Success, Disabled, Disconnected) plus search-specific:

- **Cleared via button** (`on:clear`): explicit user action; ToolsFlyout's existing ESC handling SHOULD be additive — keep both paths.
- **Expandable**: not in PR3b scope, but if added later: `expand` / `collapse` events.

## ToolsFlyoutHeader-specific migration notes

The existing chrome includes:

- A Lucide `<Search>` icon prefix (Carbon ships its own — replace).
- An ESC chip indicator (decorative; KEEP outside the Carbon component).
- A bespoke `.search` flexbox wrapper with `:focus-within` ring (Carbon handles focus internally — DELETE the wrapper after migration).
- Self-focus-on-open via `bind:this + searchInput?.focus()` (Carbon's `autofocus={open}` + `bind:ref` solves the same).

The ESC kbd-chip remains as decorative chrome adjacent to the Carbon `<Search>` — Carbon doesn't ship a kbd-hint slot and Argos's tactical aesthetic relies on it.

## Out of scope for Phase 3

- Carbon's `expandable` variant — defer until a surface needs collapse-to-icon behavior.
- `<Search>` skeleton state — async-loading affordance; Argos doesn't wire async filtering yet.
- Multi-token / chip-style search filters — not currently surfaced; future spec.

## Authority citations

- Carbon Svelte component: <https://svelte.carbondesignsystem.com/?path=/docs/components-search--default>
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/Search/Search.svelte`
- Carbon Svelte type defs: `node_modules/carbon-components-svelte/src/Search/Search.svelte.d.ts`
- Argos current bespoke: `src/lib/components/chassis/ToolsFlyoutHeader.svelte`
- ADR-0001: `specs/026-lunaris-design-system/adrs/0001-phase-3-canary-textinput.md` — taxonomy decision
