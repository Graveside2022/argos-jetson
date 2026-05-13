# Tooltip — Usage

**Status:** Phase 4 PR-A — wrapper + canary live
**Last updated:** 2026-04-30
**Implementation file:** `src/lib/components/chassis/forms/Tooltip.svelte`
**Carbon component:** `<Tooltip>` from `carbon-components-svelte` v0.107.0+
**Carbon source:** `node_modules/carbon-components-svelte/src/Tooltip/Tooltip.svelte`

---

## When to use

Carbon's `<Tooltip>` is **its own trigger**: it renders a button (default: an `Information` info icon) and shows the tooltip body on hover/focus/click. Use when:

- The help text is **multi-line** or contains **icons + structure** that a native `title=` cannot express.
- The hint is **operator-critical** (security, mission state, fingerprint detail) and worth the extra UI weight.
- The control already needs an info-icon affordance — Tooltip provides it.

## When NOT to use

- **Single-line, low-stakes hint** → keep the native HTML `title=` attribute. Argos has 102 such sites; only 5 migrate. Browser-rendered, a11y-valid, zero maintenance.
- **Tap target on touch screens** without a hover affordance → Tooltip is a button + popover, but for mobile-first targets prefer an inline label or `<InlineNotification>`.
- **Persistent rich content** → use `<Modal>` or a side panel.

## Argos surface inventory (Phase 4 scope — 5 sites of 102)

| File                                                                                   | Line               | Why migrate                                                                         | PR              |
| -------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------- | --------------- |
| `src/lib/components/dashboard/panels/BluetoothPanel.svelte`                            | 245, 252, 259, 266 | Multi-line capture-mode descriptions (CLEAN/VOLUME/MAX, ALL CH, ACTIVE, GPS, CODED) | **PR-A canary** |
| `src/lib/components/dashboard/panels/devices/DevicesPanel.svelte`                      | 232-275            | 6 filter-badge tooltips with security warnings                                      | PR-B sweep      |
| `src/lib/components/dashboard/panels/devices/DevicePriorityTable.svelte`               | 197                | Beacon fingerprint hex display (scrollable)                                         | PR-B sweep      |
| `src/lib/components/dashboard/views/MissionHeader.svelte`                              | 185                | Session-state explanation + actionable hint                                         | PR-B sweep      |
| `src/lib/components/dashboard/agent/AgentChatPanel.svelte` + `AgentChatToolbar.svelte` | multiple           | Send/clear icon buttons, future keyboard-shortcut hints                             | PR-B sweep      |

The remaining 97 `title=` instances stay native — see `migration-roadmap.md` for the cost-vs-benefit decision.

## Direction + alignment defaults

Wrapper defaults: `direction="bottom"`, `align="start"`. Override on a per-site basis when the trigger sits at a panel edge.

| Direction            | When                                                           |
| -------------------- | -------------------------------------------------------------- |
| `'bottom'` (default) | Most cases — opens downward, doesn't collide with panel header |
| `'top'`              | Trigger sits near the bottom of a scrollable container         |
| `'right'` / `'left'` | Trigger embedded in a vertical rail (side menu, mission strip) |

## Trigger anatomy

```svelte
<Tooltip
	iconDescription="ALL CH capture details"
	triggerText="ALL CH"
	direction="bottom"
	align="start"
>
	Capture full BLE band 2402–2480 MHz (96 channels). Default covers ch37+ch38 only.
</Tooltip>
```

`iconDescription` is the screen-reader label for the trigger button. `triggerText` is the visible label next to the info icon. `hideIcon={true}` swaps the info icon for plain text-only triggers.

## Modal composition

Carbon auto-portals tooltips that live inside a `<Modal>`. No extra wiring. Verified visually for `ToolsFlyout` migration in PR-B (Tooltip-in-Modal site).

## Quick start

```svelte
<script lang="ts">
	import Tooltip from '$lib/components/chassis/forms/Tooltip.svelte';
</script>

<Tooltip
	triggerText="ACTIVE"
	iconDescription="ACTIVE scan tooltip"
	direction="bottom"
	align="start"
>
	HCI LE active scan via system Bluetooth — enriches device names + services.
</Tooltip>
```

## See also

- `style.md` — Lunaris token overrides for the tooltip popover (PR-B)
- `code.md` — `enterDelayMs` / `leaveDelayMs` tuning, portal behavior (PR-B)
- `accessibility.md` — focus, keyboard activation, ESC semantics (PR-B)
