# Number Input — Accessibility

**Status:** Phase 3 PR3e — implementation in flight
**Last updated:** 2026-04-29
**Carbon mirror:** `docs/carbon-website/src/pages/components/NumberInput/accessibility.mdx`

---

## What Carbon provides for free

### Semantic structure

- Renders `<input type="number">` (or `type="text"` with `inputmode="decimal"` when `allowDecimal` is set) inside a `<div class="bx--number">` wrapper, paired with `<label for={id}>`.
- Stepper buttons rendered as `<button>` elements with `aria-label="Increment"` / `"Decrement"` (translatable via Carbon's `translateWithId` prop — Argos doesn't override).
- `id` defaults to `ccs-${random}` — auto-association.

### ARIA wiring (verified in Carbon source)

- **`aria-invalid`** set to `true` when `invalid && !readonly`.
- **`aria-describedby`** points to `helper-${id}` / `error-${id}` / `warn-${id}` based on which message is currently visible.
- **`required`** sets HTML attribute; AT auto-announces "required."
- **`disabled`** — HTML attribute; AT auto-announces "disabled" + browser removes from tab order.
- **`readonly`** — Carbon adds `aria-readonly="true"` + `EditOff` icon. Tab order preserved (different from disabled).
- **`min` / `max`** propagate to HTML `min` / `max` attributes; AT may announce "between -120 and 0."
- **`step`** propagates; affects keyboard arrow-key increment granularity + AT-announced step size.

### Keyboard interaction

- **Tab / Shift+Tab** — standard tab order.
- **Arrow Up / Arrow Down** — increments/decrements by `step` (browser-native behavior).
- **Page Up / Page Down** — increments/decrements by 10 × step (browser-native).
- **Home / End** — sets value to `min` / `max` if defined (browser-native).
- **Wheel scroll while focused** — increments/decrements by `step` (browser default; **Argos disables this via `disableWheel={true}` because it's a UX gotcha** — scrolling the page silently mutates form values).
- **Stepper button click** — increments/decrements by `step`. Buttons are independently focusable + activatable via Space/Enter when focused.
- **Focus visible** — Carbon's `focus-outline('outline')` mixin renders 2 px outline outside the input border, in `$focus`. Lunaris maps `$focus` → `var(--accent)`.

### Color contrast (Carbon's audit floor)

| Pair                              | Min contrast (AA) | Lunaris target                      | Status                                              |
| --------------------------------- | ----------------- | ----------------------------------- | --------------------------------------------------- |
| Input text on `$field` background | 4.5:1             | `var(--ink)` on `var(--bg-2)`       | ≈ 14.6:1 ✓                                          |
| Placeholder on `$field`           | 4.5:1             | `var(--ink-4)` on `var(--bg-2)`     | ≈ 3.9:1 ⚠ — same flag as TextInput, verify in PR3e |
| Stepper chevron on bg             | 3:1 (graphical)   | `var(--ink-2)` on `var(--bg-2)`     | ≈ 11.4:1 ✓                                          |
| Disabled border                   | 3:1 (graphical)   | `var(--ink-5)` on `var(--bg-1)`     | ≈ 1.7:1 ⚠ — expected for disabled                  |
| Focus outline                     | 3:1 (graphical)   | `var(--accent)` ≈ 7.4:1             | ✓                                                   |
| Invalid border                    | 3:1 (graphical)   | `var(--mk2-red)` on `var(--bg-2)`   | ≈ 4.8:1 ✓                                           |
| Warn border                       | 3:1 (graphical)   | `var(--mk2-amber)` on `var(--bg-2)` | ≈ 4.2:1 ✓                                           |

---

## Argos-specific a11y considerations

### Tap target compliance (WCAG 2.2 SC 2.5.8)

Stepper buttons are 18 × 20 px in Carbon's `md` size — **below 24 × 24 px AA threshold**. Mitigations:

- The number input itself is the primary tap target; stepper buttons are auxiliary (keyboard arrow-keys are the canonical alternative input method).
- For touch-first surfaces (none in current Argos scope, but flag for future tablet builds), set `hideSteppers={true}` and rely on direct text entry + on-screen keyboard.

| Surface                    | Stepper size | WCAG 2.5.8 (24 px) | Notes                              |
| -------------------------- | ------------ | ------------------ | ---------------------------------- |
| FilterBar RSSI floor       | hidden       | n/a                | `hideSteppers`                     |
| TakServerForm port         | hidden       | n/a                | `hideSteppers`                     |
| FrequencyTuner (3e-tier-2) | sm 16×16     | ⚠ marginal        | acceptable for desktop-only deploy |

### Wheel-scroll value-mutation guard

This is **the** classic numeric-input UX bug. Default browser behavior: focus a `<input type="number">`, scroll the page, the value changes silently. User has no idea why their port number became -47000.

**Argos guard: ALWAYS pass `disableWheel={true}` on numeric inputs.** Adapter doesn't default it (Carbon's default is "off" = wheel works) — but every consumer call-site must opt in. Add to migration checklist.

### Numeric type input mode (mobile)

Argos targets desktop browsers (RPi 5 + Jetson stations). Mobile keyboard hint is irrelevant for the primary deploy. But if/when tablet builds happen, `inputmode="numeric"` (no decimal) vs `inputmode="decimal"` (with decimal point) materially changes the on-screen keyboard. Carbon manages this automatically based on `allowDecimal`.

### Locale-aware decimal separators

User in Germany sees `1234,5` (comma decimal); user in US sees `1234.5`. With `locale="de-DE"`, Carbon parses input + displays accordingly. **Argos default = `en-US`** because tactical comms standards (NATO, military) use period decimal. Locale prop reserved for future internationalization without breaking existing consumers.

### Invalid state announcement timing

Carbon's `aria-describedby` switches between `helper-${id}` and `error-${id}` synchronously when `invalid` flips. AT announces on next focus event or AT polling cycle (~50ms typically).

For real-time validation (typed character triggers `invalid`), debounce client-side validation by ≥250ms to avoid AT-announcement thrash on each keystroke.

### Custom `validate` hook + AT compatibility

If consumer passes `validate: (raw, locale) => false`, Carbon sets `invalid` automatically and renders the trailing error icon + `invalidText`. AT users hear the same `aria-describedby` announcement as for built-in min/max validation.

---

## Verification checklist (PR3e)

| Check                                   | Tool                                  | Pass criterion                                                   |
| --------------------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| WCAG 2.1 AA on FilterBar route          | `@axe-core/playwright` (`AxeBuilder`) | `violations: []`                                                 |
| Label association                       | Playwright `<input>` aria audit       | All number inputs have linked `<label for>`                      |
| Tab order                               | Playwright keyboard nav               | Number input lands in expected tab order                         |
| Arrow keys increment/decrement          | Playwright keyboard test              | `await page.keyboard.press('ArrowUp')` increases value by `step` |
| Wheel-scroll guard                      | Playwright wheel event simulation     | Wheel on focused input does NOT change value                     |
| Min/max clamping                        | Playwright fill + assert              | Setting value below min triggers `invalid` state                 |
| Focus ring visible                      | manual + Playwright `:focus` check    | 2 px outline visible at all densities + accents                  |
| Stepper button visibility (per surface) | chrome-devtools MCP screenshot        | hideSteppers={true} → no chevron buttons rendered                |
| Color contrast (placeholder, border)    | chrome-devtools MCP + axe             | Placeholder ≥ 4.5:1, border ≥ 3:1                                |

---

## Authority citations

- Carbon NumberInput a11y mdx: `docs/carbon-website/src/pages/components/NumberInput/accessibility.mdx`
- Carbon NumberInput SCSS: `docs/carbon-design-system/packages/styles/scss/components/number-input/_number-input.scss`
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/NumberInput/NumberInput.svelte`
- WCAG 2.1: <https://www.w3.org/TR/WCAG21/>
- WCAG 2.2 SC 2.5.8 Target Size (Minimum): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- HTML number input MDN: <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number>
- HTML inputmode MDN: <https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode>
