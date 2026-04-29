# Password Input — Usage

**Status:** Phase 3 PR3b prep
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/PasswordInput.svelte`
**Carbon component:** `<PasswordInput>` from `carbon-components-svelte` v0.107.0+

---

## When to use

Single-line password capture (VPN portal credentials, secure-channel keys, certificate enrolment passphrases). Carbon's `<PasswordInput>` is the canonical authority — it's `<TextInput>` plus a visibility-toggle button rendered inside the input chrome.

## When NOT to use

- General secrets entered without redaction → use `<TextInput type="text">` (rare in Argos; certificate body, base64 token).
- Multi-line secrets / private keys → use `<TextArea>` (deferred — not in Phase 3 scope).
- Hidden tokens / API keys persisted server-side → don't render at all; use HTTP-only cookies / server-side env (per existing TAK enroll pattern at `src/routes/api/tak/enroll/+server.ts`).
- Search boxes → use `<Search>` (separate spec).
- Plain text inputs → use `<TextInput>` (parent spec).

## Argos surface inventory

Bespoke password inputs that PR3b retires by migrating to `<PasswordInput>`:

| Surface        | File                                                             | Current pattern                                                           |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| GP server form | `src/lib/components/dashboard/globalprotect/GpServerForm.svelte` | `<input type="password">` w/ tailwind classes (canary leftover from PR3a) |

Total bespoke password-input call sites confirmed: **1**. PR3a deferred this single field; PR3b finishes it.

## Anatomy

Per Carbon `password-input/usage.mdx`:

1. **Label** (required for a11y) — short, sentence case, above the input.
2. **Input field** — bordered control, masks characters by default (`type="password"`).
3. **Visibility toggle button** — eye icon embedded INSIDE the input's right edge. Clicking flips `type="text"` ↔ `type="password"`.
4. **Tooltip** on the toggle — announces "Show password" / "Hide password" via `iconDescription`. Configurable position + alignment.
5. **Helper text / invalid state / warn state** — same as `<TextInput>` (shared `aria-describedby` wiring).

## States to handle

Same eight Argos lifecycle states as `<TextInput>` (Empty, Loading, Default, Active, Error, Success, Disabled, Disconnected). Plus password-specific:

- **Visibility toggle**: default state hidden (masked); clicking eye reveals (`type="text"`); clicking again re-masks. Carbon owns this state internally — don't fight it.
- **Caps lock indicator** (Argos extension consideration): Argos may want a subtle caps-lock warning. Carbon doesn't ship this — defer to a wrapping component if surfaced.

## Out of scope for Phase 3

- Carbon's `inline` variant — Argos doesn't surface inline forms in tactical chrome; reserved.
- Strength meter — Argos passwords are operator credentials, not user-defined; no strength UX needed.
- Password generator / paste protection — out of operational scope.

## Authority citations

- Carbon Svelte component: <https://svelte.carbondesignsystem.com/?path=/docs/components-passwordinput--default>
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/TextInput/PasswordInput.svelte`
- Carbon Svelte type defs: `node_modules/carbon-components-svelte/src/TextInput/PasswordInput.svelte.d.ts`
- Carbon SCSS source: `docs/carbon-design-system/packages/styles/scss/components/text-input/_text-input.scss` (shared with TextInput)
- Argos current bespoke (1 surface): `src/lib/components/dashboard/globalprotect/GpServerForm.svelte` password input
- WCAG 2.1 input field a11y: <https://www.w3.org/WAI/ARIA/apg/patterns/>
