<!-- Terminal toolbar: right-side action buttons for TerminalPanel -->
<script lang="ts">
	import Close from 'carbon-icons-svelte/lib/Close.svelte';
	import DocumentView from 'carbon-icons-svelte/lib/DocumentView.svelte';
	import Maximize from 'carbon-icons-svelte/lib/Maximize.svelte';
	import Minimize from 'carbon-icons-svelte/lib/Minimize.svelte';
	import OverflowMenuVertical from 'carbon-icons-svelte/lib/OverflowMenuVertical.svelte';
	import Screen from 'carbon-icons-svelte/lib/Screen.svelte';
	import SplitScreen from 'carbon-icons-svelte/lib/SplitScreen.svelte';

	import {
		closeTerminalPanel,
		terminalPanelState,
		toggleMaximize,
		unsplit
	} from '$lib/stores/dashboard/terminal-store.svelte';

	interface Props {
		showMoreMenu: boolean;
		onSplit: (e: MouseEvent) => void;
		onCreateSession: (shell?: string) => void;
		onToggleMoreMenu: () => void;
		onCloseActiveSession: () => void;
	}

	let { showMoreMenu, onSplit, onCreateSession, onToggleMoreMenu, onCloseActiveSession }: Props =
		$props();
</script>

<div class="toolbar-right">
	<!-- Split/Unsplit button -->
	{#if terminalPanelState.current.splits}
		<button
			class="toolbar-btn"
			aria-label="Unsplit terminal"
			title="Unsplit terminal"
			onclick={() => unsplit()}
		>
			<Screen size={14} />
		</button>
	{:else}
		<button
			class="toolbar-btn split-btn"
			aria-label="Split terminal"
			title="Split terminal"
			onclick={onSplit}
		>
			<SplitScreen size={14} />
		</button>
	{/if}

	<!-- More menu -->
	<div class="more-menu-wrapper">
		<button class="toolbar-btn" aria-label="More actions" onclick={onToggleMoreMenu}>
			<OverflowMenuVertical size={14} />
		</button>

		{#if showMoreMenu}
			<div class="dropdown-menu more-menu">
				<button class="dropdown-item" onclick={() => onToggleMoreMenu()}> Clear </button>
				{#if terminalPanelState.current.splits}
					<button
						class="dropdown-item"
						onclick={() => {
							unsplit();
							onToggleMoreMenu();
						}}
					>
						Unsplit
					</button>
				{:else}
					<button class="dropdown-item" onclick={onSplit}> Split Right </button>
				{/if}
				<div class="dropdown-divider"></div>
				<button class="dropdown-item danger" onclick={onCloseActiveSession}>
					Kill Terminal
				</button>
			</div>
		{/if}
	</div>

	<!-- Maximize/restore button -->
	<button
		class="toolbar-btn"
		aria-label={terminalPanelState.current.isMaximized ? 'Restore panel' : 'Maximize panel'}
		title={terminalPanelState.current.isMaximized ? 'Restore panel' : 'Maximize panel'}
		onclick={toggleMaximize}
	>
		{#if terminalPanelState.current.isMaximized}
			<Minimize size={14} />
		{:else}
			<Maximize size={14} />
		{/if}
	</button>

	<!-- System logs button -->
	<button
		class="toolbar-btn"
		aria-label="View system logs"
		title="View system logs"
		onclick={() => onCreateSession('scripts/tmux/tmux-logs.sh')}
	>
		<DocumentView size={14} />
	</button>

	<!-- Close panel button -->
	<button
		class="toolbar-btn"
		aria-label="Close panel"
		title="Close panel"
		onclick={closeTerminalPanel}
	>
		<Close size={14} />
	</button>
</div>

<style>
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex-shrink: 0;
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
		border-radius: var(--radius-sm);
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

	.more-menu-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: var(--radius-md);
		padding: var(--space-2);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		z-index: 1000;
		min-width: 140px;
	}

	.more-menu {
		right: 0;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
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

	.dropdown-item.danger:hover {
		background: color-mix(in srgb, var(--cds-support-error) 10%, transparent);
		color: var(--cds-support-error);
	}

	.dropdown-divider {
		height: 1px;
		background: var(--cds-border-subtle);
		margin: var(--space-1) 0;
	}
</style>
