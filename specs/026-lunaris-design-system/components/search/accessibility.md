# Search — Accessibility

**Status:** Phase 3 PR3b prep
**Last updated:** 2026-04-29
**Carbon mirror:** `docs/carbon-website/src/pages/components/search/accessibility.mdx`

---

## What Carbon provides for free

Per Carbon `<Search>` source verification:

### Semantic structure

- `<input type="search">` — browsers expose proper search-field semantics to AT.
- `<label for={id}>` paired with the input via Carbon-managed `id`.
- Magnifier icon is decorative (`aria-hidden`, no role) — purely visual affordance.
- Clear button is a real `<button>` with `aria-label` driven by `closeButtonLabelText` (default "Clear search input").

### ARIA wiring

- `aria-label` mirrors `labelText` when `hideLabel={true}` — keeps screen-reader announcement intact when the visible label is suppressed for tactical chrome.
- Clear button's `aria-label` announced as a separate element ("Clear search input") — distinct from the input's announcement.

### Keyboard interaction

- **Type into input**: standard.
- **Escape**: browser clears `<input type="search">` natively on some platforms; Argos's existing ToolsFlyout ESC handler dismisses the flyout entirely — keep both behaviors (flyout dismissal wins).
- **Tab**: standard order — input → clear button (if visible) → next focusable.
- **Enter**: NO submit semantics — Carbon's `<Search>` does not wrap in a form. ToolsFlyoutHeader uses Enter to activate the selected tool, which is parent-level handling — preserve.
- **Click clear button**: fires `on:clear` event; Argos's `bind:value={query}` resets to empty string; Carbon emits the event for consumer-side resets.

### Color contrast

| Pair                           | Min contrast (AA, graphical) | Lunaris target                            | Status |
| ------------------------------ | ---------------------------- | ----------------------------------------- | ------ |
| Magnifier icon stroke on bg    | 3:1                          | `var(--ink-3)` on `var(--bg-2)` ≈ 5.4:1   | ✓      |
| Clear button icon stroke on bg | 3:1                          | `var(--ink-3)` on `var(--bg-2)` ≈ 5.4:1   | ✓      |
| Clear button hover state       | 3:1                          | `var(--mk2-red)` on `var(--bg-2)` ≈ 4.8:1 | ✓      |
| Focus ring                     | 3:1                          | `var(--accent)` 2px outline               | ✓      |

---

## Argos-specific a11y considerations

### `hideLabel` use is REQUIRED for chrome surfaces

ToolsFlyoutHeader has no visible label — the magnifier + placeholder communicate purpose visually. Per WCAG 2.1 SC 4.1.2 "Name, Role, Value" (Level A), the input STILL needs an accessible name. Adapter enforces by:

- Making `labelText` a **required** prop.
- Exposing `ariaLabel` as a separate prop (Carbon's `<Search>` does NOT ship `hideLabel` like `<TextInput>` does); when `labelText` is omitted, `ariaLabel` flows through `$$restProps` as `aria-label` on the underlying `<input>`.

### ESC clear vs flyout dismissal

ToolsFlyout's existing ESC handler dismisses the entire flyout. Browser's native ESC on `<input type="search">` clears the field. Conflict resolution:

- **Flyout-level keydown handler runs FIRST** (`<svelte:window onkeydown={onKeydown}>`). It calls `onClose()` and `e.preventDefault()` — preventing browser default.
- Net effect: ESC dismisses flyout, never clears input. Acceptable per Argos UX (the next flyout open re-clears via the existing `$effect` on `open`).

If a future surface wants ESC-to-clear semantics WITHOUT flyout dismissal, it can omit the parent keydown trap and let Carbon / browser handle it.

### Magnifier icon decoration check

Carbon ships the magnifier as `aria-hidden`. Verify in PR3b chrome-devtools snapshot — should NOT appear in a11y tree as an interactive element.

### Clear button focus order

The clear button only EXISTS in DOM when `value !== ''` (Carbon conditional render). Tab order:

- Empty: input → next form element.
- Filled: input → clear button → next form element.

This dynamic tab order is correct per Carbon design but operators may notice the focus jump. Document for Phase 7 audit.

### Tap target compliance

Carbon `<Search size="sm">` clear button = 32×32 — passes WCAG 2.2 SC 2.5.8 (AA, ≥24×24). Carbon `<Search size="lg">` = 40×40 — passes 2.5.8 and approaches 2.5.5 (AAA, 44×44). Carbon `<Search size="xl">` = 48×48 — passes 2.5.5 (AAA).

---

## Verification checklist (PR3b + Phase 7)

| Check                                      | Tool                          | Pass criterion                                                                  |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------- |
| WCAG 2.1 AA on ToolsFlyout open            | `@axe-core/playwright`        | `violations: []`                                                                |
| Search input has accessible name           | Playwright + axe `label` rule | `labelText` mapped to `aria-label` via `hideLabel`                              |
| Magnifier icon has `aria-hidden`           | manual DOM inspection         | `aria-hidden="true"` on the SVG                                                 |
| Clear button only present when filled      | Playwright                    | `getByRole('button', { name: /clear/i }).count()` = 0 when empty, 1 when filled |
| Clear button keyboard-activatable          | Playwright keyboard           | Space + Enter clear value                                                       |
| ESC dismisses flyout (not clears field)    | Playwright keyboard           | `Escape` triggers `onClose`, value preserved across re-open                     |
| Focus ring visible on input + clear button | manual + Playwright           | 2px outline on each focus target                                                |
| Tab order matches DOM order dynamically    | Playwright keyboard           | Tab from input lands on clear button when value non-empty                       |

---

## Authority citations

- Carbon Search a11y mdx: `docs/carbon-website/src/pages/components/search/accessibility.mdx`
- Carbon source: `node_modules/carbon-components-svelte/src/Search/Search.svelte`
- WCAG 2.1 SC 4.1.2 Name Role Value: <https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html>
- WCAG 2.2 SC 2.5.8 Target Size (Minimum): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- HTML5 `<input type="search">` semantics: <https://html.spec.whatwg.org/multipage/input.html#text-(type=text)-state-and-search-state-(type=search)>
