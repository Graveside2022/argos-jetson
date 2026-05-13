# Spec 026 — Carbon → Lunaris Token Map

This is the **single source of truth** for translating IBM Carbon SCSS tokens to Argos Lunaris CSS custom properties. Implemented in `src/lib/styles/lunaris-carbon-theme.scss`. Grows per-component — entries added as each Lunaris component spec gets authored.

---

## Categories

Carbon's token system has these categories. Lunaris maps to Carbon's structure but uses oklch + military-tactical palette.

| Carbon category           | Carbon prefix                                                                                | Lunaris equivalent (CSS custom property)                                      | Source                                       |
| ------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| Color: background layers  | `$background`, `$layer-01`, `$layer-02`, `$layer-03`, `$layer-accent-01`, `$layer-accent-02` | `--bg`, `--bg-2`, `--bg-3`, `--panel`, `--panel-hi`, `--rail`                 | `docs/argos-v2-mockup/styles.css` lines 7-15 |
| Color: text/ink           | `$text-primary`, `$text-secondary`, `$text-helper`, `$text-on-color`, `$text-disabled`       | `--ink`, `--ink-2`, `--ink-3`, `--ink-4` (4 levels of ink)                    | lines 18-21                                  |
| Color: borders            | `$border-subtle-01`, `$border-strong-01`, `$border-interactive`, `$border-disabled`          | `--line`, `--line-2`, `--line-hi`                                             | lines 13-15                                  |
| Color: focus              | `$focus`, `$focus-inset`                                                                     | `--accent` (or accent variant per `data-accent` attribute)                    | lines 24-34                                  |
| Color: support (semantic) | `$support-error`, `$support-warning`, `$support-success`, `$support-info`                    | `--red`, `--amber`, `--green`, `--cyan`                                       | lines 24-32                                  |
| Typography: body          | `$body-font-family`                                                                          | `"Geist", ui-sans-serif, system-ui, sans-serif`                               | line 37                                      |
| Typography: heading       | `$heading-font-family`                                                                       | `"Geist"`                                                                     | line 37                                      |
| Typography: monospace     | `$font-family-mono`                                                                          | `"Geist Mono", ui-monospace, ...`                                             | line 38                                      |
| Typography: serif         | n/a (Carbon doesn't use serif)                                                               | `"Instrument Serif", ui-serif, Georgia, serif`                                | line 39                                      |
| Spacing                   | `$spacing-01` (2px) … `$spacing-13` (160px)                                                  | `--u: 4px` × N (Argos 4px grid)                                               | line 49                                      |
| Density                   | n/a (Carbon has 4 row sizes: xs/sm/md/lg/xl)                                                 | `--row-h: 26px` (default), `--row-h: 22px` (compact), `--row-h: 30px` (comfy) | lines 50, 53-54                              |
| Radius                    | `$border-radius`                                                                             | `--r-0: 0px`, `--r-1: 2px`, `--r-2: 4px`                                      | lines 43-45                                  |

Note: Carbon prefixes its tokens with `$` (Sass variables) at the source level; the `@use '@carbon/styles'` import exposes them. Lunaris uses CSS custom properties (`var(--name)`) at the consumption level. The bridge file `src/lib/styles/lunaris-carbon-theme.scss` does the `$carbon-token: var(--lunaris-token)` translation.

---

## Phase 1 — data-table specific tokens

Loaded as Phase 1 component spec authors `components/data-table/style.md`.

| Carbon token                           | Lunaris value                                      | Used by                 |
| -------------------------------------- | -------------------------------------------------- | ----------------------- |
| `$layer-accent-01` (header background) | `var(--bg-2)`                                      | `<th>` background       |
| `$text-primary` (header text)          | `var(--ink-4)` (uppercase + letter-spaced)         | `<th>` color            |
| `$text-secondary` (muted body)         | `var(--ink-3)`                                     | `<td>.dim` color        |
| `$border-subtle-01` (row divider)      | `var(--line)`                                      | `<tr>` border-bottom    |
| `$layer-hover-01` (row hover)          | `var(--bg-2)`                                      | `<tr>:hover` background |
| `$body-compact-01` typography          | mono 11-13px / 1.4                                 | table cell font         |
| `$heading-compact-01` typography       | mono 10-12px / 1, uppercase, letter-spacing 0.08em | header font             |

---

## Future phase placeholders

To be filled in as each phase's component spec is authored:

- **Phase 2 — Buttons**: `$button-primary`, `$button-secondary`, `$button-tertiary`, `$button-ghost`, `$button-danger`, focus-ring tokens, button-size tokens
- **Phase 3 — Form fields**: `$field-01`, `$field-02`, `$field-hover-01`, validation tokens (`$support-error-inverse` etc.), input-size tokens
- **Phase 4 — Modal/Notification/Tooltip**: `$overlay`, `$toggle-off`, `$shadow-popover`, motion tokens
- **Phase 5 — Tabs**: `$tab-background`, `$tab-active`, `$tab-hover`
- **Phase 6 — Pagination/Loading/Search**: pagination footer tokens, skeleton tokens, search input tokens

---

## How to add a token

1. Identify the Carbon token via `docs/carbon-design-system/packages/styles/scss/components/<component>/_index.scss` or `packages/themes/scss/`.
2. Find or define the matching Lunaris CSS custom property in `src/app.css` or `src/lib/styles/dashboard-utilities.css`.
3. Add the mapping row to the relevant component's section above with a citation.
4. Add the actual `$carbon-token: var(--lunaris-token);` override in `src/lib/styles/lunaris-carbon-theme.scss`.
5. Reference this map from the component's `style.md` — no duplicating the citation.

---

## Tokens that have NO Carbon equivalent (Argos-specific)

These live in Lunaris alone; Carbon components ignore them. Argos-specific widgets consume them directly.

| Token                              | Purpose                                         |
| ---------------------------------- | ----------------------------------------------- | ----- | ---- | ---------- |
| `--rail-w: 56px`                   | IconRail (left vertical nav) width              |
| `--bar-h: 44px`                    | TopStatusBar height (32-44px range)             |
| `--inspector-w: 340px`             | Right-side inspector panel width                |
| `--accent` (defaults to `--amber`) | User-switchable accent hue (`data-accent="amber | green | cyan | magenta"`) |
| `--amber-ink`, `--green-dim`, etc. | Lunaris-specific support color variants         |
