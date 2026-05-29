<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { activeView } from '$lib/stores/dashboard/dashboard-store.svelte';

	import ToolViewWrapper from './ToolViewWrapper.svelte';

	interface Props {
		title: string;
	}

	let { title }: Props = $props();

	function goBack() {
		activeView.set('map');
	}
</script>

<ToolViewWrapper {title} onBack={goBack}>
	<div class="unavailable">
		<svg
			width="48"
			height="48"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
			<line x1="8" y1="21" x2="16" y2="21" />
			<line x1="12" y1="17" x2="12" y2="21" />
		</svg>
		<h3>{title}</h3>
		<p>This tool's built-in interface is not available.</p>
		<p class="hint">Use the terminal to interact with this tool directly.</p>
	</div>
</ToolViewWrapper>

<style>
	.unavailable {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: var(--space-3);
		color: var(--cds-text-helper);
		text-align: center;
		padding: var(--space-6);
	}

	.unavailable svg {
		opacity: 0.3;
	}

	.unavailable h3 {
		margin: 0;
		font-size: var(--cds-body-compact-01-font-size);
		color: var(--cds-text-secondary);
		font-weight: 600;
	}

	.unavailable p {
		margin: 0;
		font-size: var(--cds-label-01-font-size);
		line-height: 1.5;
		max-width: 360px;
	}

	.hint {
		font-size: 0.6875rem;
		opacity: 0.7;
	}
</style>
