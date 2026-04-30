# Modal — Usage

**Status:** Phase 4 PR-A — wrapper + canary live
**Last updated:** 2026-04-30
**Implementation file:** `src/lib/components/chassis/forms/Modal.svelte`
**Carbon component:** `<Modal>` from `carbon-components-svelte` v0.107.0+
**Carbon source:** `node_modules/carbon-components-svelte/src/Modal/Modal.svelte`

---

## When to use

Centered overlay that demands the operator's full attention before they continue. Use for a confirmation prompt, a focused form (e.g., new mission, edit report), an error/danger acknowledgement, or for surfacing detail content that would otherwise overflow the dashboard chrome.

## When NOT to use

- **Slide-from-side panel** (mission rail, settings drawer) → use `chassis/Drawer.svelte` (separate primitive, deferred to Phase 7+).
- **Hover/click popover with a small chunk of help text or icon-driven menu** → use `chassis/forms/Tooltip.svelte`.
- **Transient feedback after an action** → use `chassis/forms/ToastNotification.svelte` (auto-dismiss).
- **Persistent inline alert tied to a panel's state** → use `chassis/forms/InlineNotification.svelte`.
- **Bespoke overlay with raster background** (`ToolsFlyout` z-index 1000 pattern) — defer to PR-B with explicit z-index audit; do not migrate ad hoc.

## Argos surface inventory (Phase 4 scope — 4 sites)

| File | Line | Pattern | PR |
|------|------|---------|----|
| `src/lib/components/gsm-evil/ErrorDialog.svelte` | 22 | bits-ui AlertDialog, single OK button | **PR-A canary** |
| `src/lib/components/screens/parts/EventDetailDialog.svelte` | 53 | bits-ui AlertDialog, no buttons | PR-B sweep |
| `src/lib/components/dashboard/views/ReportsView.svelte` | 111 | Custom modal, has form, has scroll, 3-button area | PR-B sweep |
| `src/lib/components/chassis/ToolsFlyout.svelte` | top-level | Custom overlay, search + scroll, z-index 1000 | PR-B sweep (audit z-index) |

## Size mapping

| Argos `size` | Carbon `size` | Use |
|--------------|---------------|-----|
| `'sm'` | `'sm'` | Confirmation prompt, compact error |
| `'md'` (default) | `undefined` | Default — most flows |
| `'lg'` | `'lg'` | Forms, scrolling content, multi-step |

Carbon Modal does not ship an `'md'` size; passing `undefined` yields Carbon's default centered width which matches the visual `md` slot. Carbon also supports `'xs'`, which the wrapper does not expose — use `'sm'` instead.

## Event bridge (Carbon Svelte-4 → Argos Svelte-5)

| Carbon event | Wrapper callback | Detail |
|--------------|------------------|--------|
| `close` | `onClose?(trigger)` | `trigger ∈ {'escape-key', 'outside-click', 'close-button'}` |
| `submit` | `onSubmit?()` | Fires on primary button + Enter key (when `shouldSubmitOnEnter`) |
| `click:button--secondary` | `onClickSecondary?(text)` | `text` = button label, useful for 3-button modals via `secondaryButtons` 2-tuple |

`open` is `$bindable` — parent owns the open/close state.

## Quick start

```svelte
<script lang="ts">
  import Modal from '$lib/components/chassis/forms/Modal.svelte';

  let open = $state(false);
</script>

<button onclick={() => (open = true)}>Show</button>

<Modal
  bind:open
  modalHeading="Discard report?"
  modalLabel="Reports"
  primaryButtonText="Discard"
  secondaryButtonText="Cancel"
  size="sm"
  danger
  onSubmit={() => discardReport()}
  onClose={(trigger) => console.log('closed via', trigger)}
>
  This action cannot be undone.
</Modal>
```

## See also

- `style.md` — Lunaris token map (PR-B)
- `code.md` — wrapper anatomy + bridge pattern (PR-B)
- `accessibility.md` — focus trap, ESC handling, screen-reader notes (PR-B)
