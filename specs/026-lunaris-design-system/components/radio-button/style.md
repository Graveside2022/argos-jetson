# Radio Button — Style

**Status:** Phase 3 PR3d — implementation in flight
**Last updated:** 2026-04-29
**Authority precedence:** Carbon source SCSS > Carbon site mdx > Lunaris CSS overlay

---

## Canonical anatomy citations

From `docs/carbon-design-system/packages/styles/scss/components/radio-button/_radio-button.scss`:

- **Native input is `visually-hidden`** (off-screen at 1×1 px, accessible to AT but not visible). The visual mark is rendered by `.bx--radio-button__label::before` pseudo-element.
- **Outer ring** is a 16 × 16 px (`$spacing-05`) circle with a 1 px border (`$radio-border-width`) in `$icon-primary`.
- **Inner dot** is a 7 × 7 px filled circle in `$icon-primary` rendered via `::before` background-color when `:checked`.
- **Border-radius** = 50% (full circle, distinguishing radio from checkbox's 1 px square corner).
- **Focus ring** uses Carbon's `focus-outline('outline')` mixin — 2 px outline OUTSIDE the circle, in `$focus`.
- **Group container** (`.bx--radio-button-group`) is `display: flex` with `align-items: center`. Vertical variant flips to `flex-direction: column`.

Key shape:

- **16 × 16 px circle** mirrors Checkbox's 16 × 16 px square → unified selection-control footprint.
- **Single dot fill on check** (no animated transition like Checkbox's checkmark stroke).
- **`bind:group` semantics** — only one of N RadioButtons in a group can be checked simultaneously (browser-enforced via shared `name` attribute).

---

## Lunaris token map

| Carbon token                        | Lunaris value                             | Notes                                                   |
| ----------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `$icon-primary` (border, dot fill)  | `var(--ink-2)` → `var(--ink)`             | Border in unchecked; dot in checked                     |
| `$focus` (focus ring)               | `var(--accent)`                           | 2 px outline outside circle, switches per `data-accent` |
| `$support-error` (invalid border)   | `var(--mk2-red)`                          | High-vis #FF5C33; group-level via RadioButtonGroup      |
| `$text-primary` (label text)        | `var(--ink-2)`                            | Slightly muted vs full ink                              |
| `$text-disabled` (disabled label)   | `var(--ink-5)`                            | Most-muted ink                                          |
| `$layer-disabled` (disabled border) | `var(--ink-5)`                            | Reduced contrast for disabled state                     |
| `body-compact-01` type-style        | `var(--mk2-fs-3) / 1.4 var(--mk2-f-mono)` | Geist Mono for tactical surfaces; Geist sans for prose  |

---

## Sizing

Carbon's RadioButton is fixed at 16 × 16 px regardless of surrounding density (mirrors Checkbox). Lunaris inherits this — no radio-specific size axis.

| Argos surface          | Density | Circle | Label text                                |
| ---------------------- | ------- | ------ | ----------------------------------------- |
| TakAuthMethodPicker    | normal  | 16 px  | `body-compact-01` (or chip-skin override) |
| Future settings panels | normal  | 16 px  | `body-compact-01`                         |

Touch-target compliance is achieved by the surrounding `<label>` and/or `<RadioButtonGroup>` `<fieldset>` chrome — see `accessibility.md` § "Tap target compliance."

---

## State matrix

| State             | Border (Lunaris)                                             | Dot fill (Lunaris)                  | Label color                    |
| ----------------- | ------------------------------------------------------------ | ----------------------------------- | ------------------------------ |
| Default unchecked | `var(--ink-2)` 1 px                                          | none                                | `var(--ink-2)`                 |
| Hover             | `var(--ink)` 1 px                                            | none                                | `var(--ink-2)`                 |
| Focus (any)       | + 2 px ring `var(--accent)` outside                          | unchanged                           | unchanged                      |
| Checked           | `var(--ink)`                                                 | `var(--ink)` 7 px circle            | `var(--ink-2)`                 |
| Disabled          | `var(--ink-5)` 1 px                                          | none (or `var(--ink-5)` if checked) | `var(--ink-5)`                 |
| Group invalid     | inherits group-level `var(--mk2-red)` border on `<fieldset>` | unchanged                           | invalid text shown below group |

**No invalid state at individual RadioButton level** — Carbon validates groups, not single radios. (Same constraint we hit with Checkbox in Phase 3c — wrapper does NOT expose `invalid`/`invalidText` on the atomic component.)

---

## TakAuthMethodPicker `.chip` skin — Lunaris-bespoke surface

The 2 RadioButton sites in `TakAuthMethodPicker.svelte` use a chip-pill skin: each option renders as a bordered rectangle with uppercase mono text, with one selected. Native HTML `<input type="radio">` is hidden via `class="sr-only"`; the visible chip is a styled `<span>`.

Migration approach (mirrors Phase 3c BluetoothPanel `.opt` chip pattern):

1. Wrap two `<RadioButton hideLabel labelText="…" value="…" class="chip" />` inside `<RadioButtonGroup bind:selected={config.authMethod}>`.
2. The existing `.chip` CSS in `TakAuthMethodPicker.svelte`'s `<style>` block continues to apply via `class` forwarding to Carbon's outer `<div>` wrapper.
3. `hideLabel` keeps the AT-readable label without visible chrome — the chip's visible text is rendered separately via the chip-pill styling rules.

If the existing `.chip input` selectors become unused after Carbon takes over input rendering (Carbon hides the native input via `visually-hidden`), remove them — same dead-CSS cleanup pattern that Phase 3c applied to BluetoothPanel `.opt input`.

Verification: chrome-devtools MCP screenshot pre/post migration of TakAuthMethodPicker — must be pixel-near-identical.

---

## What Argos does NOT inherit from Carbon

- **`bx--radio-button-group--label-left`** (legend on right of group) — Argos uses default left-aligned legends only.
- **Helper text rendering at individual radio level** — Carbon's RadioButton has no `helperText` prop; helperText only exists on RadioButtonGroup. Lunaris adapter respects this constraint.
- **High-contrast mode CSS** — Argos is dark-mode only; Carbon's high-contrast media query stays inert.

---

## Authority citations

- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/radio-button/_radio-button.scss`
- Carbon site mdx: `docs/carbon-website/src/pages/components/RadioButton/{usage,style,code,accessibility}.mdx`
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/RadioButton/RadioButton.svelte`
- Lunaris CSS custom properties: `src/app.css` (`:root` block)
- Theme overlay: `src/lib/styles/lunaris-carbon-theme.scss`
- Phase 3c chip-skin precedent: `src/lib/components/dashboard/panels/BluetoothPanel.svelte` `<style>` `.opt` rules
