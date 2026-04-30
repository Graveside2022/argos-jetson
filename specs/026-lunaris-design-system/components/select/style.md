# Select — Style

This document maps Carbon Select's visual treatment to Lunaris tokens. Per spec-026 authority precedence (`authorities.md`), **Carbon source SCSS wins** when source disagrees with site docs; the citations below all point to source files.

## Carbon source-of-truth files

| File                                                              | Purpose                                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `node_modules/carbon-components-svelte/src/Select/Select.svelte`  | Component template + class-name authority (`bx--select`, `bx--select-input`, `bx--select__arrow`)           |
| `node_modules/@carbon/styles/scss/components/select/_select.scss` | SCSS rules + token consumption                                                                              |
| `node_modules/@carbon/styles/scss/components/form/_form.scss`     | `bx--form-item`, `bx--label`, `bx--form__helper-text`, `bx--form-requirement` (shared with all form fields) |

## Anatomy

Carbon's Select renders this structure (`Select.svelte:138-268`):

```
<div class="bx--form-item">
  <div class="bx--select [bx--select--inline]">
    <label class="bx--label">{labelText}</label>
    <div class="bx--select-input__wrapper">
      <select class="bx--select-input bx--select-input--{sm|xl}">
        <slot />  <!-- SelectItem children -->
      </select>
      <ChevronDown class="bx--select__arrow" />
    </div>
    <div class="bx--form__helper-text">{helperText}</div>
  </div>
</div>
```

The Lunaris wrapper introduces no extra DOM — it forwards directly into CarbonSelect.

## Token mapping (Carbon → Lunaris)

These overrides live (or will live) in `src/lib/styles/lunaris-carbon-theme.scss`. **Token additions are deferred** to whichever PR's chrome-devtools visual diff first exposes drift; do not edit the theme file unless the diff fails.

| Carbon token                        | Lunaris value   | Used by                                     | Citation                                             |
| ----------------------------------- | --------------- | ------------------------------------------- | ---------------------------------------------------- |
| `$field-01` (select background)     | `var(--bg-2)`   | `<select>` background                       | `@carbon/styles/scss/components/select/_select.scss` |
| `$text-primary`                     | `var(--ink)`    | selected option text                        | shared with TextInput, mapped Phase 3a               |
| `$text-secondary`                   | `var(--ink-3)`  | label text                                  | shared with TextInput                                |
| `$border-strong-01` (select border) | `var(--line-2)` | `bx--select-input` border-bottom            | `_select.scss`                                       |
| `$focus` (focus ring)               | `var(--accent)` | `:focus` outline                            | shared with all form fields                          |
| `$icon-primary` (chevron)           | `var(--ink-3)`  | `bx--select__arrow` color                   | `Select.svelte:189`                                  |
| `$support-error`                    | `var(--red)`    | `bx--select--invalid` border + invalid icon | shared with TextInput error state                    |
| `$support-warning`                  | `var(--amber)`  | `bx--select--warning` border + warning icon | shared                                               |

## Typography

Carbon's Select inherits `$body-compact-01` → `font-family: $body-font-family` → mapped to Geist via Phase 0 `lunaris-carbon-theme.scss`. **The chassis wrapper applies no font-family rule itself.** The Select element inherits whatever `font-family` the parent surface declares via CSS cascade. Per CLAUDE.md typography rules: Fira Code (monospace) for ALL data — so a parent that sets `font-family: 'Fira Code', ui-monospace, monospace` (e.g. FilterBar at `panels/FilterBar.svelte`) makes the Select render in Fira Code without any wrapper-side rule. Geist is reserved for tab labels and UI navigation chrome, not data.

## Sizing

Carbon offers `'sm'` and `'xl'` sizes. The wrapper exposes Argos sizes `'sm' | 'md' | 'lg'` and maps:

| Argos `size` | Carbon `size`              |
| ------------ | -------------------------- |
| `'sm'`       | `'sm'`                     |
| `'md'`       | undefined (Carbon default) |
| `'lg'`       | `'xl'`                     |

Mapping is identical to NumberInput (Phase 3e) — see `components/number-input/style.md` for the precedent.

## Inline vs stacked label

Default = stacked (label above input). For inline label-and-input pairs (none used in Argos as of PR-A — pattern reserved for tightly-packed control bars where vertical space is scarce), pass `inline={true}`. Carbon's Select renders a different DOM tree for inline (`Select.svelte:157-209`) which the wrapper passes through without overriding. PR-A's FilterBar canary uses the default stacked layout.

## Accent ring

Argos uses a single `--accent` color (default amber, switchable via `data-accent` attribute on `<html>`). Carbon's `$focus` token gets overridden globally in `lunaris-carbon-theme.scss` so the focus ring matches whatever the user picked — the Select wrapper inherits this without needing local rules.

## Visual diff procedure (PR-A)

1. Pre-merge: chrome-devtools MCP `take_screenshot` of FilterBar source-select on `localhost:5173/dashboard`.
2. Apply PR-A.
3. Post-merge: same screenshot, same isolated context.
4. Compare. Drift > 1 pixel on any axis OR > 0.5 luma on any color sample OR new layout shift = fail; extend `lunaris-carbon-theme.scss` with the missing override and re-test.
