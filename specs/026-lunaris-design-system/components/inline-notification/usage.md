# InlineNotification — Usage

**Status:** Phase 4 PR-A — wrapper + canary live
**Last updated:** 2026-04-30
**Implementation file:** `src/lib/components/chassis/forms/InlineNotification.svelte`
**Carbon component:** `<InlineNotification>` from `carbon-components-svelte` v0.107.0+
**Carbon source:** `node_modules/carbon-components-svelte/src/Notification/InlineNotification.svelte`

---

## When to use

A persistent, in-flow alert tied to a panel's state — error after a failed fetch, warning when a hardware probe degrades, info banner when a mode is provisional. Sits inside the surface that owns the state, not in a global region.

## When NOT to use

- **Transient action confirmation** (e.g., "Saved", "Copied") → use `chassis/forms/ToastNotification.svelte` (auto-dismiss, top-right region).
- **Blocking confirmation that demands acknowledgement** → use `chassis/forms/Modal.svelte`.
- **Tooltip-style hover help** → use `chassis/forms/Tooltip.svelte`.
- **Long-form CTA banner with multiple actions** → use `<ActionableNotification>` (deferred; not yet wrapped).

## Argos surface inventory (Phase 4 scope — 14 sites)

13 inline `<div role="alert">` patterns + 1 inline-with-timeout. Toasts (3 sites) belong to `toast-notification/usage.md`.

| File | Line | Variant | PR |
|------|------|---------|----|
| `src/lib/components/dashboard/panels/FilterBar.svelte` | 121 | Inline error | **PR-A canary** |
| `src/lib/components/dashboard/panels/BluetoothPanel.svelte` | 278 | Inline error | PR-B sweep |
| `src/lib/components/dashboard/panels/UASPanel.svelte` | 286 | Inline error | PR-B sweep |
| `src/lib/components/dashboard/views/ReportsView.svelte` | 364, 612, 615 | Inline error | PR-B sweep |
| `src/lib/components/dashboard/panels/SessionSelector.svelte` | — | Inline error | PR-B sweep |
| `src/lib/components/chassis/MissionStrip.svelte` | — | Inline error | PR-B sweep |
| `src/lib/components/dashboard/tabs/HostMetricsTab.svelte` | — | Inline error | PR-B sweep |
| `src/lib/components/dashboard/panels/FrequencyTuner.svelte` | — | Inline error | PR-B sweep |
| `src/lib/components/dashboard/panels/SpectrumControls.svelte` | — | Inline error | PR-B sweep |
| `src/routes/(dashboard)/trunk-recorder/+page.svelte` | — | Inline error | PR-B sweep |
| `src/lib/components/dashboard/forms/PresetForm.svelte` | — | Inline error | PR-B sweep |
| `src/lib/components/dashboard/panels/GpConfigView.svelte` | 80 | Inline + 4s timeout | PR-B sweep |

PR-B will replace each `<div role="alert">{message}</div>` with `<InlineNotification kind="error" title={message} hideCloseButton />`. The 4s-timeout site uses `<InlineNotification timeout={4000} />`.

## Kind → role mapping

| `kind` | Default `role` | Carbon icon |
|--------|----------------|-------------|
| `'error'` | `'alert'` | error-filled |
| `'warning'`, `'warning-alt'` | `'alert'` | warning |
| `'success'` | `'status'` | checkmark-filled |
| `'info'`, `'info-square'` | `'status'` | information |

Override via `role={'status'}` or `role={'alert'}` if the consumer needs a non-default. Argos defaults match the Carbon contract: errors and warnings interrupt; success and info simply update.

## Color is not the only signal

Per `.claude/rules/design-system.md`, every kind pairs the color with a label and a status icon. Carbon does this automatically — do not strip the icon by setting an empty `statusIconDescription`.

## Quick start

```svelte
<script lang="ts">
  import InlineNotification from '$lib/components/chassis/forms/InlineNotification.svelte';

  let errorMessage = $state<string | null>(null);
</script>

{#if errorMessage}
  <InlineNotification
    kind="error"
    title={errorMessage}
    hideCloseButton
  />
{/if}
```

## See also

- `style.md` — Lunaris token overrides (PR-B)
- `code.md` — `timeout` semantics + cancelable close events (PR-B)
- `accessibility.md` — `role="alert"` vs `role="status"` (PR-B)
