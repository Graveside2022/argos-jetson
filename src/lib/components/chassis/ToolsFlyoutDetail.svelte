<script lang="ts">
	import type { Mk2Tool } from '$lib/types/mk2-tool';

	// spec-024 Phase 3 PR B2-full — right-side detail pane for ToolsFlyout.
	// Shows the currently-hovered or arrow-selected tool: pillar crumb, name,
	// description, single action button labeled by action.kind. Empty state when
	// nothing selected.

	interface Props {
		tool: Mk2Tool | null;
		actionLabel: (t: Mk2Tool) => string;
		onActivate: (t: Mk2Tool) => void;
	}

	let { tool, actionLabel, onActivate }: Props = $props();
</script>

<aside class="detail">
	{#if tool}
		<div class="crumb">{tool.pillar}</div>
		<div class="name">{tool.name}</div>
		<p class="desc">{tool.description}</p>
		<div class="actions">
			<button
				type="button"
				class="btn primary"
				disabled={tool.action.kind === 'unwired'}
				onclick={() => onActivate(tool)}
			>
				{actionLabel(tool)}
			</button>
			{#if tool.docsUrl}
				<a
					class="btn docs"
					href={tool.docsUrl}
					target="_blank"
					rel="noopener noreferrer"
					title="Open the upstream project's official documentation in a new tab"
				>
					OFFICIAL DOCS
					<svg
						class="ext-icon"
						width="11"
						height="11"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M7 17 17 7" />
						<path d="M7 7h10v10" />
					</svg>
				</a>
			{/if}
		</div>
	{:else}
		<div class="empty">
			<div class="brand">SELECT A TOOL</div>
			<p>Hover or click to inspect. Enter to launch.</p>
		</div>
	{/if}
</aside>

<style>
	.detail {
		padding: 18px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: var(--mk2-bg);
	}
	.crumb {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-3);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.name {
		font-size: var(--mk2-fs-6);
		color: var(--mk2-ink);
		font-weight: 600;
	}
	.desc {
		color: var(--mk2-ink-2);
		font-size: var(--mk2-fs-3);
		line-height: 1.55;
		padding: 10px 0;
		border-top: 1px solid var(--mk2-line);
		border-bottom: 1px solid var(--mk2-line);
		margin: 0;
	}
	.actions {
		margin-top: 4px;
		display: flex;
		gap: 8px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		background: var(--mk2-bg-2);
		border: 1px solid var(--mk2-line-hi);
		color: var(--mk2-ink);
		font: inherit;
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.12em;
		cursor: pointer;
		text-transform: uppercase;
	}
	.btn:hover:not(:disabled) {
		border-color: var(--mk2-accent);
	}
	.btn.primary {
		background: var(--mk2-accent);
		color: var(--mk2-bg);
		border-color: var(--mk2-accent);
	}
	.btn.docs {
		background: var(--mk2-amber, #d4a054);
		color: #1a1a1a;
		border-color: var(--mk2-amber, #d4a054);
		text-decoration: none;
		font-weight: 500;
	}
	.btn.docs:hover {
		filter: brightness(1.1);
		border-color: var(--mk2-amber, #d4a054);
	}
	.ext-icon {
		opacity: 0.85;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.empty {
		display: flex;
		flex-direction: column;
		gap: 6px;
		color: var(--mk2-ink-3);
	}
	.empty .brand {
		font-size: var(--mk2-fs-3);
		color: var(--mk2-ink-2);
		letter-spacing: 0.16em;
	}
	.empty p {
		margin: 0;
		font-size: var(--mk2-fs-2);
	}
</style>
