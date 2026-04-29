# Radio Button — Accessibility

**Status:** Phase 3 PR3d — implementation in flight
**Last updated:** 2026-04-29
**Carbon mirror:** `docs/carbon-website/src/pages/components/RadioButton/accessibility.mdx`

---

## What Carbon provides for free

### Semantic structure

- Renders a real `<input type="radio" id={id} name={...}>` paired with `<label for={id}>`. Native radio button semantics — AT announces "radio button, [labelText], [selected|not selected], [N of M]" when inside a group with proper `<fieldset>`/`<legend>`.
- The visible circle + dot is CSS-only (`::before` pseudo-element on the label). Native `<input>` is `visually-hidden` (off-screen at 1×1 px, screen-reader accessible).
- `id` defaults to `ccs-${random}` so consumers can't accidentally produce duplicate `id`s. Auto-association of label to input via `for={id}`.

### ARIA wiring (verified in Carbon source)

- **`aria-checked`** is NOT explicitly set on the `<input>` — native `<input type="radio">` state is authoritative. Browser exposes "checked" state via the IDL property; AT reads it natively.
- **`aria-invalid`** is NOT exposed on individual RadioButton (Carbon validates at group level via RadioButtonGroup's `required`).
- **`required`** sets the HTML attribute on the `<input>`; AT auto-announces "required."
- **`disabled`** — HTML attribute; AT auto-announces "disabled" + browser removes from tab order.
- **No `readonly`** — HTML radios don't natively support `readonly` (the spec ignores it). Carbon doesn't expose a `readonly` prop.

### Keyboard interaction (this is the BIG difference from Checkbox)

- **Tab / Shift+Tab** — moves into the FIRST radio of a group, or onto the currently-selected radio if any is selected. Tab again exits the entire group.
- **Arrow keys (Up / Down / Left / Right)** — within a group, cycle selection between siblings. **Selection follows focus** (this is the standard radio idiom — browser auto-selects whichever radio receives focus via arrows; user does NOT need to press Space).
- **Space** — does NOT toggle (radio buttons are exclusive — there's nothing to "toggle"). Pressing Space on an already-selected radio is a no-op.
- **Enter** — submits the enclosing `<form>` if any.
- **Focus visible** — Carbon renders 2 px outline outside the 16 px circle in `$focus` color. Lunaris maps `$focus` → `var(--accent)`.

### Color contrast (Carbon's audit floor)

| Pair                                          | Min contrast (AA) | Lunaris target                                          | Status                                                               |
| --------------------------------------------- | ----------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| Border (`$icon-primary`) on `--bg-2`          | 3:1 (graphical)   | `var(--ink-2)` (oklch 88%) on `var(--bg-2)` (oklch 17%) | ≈ 11.4:1 ✓                                                           |
| Dot fill (`$icon-primary`) on circle interior | 3:1 (graphical)   | `var(--ink)` on transparent (over `--bg-2`)             | ≈ 14.6:1 ✓                                                           |
| Label text on page background                 | 4.5:1             | `var(--ink-2)` on `var(--bg)` / `var(--bg-2)`           | ≈ 13.0:1 ✓                                                           |
| Disabled border / dot                         | 3:1 (graphical)   | `var(--ink-5)` (oklch 32%) on `var(--bg-2)`             | ≈ 1.7:1 ⚠ — **expected for disabled, AT auto-announces "disabled"** |
| Focus outline (`$focus`) on any background    | 3:1 (graphical)   | `var(--accent)` ≈ 7.4:1 vs `--bg` and `--bg-2`          | ✓                                                                    |

**No amber flags.** Same outcome as Checkbox audit (Phase 3c) — Lunaris token overlay preserves Carbon's WCAG 2.1 AA conformance.

---

## Argos-specific a11y considerations

### Tap target compliance (WCAG 2.2 SC 2.5.8)

The 16 × 16 px Carbon radio circle is below the 24 × 24 px AA threshold. Compliance achieved via the surrounding `<label>` (Carbon's standard rendering — full label row clickable):

| Surface                          | Circle | Label / chip height | Effective tap target         | WCAG 2.5.8 (24 px) |
| -------------------------------- | ------ | ------------------- | ---------------------------- | ------------------ |
| TakAuthMethodPicker `.chip` skin | 16 px  | ≈ 32 px (chip pad)  | full chip pill, ~120 × 36 px | ✓ pass             |

WCAG 2.1 SC 2.5.5 (44 × 44 px AAA) is **not** satisfied at any density — same Argos-wide deviation documented for Checkbox in Phase 3c. Phase 7 audit notes this.

### Label requirement enforcement

Bespoke Argos radios in `TakAuthMethodPicker` use `<label class="chip">` wrapping `<input class="sr-only">` + visible `<span>`. Migration drops the parent `<label>` (Carbon owns label rendering) and:

- Passes the visible-text label via Carbon's `labelText="Import"` / `"Enroll"`.
- Adds `hideLabel={true}` because the visible text rendered by the `.chip` styling is what the user sees; Carbon's default label `<span>` is suppressed.
- Drops the `class="sr-only"` on the input — Carbon visually-hides the input itself via the `visually-hidden` mixin.

### `bind:group` → `bind:selected` migration

Native Svelte `bind:group={config.authMethod}` on each `<input>` synchronizes a single value across siblings (browser-enforced via shared `name`). Carbon's idiom is equivalent at the surface but with different machinery:

- `<RadioButtonGroup bind:selected={config.authMethod}>` exposes a writable store via context (`getContext("carbon:RadioButtonGroup")`).
- Each child `<RadioButton value={X} />` reads the store and sets its own `checked` state via `$selectedValue === value`.
- User clicks a child → store updates → all children re-derive their `checked` reactively → `selected` two-way binds back to consumer.

Net consumer-side experience identical (`bind:selected` reads/writes the same string). AT-side experience improved (fieldset/legend semantics).

### Group-level invalid state

Single RadioButton has no `invalid` prop (verified in `.svelte.d.ts`). Group-level invalid is exposed on `<RadioButtonGroup>` via `required` plus an external error message rendered conditionally. PR3d migration doesn't need this (auth method is always valid; one of two values is always selected).

---

## Verification checklist (PR3d)

| Check                                    | Tool                                  | Pass criterion                                                                 |
| ---------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| WCAG 2.1 AA on TakAuthMethodPicker route | `@axe-core/playwright` (`AxeBuilder`) | `violations: []` with `wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice` tags |
| Label association                        | Playwright `<input>` aria audit       | All radios have linked `<label for>`                                           |
| Tab order                                | Playwright keyboard nav               | Tab enters group, arrow keys cycle, Tab exits                                  |
| Arrow-key selection                      | Playwright keyboard test              | `await page.keyboard.press('ArrowDown')` advances selection within group       |
| Focus ring visible at all themes         | manual + Playwright `:focus` check    | 2 px outline visible at all `data-accent` values                               |
| Color contrast (border, focus)           | chrome-devtools MCP + axe             | Border ≥ 3:1, focus ≥ 3:1                                                      |
| Chip pixel diff (TakAuthMethodPicker)    | chrome-devtools MCP screenshot        | Pre/post pixel-near-identical (font-rendering ε allowed)                       |
| Click anywhere on chip toggles           | Playwright click on chip text         | Selection updates; non-current chip becomes selected                           |

---

## Authority citations

- Carbon RadioButton a11y mdx: `docs/carbon-website/src/pages/components/RadioButton/accessibility.mdx`
- Carbon RadioButton SCSS: `docs/carbon-design-system/packages/styles/scss/components/radio-button/_radio-button.scss`
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/RadioButton/RadioButton.svelte`
- WCAG 2.1: <https://www.w3.org/TR/WCAG21/>
- WCAG 2.2 SC 2.5.8 Target Size (Minimum): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- ARIA Authoring Practices for radio group: <https://www.w3.org/WAI/ARIA/apg/patterns/radio/>
- axe-core rule reference: <https://dequeuniversity.com/rules/axe/4.9/>
