# Dropdown — Usage

The Lunaris **`<Dropdown>`** wraps Carbon's [`Dropdown`](../../../../node_modules/carbon-components-svelte/src/Dropdown/Dropdown.svelte) primitive — a custom popover ARIA combobox, NOT a native `<select>`. Use when `<Select>` is insufficient.

## When to use Dropdown (not Select)

- Items are **objects with separate label and id** (`{id, label}` shape) — Carbon's data-driven items API beats the slot-based SelectItem pattern.
- List has **>7 options** OR is **fully dynamic** (loaded from a store).
- You need **custom item rendering** (icons, two-line items, badges) via the slot.
- Visual treatment must depart from native `<select>` (custom popover, multi-line items).

## When to use Select instead

- ≤7 static primitive options. `<Select>` is one Lunaris layer thinner and inherits free a11y from native `<select>`.

## When to use neither

- **Multi-pick** → Carbon's `MultiSelect` (not yet wrapped in Argos).
- **Free-text autocomplete with fuzzy match** → Carbon's `ComboBox` (not yet wrapped in Argos).
- **Yes/No or two-state** → `<RadioButton>` (3+ visible at once is more discoverable).

## Example

```svelte
<script lang="ts">
  import Dropdown from '$lib/components/chassis/forms/Dropdown.svelte';

  const PROFILES = [
    { id: 'urban', label: 'Urban dense' },
    { id: 'suburban', label: 'Suburban' },
    { id: 'rural', label: 'Rural' },
    { id: 'open', label: 'Open terrain' }
  ];

  let selectedId = $state<string>('suburban');
</script>

<Dropdown
  labelText="Clutter profile"
  items={PROFILES}
  bind:selectedId
  size="sm"
/>
```

## Argos surface inventory (post-triage 2026-04-29)

Phase 3f triage classified 7 native `<select>` sites into the Dropdown cohort:

| File | Sites | Filterable? | Notes |
|------|-------|-------------|-------|
| `src/lib/components/screens/parts/SpectrumControls.svelte` | 4 (binWidth + amp + LNA + VGA) | No | binWidth uses object-keyed `BIN_PRESETS`; gain steps are dynamic numeric arrays. |
| `src/lib/components/dashboard/panels/rf-propagation/RFAdvancedControls.svelte` | 3 (clutterProfile + reliability + propagationModel) | Deferred (use scrollable popover instead) | Object-keyed `CLUTTER_PROFILES` / `RELIABILITY_OPTIONS` / `PROPAGATION_MODELS`. |

**Total: 2 files / 7 sites.**

### `filterable` deferred

The original Phase 3f plan said RFAdvancedControls should use `<Dropdown filterable>`. Carbon's `<Dropdown>` does NOT ship filtering — that's `<ComboBox>`. Filtering is deferred:

- Lists are <20 items each (4 clutter profiles, 5 reliability options, ~12 propagation models). Scrollable popover is workable.
- Adding `<ComboBox>` wrapper would expand PR-C scope by ~150 LOC + a separate spec dir.
- Phase 7 a11y audit can re-evaluate based on field operator feedback.

Tracked as follow-up in `migration-roadmap.md`.

## States

| State | Mechanism |
|-------|-----------|
| Empty | `selectedId={undefined}` — Carbon shows the placeholder via `label` prop |
| Loading | `disabled={true}` while async items fetch |
| Default | Standard render |
| Active (open) | Carbon's controlled `open={true}` OR user click — popover opens, focused item highlights |
| Error | `invalid={true}` + `invalidText="..."` |
| Success | Carbon doesn't ship a success state; pair with sibling helper text |
| Disabled | `disabled={true}` |
| Disconnected | `disabled={true}` + sibling helper text explaining why |
