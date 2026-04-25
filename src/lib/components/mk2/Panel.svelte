<script lang="ts">
	import type { Snippet } from 'svelte';

	// spec-024 PR2 T016 — Mk II Panel primitive.
	// Bracketed corner frame (4 absolutely-positioned spans + ::before/::after),
	// header strip with [tag] / title / · meta / right-aligned actions snippet,
	// body with selectable padding / scroll mode. Header rendered via mousedown
	// passthrough so PR7 dock-anywhere can grab the panel for drag-reorder.

	type BodyPad = 'pad' | 'pad-lg' | 'nopad' | 'scroll';

	interface Props {
		tag?: string;
		title?: string;
		meta?: string;
		actions?: Snippet;
		children?: Snippet;
		bodyClass?: BodyPad;
		flex?: number;
		headerClass?: string;
		panelId?: string;
		onheadermousedown?: (e: MouseEvent) => void;
	}

	let {
		tag,
		title,
		meta,
		actions,
		children,
		bodyClass = 'pad',
		flex = 1,
		headerClass = '',
		panelId,
		onheadermousedown
	}: Props = $props();
</script>

<div class="panel brackets" data-panel-id={panelId} style:flex>
	<span class="br-bl" aria-hidden="true"></span>
	<span class="br-br" aria-hidden="true"></span>

	<div class="panel-head {headerClass}" onmousedown={onheadermousedown} role="presentation">
		{#if tag}<span class="tag">[{tag}]</span>{/if}
		{#if title}<span class="title">{title}</span>{/if}
		{#if meta}<span class="meta">· {meta}</span>{/if}
		<span class="spacer"></span>
		{#if actions}{@render actions()}{/if}
	</div>

	<div class="panel-body {bodyClass}">
		{#if children}{@render children()}{/if}
	</div>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		background: var(--mk2-panel);
		border: 1px solid var(--mk2-line);
	}

	.panel-head {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 12px;
		min-height: var(--mk2-row-h);
		border-bottom: 1px solid var(--mk2-line);
		font: 500 var(--mk2-fs-2) / 1 var(--mk2-f-mono);
		color: var(--mk2-ink-3);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		user-select: none;
	}

	.tag {
		color: var(--mk2-accent);
		font-weight: 600;
	}

	.title {
		color: var(--mk2-ink);
		font-weight: 600;
	}

	.meta {
		color: var(--mk2-ink-3);
		font-weight: 400;
	}

	.spacer {
		flex: 1;
	}

	.panel-body {
		flex: 1;
		min-width: 0;
		min-height: 0;
		position: relative;
		overflow: hidden;
	}

	.panel-body.scroll {
		overflow: auto;
	}
	.panel-body.pad {
		padding: 12px;
	}
	.panel-body.pad-lg {
		padding: 18px;
	}
	.panel-body.nopad {
		padding: 0;
	}

	/* bracketed corner frame — 4 corners drawn as 1px L-segments */
	.brackets {
		position: relative;
	}

	.brackets::before,
	.brackets::after,
	.brackets > .br-bl,
	.brackets > .br-br {
		content: '';
		position: absolute;
		width: 8px;
		height: 8px;
		border: 0 solid var(--mk2-accent);
		pointer-events: none;
	}

	.brackets::before {
		top: -1px;
		left: -1px;
		border-top-width: 1px;
		border-left-width: 1px;
	}
	.brackets::after {
		top: -1px;
		right: -1px;
		border-top-width: 1px;
		border-right-width: 1px;
	}
	.brackets > .br-bl {
		bottom: -1px;
		left: -1px;
		border-bottom-width: 1px;
		border-left-width: 1px;
	}
	.brackets > .br-br {
		bottom: -1px;
		right: -1px;
		border-bottom-width: 1px;
		border-right-width: 1px;
	}
</style>
