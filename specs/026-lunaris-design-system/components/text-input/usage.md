# Text Input — Usage

**Status:** Phase 3 prep (drafted during Phase 2 PR review)
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/TextInput.svelte`
**Carbon component:** `<TextInput>` from `carbon-components-svelte` v0.107.0+

---

## When to use

Single-line free-text capture (search query, MAC filter, SSID prefix, frequency in MHz, callsign). Carbon's `<TextInput>` is the canonical authority — Argos wraps it as `<TextInput>` in `chassis/forms/`, mapping Lunaris tokens to Carbon Sass variables via the existing `lunaris-carbon-theme.scss`.

## When NOT to use

- Numeric values with up/down stepper → use `<NumberInput>` (separate spec).
- Multi-line capture (logs, notes, free-form CoT message body) → use Carbon `<TextArea>` (deferred — not in Phase 3 scope).
- Passwords / secrets → use Carbon's `<PasswordInput>` variant which adds the visibility toggle. Argos rarely surfaces secrets in the UI; the existing TAK enroll flow at `src/routes/api/tak/enroll/+server.ts` uses HTTP-only.
- **Search boxes** (input with `type="search"` + magnifier icon + clear-on-Escape semantics) → use Carbon's dedicated `<Search>` component, NOT `<TextInput>`. Carbon explicitly separates these concerns; mixing them in one adapter conflates two component specs. (ADR-0001 — `specs/026-lunaris-design-system/adrs/0001-phase-3-canary-textinput.md`).

## Argos surface inventory

Bespoke text inputs that Phase 3 retires by migrating to `<TextInput>`. Updated 2026-04-29 post-RTFM Carbon taxonomy verification (ADR-0001).

| Surface                 | File                                                                              | Current pattern                                        | Phase 3 target                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| GP server form          | `src/lib/components/dashboard/globalprotect/GpServerForm.svelte`                  | 3 bespoke `<input>` (portal, username, password)       | **PR3a canary** (portal + username only). Password → PR3b via `<PasswordInput>`.                                          |
| Filter bar              | `src/lib/components/dashboard/panels/FilterBar.svelte`                            | bespoke `<input>` with hand-rolled focus styles        | PR3b tier-migrate.                                                                                                        |
| Frequency tuner         | `src/lib/components/screens/parts/FrequencyTuner.svelte`                          | bespoke numeric input + label                          | PR3b: label half via `<TextInput>`. Numeric half → `<NumberInput>` (separate adapter, separate PR).                       |
| TAK URL form            | `src/lib/components/dashboard/views/webtak/webtak-url-form.svelte`                | bespoke URL input                                      | PR3b tier-migrate (use `type="url"`).                                                                                     |
| RF propagation controls | `src/lib/components/dashboard/panels/rf-propagation/RFPropagationControls.svelte` | bespoke numeric inputs                                 | NOT a `<TextInput>` consumer — defers to `<NumberInput>` adapter (drafted PR #68 usage.md).                               |
| Tools flyout filter     | `src/lib/components/chassis/ToolsFlyoutHeader.svelte`                             | `type="search"` with magnifier prefix + ESC clear chip | **NOT a `<TextInput>` consumer** — semantically Carbon `<Search>`. Migrates under a future `components/search/` spec set. |
| Kismet inspector query  | `src/lib/components/screens/parts/KismetInspector.svelte`                         | (unverified — `grep '<input'` returns 0 in this file)  | Re-verify before scheduling. May already use a different abstraction.                                                     |

Total bespoke text-input call sites: ~5-7 confirmed (excluding Search/NumberInput taxonomy). Migration order codified in ADR-0001: GpServerForm portal+username (canary, PR3a) → password+filter-bar+webtak+frequency-tuner-label (PR3b).

## Anatomy

Per Carbon `text-input/usage.mdx`:

1. **Label** (required for a11y) — short, sentence case, above the input.
2. **Input field** — bordered control, fixed height per size (xs 24px / sm 32px / md 40px default / lg 48px).
3. **Helper text** (optional) — below the input, secondary text token.
4. **Invalid / warn state** (optional) — error icon + message, replaces helper text when `invalid={true}`.
5. **Placeholder** — appears when empty, subtler than helper text.

Lunaris drawer-tab forms use `xs` size (24px) for density parity with `<DataTable>`. Settings screens use `md` (40px) per Carbon default.

## States to handle

Per Argos code conventions ("every component must handle ALL states: Empty, Loading, Default, Active, Error, Success, Disabled, Disconnected"), `<TextInput>` consumers MUST:

- **Empty**: render with `value=""` and a placeholder describing the expected format.
- **Loading**: when async-validating (e.g. SSID lookup), set `disabled={true}` + show spinner via Carbon's `<InlineLoading>` adjacent.
- **Default**: standard editable state.
- **Active**: focus state — Carbon ships a 2px focus ring; Lunaris overrides to `var(--accent)`.
- **Error**: set `invalid={true}` + `invalidText="..."`. Carbon adds error icon + colored border.
- **Success**: not a built-in Carbon state for `<TextInput>` (use a separate `<InlineNotification>` if confirmation needed).
- **Disabled**: `disabled={true}` — Carbon greys the field and locks input.
- **Disconnected**: when the form depends on a backend (e.g. Kismet WS), wrap with `<InlineLoading>` + connection-status pill from `chassis/Dot.svelte`.

## Out of scope for Phase 3

Reserved for future phases or screen-specific patterns:

- Carbon's `aiLabel` slot for AI-generated input — Argos doesn't surface AI-input affordance here yet.
- Inline validation (sync regex) — keep validation in submit handlers per existing pattern.
- Auto-suggest / typeahead — not present in current bespoke surfaces.

## Authority citations

- Carbon Svelte component: <https://svelte.carbondesignsystem.com/?path=/docs/components-textinput--default>
- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/text-input/_text-input.scss` (last modified 2026)
- Carbon usage mdx: `docs/carbon-website/src/pages/components/text-input/usage.mdx`
- Argos bespoke surfaces: see "Surface inventory" table above (15-20 call sites)
