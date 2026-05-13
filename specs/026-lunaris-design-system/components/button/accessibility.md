# Button — Accessibility

**Status:** Phase 1 in progress
**Last updated:** 2026-04-28
**Carbon mirror:** `docs/carbon-website/src/pages/components/button/accessibility.mdx`

---

## What Carbon provides for free

Per Carbon button accessibility patterns:

### Keyboard interaction

- **Activation**: `Space` or `Enter` triggers the button's click handler. Carbon attaches both event listeners.
- **Tab order**: standard browser tab traversal — buttons reachable in DOM order.
- **Disabled state**: Carbon sets `disabled` attribute; browser auto-skips disabled buttons in tab order; click events suppressed.
- **Focus visible**: 2px focus outline (`$focus` token). Lunaris maps to `var(--accent)` — visible against any background.

### Screen-reader semantics

- **`<button>` element** — semantic role inferred by all screen readers as "button".
- **`aria-label`** — when no visible text (icon-only buttons), Carbon's `iconDescription` prop drives `aria-label`. Mandatory per Carbon — without it, button is announced as "button" with no purpose context.
- **`aria-pressed`** — for toggle buttons (Carbon `<Toggle>` is preferred for pure toggle UX, but `<Button kind="...">` with manual `aria-pressed` is supported for compound buttons).
- **`aria-disabled` vs `disabled`**: Carbon uses `disabled` (HTML attribute) which is preferred — fully removes from interactive flow. `aria-disabled="true"` only used when the button must remain focusable but unactionable (rare).
- **Loading state announcement**: when `<Button skeleton>` or async pending, Carbon dispatches a polite live-region message ("Loading…") via the visually-hidden span pattern.

### Color contrast

Lunaris token overrides MUST preserve Carbon's WCAG 2.1 AA ratios:

| Pair                                                      | Min contrast (AA)                                     | Lunaris target                                                | Status                         |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- | ------------------------------ |
| Primary button text on accent background                  | 4.5:1                                                 | `var(--bg)` (oklch 13%) on `var(--amber)` (oklch 80%) ≈ 8.2:1 | ✓ exceeds AA                   |
| Primary button text on accent (cyan variant)              | 4.5:1                                                 | `var(--bg)` on `var(--cyan)` (oklch 78%) ≈ 7.8:1              | ✓                              |
| Primary button text on accent (red variant — danger kind) | 4.5:1                                                 | `var(--bg)` on `var(--red)` (oklch 65%) ≈ 4.6:1               | ✓ marginal — verify in Phase 1 |
| Ghost button text on default background                   | 4.5:1                                                 | `var(--ink)` (oklch 94%) on `var(--bg)` (oklch 13%) ≈ 17.4:1  | ✓ exceeds AAA                  |
| Disabled button text on background                        | 3:1 (Disabled exempt from AA, but 3:1 is recommended) | `var(--ink-4)` (oklch 42%) on `var(--bg)` (oklch 13%) ≈ 4.0:1 | ✓                              |
| Focus outline on focused button                           | 3:1 (graphical)                                       | `var(--accent)` ≈ 7.4:1 vs background                         | ✓                              |

Verification in Phase 1: run Carbon's `axe-core` integration test on a sample page with all button variants rendered.

---

## Argos-specific a11y considerations

### Tap target compliance (WCAG 2.5.5)

WCAG 2.5.5 (AA) requires interactive targets ≥24×24 CSS pixels. Argos defaults to 26-28px ✓ (passes). The `compact` density variant drops to 22px which is **below WCAG 2.5.5** — this is intentional for the desktop-mouse + keyboard primary-input tactical UI. Consequences:

- **Desktop deployment**: acceptable. Mouse precision + keyboard navigation are primary input modes. Touch is secondary.
- **Future tablet deployment**: would require `comfy` density forced for touch users, OR a tap-target media query expanding all buttons to 32×32 minimum.
- **A11y audit (Phase 7)**: flag this as a known deviation; document the deployment-context justification.

### Icon-only button labels

Bespoke `IconBtn.svelte` accepts a `title` prop (HTML title attribute → tooltip + screen-reader fallback). Carbon's `<Button iconOnly>` uses `iconDescription` (a more rigorous prop name, drives `aria-label`).

**Migration rule**: `IconBtn`'s `title` prop maps to Carbon's `iconDescription`. Consumers don't change; the Argos wrapper performs the mapping. **Both must be present** — without `iconDescription`, screen readers announce "button" with no context.

### High-contrast mode

Carbon ships `high-contrast-mode` SCSS utility (per `_button.scss` import line). Honors Windows High Contrast / `prefers-contrast: more` media query.

Lunaris's oklch palette already provides high contrast for the default theme. Carbon's high-contrast adjustments may add additional border emphasis when the OS-level setting is on — Argos inherits this for free.

### Focus management in modals (forward-looking)

Phase 4 (Modal + Notification + Tooltip) will introduce focus-trap requirements. Carbon's `<Modal>` handles focus trap + restoration automatically; Argos's bespoke modals will inherit when migrated. Phase 1 (Buttons) just needs to ensure `IconBtn` works correctly INSIDE Carbon's eventual modal — confirmed: `iconOnly` Buttons have correct focus handling within modal containers per Carbon's ButtonSet patterns.

---

## Argos extensions to verify (Phase 1)

### `data-density` attribute responsiveness

The user-switchable density (`compact / default / comfy`) changes button heights via Lunaris CSS custom properties. Carbon's `<Button>` uses `size` prop. The theme overlay must:

1. Define density-aware button heights via `--cds-button-size-*` overrides
2. Confirm that switching density at runtime updates rendered buttons (no SSR vs CSR mismatch)
3. Verify focus rings scale with density (smaller buttons = thinner ring proportional? or constant 2px?)

Phase 1 verify: chrome-devtools MCP probe each density variant + measure computed button height + verify focus ring visible at all 3 densities.

### `data-accent` color switching

Argos's `data-accent="amber|green|cyan|magenta"` switches `var(--accent)` at runtime. Carbon's `$button-primary` derives from `$focus` which we map to `var(--accent)`. Switching accent runtime should re-render Carbon primary/danger buttons in the new color — verify in Phase 1.

---

## Verification checklist (Phase 1 + Phase 7)

| Check                            | Tool                   | Pass criterion                                               |
| -------------------------------- | ---------------------- | ------------------------------------------------------------ |
| Keyboard activation              | manual + Playwright    | Tab to button, Space + Enter both trigger handler            |
| Focus visible                    | manual + Playwright    | 2px ring visible on every kind                               |
| Disabled state                   | manual + Playwright    | Tab skips disabled buttons; click suppressed                 |
| Color contrast                   | `axe-core` integration | Zero WCAG 2.1 AA violations across all kinds × densities     |
| Icon-only screen-reader announce | NVDA + VoiceOver       | `aria-label` from `iconDescription` announces purpose        |
| Density responsiveness           | chrome-devtools MCP    | Computed button height matches `--row-h` for current density |
| Accent color switching           | chrome-devtools MCP    | `data-accent` change re-renders primary buttons in new color |

Phase 7 includes the full WCAG 2.1 AA audit including buttons via Carbon's `axe-core` integration.

---

## Authority citations

- Carbon button a11y mdx: `docs/carbon-website/src/pages/components/button/accessibility.mdx`
- Carbon button SCSS: `docs/carbon-design-system/packages/styles/scss/components/button/_button.scss`
- WCAG 2.1 spec: <https://www.w3.org/TR/WCAG21/>
- WCAG 2.5.5 tap target size: <https://www.w3.org/WAI/WCAG21/Understanding/target-size.html>
- ARIA button practices: <https://www.w3.org/WAI/ARIA/apg/patterns/button/>
