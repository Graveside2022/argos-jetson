<!--
  Bottom panel tab bar for the dashboard.
  Tab order: Terminal (+), Chat, Logs, IMSI Captures, Dashboard.
  Always visible — chevron toggles collapse/expand (panel never fully disappears).
-->
<script lang="ts">
	import Add from 'carbon-icons-svelte/lib/Add.svelte';
	import ChevronDown from 'carbon-icons-svelte/lib/ChevronDown.svelte';
	import Terminal from 'carbon-icons-svelte/lib/Terminal.svelte';
	import { onMount } from 'svelte';

	import {
		activeBottomTab,
		closeBottomPanel,
		isBottomPanelOpen
	} from '$lib/stores/dashboard/dashboard-store.svelte';
	import { createSession } from '$lib/stores/dashboard/terminal-store.svelte';
	import type { ShellInfo } from '$lib/types/terminal';
	import { fetchJSON } from '$lib/utils/fetch-json';

	interface Props {
		activeTab: string | null;
	}

	let { activeTab }: Props = $props();

	type TabId = 'terminal' | 'chat' | 'logs' | 'captures' | 'dashboard' | 'bluetooth' | 'uas';

	// Only the Terminal tab carries an icon (the Carbon Terminal glyph); others are text-only
	const tabs: { id: TabId; label: string }[] = [
		{ id: 'terminal', label: 'Terminal' },
		{ id: 'chat', label: 'Chat' },
		{ id: 'logs', label: 'Logs' },
		{ id: 'captures', label: 'IMSI Captures' },
		{ id: 'dashboard', label: 'Wi-Fi' },
		{ id: 'bluetooth', label: 'Bluetooth' },
		{ id: 'uas', label: 'UAS' }
	];

	// Shell-picker state — mirrors TerminalShellDropdown so the tab-bar "+" offers
	// the same Tmux-0/1/2/3 choice as the in-panel "+". Fetched once on mount.
	let availableShells = $state<ShellInfo[]>([]);
	let showShellDropdown = $state(false);

	onMount(async () => {
		try {
			const data = await fetchJSON<{ shells: ShellInfo[] }>('/api/terminal/shells');
			availableShells = data?.shells ?? [];
		} catch {
			/* keep dropdown empty on fetch fail; user can still use in-panel "+" */
		}
	});

	function pickShell(shellPath?: string) {
		activeBottomTab.set('terminal');
		createSession(shellPath);
		showShellDropdown = false;
	}

	// Toggle: if panel is open, collapse it; if collapsed, reopen to terminal tab
	function toggleCollapse() {
		if (isBottomPanelOpen.current) {
			closeBottomPanel();
		} else {
			activeBottomTab.set('terminal');
		}
	}
</script>

<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Tab buttons use custom styling tightly coupled to panel layout; shadcn Tabs component incompatible with split tab-bar/panel-content architecture -->
<div class="bottom-panel-tabs">
	<div class="tab-list">
		{#each tabs as tab (tab.id)}
			<button
				class="panel-tab"
				class:active={activeTab === tab.id}
				onclick={() => activeBottomTab.set(tab.id)}
			>
				{#if tab.id === 'terminal'}
					<Terminal size={14} />
				{/if}
				{tab.label}
			</button>
			<!-- "+" new session button sits immediately after Terminal tab. Opens a
			     shell-picker dropdown (Tmux 0-3, /bin/zsh, etc.) — mirrors the
			     in-panel TerminalShellDropdown. -->
			{#if tab.id === 'terminal'}
				<div class="tab-new-wrapper">
					<button
						class="tab-new-btn"
						aria-label="New terminal session"
						title="New terminal session"
						aria-haspopup="menu"
						aria-expanded={showShellDropdown}
						onclick={() => (showShellDropdown = !showShellDropdown)}
					>
						<Add size={12} />
					</button>
					{#if showShellDropdown}
						<div class="shell-dropdown-menu" role="menu">
							{#if availableShells.length === 0}
								<button
									type="button"
									class="dropdown-item"
									role="menuitem"
									onclick={() => pickShell()}
								>
									<span class="dropdown-item__name">Default shell</span>
								</button>
							{:else}
								{#each availableShells as shell (shell.path)}
									<button
										type="button"
										class="dropdown-item"
										role="menuitem"
										onclick={() => pickShell(shell.path)}
									>
										<span class="dropdown-item__name">{shell.name}</span>
										{#if shell.isDefault}
											<span class="default-badge">default</span>
										{/if}
									</button>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>

	<!-- Flex spacer pushes collapse caret to far right -->
	<div class="tab-spacer"></div>

	<!-- Collapse/expand toggle — shows ▼ when open, ▲ when collapsed -->
	<button
		class="tab-collapse-btn"
		class:collapsed={!isBottomPanelOpen.current}
		aria-label={isBottomPanelOpen.current ? 'Collapse panel' : 'Expand panel'}
		title={isBottomPanelOpen.current ? 'Collapse panel' : 'Expand panel'}
		onclick={toggleCollapse}
	>
		<!-- Chevron-down by default; CSS rotates 180° when collapsed to show chevron-up -->
		<ChevronDown size={14} />
	</button>
</div>

<style>
	.bottom-panel-tabs {
		display: flex;
		align-items: center;
		height: 40px;
		min-height: 40px;
		background: var(--cds-background);
		border-bottom: 1px solid var(--cds-border-subtle);
		padding: 4px 12px;
		gap: 4px;
	}

	.tab-spacer {
		flex: 1;
	}

	.tab-new-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.tab-new-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: transparent;
		border: none;
		color: var(--cds-text-helper);
		cursor: pointer;
		border-radius: 4px;
		flex-shrink: 0;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.tab-new-btn:hover {
		background: var(--cds-layer-hover);
		color: var(--cds-text-secondary);
	}

	.shell-dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 6px;
		padding: 4px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		z-index: 1000;
		min-width: 160px;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		padding: 6px 10px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--cds-text-helper);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;
		white-space: nowrap;
	}

	.dropdown-item:hover {
		background: var(--cds-layer-hover);
		color: var(--cds-text-primary);
	}

	.dropdown-item__name {
		flex: 1;
	}

	.default-badge {
		font-size: 10px;
		padding: 1px 4px;
		background: var(--cds-layer-hover);
		border-radius: 4px;
		color: var(--cds-text-helper);
	}

	.tab-list {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 100%;
	}

	.panel-tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 100%;
		box-sizing: border-box;
		padding: 6px 12px;
		margin: 0;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--cds-text-helper);
		font-size: 14px;
		font-weight: 500;
		line-height: 1;
		font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
		cursor: pointer;
		white-space: nowrap;
		transition:
			color 0.1s,
			background 0.1s;
	}

	.panel-tab:hover {
		color: var(--cds-text-secondary);
		background: var(--cds-layer-hover);
	}

	.panel-tab.active {
		color: var(--cds-link-primary);
		border-bottom-color: var(--cds-link-primary);
		padding: 6px 12px 4px 12px;
	}

	.panel-tab svg {
		display: block;
		flex-shrink: 0;
	}

	.tab-collapse-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: transparent;
		border: none;
		color: var(--cds-text-helper);
		cursor: pointer;
		border-radius: 4px;
		transition:
			background 0.1s,
			color 0.1s,
			transform 0.2s ease;
	}

	/* Rotate chevron 180° when panel is collapsed → shows ▲ (pointing up) */
	.tab-collapse-btn.collapsed {
		transform: rotate(180deg);
	}

	.tab-collapse-btn:hover {
		background: var(--cds-layer-hover);
		color: var(--cds-text-secondary);
	}
</style>
