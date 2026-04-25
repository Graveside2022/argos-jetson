<script lang="ts">
	import { CloudSun } from '@lucide/svelte';

	import type { FlightCategory, WeatherReport } from '$lib/types/weather';

	import WeatherPanel from './WeatherPanel.svelte';

	// spec-024 PR1 T011 — Mk II weather popover trigger.
	// Button + open state + click-outside / Escape close. Popover body lives in
	// WeatherPanel.svelte. Split per CR feedback to stay under the 300-LOC cap.

	interface Props {
		wx?: WeatherReport | null;
		loading?: boolean;
		error?: string | null;
		disabled?: boolean;
		empty?: boolean;
	}

	let {
		wx = null,
		loading = false,
		error = null,
		disabled = false,
		empty = false
	}: Props = $props();

	let open = $state(false);
	let wrapEl: HTMLDivElement | undefined = $state();

	const CAT_STROKE: Record<FlightCategory, string> = {
		VFR: 'var(--mk2-green)',
		MVFR: 'var(--mk2-cyan)',
		IFR: 'var(--mk2-red)',
		LIFR: 'var(--mk2-red)'
	};

	const catColor = $derived(wx ? CAT_STROKE[wx.cat] : 'var(--mk2-ink-4)');
	const buttonLabel = $derived.by(() => {
		if (loading) return 'WX…';
		if (error) return 'WX ERR';
		if (!wx) return 'NO WX';
		return wx.cat;
	});
	const tempLabel = $derived(wx ? `${Math.round(wx.temp)}°C` : '—');
	const windLabel = $derived(wx ? `WIND ${wx.wind.spd}KT` : 'WIND —');

	function close(): void {
		open = false;
	}

	function isOutsideClick(e: MouseEvent): boolean {
		if (!wrapEl) return false;
		return e.target instanceof Node && !wrapEl.contains(e.target);
	}

	function onPointerDown(e: MouseEvent): void {
		if (isOutsideClick(e)) close();
	}

	function onKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Escape') close();
	}

	$effect(() => {
		if (!open) return;
		document.addEventListener('mousedown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('mousedown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

<div class="wx-wrap" bind:this={wrapEl}>
	<button
		type="button"
		class="wx-btn"
		class:open
		title="Weather & flight conditions"
		aria-haspopup="dialog"
		aria-expanded={open}
		{disabled}
		aria-disabled={disabled}
		onclick={() => (open = !open)}
	>
		<CloudSun size={13} />
		<span class="mono cat" style:color={catColor}>{buttonLabel}</span>
		<span class="mono ink-3">{tempLabel}</span>
		<span class="mono ink-4">{windLabel}</span>
	</button>

	{#if open}
		<WeatherPanel {wx} {loading} {error} {disabled} {empty} />
	{/if}
</div>

<style>
	.wx-wrap {
		position: relative;
		display: inline-flex;
	}

	.wx-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 26px;
		padding: 0 10px;
		background: transparent;
		border: 1px solid var(--mk2-line-2);
		color: var(--mk2-ink-2);
		font: 500 var(--mk2-fs-3) / 1 var(--mk2-f-mono);
		letter-spacing: 0.04em;
		cursor: pointer;
		transition:
			border-color var(--mk2-mo-2),
			background var(--mk2-mo-2),
			color var(--mk2-mo-2);
	}

	.wx-btn:hover,
	.wx-btn.open {
		border-color: var(--mk2-line-hi);
		color: var(--mk2-ink);
		background: var(--mk2-bg-2);
	}

	.cat {
		font-weight: 600;
		letter-spacing: 0.08em;
	}

	.mono {
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.ink-3 {
		color: var(--mk2-ink-3);
	}
	.ink-4 {
		color: var(--mk2-ink-4);
	}
</style>
