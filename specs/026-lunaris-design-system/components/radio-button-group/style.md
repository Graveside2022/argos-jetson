# Radio Button Group — Style

**Status:** Phase 3 PR3d — implementation in flight
**Last updated:** 2026-04-29
**Authority precedence:** Carbon source SCSS > Carbon site mdx > Lunaris CSS overlay

---

## Canonical anatomy citations

From `docs/carbon-design-system/packages/styles/scss/components/radio-button/_radio-button.scss`:

```scss
.#{$prefix}--radio-button-group {
	@include reset;
	position: relative;
	display: flex;
	align-items: center;
}

.#{$prefix}--radio-button-group--vertical {
	flex-direction: column;
	align-items: flex-start;
}
```

Group structure:

- **`<fieldset class="bx--form-item bx--radio-button-group">`** wraps all children — semantic HTML grouping.
- **`<legend class="bx--label">`** provides the group's accessible name (visible by default, can be hidden via `hideLegend` while still readable by AT).
- **Default orientation: horizontal** — flex row, children laid out left-to-right with their default labels right-of-circle.
- **Vertical orientation** flips to flex column with `align-items: flex-start`. Children stack vertically with `margin-block-end: $spacing-03` between them.
- **`hideLegend`** applies the `bx--visually-hidden` utility — legend renders off-screen (1×1 px) but stays in the tab/AT model.
- **`helperText`** renders as `.bx--form__helper-text` below the entire group.

---

## Lunaris token map

| Carbon token                       | Lunaris value                             | Notes                                                      |
| ---------------------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| `$text-primary` (legend)           | `var(--ink-2)`                            | Slightly muted; group title not as prominent as headings   |
| `$text-secondary` (helper text)    | `var(--ink-3)`                            | More muted than legend                                     |
| `$text-on-color` (legend disabled) | `var(--ink-5)`                            | Reduced contrast when entire group disabled                |
| `$support-error` (invalid)         | `var(--mk2-red)`                          | When `required` and unselected, applied to legend + helper |
| `body-compact-01` (helper type)    | `var(--mk2-fs-3) / 1.4 var(--mk2-f-mono)` | Same data-type baseline as RadioButton labels              |

---

## Layout per surface

| Argos surface          | Orientation | hideLegend | Spacing between children                      |
| ---------------------- | ----------- | ---------- | --------------------------------------------- |
| TakAuthMethodPicker    | horizontal  | true       | `gap: var(--mk2-sp-3)` (~12 px) for chip-skin |
| Future settings panels | vertical    | false      | `$spacing-03` (Carbon default, ~8 px)         |

For TakAuthMethodPicker specifically: the legend is hidden because the surrounding form already labels the group ("Authentication method" is the section heading above), so the Carbon `<legend>` would be redundant visible chrome. AT users still get the legend semantics.

---

## State matrix (group-level)

| State            | Legend color                       | Helper text color            | Container border                                  |
| ---------------- | ---------------------------------- | ---------------------------- | ------------------------------------------------- |
| Default          | `var(--ink-2)`                     | `var(--ink-3)`               | none (transparent fieldset)                       |
| Disabled (all)   | `var(--ink-5)`                     | `var(--ink-5)`               | none                                              |
| Required + unsel | inherits default until form-submit | shows error from invalidText | optional 1 px `var(--mk2-red)` border on fieldset |

Individual RadioButton states (focus, checked, hover, disabled) covered in `radio-button/style.md`.

---

## TakAuthMethodPicker chip-row layout

The 2-RadioButton chip pair is rendered horizontally with the existing `.chip-row` flex container in `TakAuthMethodPicker.svelte`. Migration decision tree:

1. **If `.chip-row` already wraps the radios:** no layout change needed; `<RadioButtonGroup>` becomes the new wrapper rendered as `<fieldset class="bx--radio-button-group">` and inherits `.chip-row`'s flex via `class="chip-row"`.
2. **If layout breaks under Carbon's default flex:** add `class="chip-row"` to the wrapper and ensure `.chip-row { gap: 12px }` overrides Carbon's child margin.
3. **If `<legend>` appears unexpectedly visible:** confirm `hideLegend={true}` is passed.

Verification: chrome-devtools MCP screenshot pre/post — must match within font-rendering ε.

---

## What Argos does NOT inherit from Carbon

- **Inline error rendering at fieldset level** — Argos renders form errors via the surrounding form-row layout; the wrapper does not add a `<div class="form-error">` automatically.
- **Floating-label pattern** — Carbon does not use floating labels for radio groups; Argos doesn't either.
- **Light theme variant** — dark mode only.

---

## Authority citations

- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/radio-button/_radio-button.scss` (group rules in same file as individual radio)
- Carbon site mdx: `docs/carbon-website/src/pages/components/RadioButtonGroup/{usage,style,code,accessibility}.mdx`
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/RadioButtonGroup/RadioButtonGroup.svelte`
- Lunaris CSS custom properties: `src/app.css`
- Theme overlay: `src/lib/styles/lunaris-carbon-theme.scss`
