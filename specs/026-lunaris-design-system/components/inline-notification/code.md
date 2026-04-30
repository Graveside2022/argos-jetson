# InlineNotification — Code

The `<InlineNotification>` chassis wrapper at `src/lib/components/chassis/forms/InlineNotification.svelte` is a thin Svelte-5-runes adapter over Carbon's Svelte-4 InlineNotification primitive.

## Rationale for the wrapper layer

Carbon ships `carbon-components-svelte@0.107.0`, which is **still Svelte 4 internally** — uses `export let`, `createEventDispatcher`, `$$restProps`. Argos consumer code is Svelte 5 with runes. The wrapper's job:

1. Accept Svelte-5-rune-style typed props via `$props()`.
2. Forward to Carbon's Svelte-4 props/events.
3. Auto-derive an appropriate `role` ARIA attribute from `kind` (so a consumer that forgets `role` still gets correct screen-reader behaviour).
4. Bridge Carbon's `dispatch("close", { timeout })` to a Svelte-5 callback prop `onClose?(fromTimeout)`.

## Public API — Props

| Prop                     | Type                                                                            | Default                          | Description                                                                       |
| ------------------------ | ------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `open`                   | `boolean`                                                                       | `true` (`$bindable`)             | Controlled visibility. Two-way bindable. Set `false` to dismiss programmatically. |
| `kind`                   | `'error' \| 'info' \| 'info-square' \| 'success' \| 'warning' \| 'warning-alt'` | `'error'`                        | Severity / intent variant. Drives color, icon, and default `role`.                |
| `title`                  | `string`                                                                        | `''`                             | Bold first line.                                                                  |
| `subtitle`               | `string`                                                                        | `''`                             | Secondary supporting line below the title.                                        |
| `lowContrast`            | `boolean`                                                                       | `false`                          | Swap tinted background for neutral; retain colored border-left + icon.            |
| `timeout`                | `number`                                                                        | `0`                              | Milliseconds before auto-dismiss. `0` = no timeout (sticky).                      |
| `role`                   | `string \| undefined`                                                           | derived (`'alert'` / `'status'`) | Override the auto-resolved ARIA role.                                             |
| `hideCloseButton`        | `boolean`                                                                       | `false`                          | Suppress the dismiss-X. Use only for programmatically managed notifications.      |
| `statusIconDescription`  | `string \| undefined`                                                           | `` `${kind} icon` ``             | aria-label for the leading status icon.                                           |
| `closeButtonDescription` | `string`                                                                        | `'Close notification'`           | aria-label for the close-X button.                                                |
| `class`                  | `string \| undefined`                                                           | undefined                        | Extra class forwarded to Carbon's outer wrapper.                                  |

## Public API — Callback props

Chassis uses Svelte 5 callback props that bridge Carbon's Svelte 4 `createEventDispatcher` events.

| Callback prop | Carbon source event              | Argument                                                          | Description                                                                                                                                                                                                                 |
| ------------- | -------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onClose`     | `dispatch("close", { timeout })` | `fromTimeout: boolean` (true if dismissed by `timeout` countdown) | Fired ONLY when Carbon dispatches `close` (close-button click OR auto-timeout). Setting `bind:open={false}` from external state does NOT fire `onClose` — handle analytics in the consumer state-change path for that case. |

## Slots / children

InlineNotification has **no slot / children** — title and subtitle are passed as string props. This is a deliberate Carbon constraint; if you need rich content (links, code spans) inside a notification, switch to `<ToastNotification>` or render markup adjacent to the notification.

## Carbon → chassis API mapping

| Carbon prop / event  | Chassis prop / callback                          |
| -------------------- | ------------------------------------------------ |
| `bind:open`          | `bind:open` (forwarded directly via `$bindable`) |
| `kind`               | `kind` (same enum)                               |
| `title` / `subtitle` | `title` / `subtitle` (string props)              |
| `lowContrast`        | `lowContrast`                                    |
| `timeout`            | `timeout` (ms; 0 = sticky)                       |
| `role`               | `role` (overrides auto-derived)                  |
| `hideCloseButton`    | `hideCloseButton`                                |
| `on:close`           | `onClose: (fromTimeout) => void`                 |

## Paste-ready snippets

### Basic error notification (default kind)

```svelte
<script lang="ts">
	import { InlineNotification } from '$lib/components/chassis/forms';

	let open = $state(true);
</script>

{#if open}
	<InlineNotification
		bind:open
		title="Connection failed."
		subtitle="HackRF device not detected on USB bus."
		onClose={() => (open = false)}
	/>
{/if}
```

### Success notification (auto-dismiss after 4s)

```svelte
<InlineNotification
	bind:open
	kind="success"
	title="Saved."
	subtitle="Frequency profile written to disk."
	timeout={4000}
	onClose={(fromTimeout) => console.info('saved-toast dismissed', { byTimeout: fromTimeout })}
/>
```

### Warning notification (sticky, low-contrast for stacking)

```svelte
<InlineNotification
	bind:open
	kind="warning"
	title="GPS fix degraded."
	subtitle="Position accuracy > 50m. Consider relocating."
	lowContrast
	onClose={() => (open = false)}
/>
```

### Info notification (custom role override)

```svelte
<InlineNotification
	bind:open
	kind="info"
	title="Auto-scan paused."
	subtitle="Sweep will resume when current capture completes."
	role="status"
	onClose={() => (open = false)}
/>
```

## What the wrapper does NOT expose

- `hideIcon` — not surfaced by this wrapper. If you need a text-only notification, use a different component.
- `light` (Carbon's light-theme variant) — Argos is dark-only per Lunaris spec.
- Direct keyboard event forwarding — InlineNotification does not implement Escape-to-close; dismissal is via the close button (Tab + Enter/Space), `bind:open` from external state, or `timeout > 0` for auto-dismiss. Per Carbon source (carbon-components-svelte v0.107.0 `Notification/InlineNotification.svelte`) — no Escape handler is registered; `role="alert"` semantic requires explicit interaction.
- Multiple action buttons — InlineNotification has no action-button slot. Use `<ActionableNotification>` (not yet wrapped) for that case.

## File budget

The wrapper is 56 LOC. Well under the 80 LOC target — InlineNotification has a small surface area and no overload branching.

## Tests

No Vitest tests in PR-A canary — Carbon's own test suite covers the underlying primitive. Argos-side smoke:

1. `npm run build` clean (vite SSR compile catches prop-type mismatch).
2. Chrome-devtools MCP visual diff per kind (visual diff procedure in `style.md`).
3. Manual TAB / ENTER / ESC / auto-timeout trace (`accessibility.md`).
