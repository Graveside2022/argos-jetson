# Spec 027 — V3 NVIDIA-themed UI

**Status:** P1 (chassis) in progress · **Branch:** `feature/v3-nvidia-chassis` · **Port:** 5175

## Summary

V3 is a third Argos UI, served on port **5175**, restyled with NVIDIA's
engineering-grade design language. It sits alongside — and never modifies —
V1 (`:5173`, legacy Lunaris) and V2 (`:5174`, Mk II).

**Design authority:** `DESIGN.md` at the repo root (installed via
`npx getdesign add nvidia`). Every V3 visual decision traces to it — single
`#76b900` green accent, 2px angular geometry, hairline-bordered flat cards,
the corner-square motif, black hero/footer chapters, Inter typography.

## Goals

- A fully NVIDIA-styled V3 of every V1 UI path, served on `:5175`.
- Runtime **dark / light** mode toggle.
- **Accent palette** picker — 14 accents (NVIDIA green default + the 13
  existing MIL-STD palettes).
- NVIDIA horizontal top-nav.
- V1 (`:5173`) and V2 (`:5174`) left **byte-identical** — verified per PR.

## Architecture

One SvelteKit build serves all three ports; `process.env.PORT` branches the
UI in `src/hooks.server.ts`. V3 is **additive**:

- **Routing** — new `src/routes/dashboard/v3/` subtree. `hooks.server.ts`
  (`rootRedirect` / `uiRedirect` / `v3DashboardRedirect`) sends `:5175` →
  `/dashboard/v3`.
- **Theming** — a `[data-ui='v3']` token scope appended to `src/app.css`:
  re-points the generic token names (`--background`, `--primary`, …) so the
  existing Tailwind utilities resolve under V3 with no config change; light
  + dark modes via `[data-mode]`; 14 accents via `[data-palette]`. The
  `v3-theme-store.svelte.ts` runes store persists `{mode,palette}` to the
  `argos-v3-theme` localStorage key.
- **Components** — `src/lib/components/v3/` — NVIDIA-native Svelte 5
  components, **zero `carbon-components-svelte`** (so the globally-imported
  dark `g100.css` is inert for V3).
- **Serving** — `deployment/argos-v3.service` (`PORT=5175`, clone of
  `argos-dev.service`). The dead `argos-newui-dev.service` is retired.

### V1 / V2 isolation

Four shared files take additive, gated edits, each provably inert off the V3
path:

- `hooks.server.ts` — `PORT === '5175'` redirect branch.
- `routes/+layout.svelte` — an `isV3` guard; the Mk II `$effect`s bail on
  `/dashboard/v3` routes.
- `app.css` — the appended `[data-ui='v3']` scope (no `:root` / mk2 edit).
- `app.html` — a `<body>`-top FOUC script gated on the `/dashboard/v3` path.

Every PR verifies `:5173` + `:5174` rendered DOM is byte-identical to a
pre-change baseline.

## Phasing

8 PRs, each ≤ ~2000 LOC, each sentrux-bracketed (Rule 6) — see `tasks.md`.
P1 = the chassis (this branch).

## References

- `DESIGN.md` (repo root) — NVIDIA design tokens + component specs.
- Implementation plan: `~/.claude/plans/i-want-you-to-hidden-popcorn.md`.
