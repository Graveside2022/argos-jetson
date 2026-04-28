<script lang="ts">
	import { Search, X } from '@lucide/svelte';
	import { tick } from 'svelte';

	// spec-024 Phase 3 PR B2-full — header strip for ToolsFlyout: title + total
	// + search + ESC chip + close. Self-manages focus when `open` becomes true.

	interface Props {
		total: number;
		query: string;
		open: boolean;
		onClose: () => void;
	}

	let { total, query = $bindable(), open, onClose }: Props = $props();

	let searchInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (!open) return;
		void tick().then(() => searchInput?.focus());
	});
</script>

<header class="head">
	<div class="title">
		<span class="brand">TOOLS</span>
		<span class="total">{total} TOTAL</span>
	</div>
	<div class="search">
		<Search size={14} />
		<input
			bind:this={searchInput}
			bind:value={query}
			type="search"
			placeholder="Search tools…"
			aria-label="Search tools"
			spellcheck="false"
			autocomplete="off"
		/>
		<span class="kbd">ESC</span>
	</div>
	<button type="button" class="close" onclick={onClose} aria-label="Close tools">
		<X size={14} />
	</button>
</header>

<style>
	.head {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
	}
	.title {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.brand {
		font-size: var(--mk2-fs-3);
		letter-spacing: 0.16em;
		color: var(--mk2-ink);
		text-transform: uppercase;
	}
	.total {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-3);
		letter-spacing: 0.08em;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 10px;
		background: var(--mk2-bg);
		border: 1px solid var(--mk2-line);
		color: var(--mk2-ink-3);
	}
	.search:focus-within {
		border-color: var(--mk2-accent);
		color: var(--mk2-ink);
	}
	.search input {
		flex: 1;
		background: transparent;
		border: 0;
		color: var(--mk2-ink);
		font: inherit;
		outline: none;
	}
	.search input::placeholder {
		color: var(--mk2-ink-4);
	}
	.kbd {
		margin-left: auto;
		padding: 1px 6px;
		background: var(--mk2-bg);
		border: 1px solid var(--mk2-line);
		color: var(--mk2-ink-2);
		font-size: var(--mk2-fs-1);
	}
	.close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: 1px solid var(--mk2-line);
		color: var(--mk2-ink-3);
		cursor: pointer;
	}
	.close:hover {
		color: var(--mk2-ink);
		border-color: var(--mk2-accent);
	}
</style>
