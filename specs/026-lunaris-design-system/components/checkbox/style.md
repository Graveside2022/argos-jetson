# Checkbox — Style

**Status:** Phase 3 PR3c — implementation in flight
**Last updated:** 2026-04-29
**Authority precedence:** Carbon source SCSS > Carbon site mdx > Lunaris CSS overlay

---

## Canonical anatomy citations

From `docs/carbon-design-system/packages/styles/scss/components/checkbox/_checkbox.scss`:

```scss
.#{$prefix}--checkbox + .#{$prefix}--checkbox-label::before {
	box-sizing: border-box;
	block-size: $spacing-05; // 16px
	inline-size: $spacing-05;
	background-color: transparent;
	border: 1px solid $icon-primary;
	border-radius: 1px;
	content: '';
	margin-block-start: convert.to-rem(2px);
	margin-inline-end: convert.to-rem(8px);
}

.#{$prefix}--checkbox:checked + .#{$prefix}--checkbox-label::before {
	background-color: $icon-primary;
	border-color: $icon-primary;
}

.#{$prefix}--checkbox:checked + .#{$prefix}--checkbox-label::after {
	transform: scale(1) rotate(-45deg);
	// 5px × 9px stroked checkmark drawn with two borders
}
```

Key shape:

- **16×16 px square** (`$spacing-05` token), 1 px border, 1 px corner radius. Tactical look at smaller sizes than the 18-px Material default.
- **Checkmark glyph** is a CSS `::after` pseudo with two borders rotated −45°, scaled in on `:checked`. No SVG asset.
- **Indeterminate state** is a 2-px-tall horizontal bar (a separate `::after` rotation) — same checkmark element, different geometry.
- **Native `<input type="checkbox">` is hidden** via `position: absolute; opacity: 0;` — the `::before` square is the visual mark. AT still announces from the real input.

---

## Lunaris token map

| Carbon token                        | Lunaris value                             | Notes                                                                                                            |
| ----------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `$icon-primary` (border, fill)      | `var(--ink-2)` → `var(--ink)`             | Border in unchecked; fill in checked                                                                             |
| `$icon-on-color` (checkmark stroke) | `var(--bg)`                               | Subtractive — checkmark is the page bg punched through fill                                                      |
| `$focus` (focus ring)               | `var(--accent)`                           | 2 px outline outside the square, switchable per `data-accent`                                                    |
| `$support-error` (invalid border)   | `var(--mk2-red)`                          | High-vis #FF5C33                                                                                                 |
| `$text-primary` (label text)        | `var(--ink-2)`                            | Slightly muted vs full ink — checkboxes are auxiliary                                                            |
| `$text-disabled` (disabled label)   | `var(--ink-5)`                            | Most-muted ink                                                                                                   |
| `$layer-disabled` (disabled fill)   | `var(--bg-1)`                             | One layer down from `--background`                                                                               |
| `body-compact-01` type-style        | `var(--mk2-fs-3) / 1.4 var(--mk2-f-mono)` | Geist Mono for tactical surfaces (BluetoothPanel `.opt`); Geist sans for prose forms (ReportsView mission modal) |

---

## Sizing per surface

Carbon's checkbox is fixed at 16 × 16 px regardless of `<DataTable size>`; the surrounding density only changes vertical padding and label text size. Lunaris inherits this — no checkbox-specific size axis.

| Argos surface              | Density | Square | Label text                                                |
| -------------------------- | ------- | ------ | --------------------------------------------------------- |
| ReportsView mission modal  | normal  | 16 px  | `body-compact-01`                                         |
| BluetoothPanel `.opt` pill | compact | 16 px  | `code-compact-01` (uppercase mono, hand-rolled by `.opt`) |
| Future settings panels     | normal  | 16 px  | `body-compact-01`                                         |

Touch-target compliance is achieved by the surrounding label / `.opt` pill — see `accessibility.md` for the WCAG 2.5.8 reasoning.

---

## What Argos does NOT inherit from Carbon

- **`bx--checkbox-wrapper--readonly`** — Argos has no read-only checkbox cases today; Carbon's read-only path stays available for free, but no overlay is authored.
- **Helper text rendering** (`bx--form__helper-text`) — only the ReportsView canary needs helper text, and that copy lives in the surrounding form layout. Carbon's `helperText` prop is exposed by the wrapper for future use.
- **Light variant** (`bx--checkbox-label--light`) — Argos is dark-mode only.

---

## State matrix

Per Carbon `checkbox/style.mdx` confirmed against source SCSS:

| State             | Border (Lunaris)                           | Fill (Lunaris)                          | Glyph color                            | Label color                        |
| ----------------- | ------------------------------------------ | --------------------------------------- | -------------------------------------- | ---------------------------------- |
| Default unchecked | `var(--ink-2)` 1 px                        | transparent                             | n/a                                    | `var(--ink-2)`                     |
| Hover             | `var(--ink)` 1 px                          | transparent                             | n/a                                    | `var(--ink-2)`                     |
| Focus (any)       | + 2 px ring `var(--accent)` outside square | unchanged                               | unchanged                              | unchanged                          |
| Checked           | `var(--ink)`                               | `var(--ink)`                            | `var(--bg)`                            | `var(--ink-2)`                     |
| Indeterminate     | `var(--ink)`                               | `var(--ink)`                            | dash `var(--bg)`                       | `var(--ink-2)`                     |
| Disabled          | `var(--ink-5)` 1 px                        | transparent or `var(--bg-1)` if checked | `var(--ink-5)`                         | `var(--ink-5)`                     |
| Invalid           | `var(--mk2-red)` 2 px                      | unchanged                               | unchanged                              | `var(--mk2-red)` for `invalidText` |
| Read-only         | `var(--ink-3)` dashed 1 px                 | transparent                             | n/a (read-only never displays a check) | `var(--ink-2)`                     |

---

## BluetoothPanel `.opt` pill — Lunaris-bespoke surface

The 4 BluetoothPanel checkboxes (`ALL CH`, `ACTIVE`, `GPS`, `CODED`) are rendered inside a `.opt` pill — a tactical filter chip with bordered rectangle, uppercase Geist Mono text, and active state coloring on `:checked`. This is Lunaris-specific and is NOT a Carbon checkbox visual — it's a Lunaris filter-chip skin layered on top of a real Carbon checkbox.

Migration approach:

1. Wrapper exposes `class` prop forwarding to Carbon's `bx--checkbox-wrapper` div.
2. BluetoothPanel passes `class="opt"`; existing `.opt` CSS (in `BluetoothPanel.svelte` `<style>` block) continues to apply.
3. Carbon's default checkbox visual is hidden by the `.opt` rule chain (`.opt input { display: none }` style hide) OR the `.opt` rule wraps the Carbon checkbox in a way that visually suppresses the default and renders chip styling instead.

Verification: chrome-devtools MCP screenshot pre-migration vs post-migration — must be pixel-identical for the BluetoothPanel filter row.

If the existing `.opt` CSS doesn't survive the Carbon DOM restructure, fall back to plan B — wrap each Carbon `<Checkbox>` in a Lunaris `<OptPill>` shell that handles the visual transformation. Decision deferred until first chrome-devtools probe in PR3c.

---

## Authority citations

- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/checkbox/_checkbox.scss` (15165 bytes)
- Carbon site mdx: `docs/carbon-website/src/pages/components/Checkbox/{usage,style,code,accessibility}.mdx`
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/Checkbox/Checkbox.svelte`
- Lunaris CSS custom properties: `src/app.css` (`:root` block)
- Theme overlay: `src/lib/styles/lunaris-carbon-theme.scss`
- Bespoke `.opt` chip CSS: `src/lib/components/dashboard/panels/BluetoothPanel.svelte` `<style>` block
