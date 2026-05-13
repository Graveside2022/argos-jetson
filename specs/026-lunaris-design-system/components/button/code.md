# Button — Code

**Status:** ✅ Phase 1 done 2026-04-29 (atomic swap)
**Last updated:** 2026-04-29
**Implementation file:** `src/lib/components/mk2/IconBtn.svelte` (Carbon-wrapped; atomic-swap-merged from `IconBtnCarbon.svelte` parallel impl; bespoke deleted)
**Carbon component:** `<Button>` from `carbon-components-svelte` v0.107.0+

---

## Argos `IconBtn` API (post-migration)

The Argos `IconBtn` wrapper preserves the existing public API to minimize call-site churn. Internally it delegates to Carbon's `<Button kind="ghost" iconOnly>`.

```ts
interface Props {
	name: string; // lucide icon name
	size?: number; // icon size in px (default 12 per v2 mockup)
	title?: string; // tooltip text + aria-label
	ariaLabel?: string; // overrides title for aria-label specifically (Carbon iconDescription)
	variant?: 'default' | 'ghost'; // density variant — only the 2 actually shipped
	disabled?: boolean;
	onClick?: () => void;
}
```

**Variant mapping**:

| Argos `variant`       | Carbon `kind` + `size`               | Visual                                                         |
| --------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `'default'` (default) | `kind="ghost" size="small" iconOnly` | 28×28px chassis-level icon button (1px border, transparent bg) |
| `'ghost'`             | `kind="ghost" size="small" iconOnly` | 28×28px chassis-level icon button (no border, transparent bg)  |

**Shipped variants only.** The earlier `'panel-actions'` / `'tab-strip'` variants from the pre-impl spec were YAGNI — the 4 actual consumers (Tweaks, Topbar, MissionStrip, CapturesTab) only needed `'default'` and `'ghost'`. Add more when a real consumer surface needs one.

---

## Consumer pattern

**Before (bespoke)**:

```svelte
<script>
	import IconBtn from '$lib/components/mk2/IconBtn.svelte';
</script>

<IconBtn name="x" title="Close" onClick={() => dispatch('close')} />
```

**After (Carbon-wrapped, public API unchanged)**:

```svelte
<script>
	import IconBtn from '$lib/components/mk2/IconBtn.svelte'; // same import
</script>

<IconBtn name="x" title="Close" onClick={() => dispatch('close')} />
```

Internal implementation delegates to Carbon — call sites don't change. This is the **adapter pattern** (Gang of Four) explicitly chosen so Phase 1 has zero consumer-side churn.

---

## Direct Carbon `<Button>` use

For new buttons that want full Carbon API access (primary CTAs, dialog actions, batch action bars), import Carbon directly:

```svelte
<script>
	import { Button } from 'carbon-components-svelte';
	import { Add16, Save16 } from 'carbon-icons-svelte';
</script>

<Button kind="primary" icon={Add16} on:click={createMission}>New mission</Button>
<Button kind="secondary" icon={Save16} on:click={save}>Save</Button>
<Button kind="danger" on:click={confirmDelete}>Delete</Button>
```

The Lunaris theme overlay (`src/lib/styles/lunaris-carbon-theme.scss` post-Phase-1) translates Carbon button tokens to Argos's accent palette automatically. No per-call-site styling.

---

## State + interaction semantics

- **Click** — Carbon's `<Button>` exposes `on:click` event; Argos wrapper translates to `onClick` callback prop for Svelte 5 idiom (no event dispatchers in new code).
- **Disabled** — passes through to Carbon; Carbon enforces `aria-disabled` + `cursor: not-allowed` + skips click events.
- **Loading** — Carbon ships `skeleton` prop for indicating async pending. Argos uses Carbon's loading variant directly when relevant.
- **Tooltip** — Carbon's `iconDescription` prop drives both `aria-label` and tooltip. Argos `title` prop maps to it.
- **Icon size** — Carbon's `<Button iconOnly>` doesn't constrain icon size; consumer passes any `<Icon size={n}>`. Argos default 12px per v2 mockup.

---

## Migration consumer call-sites

Per `LSP findReferences` on `IconBtn` (Phase 1 step 2 will run this), expected consumer count: ~50-100. Migration in tiers:

### Tier 1: Chassis (highest visibility, lowest count)

- `src/lib/components/chassis/TopStatusBar.svelte` — weather, GPS, command-bar buttons
- `src/lib/components/chassis/IconRail.svelte` — primary navigation icon-only buttons (NOTE: these are large 48px buttons; may stay bespoke or use Carbon `kind="ghost" size="lg"`)
- `src/lib/components/chassis/Drawer.svelte` — collapse/expand button

### Tier 2: Screens

- `src/lib/components/screens/SystemsScreen.svelte` — sub-tab + content buttons
- `src/lib/components/screens/MapScreen.svelte` — layer toggles, location-zoom controls
- (other screens — full inventory in Phase 1 step 2)

### Tier 3: Drawer tabs + inline actions

- `src/lib/components/chassis/drawer-tabs/CapturesTab.svelte` — download IconBtn per row
- All other inline IconBtn instances surface here

Each tier ships as its own commit on the Phase 1 branch for bisect granularity.

---

## What we don't migrate yet

These wait for later phases or stay bespoke:

- `<ButtonSet>` (Carbon's button-row container) — not used in Argos drawer chrome; reserved for Phase 4 modal dialogs.
- `<ButtonSkeleton>` — async loading buttons; reserved for screens that have async-pending UX.
- Buttons embedded inside Carbon `<DataTable>` slots — handled in Phase 2 alongside the DataTable migration.

---

## Authority citations

- Carbon Svelte component: <https://svelte.carbondesignsystem.com/?path=/docs/components-button--default>
- Carbon Button source: `docs/carbon-design-system/packages/react/src/components/Button/`
- Argos current bespoke: `src/lib/components/mk2/IconBtn.svelte`
- Adapter pattern reference: <https://refactoring.guru/design-patterns/adapter>
