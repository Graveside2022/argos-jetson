<script lang="ts">
	import type { IconProps } from '@lucide/svelte';
	import { Bot, LayoutDashboard, Map, Plus, Wrench } from '@lucide/svelte';
	import type { Component } from 'svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	// spec-024 PR1 T009 — Mk II left rail.
	// PR6 conversion: rail slots are now anchor links into the
	// /dashboard/mk2/{id} nested routes; the layout chassis stays
	// mounted across screen swaps (Datadog-style persistent shell).
	// Active state derives from URL pathname so browser back/forward
	// updates the rail automatically. Hotkeys (1-9) call goto() with
	// the same URL, so keyboard nav and click nav share one path.
	// Drag-reorder still deferred to PR9 (T051).

	type View = string;

	interface PinnedTool {
		id: View;
		label: string;
		icon: Component<IconProps>;
	}

	interface Props {
		pinned?: PinnedTool[];
		toolsOpen?: boolean;
		onOpenTools?: () => void;
	}

	const FIXED: PinnedTool[] = [
		{ id: 'agents', label: 'AGENTS', icon: Bot },
		{ id: 'overview', label: 'OVERVIEW', icon: LayoutDashboard },
		{ id: 'map', label: 'MAP', icon: Map }
	];

	const SYSTEMS: PinnedTool = { id: 'systems', label: 'SYSTEMS', icon: Wrench };

	let { pinned = [], toolsOpen = false, onOpenTools }: Props = $props();

	const slots = $derived([...FIXED, ...pinned]);

	// Derive active screen from URL: /dashboard/mk2/<id> → <id>.
	// Pathnames outside the mk2 namespace produce null, which means no
	// rail slot is highlighted.
	const ROUTE_RE = /^\/dashboard\/mk2\/([^/?#]+)/;

	function activeIdFrom(pathname: string): string | null {
		const m = pathname.match(ROUTE_RE);
		return m ? m[1] : null;
	}

	const active = $derived(activeIdFrom(page.url.pathname));

	function pad2(n: number): string {
		return String(n).padStart(2, '0');
	}

	function hrefFor(id: View): string {
		return `/dashboard/mk2/${id}`;
	}

	const INTERACTIVE_SELECTOR =
		'[role="dialog"], [role="menu"], [role="menuitem"], [role="listbox"], [role="combobox"], dialog, select, [contenteditable="true"]';

	function isFormField(target: EventTarget | null): boolean {
		if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
			return true;
		return target instanceof HTMLElement && target.isContentEditable;
	}

	function isInsideInteractive(target: EventTarget | null): boolean {
		return target instanceof HTMLElement && target.closest(INTERACTIVE_SELECTOR) !== null;
	}

	function shouldSkipHotkey(e: KeyboardEvent): boolean {
		if (e.defaultPrevented) return true;
		if (isFormField(e.target)) return true;
		return isInsideInteractive(e.target);
	}

	function digitKeyToIndex(key: string): number | null {
		if (key < '1' || key > '9') return null;
		return Number(key) - 1;
	}

	function handleHotkey(e: KeyboardEvent): void {
		if (shouldSkipHotkey(e)) return;
		const idx = digitKeyToIndex(e.key);
		if (idx === null) return;
		const slot = slots[idx];
		if (!slot) return;
		e.preventDefault();
		void goto(hrefFor(slot.id));
	}

	$effect(() => {
		window.addEventListener('keydown', handleHotkey);
		return () => window.removeEventListener('keydown', handleHotkey);
	});

	const systemsActive = $derived(active === SYSTEMS.id);
</script>

<nav class="rail-inner" aria-label="Primary navigation">
	{#each slots as item, i (item.id)}
		{@const isActive = active === item.id && !toolsOpen}
		<div class="rail-slot">
			<a
				class="rail-btn"
				class:active={isActive}
				class:fixed={i < FIXED.length}
				href={hrefFor(item.id)}
				title="{pad2(i + 1)} {item.label}"
				aria-label={item.label}
				aria-current={isActive ? 'page' : undefined}
			>
				<span class="rail-num">{pad2(i + 1)}</span>
				<item.icon size={16} />
				{#if isActive}<span class="rail-tick"></span>{/if}
			</a>
		</div>
	{/each}

	<button
		type="button"
		class="rail-btn tools-launcher"
		class:active={toolsOpen}
		title="TOOLS · open library"
		aria-label="Open tools library"
		onclick={() => onOpenTools?.()}
	>
		<span class="rail-num">+</span>
		<Plus size={16} />
		{#if toolsOpen}<span class="rail-tick"></span>{/if}
	</button>

	<div class="rail-spacer"></div>

	<a
		class="rail-btn rail-bottom"
		class:active={systemsActive}
		href={hrefFor(SYSTEMS.id)}
		title="SYSTEMS · host metrics, hardware, processes"
		aria-label="Systems"
		aria-current={systemsActive ? 'page' : undefined}
	>
		<Wrench size={16} />
		{#if systemsActive}<span class="rail-tick"></span>{/if}
	</a>
</nav>

<style>
	.rail-inner {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		height: 100%;
		padding: 0;
	}

	.rail-slot {
		position: relative;
	}

	.rail-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 44px;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--mk2-line);
		color: var(--mk2-ink-3);
		cursor: pointer;
		text-decoration: none;
		transition:
			background var(--mk2-mo-1),
			color var(--mk2-mo-1);
	}

	.rail-btn:hover {
		background: var(--mk2-bg-2);
		color: var(--mk2-ink-2);
	}

	.rail-btn.active {
		background: var(--mk2-bg-2);
		color: var(--mk2-accent);
	}

	.rail-btn:focus-visible {
		outline: 1px solid var(--mk2-accent);
		outline-offset: -2px;
	}

	.rail-num {
		position: absolute;
		top: 4px;
		left: 4px;
		font: 500 var(--mk2-fs-1) / 1 var(--mk2-f-mono);
		color: var(--mk2-ink-4);
		letter-spacing: 0.05em;
	}

	.rail-tick {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--mk2-accent);
	}

	.rail-spacer {
		flex: 1;
	}

	.rail-bottom {
		border-top: 1px solid var(--mk2-line);
		border-bottom: 0;
	}
</style>
