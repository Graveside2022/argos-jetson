# Button — Usage

**Status:** Phase 1 in progress
**Last updated:** 2026-04-28
**Carbon mirror:** `docs/carbon-website/src/pages/components/button/usage.mdx`
**Implementation:** `src/lib/components/mk2/IconBtn.svelte` (current bespoke); Phase 1 swaps to `<Button>` from `carbon-components-svelte`.

---

## When to use

- Trigger an action (sort, filter, navigate, expand, dismiss, copy, download).
- Submit a form or confirm a destructive operation.
- Provide visual entry point for a primary call-to-action.

## When not to use

- For navigation between pages → use `<Link>` or `<a href>` (SvelteKit semantics + a11y).
- For toggle state (on/off) → use `<Toggle>` or `<Checkbox>`.
- For multiple choice → use `<ContentSwitcher>` or `<RadioButton>`.
- For displaying a non-interactive label → use a `<span>` or `<Tag>`.

---

## Variants used in Argos

| Variant       | Carbon `kind` prop      | Argos consumer                                                      | Notes                                                |
| ------------- | ----------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| **Primary**   | `kind="primary"`        | mission-critical CTAs (Start scan, Send TAK message)                | Lunaris accent color (`var(--accent)`) on background |
| **Secondary** | `kind="secondary"`      | filter / setting buttons in toolbars                                | Lunaris `var(--bg-2)` background                     |
| **Tertiary**  | `kind="tertiary"`       | tab-strip secondary actions                                         | Lunaris border-only style                            |
| **Ghost**     | `kind="ghost"`          | drawer-tab inline actions, IconBtn replacement                      | No background; minimal hover affordance              |
| **Danger**    | `kind="danger"`         | destructive ops (Stop scan, Disconnect device, Reset)               | Lunaris `var(--red)`                                 |
| **Icon-only** | `kind="ghost" iconOnly` | sort indicators, panel close, drawer collapse, agent input controls | Replaces bespoke `IconBtn.svelte`                    |

## Argos-specific extensions

These wrap Carbon's `<Button>` to expose Argos-specific patterns:

- **`IconBtn`** — Argos's bespoke icon-only button. Phase 1 migrates to Carbon `<Button kind="ghost" iconOnly>`. Provides the `name` prop (lucide icon name) + `size` prop (defaults to 12px per v2 mockup `primitives.jsx` line 22).
- **`PanelActions`** — Argos panel header action group. Wraps multiple `IconBtn` / `<Button>` instances. Stays bespoke; no Carbon equivalent (Carbon's "ButtonSet" is for primary CTAs not header actions).
- **`data-density` responsive sizing** — Argos buttons resize via the global density attribute (`compact: 22px`, `default: 26px`, `comfy: 30px`). Maps to Carbon button `size` prop (`sm`, `md`, `lg`) via the theme overlay.

---

## Anatomy

Per Carbon `usage.mdx`:

1. **Container** — `<button>` element with focus ring + min tap-target.
2. **Icon (optional)** — leading icon for action emphasis, trailing icon for chained navigation.
3. **Label** — verb-led action text (sentence-case per Carbon, **UPPERCASE per Lunaris convention** for the tactical aesthetic).
4. **Loading state** — spinner replaces icon when `disabled` + async action pending.

---

## Argos sizing matrix

Per v2 mockup `styles.css`:

| Context                                             | Size                                                      | v2 source                                             |
| --------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Default `.icon-btn` (chassis-level, drawer headers) | 28×28px, 16px icon                                        | `styles.css` (search `.icon-btn` rule)                |
| Inside `.panel-actions` (panel header action group) | 18×18px, 12px icon                                        | `styles.css` `.panel-actions .icon-btn` rule          |
| Sort indicator inside `<th>`                        | 12px icon                                                 | DataTable spec (per `components/data-table/style.md`) |
| Drawer-tab tabs (`01 TERMINAL`, `02 LOGS`, etc.)    | not via IconBtn — these are tab buttons; Phase 5 migrates | n/a                                                   |

Carbon's `<Button>` ships sizes `sm` (32px), `md` (40px, default), `lg` (48px). Argos's denser sizing is intentional for tactical density; theme overlay maps `--cds-button-size-sm` to `28px` etc. via Lunaris density tokens.

---

## Authority citations

- Carbon button SCSS: `docs/carbon-design-system/packages/styles/scss/components/button/_button.scss`
- Carbon button mdx: `docs/carbon-website/src/pages/components/button/usage.mdx`
- v2 mockup IconBtn JSX: `docs/argos-v2-mockup/src/primitives.jsx` lines 21-23
- v2 mockup IconBtn CSS: `docs/argos-v2-mockup/styles.css` (`.icon-btn` + `.panel-actions .icon-btn`)
