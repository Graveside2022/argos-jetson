<script lang="ts">
	import type { Snippet } from 'svelte';

	// spec-024 PR1 T007 — Mk II chassis skeleton.
	// Grid: 56px rail / 44px topbar / 1fr main / 22px statusbar (matches
	// prototype docs/Argos (1).zip → src/chassis.jsx `.shell`).
	// Drawer is rendered inside `.stage` per prototype — it shares the
	// flex column with main content and clamps via PR3 (T019).

	interface Props {
		topbar?: Snippet;
		rail?: Snippet;
		main?: Snippet;
		drawer?: Snippet;
		statusbar?: Snippet;
	}
	let { topbar, rail, main, drawer, statusbar }: Props = $props();
</script>

<div class="mk2-shell">
	<div class="mk2-topbar">
		{#if topbar}{@render topbar()}{/if}
	</div>
	<aside class="mk2-rail">
		{#if rail}{@render rail()}{/if}
	</aside>
	<section class="mk2-stage">
		<div class="mk2-stage-inner">
			{#if main}{@render main()}{/if}
		</div>
		{#if drawer}<div class="mk2-drawer-slot">{@render drawer()}</div>{/if}
	</section>
	<div class="mk2-statusbar">
		{#if statusbar}{@render statusbar()}{/if}
	</div>
</div>

<style>
	.mk2-shell {
		display: grid;
		grid-template-columns: var(--mk2-rail-w) 1fr;
		grid-template-rows: var(--mk2-bar-h) 1fr var(--mk2-status-h);
		height: 100vh;
		background: var(--mk2-bg);
		color: var(--mk2-ink);
		font-family: var(--mk2-f-sans);
	}

	.mk2-topbar {
		grid-column: 1 / -1;
		border-bottom: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
		display: flex;
		align-items: stretch;
		position: relative;
	}

	.mk2-rail {
		background: var(--mk2-rail-bg);
		border-right: 1px solid var(--mk2-line);
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}

	.mk2-stage {
		position: relative;
		background: var(--mk2-bg);
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.mk2-stage-inner {
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		position: relative;
	}

	.mk2-drawer-slot {
		flex-shrink: 0;
	}

	.mk2-statusbar {
		grid-column: 1 / -1;
		border-top: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
		display: flex;
		align-items: center;
		font: 500 var(--mk2-fs-2) / 1 var(--mk2-f-mono);
		color: var(--mk2-ink-3);
		letter-spacing: 0.04em;
	}
</style>
