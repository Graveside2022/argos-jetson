<script lang="ts">
	// spec-024 PR2 T016 — Mk II Dot primitive.
	// 6-px status dot with semantic kind:
	//   ok       → green   (healthy)
	//   warn     → amber   (degraded)
	//   err      → red     (faulted)
	//   inactive → ink-4   (offline / unknown)
	// Per Lunaris design rule (CLAUDE.md "Color Architecture"): color is never
	// the sole status indicator — `aria-label` defaults to `kind`, so screen
	// readers + automated tests get a textual cue.

	type DotKind = 'ok' | 'warn' | 'err' | 'inactive';

	interface Props {
		kind?: DotKind;
		label?: string;
		pulse?: boolean;
	}

	let { kind = 'ok', label, pulse = false }: Props = $props();
</script>

<span class="pill" role="status" aria-label={label ?? kind}>
	<span class="dot {kind}" class:pulse aria-hidden="true"></span>
</span>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		padding: 0;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--mk2-ink-4);
		display: inline-block;
	}

	.dot.ok {
		background: var(--mk2-green);
		box-shadow: 0 0 0 2px oklch(72% 0.17 148 / 0.15);
	}
	.dot.warn {
		background: var(--mk2-amber);
		box-shadow: 0 0 0 2px oklch(80% 0.155 78 / 0.18);
	}
	.dot.err {
		background: var(--mk2-red);
		box-shadow: 0 0 0 2px oklch(65% 0.22 22 / 0.2);
	}
	.dot.inactive {
		background: var(--mk2-ink-4);
	}

	.dot.pulse {
		animation: dot-pulse 1.6s infinite;
	}

	@keyframes dot-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
