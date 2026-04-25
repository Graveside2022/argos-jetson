<script lang="ts">
	import { Settings2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	import IconBtn from '$lib/components/mk2/IconBtn.svelte';
	import Tweaks from '$lib/components/mk2/Tweaks.svelte';
	import { latLonToMGRS } from '$lib/utils/mgrs-converter';

	// spec-024 PR1 T008 — Mk II topbar.
	// Brand mark + ARGOS MK II wordmark + weather slot + city + lat/lon + MGRS
	// + Z-clock (DDHHMM Zulu, ticks every 1s via $effect).
	// MGRS derives from lat/lon via existing src/lib/utils/mgrs-converter.ts.
	// WeatherButton (T011) renders into the `weather` snippet slot.
	// PR2 T017 — gear IconBtn toggles the floating Tweaks panel.

	interface Props {
		city?: string;
		lat?: number;
		lon?: number;
		version?: string;
		weather?: Snippet;
	}
	let { city = '—', lat, lon, version = '0.0.2', weather }: Props = $props();

	let tweaksOpen = $state(false);

	function fmtZ(d: Date): string {
		return (
			String(d.getUTCDate()).padStart(2, '0') +
			String(d.getUTCHours()).padStart(2, '0') +
			String(d.getUTCMinutes()).padStart(2, '0')
		);
	}

	let now = $state(fmtZ(new Date()));
	// fmtZ is minute-precision (DDHHMM); align ticks to UTC minute boundaries
	// so the visible value is never stale by more than ~1s after rollover.
	function tick(): void {
		now = fmtZ(new Date());
	}
	$effect(() => {
		const msToNext = 60_000 - (Date.now() % 60_000);
		let intervalId: ReturnType<typeof setInterval> | undefined;
		const timeoutId = setTimeout(() => {
			tick();
			intervalId = setInterval(tick, 60_000);
		}, msToNext);
		return () => {
			clearTimeout(timeoutId);
			if (intervalId) clearInterval(intervalId);
		};
	});

	const latStr = $derived(
		lat == null ? '—' : `${Math.abs(lat).toFixed(6)}°${lat >= 0 ? 'N' : 'S'}`
	);
	const lonStr = $derived(
		lon == null ? '—' : `${Math.abs(lon).toFixed(6)}°${lon >= 0 ? 'E' : 'W'}`
	);
	const mgrs = $derived(lat != null && lon != null ? latLonToMGRS(lat, lon) : '—');
</script>

<div class="brand"><div class="brand-mark"><span></span></div></div>

<div class="topbar-section" style="gap: 18px;">
	<div class="wordmark">ARGOS<span class="v">MK II · {version}</span></div>
</div>

<div class="topbar-section grow"></div>

<div class="topbar-section right" style="gap: 16px;">
	{#if weather}{@render weather()}{/if}
	<span class="mono ink-2">{city}</span>
	<span class="mono ink-3">{latStr} · {lonStr}</span>
	<span class="mono ink-3">{mgrs}</span>
	<span class="mono accent">{now}Z</span>
	<IconBtn
		title={tweaksOpen ? 'Close tweaks' : 'Open tweaks'}
		ariaLabel={tweaksOpen ? 'Close tweaks' : 'Open tweaks'}
		variant="ghost"
		active={tweaksOpen}
		onclick={() => (tweaksOpen = !tweaksOpen)}
	>
		<Settings2 size={14} />
	</IconBtn>
</div>

<Tweaks open={tweaksOpen} onclose={() => (tweaksOpen = false)} />

<style>
	.brand {
		width: var(--mk2-rail-w);
		min-width: var(--mk2-rail-w);
		display: flex;
		align-items: center;
		justify-content: center;
		border-right: 1px solid var(--mk2-line);
		background: var(--mk2-bg);
	}

	.brand-mark {
		width: 22px;
		height: 22px;
		border: 1.5px solid var(--mk2-accent);
		position: relative;
		display: grid;
		place-items: center;
	}

	.brand-mark::before,
	.brand-mark::after {
		content: '';
		position: absolute;
		inset: 0;
		border: 1px solid var(--mk2-accent);
		transform: rotate(45deg) scale(0.6);
		opacity: 0.35;
	}

	.brand-mark > span {
		width: 4px;
		height: 4px;
		background: var(--mk2-accent);
		border-radius: 50%;
	}

	.topbar-section {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 0 14px;
		border-right: 1px solid var(--mk2-line);
		font: 500 var(--mk2-fs-3) / 1 var(--mk2-f-mono);
		color: var(--mk2-ink-2);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.topbar-section.grow {
		flex: 1;
		justify-content: flex-start;
	}

	.topbar-section.right {
		justify-content: flex-end;
		border-right: 0;
		border-left: 1px solid var(--mk2-line);
	}

	.wordmark {
		font: 600 var(--mk2-fs-5) / 1 var(--mk2-f-sans);
		letter-spacing: 0.3em;
		color: var(--mk2-ink);
	}

	.wordmark .v {
		color: var(--mk2-ink-4);
		font-size: var(--mk2-fs-2);
		margin-left: 8px;
		letter-spacing: 0.2em;
	}

	.mono {
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.ink-2 {
		color: var(--mk2-ink-2);
	}
	.ink-3 {
		color: var(--mk2-ink-3);
	}
	.accent {
		color: var(--mk2-accent);
	}
</style>
