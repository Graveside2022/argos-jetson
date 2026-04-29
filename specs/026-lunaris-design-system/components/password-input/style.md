# Password Input — Style

**Status:** Phase 3 PR3b prep
**Last updated:** 2026-04-29
**Authority precedence:** Carbon source SCSS > Carbon site mdx > v2 mockup CSS

---

## Canonical anatomy citations

`<PasswordInput>` re-uses `<TextInput>`'s SCSS module. Bottom-only border, filled background, focus-outline mixin — see `text-input/style.md` for the shared base.

The visibility-toggle button is positioned absolutely inside the input field wrapper (per Carbon source line 179-212 of `TextInput.svelte`, mirrored in `PasswordInput.svelte`). It's a Carbon `<IconButton>` rendering `<View>` / `<ViewOff>` icons from `carbon-icons-svelte`.

## Lunaris token map

Inherits all `<TextInput>` token mappings (background, border, text, focus). Adds:

| Carbon token / class             | Lunaris value                                      | Notes                                                  |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `.bx--text-input--password` icon | `var(--ink-3)` (default), `var(--accent)` on hover | Eye icon; Argos's accent ring matches focus ring color |
| Tooltip background               | `var(--bg-3)` with 1px `var(--line)` border        | Tooltip "Show password" / "Hide password"              |
| Tooltip text                     | `var(--ink-2)`                                     | Same family as helper text                             |

## Sizing per surface

Argos password inputs only appear in Settings forms today. Use Carbon `md` (40px default) — matches the TextInput sibling fields in the same form for visual consistency.

## What Argos does NOT inherit from Carbon

- **Tooltip portal**: Argos forms aren't deeply nested in `overflow: hidden` containers (Settings panel is the deepest surface). Skip `portalTooltip={true}` unless a future Modal hosts the form.
- **Strength meter chrome**: Carbon doesn't ship one; Argos doesn't need one. Skip.

## Authority citations

- Carbon TextInput SCSS: `docs/carbon-design-system/packages/styles/scss/components/text-input/_text-input.scss`
- Carbon PasswordInput component: `node_modules/carbon-components-svelte/src/TextInput/PasswordInput.svelte`
- Lunaris token mapping: `specs/026-lunaris-design-system/tokens.md`
