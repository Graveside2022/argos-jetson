# Button — Style

**Status:** Phase 1 in progress
**Last updated:** 2026-04-28
**Authority precedence:** Carbon source SCSS > Carbon site mdx > v2 mockup CSS

---

## Canonical button-kind matrix

| `kind`                | Carbon token surface                                                              | Lunaris adoption (theme overlay)                                                        | v2 mockup analog                         |
| --------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| `primary`             | `$button-primary` (background), `$button-primary-hover`, `$button-primary-active` | `var(--accent)` background, `var(--bg)` text on accent, hover deepens by ~10%           | not used; reserved for future CTAs       |
| `secondary`           | `$button-secondary` (lighter than primary), `$button-secondary-hover`             | `var(--bg-2)` background, `var(--ink)` text                                             | toolbar buttons (filter, settings)       |
| `tertiary`            | `$button-tertiary` (border-only)                                                  | `1px solid var(--accent)`, transparent background, `var(--accent)` text; fills on hover | tab-strip secondary actions              |
| `ghost`               | `$button-ghost-hover` (no border, no background, hover-only affordance)           | transparent; hover = `var(--bg-2)` background; no border                                | `.icon-btn` (v2 mockup) base style       |
| `danger`              | `$support-error-inverse`, `$button-danger-primary`, `$button-danger-hover`        | `var(--red)` background variant                                                         | reserved (Stop scan, Disconnect)         |
| `iconOnly` (modifier) | square padding, single icon child, optional `aria-label`                          | 28px square (default density); 18px inside `.panel-actions`                             | `.icon-btn` `width: 28px; height: 28px;` |

**Citations:**

- Carbon: `docs/carbon-design-system/packages/styles/scss/components/button/_button.scss`
- Carbon tokens: `docs/carbon-design-system/packages/styles/scss/components/button/_tokens.scss`
- v2 mockup IconBtn CSS: `docs/argos-v2-mockup/styles.css` (`.icon-btn` + `.panel-actions .icon-btn` rules)

---

## Sizing matrix

Carbon ships `sm` (32px), `md` (40px, default), `lg` (48px), `xl` (64px), `2xl` (80px). **Argos overrides Carbon's button heights via theme tokens** for tactical density:

| Argos density | Argos button height | Carbon mapping (`size` prop)                    | Tap target compliance                                    |
| ------------- | ------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| `compact`     | 22px                | `sm` (32 → 22 via `--cds-button-size-sm: 22px`) | Below WCAG 2.5.5 minimum (24×24); justified for desktop  |
| _default_     | 26-28px             | `sm` (32 → 26 / 28)                             | Borderline; meets WCAG 2.5.5 for `--row-h: 26px` exactly |
| `comfy`       | 30-32px             | `md` (40 → 30 / 32)                             | WCAG 2.5.5 compliant                                     |

`<Button>` `size` prop maps via theme tokens; consumer code stays idiomatic Carbon.

---

## Focus, hover, active states

Per Carbon `_button.scss`:

- **Focus**: `2px solid $focus` outline, offset by 1px. Lunaris maps `$focus` → `var(--accent)`. Default amber, user-switchable via `data-accent`.
- **Hover**: `$button-{kind}-hover` token darkens / lightens by ~10% per kind. Lunaris uses `color-mix(in oklch, ...)` to derive hover variants from base accent.
- **Active**: `$button-{kind}-active` further darkens. Lunaris maps similarly.
- **Disabled**: `$button-disabled` (50% opacity); Lunaris uses `var(--ink-4)` with `cursor: not-allowed`.
- **Skeleton**: Carbon's loading state. Carbon supplies `<ButtonSkeleton>` directly.

---

## Icon-only buttons (`<Button iconOnly>`)

Per Carbon's button code: `iconOnly` removes label padding and centers a single icon child. Carbon enforces `aria-label` for a11y.

**Lunaris IconBtn migration mapping**:

```svelte
<!-- Bespoke IconBtn (current) -->
<button class="icon-btn" {title} on:click={onClick}>
	<Icon {name} size={12} />
</button>

<!-- Carbon equivalent (Phase 1 target) -->
<Button kind="ghost" iconOnly tooltipPosition="top" iconDescription={title} on:click={onClick}>
	<Icon {name} size={12} />
</Button>
```

`iconDescription` provides `aria-label` automatically. Tooltip positioning matches Carbon's overlay system. Consumer-side change is one-line.

---

## What Argos does NOT inherit from Carbon

These Carbon defaults are intentionally overridden:

- **Heading typography** — Carbon defaults to `body-compact-01` (Plex Sans). Lunaris uses Geist + `0.04em letter-spacing` via theme override of `$body-font-family` + custom button-text mixin.
- **Default `size: lg`** — Argos defaults to `sm` (denser, tactical UI).
- **Border-radius** — Carbon defaults to `0` (sharp corners) which matches Lunaris `--r-0: 0px`. **Inherited as-is**, no override needed. (This was a coincidence-of-design between IBM enterprise + military-tactical aesthetics.)
- **`<ButtonSet>` fluid layout container queries** — not used in Argos drawer chrome; reserved for future modal/dialog button rows.

---

## Color tokens (theme overlay file additions)

Phase 1 will add to `src/lib/styles/lunaris-carbon-theme.scss`:

```scss
@use '@carbon/styles/scss/components/button' with (
	$button-primary: var(--accent),
	$button-primary-hover: color-mix(in oklch, var(--accent) 90%, var(--bg)),
	$button-primary-active: color-mix(in oklch, var(--accent) 80%, var(--bg)),
	$button-secondary: var(--bg-2),
	$button-secondary-hover: var(--bg-3),
	$button-tertiary: transparent,
	$button-tertiary-active: var(--accent),
	$button-ghost-hover: var(--bg-2),
	$button-danger-primary: var(--red),
	$button-disabled: var(--ink-4)
);
```

Plus `$body-font-family: ('Geist', ui-sans-serif, system-ui, sans-serif)` global override.

---

## Authority citations

- Carbon SCSS: `docs/carbon-design-system/packages/styles/scss/components/button/` (entire dir)
- Carbon usage mdx: `docs/carbon-website/src/pages/components/button/usage.mdx`
- v2 mockup CSS: `docs/argos-v2-mockup/styles.css` (`.icon-btn` rules)
- v2 mockup primitives: `docs/argos-v2-mockup/src/primitives.jsx` lines 21-23
- WCAG 2.5.5 tap target: <https://www.w3.org/WAI/WCAG21/Understanding/target-size.html>
