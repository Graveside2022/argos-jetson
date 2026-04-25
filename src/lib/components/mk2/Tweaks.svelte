<script lang="ts">
	import {
		type AccentName,
		ACCENTS,
		accentStore,
		DENSITIES,
		type Density,
		densityStore
	} from '$lib/state/ui.svelte';

	import IconBtn from './IconBtn.svelte';

	// spec-024 PR2 T017 — Mk II Tweaks panel.
	// Floating popover anchored top-right under the topbar, activated from the
	// gear `IconBtn` on Topbar.svelte. Mutates `accentStore` / `densityStore`
	// directly — `+layout.svelte` mirrors those values onto `body[data-accent]`
	// + `body[data-density]`, and the pre-wired CSS selectors in `app.css`
	// (PR1 T005) flip the active swatch / row height live without re-render.

	interface Props {
		open?: boolean;
		onclose?: () => void;
	}

	let { open = false, onclose }: Props = $props();

	// Swatch colors — bind to Mk II accent tokens (declared in app.css PR1 T005)
	// so future palette retones flow through automatically. Keep keys in lockstep
	// with `AccentName` — adding a sixth accent is a single-line append.
	const SWATCH_FILL: Record<AccentName, string> = {
		amber: 'var(--mk2-amber)',
		green: 'var(--mk2-green)',
		cyan: 'var(--mk2-cyan)',
		magenta: 'var(--mk2-magenta)',
		steel: 'var(--mk2-steel)'
	};

	function setAccent(a: AccentName): void {
		accentStore.value = a;
	}

	function setDensity(d: Density): void {
		densityStore.value = d;
	}

	function onkeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape' && onclose) {
			e.stopPropagation();
			onclose();
		}
	}
</script>

<svelte:window onkeydown={open ? onkeydown : undefined} />

{#if open}
	<div class="tweaks" role="dialog" aria-label="UI tweaks">
		<div class="th">
			<span>TWEAKS</span>
			<IconBtn ariaLabel="Close tweaks" variant="ghost" onclick={onclose}>
				<span class="x">×</span>
			</IconBtn>
		</div>

		<div class="row">
			<span class="lbl">Accent</span>
			<div class="swatches">
				{#each ACCENTS as a (a)}
					<button
						type="button"
						class="sw"
						class:active={accentStore.value === a}
						style:background={SWATCH_FILL[a]}
						aria-label={`Accent ${a}`}
						aria-pressed={accentStore.value === a}
						onclick={() => setAccent(a)}
					></button>
				{/each}
			</div>
		</div>

		<div class="row">
			<span class="lbl">Density</span>
			<div class="density">
				{#each DENSITIES as d (d)}
					<button
						type="button"
						class="dbtn"
						class:active={densityStore.value === d}
						aria-pressed={densityStore.value === d}
						onclick={() => setDensity(d)}
					>
						{d.toUpperCase()}
					</button>
				{/each}
			</div>
		</div>

		<div class="row hint">Changes apply live · persist locally</div>
	</div>
{/if}

<style>
	.tweaks {
		position: fixed;
		right: 16px;
		top: calc(var(--mk2-bar-h) + 6px);
		z-index: 50;
		width: 260px;
		background: var(--mk2-panel);
		border: 1px solid var(--mk2-line-hi);
		font: 500 var(--mk2-fs-2) / 1 var(--mk2-f-mono);
		box-shadow: 0 20px 60px rgb(0 0 0 / 0.6);
	}

	.th {
		padding: 6px 8px 6px 12px;
		border-bottom: 1px solid var(--mk2-line);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--mk2-bg-2);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--mk2-ink-2);
	}

	.x {
		font-size: 14px;
		line-height: 1;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		border-bottom: 1px dashed var(--mk2-line);
	}

	.row:last-child {
		border-bottom: 0;
	}

	.row.hint {
		color: var(--mk2-ink-4);
		font-size: var(--mk2-fs-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		justify-content: flex-start;
	}

	.lbl {
		color: var(--mk2-ink-3);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.swatches {
		display: flex;
		gap: 4px;
	}

	.sw {
		width: 16px;
		height: 16px;
		padding: 0;
		border: 1px solid var(--mk2-line-hi);
		cursor: pointer;
	}

	.sw.active {
		outline: 1px solid var(--mk2-ink);
		outline-offset: 1px;
	}

	.sw:focus-visible {
		outline: 1px solid var(--mk2-ink);
		outline-offset: 1px;
	}

	.density {
		display: flex;
		gap: 2px;
	}

	.dbtn {
		height: 20px;
		padding: 0 8px;
		font: 500 9.5px / 1 var(--mk2-f-mono);
		background: var(--mk2-bg-2);
		color: var(--mk2-ink-2);
		border: 1px solid var(--mk2-line-2);
		cursor: pointer;
		letter-spacing: 0.08em;
	}

	.dbtn.active {
		background: var(--mk2-accent);
		color: var(--mk2-amber-ink);
		border-color: var(--mk2-accent);
	}

	.dbtn:focus-visible {
		outline: 1px solid var(--mk2-accent);
		outline-offset: 1px;
	}
</style>
