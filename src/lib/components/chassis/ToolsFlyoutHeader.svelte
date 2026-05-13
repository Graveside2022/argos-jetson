<script lang="ts">
	// Phase 9 follow-up — Carbon <Search>'s precompiled CSS for
	// .bx--search-magnifier isn't loaded in the current Lunaris theme scaffold,
	// so the magnifier escapes the input and the field renders 58px tall.
	// Native <input type="search"> with Lunaris tokens is reliable until
	// lunaris-carbon-theme.scss imports @carbon/styles/scss/components/search.

	interface Props {
		total: number;
		query: string;
		open: boolean;
		onClose: () => void;
	}

	let { total, query = $bindable(), open, onClose }: Props = $props();
</script>

<header class="head">
	<div class="title">
		<span class="brand">TOOLS</span>
		<span class="dot" aria-hidden="true">·</span>
		<span class="total">{total} TOTAL</span>
	</div>
	<div class="search-wrap">
		<svg
			class="search-icon"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="7" />
			<path d="m20 20-4.3-4.3" />
		</svg>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="search"
			class="search-input"
			placeholder="Search tools…"
			aria-label="Search tools"
			autofocus={open}
			bind:value={query}
		/>
	</div>
	<div class="actions">
		<kbd class="esc-hint" title="Press ESC to close">ESC</kbd>
		<button type="button" class="close" onclick={onClose} aria-label="Close tools">
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			</svg>
		</button>
	</div>
</header>

<style>
	.head {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		column-gap: 20px;
		padding: 0 16px;
		height: 48px;
		border-bottom: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
	}

	.title {
		display: flex;
		align-items: center;
		gap: 10px;
		line-height: 1;
		white-space: nowrap;
	}
	.brand {
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.18em;
		color: var(--mk2-ink);
		text-transform: uppercase;
	}
	.dot {
		color: var(--mk2-ink-4);
		font-size: 12px;
	}
	.total {
		font-size: 12px;
		color: var(--mk2-ink-3);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.search-wrap {
		position: relative;
		display: flex;
		align-items: center;
		justify-self: stretch;
		max-width: 520px;
		height: 32px;
	}
	.search-icon {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--mk2-ink-4);
		pointer-events: none;
	}
	.search-input {
		flex: 1;
		min-width: 0;
		height: 32px;
		padding: 0 32px 0 32px;
		background: var(--mk2-bg);
		border: 1px solid var(--mk2-line);
		color: var(--mk2-ink);
		font-family: var(--mk2-f-mono);
		font-size: 12px;
		letter-spacing: 0.04em;
		outline: none;
	}
	.search-input::placeholder {
		color: var(--mk2-ink-4);
	}
	.search-input:focus {
		border-color: var(--mk2-accent);
	}
	.search-input::-webkit-search-cancel-button {
		appearance: none;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.esc-hint {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 22px;
		min-width: 36px;
		padding: 0 8px;
		font-family: var(--mk2-f-mono);
		font-size: 10px;
		letter-spacing: 0.12em;
		color: var(--mk2-ink-3);
		background: transparent;
		border: 1px solid var(--mk2-line);
		border-radius: 2px;
		line-height: 1;
		text-transform: uppercase;
	}
	.close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
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
