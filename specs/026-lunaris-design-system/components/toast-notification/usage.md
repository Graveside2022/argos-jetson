# ToastNotification — Usage

**Status:** Phase 4 PR-A — wrapper + canary live
**Last updated:** 2026-04-30
**Implementation files:**
- Wrapper: `src/lib/components/chassis/forms/ToastNotification.svelte`
- Region: `src/lib/components/chassis/ToastRegion.svelte`
- Store: `src/lib/stores/toast.svelte.ts`
**Carbon component:** `<ToastNotification>` from `carbon-components-svelte` v0.107.0+
**Carbon source:** `node_modules/carbon-components-svelte/src/Notification/ToastNotification.svelte`

---

## When to use

Transient, bottom-right confirmation or error after an operator action — Kismet start failed, report copied, link clipboard saved. Auto-dismiss (default 4 s). Stack vertically when fired in quick succession.

## When NOT to use

- **Persistent, panel-scoped state alert** → use `chassis/forms/InlineNotification.svelte`.
- **Blocking confirmation** → use `chassis/forms/Modal.svelte`.
- **Help text on a control** → use `chassis/forms/Tooltip.svelte`.

## Argos surface inventory (Phase 4 scope — 3 sites today, 4-after PR-A)

| File | Line | Pattern | PR |
|------|------|---------|----|
| `src/lib/components/dashboard/panels/devices/DeviceToolbar.svelte` | 53, 70 | `toast.error` (svelte-sonner) | **PR-A canary** |
| `src/lib/components/dashboard/panels/ToolsNavigationView.svelte` | 174, 177, 194, 201 | `toast.error/info` (svelte-sonner) | PR-B sweep |
| `src/lib/components/tak/TakAuthEnroll.svelte` | 34, 37, 63 | `toast.success/error` (svelte-sonner) | PR-B sweep |

PR-B closes the sweep, removes `<Toaster>` from `+layout.svelte`, drops `svelte-sonner` from `package.json`.

## Drop-in API (matches svelte-sonner shape)

```ts
import { toast } from '$lib/stores/toast.svelte';

toast.error('Kismet control failed');
toast.success('Report copied', { subtitle: 'Caveat: redacts mission name' });
toast.info('Link saved');
toast.warning('GPS lost — falling back to last fix', { timeout: 8000 });
toast.dismiss(idFromCallSite);
```

The store keeps a reactive `ToastEntry[]`; `<ToastRegion />` (mounted in `+layout.svelte`) renders each entry and calls `toast.dismiss(id)` on Carbon's `close` event.

## Kind → role mapping

Same matrix as `inline-notification/usage.md`. `'error'`, `'warning'`, `'warning-alt'` → `role="alert"`; everything else → `role="status"`.

## Default timeout

`4000 ms`. Override per-call (`{ timeout: 8000 }`) or set `timeout: 0` for sticky toast that requires a click. Sticky toasts should be rare — prefer `<InlineNotification>` for that case.

## Mount

Mount `<ToastRegion />` once in `+layout.svelte` after the `<Toaster>` element. PR-B removes the `<Toaster>`. Until then both regions co-exist; chassis-store toasts appear in the chassis region, sonner toasts continue rendering in the sonner region. No conflict — different DOM trees, different z-indexes.

## See also

- `style.md` — Lunaris token map for toast container + region (PR-B)
- `code.md` — store anatomy, dismiss semantics, full-width variant (PR-B)
- `accessibility.md` — assertive vs polite live region (PR-B)
