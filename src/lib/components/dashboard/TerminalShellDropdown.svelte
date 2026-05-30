<script lang="ts">
	import Add from 'carbon-icons-svelte/lib/Add.svelte';

	import type { ShellInfo } from '$lib/types/terminal';

	interface Props {
		availableShells: ShellInfo[];
		showShellDropdown: boolean;
		onCreateSession: (shell?: string) => void;
		onToggleShellDropdown: () => void;
	}

	let { availableShells, showShellDropdown, onCreateSession, onToggleShellDropdown }: Props =
		$props();
</script>

<div class="shell-dropdown-wrapper">
	<button
		class="toolbar-btn add-btn"
		aria-label="New terminal"
		title="New terminal"
		onclick={onToggleShellDropdown}
	>
		<Add size={14} />
	</button>
	{#if showShellDropdown}
		<div class="dropdown-menu">
			{#each availableShells as shell (shell.path)}
				<button
					type="button"
					class="dropdown-item"
					onclick={() => onCreateSession(shell.path)}
				>
					<span class="dropdown-item__name">{shell.name}</span>
					{#if shell.isDefault}
						<span class="default-badge">default</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.shell-dropdown-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		margin-left: var(--cds-spacing-02);
		padding-left: var(--cds-spacing-03);
		border-left: 1px solid var(--cds-border-subtle);
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--cds-text-secondary);
		cursor: pointer;
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}

	.toolbar-btn:hover {
		background: var(--cds-background);
		color: var(--cds-text-primary);
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 6px;
		padding: var(--cds-spacing-03);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		z-index: 1000;
		min-width: 140px;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--cds-spacing-04);
		width: 100%;
		padding: var(--cds-spacing-03) var(--cds-spacing-04);
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--cds-text-secondary);
		font-size: var(--cds-label-01-font-size);
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;
		white-space: nowrap;
	}

	.dropdown-item:hover {
		background: var(--cds-background);
		color: var(--cds-text-primary);
	}

	.dropdown-item__name {
		flex: 1;
	}

	.default-badge {
		font-size: 0.625rem;
		padding: 1px 4px;
		background: var(--cds-background);
		border-radius: 4px;
		color: var(--cds-text-helper);
	}
</style>
