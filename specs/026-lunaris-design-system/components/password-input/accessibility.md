# Password Input — Accessibility

**Status:** Phase 3 PR3b prep
**Last updated:** 2026-04-29
**Carbon mirror:** `docs/carbon-website/src/pages/components/password-input/accessibility.mdx`

---

## What Carbon provides for free

Inherits all `<TextInput>` a11y guarantees (label association, `aria-invalid`, `aria-describedby`, focus visibility, color contrast — see `text-input/accessibility.md`). Adds:

### Visibility toggle a11y (Carbon source verified)

- The eye icon is a real `<button>` with its own `aria-label` driven by `hidePasswordLabel` / `showPasswordLabel` props.
- Tooltip on the eye announces the action (Show / Hide). Carbon uses the same `iconDescription` pattern as `<Button iconOnly>`.
- The eye button is tab-reachable in DOM order (after the input). Consumers should NOT alter tab order.
- Activating the eye via Space / Enter flips visibility — same as click. No custom keyboard handler needed.

### Password-field semantic considerations

- `type="password"` triggers AT-specific behaviors (e.g., NVDA suppresses character announcement; VoiceOver replaces characters with "bullet"). Toggling to `type="text"` for visibility re-enables character read-back — desirable for users verifying typed input.
- Browsers + password managers detect `type="password"` for autofill. Carbon's `<PasswordInput>` preserves this — DON'T suppress.
- `autocomplete` token must be set per WCAG 2.1 SC 1.3.5 "Identify Input Purpose" (AA): use `'current-password'` for sign-in, `'new-password'` for creation, `'one-time-code'` for OTP.

### Color contrast + focus

Inherits TextInput's color audit. Eye icon contrast:

| Pair                           | Min contrast (AA, graphical) | Lunaris target                             | Status     |
| ------------------------------ | ---------------------------- | ------------------------------------------ | ---------- |
| Eye icon stroke on `$field` bg | 3:1                          | `var(--ink-3)` on `var(--bg-2)` ≈ 5.4:1    | ✓          |
| Eye icon hover stroke          | 3:1                          | `var(--accent)` on `var(--bg-2)` ≈ 7.4:1   | ✓          |
| Toggle button focus ring       | 3:1                          | 2px `var(--accent)` outline on `$field` bg | ✓ inherits |

---

## Argos-specific a11y considerations

### Tap target compliance

The visibility-toggle button must be ≥ 24×24 CSS pixels per WCAG 2.2 SC 2.5.8 (AA). Carbon's eye button is 32×32 in `md` size — passes. In `sm` (32px input height), the eye button shrinks to 24×24 — exactly at threshold, passing.

### Caps-lock indicator (Argos consideration, out of Carbon scope)

Operators on tactical hardware (no software keyboard, physical keys only) benefit from a caps-lock-on indicator near the password field. Carbon doesn't ship this. Adding one is OUT OF Phase 3 scope — track for Phase 7 a11y stretch.

### Password manager interop

Argos systems do NOT typically run password managers (offline tactical hardware). However, when Argos console is accessed via remote browser (lab dev, CI, demos), password managers SHOULD be able to:

- Detect the field via `type="password"` ✓ (Carbon preserves)
- Detect form context via surrounding `<form>` or sibling `username` field
- Apply autocomplete via `autocomplete="current-password"`

Adapter enforces the autocomplete token via restricted union.

### Paste prevention

WCAG-prohibited (per WCAG 2.1 input usability): never disable paste in password fields. Carbon honors this. Adapter doesn't expose any prop that would disable it.

---

## Verification checklist (PR3b + Phase 7)

| Check                                         | Tool                                   | Pass criterion                                                            |
| --------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| WCAG 2.1 AA on form (password field included) | `@axe-core/playwright`                 | `violations: []`                                                          |
| `aria-label` on visibility toggle button      | manual + Playwright                    | Button has accessible name from `hidePasswordLabel` / `showPasswordLabel` |
| Toggle button focus visible                   | manual                                 | 2px outline on focus                                                      |
| Toggle button keyboard-activatable            | Playwright keyboard                    | Space + Enter toggle visibility                                           |
| Tab order: input → toggle button → next field | Playwright keyboard                    | Tab moves through both before leaving password field                      |
| Visibility flip preserves focus               | manual                                 | Click toggle → focus stays on input (or moves to button — verify)         |
| Autocomplete token valid                      | manual + axe `autocomplete-valid` rule | `current-password` accepted                                               |

---

## Authority citations

- Carbon PasswordInput a11y mdx: `docs/carbon-website/src/pages/components/password-input/accessibility.mdx`
- Carbon source: `node_modules/carbon-components-svelte/src/TextInput/PasswordInput.svelte`
- WCAG 2.1 SC 1.3.5 Identify Input Purpose: <https://www.w3.org/WAI/WCAG21/Understanding/identify-input-purpose.html>
- WCAG 2.2 SC 2.5.8 Target Size (Minimum): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- HTML autocomplete token list: <https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill>
