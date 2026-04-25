<script lang="ts">
	// spec-024 PR1 T011 — Single GO/NO-GO row in the WeatherPanel ops matrix.
	// Pure presentational. Color tokens come from --mk2-green / --mk2-amber.

	interface Props {
		ok: boolean;
		label: string;
		note: string;
	}

	let { ok, label, note }: Props = $props();
</script>

<div class="wx-fc-row">
	<div class="wx-fc-dot" class:ok class:no={!ok}></div>
	<div class="wx-fc-label mono">{label}</div>
	<div class="wx-fc-state mono" style:color={ok ? 'var(--mk2-green)' : 'var(--mk2-amber)'}>
		{ok ? 'GO' : 'NO-GO'}
	</div>
	<div class="wx-fc-note mono">{note}</div>
</div>

<style>
	.wx-fc-row {
		display: grid;
		grid-template-columns: 12px 150px 56px 1fr;
		gap: 10px;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px dashed var(--mk2-line);
		font-size: var(--mk2-fs-3);
	}

	.wx-fc-row:last-child {
		border-bottom: 0;
	}

	.wx-fc-dot {
		width: 8px;
		height: 8px;
		background: var(--mk2-ink-4);
	}

	.wx-fc-dot.ok {
		background: var(--mk2-green);
		box-shadow: 0 0 6px color-mix(in oklch, var(--mk2-green) 70%, transparent);
	}

	.wx-fc-dot.no {
		background: var(--mk2-amber);
		box-shadow: 0 0 6px color-mix(in oklch, var(--mk2-amber) 70%, transparent);
	}

	.wx-fc-label {
		color: var(--mk2-ink);
		letter-spacing: 0.06em;
	}

	.wx-fc-state {
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.14em;
	}

	.wx-fc-note {
		color: var(--mk2-ink-3);
		font-size: var(--mk2-fs-2);
	}

	.mono {
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
