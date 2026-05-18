<!--
	V3UtilityBar — NVIDIA utility-bar (DESIGN.md): a 32px black strip at the
	very top of every page. Right-aligned cluster; for P1 it carries the
	dark/light mode toggle.
-->
<script lang="ts">
	import { Moon, Sun } from '@lucide/svelte';

	import { v3ThemeStore } from '$lib/stores/v3-theme-store.svelte';

	let isDark = $derived(v3ThemeStore.mode === 'dark');
</script>

<div class="v3-utilitybar">
	<div class="v3-utilitybar__cluster">
		<button
			class="v3-utilitybar__btn"
			type="button"
			aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
			onclick={() => v3ThemeStore.toggleMode()}
		>
			{#if isDark}
				<Sun size={14} aria-hidden="true" />
				<span>Light</span>
			{:else}
				<Moon size={14} aria-hidden="true" />
				<span>Dark</span>
			{/if}
		</button>
	</div>
</div>

<style>
	.v3-utilitybar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		height: var(--v3-utilitybar-h);
		padding: 0 var(--v3-space-xl);
		background: var(--v3-hero);
		color: var(--v3-on-hero);
	}
	.v3-utilitybar__cluster {
		display: flex;
		align-items: center;
		gap: var(--v3-space-md);
	}
	.v3-utilitybar__btn {
		display: inline-flex;
		align-items: center;
		gap: var(--v3-space-xs);
		height: 100%;
		padding: 0 var(--v3-space-sm);
		border: none;
		background: transparent;
		color: var(--v3-on-hero);
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-caption-sm);
		font-weight: 400;
		cursor: pointer;
	}
	.v3-utilitybar__btn:hover {
		color: var(--primary);
	}
	.v3-utilitybar__btn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
	}
</style>
