<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Button pattern extraction deferred to component library refactor -->
<script lang="ts">
	import Document from 'carbon-icons-svelte/lib/Document.svelte';
	import Flash from 'carbon-icons-svelte/lib/Flash.svelte';
	import Home from 'carbon-icons-svelte/lib/Home.svelte';
	import List from 'carbon-icons-svelte/lib/List.svelte';
	import Map from 'carbon-icons-svelte/lib/Map.svelte';
	import Radar from 'carbon-icons-svelte/lib/Radar.svelte';
	import RadioPushToTalk from 'carbon-icons-svelte/lib/RadioPushToTalk.svelte';
	import Roadmap from 'carbon-icons-svelte/lib/Roadmap.svelte';
	import Satellite from 'carbon-icons-svelte/lib/Satellite.svelte';
	import Settings from 'carbon-icons-svelte/lib/Settings.svelte';

	import {
		activeBottomTab,
		activePanel,
		activeView,
		toggleBottomTab,
		togglePanel
	} from '$lib/stores/dashboard/dashboard-store.svelte';
	import { themeStore } from '$lib/stores/theme-store.svelte';

	const VIEW_TOGGLE_IDS = new Set(['webtak', 'uas-scan', 'gnss-sdr']);

	function handleClick(id: string) {
		if (id === 'dashboard') toggleBottomTab('dashboard');
		else if (VIEW_TOGGLE_IDS.has(id)) toggleView(id);
		else togglePanel(id);
	}

	function toggleView(id: string) {
		activeView.set(activeView.current === id ? 'map' : (id as never));
		activePanel.set(null);
	}
</script>

<nav class="icon-rail" data-position={themeStore.railPosition} aria-label="Dashboard navigation">
	<div class="rail-top">
		<!-- Overview (house) -->
		<button
			class="rail-btn"
			class:active={activePanel.current === 'overview'}
			title="Overview"
			aria-label="Overview"
			aria-pressed={activePanel.current === 'overview'}
			onclick={() => handleClick('overview')}
		>
			<Home size={20} />
		</button>
		<!-- Dashboard (list) -->
		<button
			class="rail-btn"
			class:active={activeBottomTab.current === 'dashboard'}
			title="Dashboard"
			aria-label="Dashboard"
			aria-pressed={activeBottomTab.current === 'dashboard'}
			onclick={() => handleClick('dashboard')}
		>
			<List size={20} />
		</button>
		<!-- Tools (zap) -->
		<button
			class="rail-btn"
			class:active={activePanel.current === 'tools'}
			title="Tools"
			aria-label="Tools"
			aria-pressed={activePanel.current === 'tools'}
			onclick={() => handleClick('tools')}
		>
			<Flash size={20} />
		</button>
		<!-- Reports -->
		<button
			class="rail-btn"
			class:active={activePanel.current === 'reports'}
			title="Reports"
			aria-label="Reports"
			aria-pressed={activePanel.current === 'reports'}
			onclick={() => handleClick('reports')}
		>
			<Document size={20} />
		</button>
	</div>

	<div class="rail-spacer"></div>

	<div class="rail-bottom">
		<!-- WebTAK -->
		<button
			class="rail-btn"
			class:active={activeView.current === 'webtak'}
			title="WebTAK"
			aria-label="WebTAK"
			aria-pressed={activeView.current === 'webtak'}
			onclick={() => handleClick('webtak')}
		>
			<Radar size={20} />
		</button>
		<!-- UAS Scan (live log terminal view) -->
		<button
			class="rail-btn"
			class:active={activeView.current === 'uas-scan'}
			title="UAS Scan — Live Log"
			aria-label="UAS Scan"
			aria-pressed={activeView.current === 'uas-scan'}
			onclick={() => handleClick('uas-scan')}
		>
			<RadioPushToTalk size={20} />
		</button>
		<!-- GNSS-SDR (software GNSS receiver + RTKLIB sky-plot / nav iframe) -->
		<button
			class="rail-btn"
			class:active={activeView.current === 'gnss-sdr'}
			title="GNSS-SDR — Software GPS Receiver"
			aria-label="GNSS-SDR"
			aria-pressed={activeView.current === 'gnss-sdr'}
			onclick={() => handleClick('gnss-sdr')}
		>
			<Satellite size={20} />
		</button>
		<!-- Logo (waypoints) — brand mark, always white -->
		<button
			class="rail-btn rail-logo"
			title="Argos"
			aria-label="Argos"
			onclick={() => handleClick('overview')}
		>
			<Roadmap size={20} />
		</button>
		<!-- Map Settings -->
		<button
			class="rail-btn"
			class:active={activePanel.current === 'map-settings'}
			title="Map Settings"
			aria-label="Map Settings"
			aria-pressed={activePanel.current === 'map-settings'}
			onclick={() => handleClick('map-settings')}
		>
			<Map size={20} />
		</button>
		<!-- Separator -->
		<div class="rail-separator"></div>
		<!-- Settings -->
		<button
			class="rail-btn"
			class:active={activePanel.current === 'settings'}
			title="Settings"
			aria-label="Settings"
			aria-pressed={activePanel.current === 'settings'}
			onclick={() => handleClick('settings')}
		>
			<Settings size={20} />
		</button>
	</div>
</nav>

<style>
	@import './icon-rail.css';

	.icon-rail {
		width: var(--icon-rail-width);
		min-width: var(--icon-rail-width);
		flex-shrink: 0;
		background: var(--cds-background);
		border-right: 1px solid var(--cds-border-subtle);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 10px 0;
		position: relative;
		z-index: 10;
	}

	.rail-top {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.rail-spacer {
		flex: 1;
	}

	.rail-bottom {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.rail-btn {
		width: 48px;
		/* WCAG 2.5.5 minimum tap target — 44×44. Width already 48, height was 32; bumped to 44. */
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--cds-text-secondary);
		cursor: pointer;
		border-radius: 4px;
		position: relative;
		padding: 0;
		margin: 0;
		outline: none;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.rail-btn:hover {
		background-color: var(--cds-layer-hover);
		color: var(--cds-text-helper);
	}

	.rail-btn.active {
		color: var(--cds-link-primary);
		background-color: color-mix(in srgb, var(--cds-text-primary) 8%, transparent);
	}

	/* Logo icon — always foreground, no active state */
	.rail-logo {
		color: var(--cds-text-primary);
	}

	.rail-logo:hover {
		color: var(--cds-text-primary);
	}

	/* Separator line between Layers and Settings */
	.rail-separator {
		width: 24px;
		height: 1px;
		background: color-mix(in srgb, var(--cds-text-primary) 10%, transparent);
		margin: 2px 0;
	}
</style>
