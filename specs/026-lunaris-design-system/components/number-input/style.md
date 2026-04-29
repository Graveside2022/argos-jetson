# Number Input — Style

**Status:** Phase 3 PR3e — implementation in flight
**Last updated:** 2026-04-29
**Authority precedence:** Carbon source SCSS > Carbon site mdx > Lunaris CSS overlay

---

## Canonical anatomy citations

From `docs/carbon-design-system/packages/styles/scss/components/number-input/_number-input.scss`:

- **`.bx--number`** is the outer wrapper — flex column, full width.
- **`<input type="number">`** (or `type="text"` when `allowDecimal`/`locale` is set) gets `body-compact-01` typography + Carbon's `focus-outline('reset')` mixin baseline.
- **Stepper buttons** (up/down chevrons) are rendered as `<button>` siblings with `button-reset` mixin, positioned absolutely on the input's right edge. Each is 100% input height ÷ 2 stacked vertically.
- **Warn variant** padding-inline-end is 128px (room for the warning icon to the LEFT of the steppers).
- **Sizes:** `xs (24px)` / `sm (32px)` / **default `md (40px)`** / `xl (48px)` via `layout.size('height')`.
- **Bottom-only border** like TextInput (border-block-end, 1px).

Key shape:

- **Same input chrome as TextInput** — bottom border, filled background, `body-compact-01` type.
- **Two extra UI elements vs TextInput**: stepper buttons (clickable up/down arrows) + optional invalid/warn trailing icon.
- **Stepper button styling**: borderless, transparent until hover; on hover, background lightens by one layer step.

---

## Lunaris token map

| Carbon token                      | Lunaris value                             | Notes                                           |
| --------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| `$field` (input bg)               | `var(--bg-2)`                             | Same as TextInput                               |
| `$border-strong` (bottom border)  | `var(--line)`                             | 1px solid                                       |
| `$text-primary` (input text)      | `var(--ink)`                              | Editable input text                             |
| `$text-placeholder` (placeholder) | `var(--ink-4)`                            | Most-muted ink                                  |
| `$focus` (focus ring)             | `var(--accent)`                           | 2px outline outside border                      |
| `$support-error` (invalid)        | `var(--mk2-red)`                          | High-vis #FF5C33                                |
| `$support-warning` (warn)         | `var(--mk2-amber)`                        | Warm gold #D4A054                               |
| `$icon-primary` (stepper icon)    | `var(--ink-2)`                            | Default chevron color                           |
| `$icon-secondary` (stepper hover) | `var(--ink)`                              | Brighter on hover                               |
| `body-compact-01` type-style      | `var(--mk2-fs-3) / 1.4 var(--mk2-f-mono)` | Geist Mono — ALL number inputs are tabular data |

---

## Sizing per surface

| Argos surface                      | Density | Carbon size | Use case                       |
| ---------------------------------- | ------- | ----------- | ------------------------------ |
| Drawer-tab filter (RSSI, freq)     | compact | sm (32px)   | filter-row inline              |
| TakServerForm port / TakAuthEnroll | compact | sm (32px)   | matches TextInput in same form |
| RFPropagationControls              | normal  | md (40px)   | Carbon default (PR 3e-tier-2)  |
| SpectrumControls (ranges)          | normal  | md (40px)   | (PR 3e-tier-2)                 |
| FrequencyTuner display             | comfy   | xl (48px)   | (PR 3e-tier-2 — large readout) |

---

## Stepper button behavior

**Default:** visible at the input's trailing edge. Click increments/decrements by `step`.

**`hideSteppers={true}`:** hides them entirely. Use for surfaces where the user types the number and steppers add visual noise (e.g., RSSI in compact filter rows).

**Disabled stepper:** stepper grays out when value === min (down) or value === max (up). User can still type past constraints; Carbon's `validate` reports invalid.

**Lunaris stepper styling:** subtle by default (`var(--ink-2)` chevron on transparent bg). Hover reveals `var(--bg-3)` background + `var(--ink)` chevron. Active (mouse down) = `var(--bg-4)` background.

---

## Decimal precision rendering

**`allowDecimal={true}`** switches the rendered `<input>` from `type="number"` to `type="text"` + `inputmode="decimal"`. Why: HTML `type="number"` browsers normalize values like `"1.0"` to `"1"` (strips trailing zero). Tactical surfaces (frequency in MHz: `162.4500`) need the trailing zeros visible. Text mode preserves them.

**`locale="en-US"`** + `formatOptions={{ minimumFractionDigits: 4 }}` formats display via `Intl.NumberFormat` — useful for:

- Frequencies: `162.4500 MHz`
- Coordinates: `33.6712°`
- Currency-like display

PR 3e-tier-2's `FrequencyTuner` will use this for the radio frequency readout. PR 3e canary fields are integers (no decimals).

---

## State matrix

| State     | Border (Lunaris)                   | Bg (Lunaris)         | Stepper visibility |
| --------- | ---------------------------------- | -------------------- | ------------------ |
| Default   | `var(--line)` 1px                  | `var(--bg-2)`        | shown              |
| Hover     | `var(--line)` 1px                  | `var(--bg-3)` (lift) | shown              |
| Focus     | + 2px ring `var(--accent)` outside | unchanged            | shown              |
| Disabled  | `var(--ink-5)` 1px                 | `var(--bg-1)`        | hidden / disabled  |
| Read-only | `var(--ink-3)` dashed 1px          | unchanged            | hidden             |
| Invalid   | `var(--mk2-red)` 2px               | unchanged            | shown + error icon |
| Warn      | `var(--mk2-amber)` 2px             | unchanged            | shown + warn icon  |

---

## What Argos does NOT inherit from Carbon

- **Light variant** — dark mode only.
- **AI-gradient styling** — not applicable.
- **Custom-font display value** — Lunaris uses Geist Mono universally for number inputs; Carbon's default Plex Sans is overridden by the theme overlay.

---

## Authority citations

- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/number-input/_number-input.scss`
- Carbon site mdx: `docs/carbon-website/src/pages/components/NumberInput/{usage,style,code,accessibility}.mdx`
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/NumberInput/NumberInput.svelte`
- Lunaris CSS custom properties: `src/app.css` (`:root` block)
- Theme overlay: `src/lib/styles/lunaris-carbon-theme.scss`
- Phase 3a TextInput precedent: `specs/026-lunaris-design-system/components/text-input/style.md`
