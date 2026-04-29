# Dropdown — Accessibility

Carbon's `<Dropdown>` is a custom popover combobox. UNLIKE `<Select>` (which inherits browser-native a11y from a real `<select>` element), Dropdown re-implements every keyboard, focus, and ARIA behavior in JavaScript. This means **a11y verification on every Dropdown migration is mandatory** — not optional follow-up.

## ARIA wiring (Carbon source-of-truth)

Carbon Dropdown uses `ListBox` underneath. Per `node_modules/carbon-components-svelte/src/Dropdown/Dropdown.svelte:139-156`:

| Attribute | Value | Source |
|-----------|-------|--------|
| Outer role | `combobox` | ListBox component |
| `aria-expanded` | bound to `open` state | ListBox-Field button |
| `aria-haspopup` | `listbox` | ListBox-Field |
| `aria-labelledby` | label id | auto-wired from `labelText` + generated id |
| `aria-activedescendant` | highlighted item id | tracks ARROW key navigation |
| Inner menu role | `listbox` | ListBoxMenu |
| Menu item role | `option` | ListBoxMenuItem |
| `aria-selected` | `true` for selected item | ListBoxMenuItem |
| `aria-describedby` | `errorId` / `warnId` / `helperId` | conditional per state |
| `aria-invalid` | `true` when `invalid={true}` | wrapper field |

The Lunaris wrapper does NOT override any of this.

## Keyboard map (mandatory verification)

Every PR-C migration MUST verify each path against the running app via chrome-devtools MCP:

| Key | Behavior |
|-----|----------|
| TAB into field | Focus enters the closed dropdown button. Focus ring (Lunaris accent) visible. |
| TAB out (closed) | Focus skips to next focusable element. |
| TAB out (open) | Closes menu, focus returns to button, then advances. |
| SPACE or ENTER (closed) | Opens the popover. First item highlighted (or current selection). |
| SPACE or ENTER (open, on item) | Commits the highlighted option. Closes menu. Focus returns to button. |
| ARROW DOWN (open) | Highlights next item. Wraps at end. |
| ARROW UP (open) | Highlights previous item. Wraps at start. |
| ESC (open) | Closes menu WITHOUT committing. Focus returns to button. |
| ESC (closed) | No-op. |
| Type-ahead (open) | Letter typed jumps to first matching item by `text`. 500ms timeout per Carbon. |
| HOME / END (open) | First / last item. |

Each key path is a regression risk. The most common breakage is **ESC-bubbling**: if the Dropdown is inside a Modal or Drawer, Carbon's ESC handler may compete with the parent's ESC handler. Test ESC behavior at every nested-context site.

## Color is not the only signal

Per Argos design rule: invalid state pairs red border + `WarningFilled` icon + `invalidText` string. Warn pairs amber border + `WarningAltFilled` icon + `warnText`. Always pass the text strings — screen readers need them.

## Label discipline

- **Always provide `labelText`.** Carbon renders it visibly above the field unless `hideLabel={true}`.
- `hideLabel={true}` keeps the label in the a11y tree via `bx--visually-hidden` — screen-reader users still hear it.
- Avoid removing the label entirely; Dropdown does not auto-derive an accessible name from selected item text.
- Keep label text actionable. "Clutter profile" not "Profile".

## Disabled state

Carbon renders `disabled={true}` as an `aria-disabled` attribute on the trigger button + visual dim. Argos consumer pattern: when `disabled` reflects transient state, pair with sibling helper text explaining WHY:

```svelte
<Dropdown
  labelText="Propagation model"
  items={MODELS}
  bind:selectedId
  disabled={isLoadingModels}
  helperText={isLoadingModels ? 'Loading models — please wait' : ''}
/>
```

## Verification (PR-C)

For each of the 7 PR-C sites, manually verify the keyboard map above against the post-merge running app. Failures block the visual-diff step. Typical breakage:

- **SpectrumControls (bottom panel):** confirm TAB enters bin-width → amp → LNA → VGA in DOM order.
- **RFAdvancedControls (drawer):** confirm ESC closes the Dropdown but NOT the drawer (drawer also listens for ESC). If both close, wrap Dropdown in a `<svelte:window on:keydown|stopPropagation>` scoped to popover-open state.
- **Type-ahead:** type "u" in clutterProfile dropdown — should jump to "Urban dense".

## Phase 7 audit prep

Phase 7 (a11y audit + dead-code cleanup) re-tests every form field against axe-core + manual NVDA / VoiceOver / TalkBack. Defects trace to the wrapper, not the consumer. Lunaris wrapper is the single choke point — fix once, all 7 Dropdown consumers benefit.
