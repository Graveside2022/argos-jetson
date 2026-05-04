---
paths:
    - '**/*.svelte'
    - 'src/lib/components/**/*'
    - 'src/lib/styles/**/*'
    - 'src/app.css'
    - 'specs/026-lunaris-design-system/**/*'
---

# Design System — Carbon + Lunaris + Geist

Loaded when Claude reads `.svelte` files, `src/lib/components/`, `src/lib/styles/`, `src/app.css`, or the spec-026 design-system directory.

**IBM Carbon = methodology authority** (per-component conventions). **Lunaris = visual identity** (color, layout chrome, military-tactical look). **Geist = typography**.

## Reference dirs

Gitignored, recreate per `specs/026-lunaris-design-system/spec.md`:

- `docs/carbon-design-system/` (sparse-checkout) — Carbon SCSS source. **Wins** vs site docs (last-modified tiebreaker).
- `docs/carbon-website/` — Carbon usage/a11y mdx. Context only — never overrides source SCSS.
- `docs/argos-v2-mockup/` — Argos v2 visual ground-truth. Visual identity wins on look-and-feel; Carbon wins on anatomy.

## Spec workflow (non-negotiable)

Per memory `feedback_lunaris_spec_first.md`: no visual / behavioral component change ships without first writing or updating `specs/026-lunaris-design-system/components/<name>/style.md` citing the matching Carbon source SCSS. Implementation references the spec, not the other way round.

Per-component spec at `specs/026-lunaris-design-system/components/<name>/{usage,style,code,accessibility}.md`. Citations in `authorities.md`. Tokens in `tokens.md`. 8-phase roadmap in `migration-roadmap.md`.

## Stack

`carbon-components-svelte@^0.107.0`, `@carbon/styles@^1.105.0`, `carbon-icons-svelte@^13.10.0`. Theme overlay: `src/lib/styles/lunaris-carbon-theme.scss`.

## Lunaris specifics

**Dark mode only.** Surfaces in `src/app.css :root`: `--background`#111111, `--card`#1A1A1A, `--border`#2E2E2E. Accent: steel blue #A8B8E0 (swappable via `--primary` across 13 MIL-STD palettes). Status (independent of accent): healthy #8BBFA0, warning #D4A054, error #FF5C33/#C45B4A, inactive #555555. Color must never be the sole status indicator.

**Typography**: Fira Code for ALL data (metrics, IPs, headers); Geist for tab labels + nav chrome only. Six-step scale: 24/13/12/11/10/9px (9px = section headers, UPPERCASE, letter-spacing 1.2+).

**Layout**: 48px icon rail → 280px overview → fill map → 240px bottom panel + 40px top command bar. Icons: Lucide (nav/status), Material Symbols Sharp (collapse caret only).
