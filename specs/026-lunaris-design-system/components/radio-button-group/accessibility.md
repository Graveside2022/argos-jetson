# Radio Button Group — Accessibility

**Status:** Phase 3 PR3d — implementation in flight
**Last updated:** 2026-04-29
**Carbon mirror:** `docs/carbon-website/src/pages/components/RadioButtonGroup/accessibility.mdx`

---

## What Carbon provides for free

### Semantic structure

- Renders a `<fieldset class="bx--form-item bx--radio-button-group">` wrapping the entire group.
- `<legend class="bx--label">` provides the group's accessible name. AT announces "[legendText], radio group, [N of M selected]" on focus entry.
- `legendChildren` slot accepts custom legend content (icon + text, etc.). Default uses plain `legendText` string.
- `hideLegend` applies `bx--visually-hidden` to the legend — keeps it in the AT model, removes from visual layout.
- `helperText` renders as `<div class="bx--form__helper-text" id="helper-${id}">` below the group, linked to children via `aria-describedby`.

### ARIA wiring (verified in Carbon source)

- **`<fieldset>` + `<legend>`** is the WAI-ARIA-recommended grouping pattern for radio buttons. Better than `role="radiogroup"` + `aria-labelledby` because it leverages native HTML semantics.
- **`required`** sets the HTML attribute on `<fieldset>`; HTML form validation enforces "at least one radio selected" on submit. AT announces "required" on group focus.
- **`disabled`** on group — all child inputs inherit disabled via CSS + JS context propagation.
- **`name`** propagates to all children's `<input name>` — enables `FormData` reads and shared HTML group semantics.

### Keyboard interaction

- **Tab** — moves into the FIRST radio of the group (or the currently-selected one if any). Tab exits to next focusable element OUTSIDE the group.
- **Arrow keys (Up / Down / Left / Right)** — cycle selection within the group. Selection follows focus per WAI-ARIA radio pattern (different from Listbox where focus and selection can decouple).
- **Home / End** — jump to first / last radio in the group (Carbon implements these per WAI-ARIA APG).
- **Space** — no-op on already-selected radio; selects on unselected.
- **Enter** — submits enclosing form if any.

### Color contrast (Carbon's audit floor)

| Pair                                             | Min contrast (AA) | Lunaris target                                | Status                             |
| ------------------------------------------------ | ----------------- | --------------------------------------------- | ---------------------------------- |
| Legend (`$text-primary`) on page bg              | 4.5:1             | `var(--ink-2)` on `var(--bg)` / `var(--bg-2)` | ≈ 13.0:1 ✓                         |
| Helper text on page bg                           | 4.5:1             | `var(--ink-3)` on `var(--bg)`                 | ≈ 6.4:1 ✓                          |
| Disabled legend                                  | n/a (informative) | `var(--ink-5)` on `var(--bg)`                 | low — AT auto-announces "disabled" |
| Invalid legend (when group has invalid prop set) | 4.5:1             | `var(--mk2-red)` on `var(--bg)`               | ≈ 4.8:1 ✓                          |

Individual radio contrast pairs covered in `radio-button/accessibility.md` § "Color contrast."

---

## Argos-specific a11y considerations

### Tap target compliance (WCAG 2.2 SC 2.5.8)

Group-level tap targets are governed by individual radio + label sizes — see `radio-button/accessibility.md` § "Tap target compliance." Group itself is a `<fieldset>` (no tap target).

### Legend requirement enforcement

Bespoke Argos auth-method picker had NO accessible group label — the surrounding form section's `<h2>` provided ambient context but no programmatic group-name link. WCAG 2.1 SC 1.3.1 (Info and Relationships) requires the radio group be programmatically grouped; the bespoke pattern was technically a violation per axe-core.

Migration FIXES this: `<RadioButtonGroup legendText="Authentication method" hideLegend>` provides programmatic grouping (`<fieldset>` + `<legend>`) without changing visual layout (legend hidden via `bx--visually-hidden`). AT users now hear "Authentication method, radio group, 2 options" on focus entry; sighted users see no change.

### `bind:group` → `bind:selected` migration semantics

Conceptually identical to user; mechanically different inside:

| Pre-migration                           | Post-migration                                             |
| --------------------------------------- | ---------------------------------------------------------- |
| `bind:group` on each `<input>`          | `bind:selected` on the wrapper                             |
| Browser-enforced via shared `name`      | Svelte-store-driven via Carbon context                     |
| AT announces individual radios only     | AT announces group + radios with N-of-M positional info    |
| No legend → ambient `<h2>` is the title | Programmatic `<legend>` (visible or hidden) ties the group |

### Group-level `required`

If/when used: `required` on the group prevents form submission with no radio selected. Browser shows validation tooltip on the first child input. AT announces "required" on group focus.

PR3d does NOT set `required` on TakAuthMethodPicker's group (auth method is always selected — one of two values is always on; the form does not initialize with both unselected).

### Required interaction in tactical UI

Tactical use case: GSM-evil scan-mode picker (FUTURE migration in Phase 6 maybe) — operator MUST pick "active" or "passive" before scanning starts. That surface should set `required` + render `helperText="Required: choose scan mode"`. PR3d sets the pattern; future migration implements it.

---

## Verification checklist (PR3d)

| Check                                    | Tool                                | Pass criterion                                                                                     |
| ---------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| WCAG 2.1 AA on TakAuthMethodPicker route | `@axe-core/playwright`              | `violations: []` (especially: programmatic grouping satisfied — was previously failing implicitly) |
| `<fieldset>` + `<legend>` semantic test  | Playwright DOM query                | `await page.locator('fieldset > legend').textContent()` === "Authentication method"                |
| Tab enters first/selected radio          | Playwright keyboard nav             | Tab from preceding focusable lands on the first/selected radio                                     |
| Arrow keys cycle within group            | Playwright keyboard test            | ArrowDown / ArrowRight advances; ArrowUp / ArrowLeft retreats                                      |
| Tab exits group                          | Playwright keyboard nav             | Tab from any radio in group goes to the NEXT focusable (button) outside group                      |
| `bind:selected` two-way                  | Playwright fill + assert            | Set `config.authMethod = "enroll"` programmatically → "Enroll" radio renders selected              |
| Visible legend hidden but AT-readable    | manual NVDA / VoiceOver             | Screen reader announces "Authentication method" on focus entry                                     |
| chip-row layout preserved                | chrome-devtools MCP screenshot diff | Pre/post pixel-near-identical (font-rendering ε allowed)                                           |

---

## Authority citations

- Carbon RadioButtonGroup a11y mdx: `docs/carbon-website/src/pages/components/RadioButtonGroup/accessibility.mdx`
- Carbon SCSS group rules: `docs/carbon-design-system/packages/styles/scss/components/radio-button/_radio-button.scss`
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/RadioButtonGroup/RadioButtonGroup.svelte`
- WCAG 2.1 SC 1.3.1 Info and Relationships: <https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html>
- WAI-ARIA APG Radio pattern: <https://www.w3.org/WAI/ARIA/apg/patterns/radio/>
- Companion atomic spec: `specs/026-lunaris-design-system/components/radio-button/accessibility.md`
