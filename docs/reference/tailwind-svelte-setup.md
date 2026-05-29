# Argos Tailwind v4 + SvelteKit + sv-CLI — Reference & P1/P2 Audit

Scope: SvelteKit + Svelte 5 + Tailwind v4.1.18 + carbon-components-svelte, mid IBM Carbon migration (ADR 0006). Grounded in 13 audited official sources + verification against current Argos files (`src/app.css`, `src/routes/+layout.svelte`, `src/app.html`, `vite.config.ts`, `vitest.config.ts`, `package.json`).

---

## 1. Source index

| Source | URL | Role |
| --- | --- | --- |
| tw-sveltekit-guide | [tailwindcss.com/docs/installation/framework-guides/sveltekit](https://tailwindcss.com/docs/installation/framework-guides/sveltekit) | Canonical 7-step Tailwind v4 + SvelteKit install (happy path; no @theme) |
| tw-vite | [tailwindcss.com/docs/installation/using-vite](https://tailwindcss.com/docs/installation/using-vite) | Canonical `@tailwindcss/vite` plugin + single `@import` setup |
| tw-docs-home | [tailwindcss.com/docs](https://tailwindcss.com/docs) → [/docs/theme](https://tailwindcss.com/docs/theme) | **Authoritative `@theme` / `@theme inline` semantics** (var-resolution pitfall) |
| tw-repo | [github.com/tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | **Source-of-truth** `theme.ts resolveWith()` (one-level inline) + `apply.ts` (unknown-utility throw) |
| sv-cli | [svelte.dev/docs/cli/sv](https://svelte.dev/docs/cli/sv) | sv programmatic API (add-on authoring); NOT CLI overview |
| sv-add | [svelte.dev/docs/cli/sv-add](https://svelte.dev/docs/cli/sv-add) | `sv add` retrofit command + official add-on list |
| sv-create | [svelte.dev/docs/cli/sv-create](https://svelte.dev/docs/cli/sv-create) | `sv create` scaffolder (baseline shape) |
| sv-check | [svelte.dev/docs/cli/sv-check](https://svelte.dev/docs/cli/sv-check) | `sv check` / svelte-check engine (type/a11y/unused-CSS only) |
| sv-migrate | [svelte.dev/docs/cli/sv-migrate](https://svelte.dev/docs/cli/sv-migrate) | `sv migrate` codemods (Svelte/Kit syntax only) |
| sv-utils | [svelte.dev/docs/cli/sv-utils](https://svelte.dev/docs/cli/sv-utils) | Experimental AST codemod toolkit (add-on authoring) |
| cli-tailwind | [svelte.dev/docs/cli/tailwind](https://svelte.dev/docs/cli/tailwind) | `sv add tailwindcss` add-on (follows the Tailwind SvelteKit guide) |
| cli-prettier | [svelte.dev/docs/cli/prettier](https://svelte.dev/docs/cli/prettier) | `sv add prettier` add-on (format lane) |
| cli-eslint | [svelte.dev/docs/cli/eslint](https://svelte.dev/docs/cli/eslint) | `sv add eslint` add-on (lint lane) |
| cli-vitest | [svelte.dev/docs/cli/vitest](https://svelte.dev/docs/cli/vitest) | `sv add vitest` add-on (test lane) |
| cli-adapter | [svelte.dev/docs/cli/sveltekit-adapter](https://svelte.dev/docs/cli/sveltekit-adapter) | `sv add sveltekit-adapter` (build/deploy adapter) |

---

## 2. Canonical Tailwind v4 + SvelteKit setup

The official wiring (tw-vite, tw-sveltekit-guide, cli-tailwind — all agree):

1. **Install** the matched peer pair: `npm install tailwindcss @tailwindcss/vite`.
2. **Vite plugin** (`vite.config.ts`), `tailwindcss()` **before** `sveltekit()`:
   ```ts
   import tailwindcss from '@tailwindcss/vite';
   export default defineConfig({ plugins: [ tailwindcss(), sveltekit() ] });
   ```
3. **CSS entry** — a single line, no v3 triple-directive: `@import "tailwindcss";`
4. **Import CSS in the root layout**: `import "../app.css";` in `src/routes/+layout.svelte`.
5. v4 is **config-as-CSS**: NO `tailwind.config.js`, NO PostCSS/autoprefixer. Plugins via `@plugin "..."`, tokens via `@theme`, custom variants via `@custom-variant`.
6. Consuming a theme token inside a scoped/CSS-module `<style>` block requires `@reference "tailwindcss";` first (build pass resolves theme, not the cascade).

**Argos match (all load-bearing points PASS):**
- `tailwindcss@4.1.18` + `@tailwindcss/vite@4.1.18` (matched pair) — latest published is 4.3.0, so ~2 minors behind; the `@theme inline` + `@apply` semantics in question are stable since v4.0, so the gap is non-blocking.
- `vite.config.ts:36` — `tailwindcss()` is the **first** plugin, ahead of `sveltekit()` (canonical relative order preserved; sentry/optimizeCss/terminal/devtoolsJson interleaved, which the guide permits).
- `app.css:1` — `@import 'tailwindcss';` (single-quote vs docs' double-quote is cosmetic).
- `+layout.svelte:2` — `import '../app.css';`.
- No `tailwind.config.js`/`postcss.config` present — correct for v4.
- Plugins via v4 idiom: `@plugin "@tailwindcss/forms";` + `@plugin "@tailwindcss/typography";` (`app.css:321-322`), deps `@tailwindcss/forms@0.5.10` + `@tailwindcss/typography@0.5.19`.

**Argos divergences (all additive, none breaking):** extra global imports in `app.css` (`tw-animate-css`, `dashboard-utilities.css`), `@custom-variant dark`, the Carbon token bridge `:root` blocks, the large `@theme inline` block, and a second root stylesheet (`carbon-components-svelte/css/all.css`) + a Lunaris SCSS, both JS-imported in the same `+layout.svelte`. The guide is silent on additional global stylesheets — importing more CSS in the root layout is the normal SvelteKit pattern, so no conflict.

---

## 3. sv CLI lanes → Argos `npm run verify`

Argos was hand-assembled, not `sv`-generated (configs live in non-default locations), but its toolchain is **canonical-equivalent** to what the `sv add` add-ons produce. `npm run verify` chains exactly the lanes the add-ons install:

```
verify = format:check  →  typecheck  →  eslint --no-cache  →  test:unit  →  build
```

| sv lane | Doc says | Argos | Verify lane |
| --- | --- | --- | --- |
| `sv add tailwindcss` | `@tailwindcss/vite` + `@import "tailwindcss"` + plugin opts `typography`/`forms` | MATCHES; plugins wired v4-native via `@plugin` | (exercised only in **build**) |
| `sv add prettier` | scripts + `.prettierrc`/`.prettierignore` + eslint integration | prettier 3.6.2 + prettier-plugin-svelte 3.4.0; configs symlinked from `config/` | `format:check` (`prettier --check .`) |
| `sv add eslint` | `eslint.config.js` at **root** + eslint-plugin-svelte + prettier-last | eslint 9.30.1 flat config **relocated to `config/eslint.config.js`** (must pass `--config`); prettier last | `eslint . --config config/eslint.config.js --no-cache` |
| `sv add vitest` | merges test setup **into vite.config** (client/server-aware) | **separate `vitest.config.ts`**, single jsdom env, `plugins: [sveltekit()]` only | `test:unit` (`vitest run src/ tests/unit --passWithNoTests`) |
| `sv add sveltekit-adapter` | adapter wired in `svelte.config.js` | `@sveltejs/adapter-node` 5.5.4 wired; **`@sveltejs/adapter-auto` 6.0.1 orphaned** in devDeps (leftover scaffold) | affects **build** |
| `sv check` | wraps svelte-check (type + a11y + unused-CSS) | `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json` (svelte-check 4.2.2) | `typecheck` |
| `sv migrate` | one-shot codemods (`svelte-5`, `app-state`, `self-closing-tags`, …) | N/A to verify; relevant for runes/$app-state cleanup, then re-run verify | not in verify |

**Critical lane fact (every CSS source agrees):** of the five verify lanes, **only `build` runs the Tailwind v4 CSS pipeline.** `format:check`/`typecheck`/`eslint`/`test:unit` never resolve `@theme`, expand `@apply`, or register utilities. So a broken Carbon→Tailwind token bridge (e.g. an unknown `border-border`) surfaces **only at `npm run build`** (and at runtime). A green `npm run check` does NOT prove the token wiring works.

**Don'ts surfaced by the audit:** do not re-run `sv add eslint`/`sv add tailwindcss`/`sv add sveltekit-adapter` against this repo — they'd AST-rewrite already-correct configs or drop a duplicate root `eslint.config.js` that ignores the `config/` one. Treat all configs as hand-maintained.

**Advisory (non-blocking):** `verify` does not pass `--fail-on-warnings` to svelte-check, so a11y/unused-CSS warnings won't fail CI — a reasonable choice for a migration-in-progress, but a conscious one. `--compiler-warnings "css_unused_selector:ignore"` can quiet expected Carbon-migration noise.

---

## 4. `@theme` + external CSS variables — the authoritative answer

This is the load-bearing section for P2. The authority is **tw-docs-home (/docs/theme)** + **tw-repo source** (`packages/tailwindcss/src/theme.ts` `resolveWith()` and `src/apply.ts`). The thin Svelte CLI / install pages do NOT cover this — do not cite them for P2.

### 4.1 How `@theme inline` resolves `var()` — exactly one level, verbatim substitution

From `theme.ts resolveWith()`:
```
if (value.options & ThemeOptions.INLINE) return [value.value, extra]   // raw stored text, verbatim
return [this.#var(themeKey)!, extra]                                    // non-inline: emits var(--key)
```

- **`@theme inline { --color-border: var(--cds-border-subtle); }`** makes the `border-border` utility emit `border-color: var(--cds-border-subtle)` **literally** — the stored string, one level, no recursion. Tailwind does **not** chase `--cds-border-subtle` to a color, and does **not** follow multi-level `var()` chains.
- **`@theme` (non-inline)** would instead emit `border-color: var(--color-border)` and define `--color-border` as a real CSS var — which is wrong here, because the utility would then point at the Tailwind var, not the live Carbon token.
- Precise wording: inline substitutes the stored string **including any fallback you write**. `var(--cds-border-subtle, #393939)` would inline verbatim as `var(--cds-border-subtle, #393939)`. The behavior is "no recursion," **not** "fallbacks are stripped."

### 4.2 Utility registration vs. concrete value — the key correction to Argos's comment

This is where Argos's `app.css:205-242` comment is **factually overstated**, though the engineering outcome is correct:

- A utility like `border-border` **registers from the namespace KEY** (`--color-border` present in `@theme inline`), **regardless** of whether `--cds-border-subtle` is resolvable at build. The `:root` build shim is **NOT required to make `border-border` a known utility.**
- `apply.ts` throws `Cannot apply unknown utility class \`border-border\`` only if `--color-border` was **never registered** — i.e. if the `@theme inline` block is missing from the Tailwind-imported CSS graph, or `@apply` runs in a scoped/CSS-module context without `@reference`. It does **not** throw merely because `--cds-border-subtle` has no build-time value.
- So the comment's claimed failure mode ("the utility won't register without the shim") is wrong. What the `:root` shim **actually** buys is a **runtime/SSR concrete value** so the inlined `var(--cds-background)` etc. has something to resolve to before/while `all.css` applies (FOUC/SSR safety). That is a runtime/cascade guarantee, not a build-registration one.

### 4.3 Why `all.css` is invisible to the build (P2's premise — CONFIRMED)

`carbon-components-svelte/css/all.css` is **JS-imported** (`+layout.svelte:9`), so it lives outside Tailwind's CSS graph. tw-repo confirms Tailwind v4 only ever resolves what is in its own compiled CSS graph + template class scan; it **never** resolves runtime/external CSS variables at build. So the `--cds-*` tokens are genuinely unavailable to the build — Argos's stated premise is correct.

### 4.4 The correct pattern + the `border-border` resolution

Argos's design — `@theme inline` mapping `--color-* → var(--cds-*)` (one hop) + a `:root` shim declaring `--cds-*` at g100 literals — **is a valid and working fix.** The direct `--color-border → var(--cds-border-subtle)` mapping (one hop) is the right choice; routing through the Lunaris bridge (`--color-border → var(--border) → var(--cds-border-subtle, #hex)`) would inline only the first `var(--border)` and never resolve further, so the direct mapping is correct.

There are **two cleaner official alternatives** to the separate `:root` shim, both doc-grounded:

1. **Inline a fallback** directly in `@theme inline` and drop the second `:root` block:
   `--color-border: var(--cds-border-subtle, #393939);`
   Inline substitutes the fallback verbatim, so the utility emits `var(--cds-border-subtle, #393939)` — runtime resolves to Carbon's live token, build/SSR falls back to the g100 literal. This is the most idiomatic single-source-of-truth form and removes the duplicate `--cds-*` declaration set.

2. **Make Tailwind see the tokens via CSS `@import`** instead of JS-import — but this is **NOT viable for Argos** as a build-time source, because Carbon's package does not ship a CSS-importable file that exposes `--cds-*` to a `@import` in `app.css` cleanly (`all.css` is the runtime bundle; per-theme `g100.css` bakes literal hex and does not expose `--cds-*`, per `+layout.svelte:5-8`). So importing the token CSS into the Tailwind graph is not the clean path here; the fallback-in-`@theme-inline` approach (option 1) is the recommended simplification.

**Verdict on the shim:** keep it OR fold it into inline fallbacks (option 1) — both are correct. The shim is **not** load-bearing for utility registration; it is a runtime/SSR value guarantee. The `app.css:205-242` and `236-242` comments should be softened so a future maintainer does not believe the shim is what makes `border-border` register.

**`border-border` resolution:** with `--color-border` present in `@theme inline` (`app.css:260`) and the `@theme inline` block inside the main `@import "tailwindcss"` graph (it is — `app.css` is the entry), `border-border` IS a registered utility and `@apply border-border` (`app.css:326`) will build. If the build ever errors "unknown utility class `border-border`", the cause is **not** a missing `--cds-*` value — it is the `@theme inline` block being outside the Tailwind graph or an `@apply` in a scoped context missing `@reference "tailwindcss";`. The fact that `@apply border-border` lives in `app.css` (the main graph) means `@reference` is not needed there.

---

## 5. P1/P2 compliance verdict

### P1 — root import `all.css` + `theme="g100"`: **PASS**
Implemented exactly as designed and consistent with canonical wiring:
- `+layout.svelte:9` — `import 'carbon-components-svelte/css/all.css';` (correct: `all.css` exposes the `--cds-*` custom properties; per-theme `g100.css` would bake hex and not expose tokens).
- `app.html:11` — `<html lang="en" class="dark" theme="g100">` selects the dark Carbon theme at runtime.
- Layered on top of the canonical `@import "tailwindcss"` (not a replacement); ordering is sound (`../app.css` first at `:2`, then `all.css` at `:9`, then Lunaris SCSS at `:13` so overrides cascade last). No source contradicts P1. No required changes.

### P2 — `@theme inline` map + `:root` build shim: **PASS (functionally correct) — ADJUST comments + optional simplification**
Mechanically validated by tw-repo source: one-level inline resolution confirmed, direct `--cds-*` mapping is the right choice, `all.css` invisibility to build confirmed. The implementation builds and is correct. Required/recommended adjustments:

- **ADJUST (docs, required for accuracy):** Soften the `app.css:205-242` / `:236-242` comments. The shim is a **runtime/SSR value guarantee**, NOT what registers the utility. State that `border-border` registers from the `--color-border` key in `@theme inline`, and that an "unknown utility" error would mean the `@theme inline` block left the Tailwind graph or an `@apply` ran without `@reference` — not a missing `--cds-*` value.
- **OPTIONAL (simplification):** Fold the `:root` shim (`app.css:213-234`) into inline fallbacks — `--color-border: var(--cds-border-subtle, #393939);` etc. — eliminating the duplicate `--cds-*` block and keeping the g100 fallback hex centralized in one place. Both forms are valid; this reduces drift between two literal sets.
- **NOTE (no action):** the `border-border` build error mentioned in context is resolved by the analysis above — it is registered correctly as-is; if it recurs, it is a graph/`@reference` issue, not a token-value issue.

### CI gating — required guardrail (both phases)
Gate P1/P2 invariants on **`npm run build`**, not `npm run check`/`test:unit`:
- `vitest.config.ts:6` uses `plugins: [sveltekit()]` only — it **omits `tailwindcss()`**, so the Tailwind pipeline is never exercised by `test:unit`. A regression that removes the shim/map and breaks `border-border` would still pass tests and svelte-check; it fails only at `build`.
- svelte-check (`typecheck`) and eslint also never run Tailwind. The `build` lane (already last in `verify`) is the sole authoritative guard — ensure it is never skipped for P2 work.

### Housekeeping (out of P1/P2 scope, flagged not fixed)
- `@sveltejs/adapter-auto@6.0.1` is orphaned in devDeps (adapter-node is the wired adapter) — leftover scaffold; mention to owner, do not delete unasked.
- Version pin 4.1.18 vs latest 4.3.0 — upgrade path exists, non-blocking; the audited semantics are unchanged across that range.
