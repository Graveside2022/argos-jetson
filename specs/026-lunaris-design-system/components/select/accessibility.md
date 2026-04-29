# Select — Accessibility

Carbon Select's headline a11y win is that **it renders a real native `<select>` element under the hood** (`Select.svelte:215`). The browser supplies all the keyboard, focus, ARIA, and assistive-tech behavior automatically — the wrapper does not re-implement any of it.

## What the browser gives us for free

| Path | Behavior |
|------|----------|
| TAB to enter | Native focus order; focus ring driven by `:focus` (Carbon overrides with its own border-bottom + `bx--select__arrow` color shift) |
| TAB to leave | Skip to next focusable; Select does not trap focus |
| ARROW UP / DOWN (closed) | Cycle through options without opening the popover (browser-native) |
| ARROW UP / DOWN (open) | Highlight next/previous option |
| ENTER | Commit highlighted option, close popover |
| ESC | Close popover without committing (when open) |
| SPACE | Toggle popover (when closed) |
| Type-ahead | Type letters to jump to matching option (browser-native) |
| Mobile (iOS/Android) | Native picker UI — full-screen wheel on iOS, dropdown sheet on Android |

These behaviors are NOT re-implemented by the wrapper. **Do not add custom keyboard handlers** — they would compete with browser-native handling and cause regressions like "ESC doesn't close on iOS Safari" or "type-ahead skips the active option."

## ARIA wiring done by Carbon

Carbon Select auto-wires (`Select.svelte:165-228`):

- `aria-describedby` → `errorId` when `invalid={true}`, otherwise `warnId` when `warn={true}`, otherwise `helperId` when `helperText` is non-empty. The descendant `<div id={errorId|warnId|helperId}>` carries the message.
- `aria-invalid={true}` when `invalid={true}`.
- `disabled={true}` and `required={true}` are forwarded as native HTML attributes (which assistive tech announces).

The Lunaris wrapper does not override any of this.

## Label discipline

- **Always provide `labelText`.** The label `<label for={id}>` is rendered above the input and announced when the user reaches the field. Even when visually hiding (`hideLabel={true}`), the text MUST be set — the label is announced to screen readers via `bx--visually-hidden`.
- **Avoid `noLabel={true}`** — it removes the `<label>` entirely. Use only when an external label exists (e.g. a sibling `<h2>` with matching `for=`/`id=`).
- **Keep label text actionable.** "Source" not "Filter Source" not "Filter by source". One verbless noun phrase reads cleanest.

## Color is not the only signal

Per Argos design rule (CLAUDE.md `Color Architecture`): "Color must never be the sole status indicator — always pair with a text label." Carbon already pairs:
- Invalid → red border + `WarningFilled` icon + `invalidText` string.
- Warn → amber border + `WarningAltFilled` icon + `warnText` string.

When the wrapper is configured `invalid={true}` without `invalidText`, the visual cue still has the icon (a non-color signal). Still — always pass `invalidText` so screen readers get useful context.

## Disabled state

Carbon renders `disabled={true}` as both:
- The native HTML `disabled` attribute on `<select>` (browser locks the field, AT announces "dimmed/unavailable").
- The CSS class `bx--select--disabled` (visual dim).

Argos consumer pattern: when `disabled` reflects a transient state (e.g. `disabled={isBusy}`), pair it with sibling helper text explaining WHY (CLAUDE.md `Component state handling`):

```svelte
<Select
  labelText="Source"
  bind:value={source}
  disabled={isBusy}
  helperText={isBusy ? 'Refreshing — please wait' : ''}
/>
```

## Verification (PR-A canary keyboard map)

For PR-A, manually verify the FilterBar canary against this checklist:

- [ ] TAB into Select → focus ring visible (Lunaris accent color)
- [ ] ARROW DOWN → cycles options, value updates without opening popover
- [ ] ENTER on focused Select → opens native popover
- [ ] ARROW DOWN inside popover → highlights next option
- [ ] ENTER on highlighted option → commits, popover closes
- [ ] ESC inside popover → closes WITHOUT committing
- [ ] Type "k" → jumps to "kismet" option
- [ ] TAB out → skips to next focusable element

Failures are blockers. The brittleness mode is when CSS overrides accidentally break `:focus-visible` — fix by extending `lunaris-carbon-theme.scss` rather than working around in component CSS.

## Phase 7 audit

Phase 7 (a11y audit + dead-code cleanup) re-tests every form field in this spec dir against axe-core + manual screen-reader smoke (NVDA / VoiceOver / TalkBack). Defects found there are filed against the wrapper, not the consumer. The Lunaris wrapper is the choke point — fix once, all 11 Select consumers benefit.
