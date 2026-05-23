<!--
  Bottom panel tab bar for the dashboard.
  Tab order: Terminal (+), Chat, Logs, IMSI Captures, Dashboard.
  Always visible — chevron toggles collapse/expand (panel never fully disappears).
-->
<script lang="ts">
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

	// Lucide path data for tab icons — only Terminal keeps the >_ icon; others are text-only
	const tabs: { id: TabId; label: string; icon: string | null }[] = [
		{ id: 'terminal', label: 'Terminal', icon: 'M4 17l6-6-6-6M12 19h8' },
		{ id: 'chat', label: 'Chat', icon: null },
		{ id: 'logs', label: 'Logs', icon: null },
		{ id: 'captures', label: 'IMSI Captures', icon: null },
		{ id: 'dashboard', label: 'Wi-Fi', icon: null },
		{ id: 'bluetooth', label: 'Bluetooth', icon: null },
		{ id: 'uas', label: 'UAS', icon: null }
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
				{#if tab.icon}
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d={tab.icon} />
					</svg>
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
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="12" y1="5" x2="12" y2="19" /><line
								x1="5"
								y1="12"
								x2="19"
								y2="12"
							/>
						</svg>
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
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<!-- Chevron-down by default; CSS rotates 180° when collapsed to show chevron-up -->
			<polyline points="6 9 12 15 18 9" />
		</svg>
	</button>
</div>

<style>
	.bottom-panel-tabs {
		display: flex;
		align-items: center;
		height: 40px;
		min-height: 40px;
		background: var(--background);
		border-bottom: 1px solid var(--border);
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
		color: var(--muted-foreground);
		cursor: pointer;
		border-radius: 4px;
		flex-shrink: 0;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.tab-new-btn:hover {
		background: var(--surface-hover);
		color: var(--foreground-muted);
	}

	.shell-dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		background: var(--card, #1a1a1a);
		border: 1px solid var(--border);
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
		color: var(--muted-foreground);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;
		white-space: nowrap;
	}

	.dropdown-item:hover {
		background: var(--surface-hover);
		color: var(--foreground);
	}

	.dropdown-item__name {
		flex: 1;
	}

	.default-badge {
		font-size: 10px;
		padding: 1px 4px;
		background: var(--surface-hover);
		border-radius: 4px;
		color: var(--muted-foreground);
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
		color: var(--muted-foreground);
		font-size: 14px;
		font-weight: 500;
		line-height: 1;
		font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
		cursor: pointer;
		white-space: nowrap;
		transition:
			color 0.1s,
			background 0.1s;
	}

	.panel-tab:hover {
		color: var(--foreground-muted);
		background: var(--surface-hover);
	}

	.panel-tab.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
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
		color: var(--muted-foreground);
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
		background: var(--surface-hover);
		color: var(--foreground-muted);
	}
</style>
