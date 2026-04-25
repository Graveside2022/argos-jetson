<script lang="ts">
	import type { Snippet } from 'svelte';

	// spec-024 PR2 T016 — Mk II IconBtn primitive.
	// Square 28×28 icon button with 1px line border. `ghost` variant strips
	// border until hover. `aria-label` defaults to `title` so keyboard users
	// keep discoverability when the slot only contains an icon glyph.

	type Variant = 'default' | 'ghost';

	interface Props {
		title?: string;
		ariaLabel?: string;
		disabled?: boolean;
		variant?: Variant;
		active?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
	}

	let {
		title,
		ariaLabel,
		disabled = false,
		variant = 'default',
		active = false,
		onclick,
		children
	}: Props = $props();

	const accessibleName = $derived(ariaLabel ?? title ?? 'Icon button');
</script>

<button
	type="button"
	class="icon-btn {variant}"
	class:active
	{title}
	{disabled}
	aria-label={accessibleName}
	aria-pressed={active}
	{onclick}
>
	{#if children}{@render children()}{/if}
</button>

<style>
	.icon-btn {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		background: transparent;
		border: 1px solid var(--mk2-line);
		color: var(--mk2-ink-3);
		cursor: pointer;
		transition:
			color var(--mk2-mo-1),
			border-color var(--mk2-mo-1),
			background-color var(--mk2-mo-1);
	}

	.icon-btn:hover:not(:disabled) {
		color: var(--mk2-ink);
		border-color: var(--mk2-line-hi);
	}

	.icon-btn.active {
		color: var(--mk2-accent);
		border-color: var(--mk2-accent);
	}

	.icon-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.icon-btn.ghost {
		border-color: transparent;
	}
	.icon-btn.ghost:hover:not(:disabled) {
		border-color: var(--mk2-line);
	}

	.icon-btn:focus-visible {
		outline: 1px solid var(--mk2-accent);
		outline-offset: 1px;
	}
</style>
