<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import type { Snippet } from 'svelte';

	// spec-026 Phase 1 — Carbon-wrapped IconBtn. Preserves the bespoke
	// IconBtn.svelte public API exactly (Adapter pattern per Gang of Four)
	// so consumer call sites don't change. Internally delegates to Carbon's
	// `<Button kind="ghost" iconOnly>` for a11y + focus management while
	// Lunaris-specific visual identity (28×28 + 1px border) is preserved
	// via :global() selectors targeting Carbon's `.bx--btn` class.
	//
	// See specs/026-lunaris-design-system/components/button/ for the
	// authority citations + canonical-pattern matrix.

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
		active,
		onclick,
		children
	}: Props = $props();

	const accessibleName = $derived(ariaLabel ?? title ?? 'Icon button');
	const variantClass = $derived(
		`lunaris-icon-btn lunaris-icon-btn--${variant}${active ? ' lunaris-icon-btn--active' : ''}`
	);
	// `active` undefined → not a toggle button; aria-pressed omitted entirely.
	// `active === true | false` → genuine toggle; aria-pressed announced to AT.
	// Per WAI-ARIA APG button pattern + CR feedback on PR #67.
</script>

<Button
	kind="ghost"
	size="small"
	iconDescription={accessibleName}
	tooltipPosition="top"
	{disabled}
	on:click={(e) => onclick?.(e as unknown as MouseEvent)}
	class={variantClass}
	aria-label={accessibleName}
	aria-pressed={active}
>
	{#if children}{@render children()}{/if}
</Button>

<style>
	/* Lunaris visual identity preservation over Carbon `<Button kind="ghost">`.
	   :global() needed because Carbon's `.bx--btn` class is rendered inside
	   the Carbon component, not in this scope. See style.md for the
	   canonical-pattern matrix this implements. */
	:global(.lunaris-icon-btn.bx--btn) {
		min-block-size: 28px;
		block-size: 28px;
		inline-size: 28px;
		padding: 0;
		display: grid;
		place-items: center;
		background: transparent;
		border: 1px solid var(--mk2-line);
		color: var(--mk2-ink-3);
		transition:
			color var(--mk2-mo-1),
			border-color var(--mk2-mo-1),
			background-color var(--mk2-mo-1);
	}
	:global(.lunaris-icon-btn.bx--btn:hover:not(:disabled)) {
		color: var(--mk2-ink);
		border-color: var(--mk2-line-hi);
		background: transparent;
	}
	:global(.lunaris-icon-btn--ghost.bx--btn) {
		border-color: transparent;
	}
	:global(.lunaris-icon-btn--ghost.bx--btn:hover:not(:disabled)) {
		border-color: var(--mk2-line);
	}
	:global(.lunaris-icon-btn--active.bx--btn) {
		color: var(--mk2-accent);
		border-color: var(--mk2-accent);
	}
	:global(.lunaris-icon-btn.bx--btn:disabled) {
		opacity: 0.4;
		cursor: not-allowed;
	}
	:global(.lunaris-icon-btn.bx--btn:focus-visible) {
		outline: 1px solid var(--mk2-accent);
		outline-offset: 1px;
	}
</style>
