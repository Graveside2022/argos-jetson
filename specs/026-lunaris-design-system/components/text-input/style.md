# Text Input — Style

**Status:** Phase 3 prep (drafted during Phase 2 PR review)
**Last updated:** 2026-04-29
**Authority precedence:** Carbon source SCSS > Carbon site mdx > v2 mockup CSS

---

## Canonical anatomy citations

Verbatim from `docs/carbon-design-system/packages/styles/scss/components/text-input/_text-input.scss`:

```scss
.#{$prefix}--text-input {
	@include layout.use('size', $default: 'md', $min: 'xs', $max: 'lg');
	@include layout.use('density', $default: 'normal');
	@include component-reset.reset;
	@include type-style('body-compact-01');
	@include focus-outline('reset');

	padding: 0 layout.density('padding-inline');
	border: none;
	background-color: $field;
	block-size: layout.size('height');
	border-block-end: 1px solid $border-strong;
	color: $text-primary;
	font-family: inherit;
	inline-size: 100%;
	transition:
		background-color $duration-fast-01 motion(standard, productive),
		outline $duration-fast-01 motion(standard, productive);

	&:focus,
	&:active {
		@include focus-outline('outline');
	}
}
```

Key shape:

- **Bottom-only border** (`border-block-end`), no full-rectangle outline. Carbon design language for inputs.
- **Filled background** (`$field`) — distinguishes input from page bg.
- **Type-style:** `body-compact-01` — denser than default body type.
- **Sizes:** xs (24px) / sm (32px) / **md (40px default)** / lg (48px) via `layout.size('height')`.
- **Focus:** outline applied via `focus-outline('outline')` mixin — colored ring outside the border.

---

## Lunaris token map

| Carbon token                      | Lunaris value                             | Notes                                                                |
| --------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `$field` (background)             | `var(--bg-2)`                             | Subtle layered depth on `--background`                               |
| `$border-strong` (bottom border)  | `var(--line)`                             | 1px solid divider                                                    |
| `$text-primary` (input text)      | `var(--ink)`                              | Full-strength ink (input is editable, not muted)                     |
| `$text-placeholder`               | `var(--ink-4)`                            | Most-muted ink                                                       |
| `$focus` (focus ring)             | `var(--accent)`                           | 2px outline, switchable per-theme via `data-accent`                  |
| `$support-error` (invalid border) | `var(--mk2-red)`                          | High-vis #FF5C33                                                     |
| `body-compact-01` type-style      | `var(--mk2-fs-3) / 1.4 var(--mk2-f-mono)` | Geist Mono for data inputs (MAC, freq); Geist sans for prose (notes) |

---

## Sizing per surface

| Argos surface                      | Density | Carbon size | `--row-h` analog                     |
| ---------------------------------- | ------- | ----------- | ------------------------------------ |
| Drawer-tab filter (Logs/Wifi/etc.) | compact | xs (24px)   | matches `<DataTable size="compact">` |
| Tools flyout filter                | compact | xs (24px)   | matches drawer rhythm                |
| Filter bar                         | compact | sm (32px)   | slight breathing room above density  |
| Settings screen forms              | normal  | md (40px)   | Carbon default                       |
| Modal forms (rare)                 | normal  | md (40px)   | Carbon default                       |

User-switchable via `data-density` attribute on app root, mapped through `lunaris-carbon-theme.scss` into Carbon's `--cds-text-input-height-*` tokens.

---

## What Argos does NOT inherit from Carbon

- **Inline padding token** — Argos uses fixed `12px` horizontal padding for drawer-tab inputs to match `<DataTable>` cell padding. Override via `:global(.lunaris-text-input .bx--text-input) { padding-inline: 12px; }`.
- **Body type-style font family** — Carbon's `body-compact-01` defaults to IBM Plex Sans. Lunaris substitutes Geist for sans contexts and Geist Mono for data-input contexts (MAC, freq, RSSI, callsign).
- **Light variant** (`bx--text-input--light`) — Argos is dark-mode-only; the Lunaris theme overlay forces dark.

---

## Hover, focus, invalid states

Per Carbon `text-input/style.mdx`:

- **Hover:** background lightens by one layer step. Lunaris: `var(--bg-3)` (one notch up from `--bg-2`).
- **Focus:** 2px outline at `$focus` color, sits OUTSIDE the field. Lunaris: 2px `var(--accent)`.
- **Invalid:** bottom border becomes 2px `$support-error`; trailing error icon. Lunaris: 2px `var(--mk2-red)` + `lucide:alert-circle` 12px in red.
- **Disabled:** field bg → `$layer-disabled`, text → `$text-disabled`. Lunaris: `var(--bg-1)` + `var(--ink-5)`.

---

## Authority citations

- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/text-input/_text-input.scss`
- Carbon site mdx: `docs/carbon-website/src/pages/components/text-input/{usage,style,code,accessibility}.mdx`
- v2 mockup: tactical-density inputs in `docs/argos-v2-mockup/src/forms/*.jsx` (TBD inventory during Phase 3 kickoff)
- Lunaris CSS custom properties: `src/app.css` (`:root` block)
- Theme overlay: `src/lib/styles/lunaris-carbon-theme.scss`
