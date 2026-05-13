# Dropdown — Style

## Carbon source-of-truth files

| File                                                                  | Purpose                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `node_modules/carbon-components-svelte/src/Dropdown/Dropdown.svelte`  | Component template + items API + dispatch shape                            |
| `node_modules/@carbon/styles/scss/components/dropdown/_dropdown.scss` | SCSS rules + token consumption                                             |
| `node_modules/carbon-components-svelte/src/ListBox/`                  | Underlying ListBox primitive (Dropdown uses ListBoxMenu + ListBoxMenuItem) |

## Anatomy

Carbon's Dropdown renders as a `ListBox` with `ListBoxMenu` popover (`Dropdown.svelte:139-156`):

```
<div class="bx--dropdown__wrapper bx--list-box__wrapper">
  <label class="bx--label">{labelText}</label>
  <ListBox class="bx--dropdown" role="combobox">
    <button class="bx--list-box__field" aria-expanded={open}>
      <span class="bx--list-box__label">{selectedItem.text}</span>
      <ListBoxMenuIcon />
    </button>
    {#if open}
      <ListBoxMenu>
        {#each items as item (item.id)}
          <ListBoxMenuItem ... >{item.text}</ListBoxMenuItem>
        {/each}
      </ListBoxMenu>
    {/if}
  </ListBox>
  {#if helperText}<div class="bx--form__helper-text">{helperText}</div>{/if}
</div>
```

The Lunaris wrapper introduces no extra DOM.

## Token mapping (Carbon → Lunaris)

| Carbon token         | Lunaris value                   | Used by                            |
| -------------------- | ------------------------------- | ---------------------------------- |
| `$field-01`          | `var(--bg-2)`                   | dropdown closed-state background   |
| `$field-hover-01`    | `var(--bg-3)`                   | hover background                   |
| `$layer-01`          | `var(--panel)`                  | open menu background               |
| `$layer-hover-01`    | `var(--bg-2)`                   | menu item hover                    |
| `$layer-selected-01` | `var(--bg-3)`                   | currently-selected item background |
| `$text-primary`      | `var(--ink)`                    | item text                          |
| `$text-helper`       | `var(--ink-3)`                  | placeholder + helper text          |
| `$border-strong-01`  | `var(--line-2)`                 | dropdown border                    |
| `$focus`             | `var(--accent)`                 | focus ring on closed button        |
| `$icon-primary`      | `var(--ink-3)`                  | chevron + checkmark icons          |
| `$support-error`     | `var(--red)`                    | invalid state border + icon        |
| `$shadow-popover`    | (defer to chrome-devtools diff) | menu drop-shadow                   |

Token mappings are **deferred to `lunaris-carbon-theme.scss`** until chrome-devtools visual diff exposes drift. Carbon defaults often match the Lunaris dark palette closely enough that no overrides are needed.

## Sizing

Argos `'sm' | 'md' | 'lg'` → Carbon `'sm' | undefined | 'xl'`. Carbon Dropdown sizes: `'sm' | 'lg' | 'xl'` per `Dropdown.svelte:47`. Mapping:

| Argos `size` | Carbon `size`                       |
| ------------ | ----------------------------------- |
| `'sm'`       | `'sm'`                              |
| `'md'`       | undefined (Carbon default = `'lg'`) |
| `'lg'`       | `'xl'`                              |

Note: Carbon's `Dropdown` default differs from `Select` default. `Select`'s default size is undefined which renders the medium 40px field; `Dropdown`'s undefined renders 'lg'. For visual parity with NumberInput / Select on dashboards, pass `size="sm"` explicitly on tight-density surfaces.

## Popover direction

Carbon supports `direction: 'bottom' | 'top'` (`Dropdown.svelte:43`). Default = `'bottom'`. Argos consumers near the bottom of the viewport (e.g. SpectrumControls inside the bottom panel) MAY pass `direction="top"` to avoid clipping. Test in chrome-devtools at the post-merge visual-diff step; default is fine for hero surfaces.

## Portal

Carbon's `portalMenu` renders the dropdown menu in a portal so it can escape `overflow:hidden` containers. Default = `false` outside Modal. Argos's RF-propagation drawer has `overflow:hidden` — pass `portalMenu={true}` if migration shows the menu clipped. Defer to visual diff.

## Visual diff procedure (PR-C)

1. Pre-merge: chrome-devtools MCP `take_screenshot` of SpectrumControls bottom panel + RFAdvancedControls drawer with each Dropdown closed AND open (open state requires `click` interaction first).
2. Apply PR-C.
3. Post-merge: same screenshots, same isolated context.
4. Drift check: > 1px misalignment, > 0.5 luma color drift, OR menu-positioning regression = fail; extend `lunaris-carbon-theme.scss`.
