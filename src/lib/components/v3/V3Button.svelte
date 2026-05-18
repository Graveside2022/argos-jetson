<!--
	V3Button — the universal NVIDIA CTA (DESIGN.md: button-primary /
	button-outline / button-ghost-link). Renders an <a> when `href` is
	given, a <button> otherwise. No shadows, 2px radius, weight 700.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type V3ButtonVariant = 'primary' | 'outline' | 'ghost';

	interface Props {
		variant?: V3ButtonVariant;
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		ariaLabel?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'primary',
		href,
		type = 'button',
		disabled = false,
		ariaLabel,
		onclick,
		children
	}: Props = $props();
</script>

{#if href}
	<a
		class="v3-btn v3-btn--{variant}"
		class:v3-btn--disabled={disabled}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		aria-label={ariaLabel}
		{onclick}
	>
		{@render children()}
	</a>
{:else}
	<button class="v3-btn v3-btn--{variant}" {type} {disabled} aria-label={ariaLabel} {onclick}>
		{@render children()}
	</button>
{/if}

<style>
	.v3-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--v3-space-sm);
		height: 44px;
		padding: 11px 24px;
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-body);
		font-weight: 700;
		line-height: 1.25;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color 120ms ease,
			border-color 120ms ease,
			color 120ms ease;
	}

	/* primary — solid NVIDIA-green fill */
	.v3-btn--primary {
		background: var(--primary);
		color: var(--primary-foreground);
	}
	.v3-btn--primary:hover {
		background: var(--v3-green-dark);
	}

	/* outline — a clear pane bordered in the accent */
	.v3-btn--outline {
		background: transparent;
		color: var(--foreground);
		border-color: var(--primary);
	}
	.v3-btn--outline:hover {
		background: color-mix(in srgb, var(--primary) 12%, transparent);
	}

	/* ghost-link — bare accent-text affordance, square (rounded.none) */
	.v3-btn--ghost {
		height: auto;
		padding: 0;
		border: none;
		border-radius: 0;
		background: transparent;
		color: var(--primary);
	}
	.v3-btn--ghost:hover {
		color: var(--v3-green-dark);
	}

	.v3-btn--disabled,
	.v3-btn:disabled {
		background: var(--secondary);
		color: var(--text-inactive);
		border-color: transparent;
		cursor: not-allowed;
		pointer-events: none;
	}

	.v3-btn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
</style>
