<script lang="ts">
	import { Tag } from 'carbon-components-svelte';

	interface ActivityStatus {
		hasActivity: boolean;
		packetCount: number;
		recentIMSI: boolean;
		currentFrequency: string;
		message: string;
	}

	let {
		gsmFrames = [],
		activityStatus
	}: {
		gsmFrames: string[];
		activityStatus: ActivityStatus;
	} = $props();
</script>

<div class="frames-card">
	<div class="frames-head">
		<h4 class="frames-title">
			<span class="frames-title-accent">Live</span> Frames
		</h4>
		<div class="frames-meta">
			{#if activityStatus.packetCount > 0}
				<span>{activityStatus.packetCount} pkts/s</span>
			{/if}
			<Tag type="outline" size="sm" class="freq-tag">
				{activityStatus.currentFrequency} MHz
			</Tag>
			<span class="frames-count">{gsmFrames.length} frames</span>
		</div>
	</div>

	<div class="live-frames-console">
		{#if gsmFrames.length > 0}
			{#each gsmFrames as frame, i (i)}
				<div class="frame-line" class:frame-latest={i === gsmFrames.length - 1}>
					{frame}
				</div>
			{/each}
		{:else}
			<div class="frames-empty">
				<p>Waiting for GSM frames...</p>
				<p class="frames-empty-sub">
					Listening on {activityStatus.currentFrequency} MHz
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.frames-card {
		margin: 0.5rem 1rem 0;
		border: 1px solid var(--cds-border-subtle);
		border-radius: 0.5rem;
		background: var(--cds-layer);
		color: var(--cds-text-primary);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.frames-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--cds-border-subtle);
	}

	.frames-title {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		margin: 0;
	}

	.frames-title-accent {
		color: var(--cds-support-error);
	}

	.frames-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--cds-text-helper);
	}

	.frames-meta :global(.freq-tag) {
		font-family: var(--cds-code-01-font-family);
		font-size: 0.625rem;
	}

	.frames-count {
		font-family: var(--cds-code-01-font-family);
	}

	.live-frames-console {
		max-height: calc(100vh - 350px);
		min-height: 400px;
		overflow-y: auto;
		padding: 0.75rem;
		font-family: var(--cds-code-01-font-family);
		font-size: 0.75rem;
		background: var(--cds-background);
	}

	.frame-line {
		margin-bottom: 0.125rem;
		white-space: pre-wrap;
		word-break: break-all;
		color: var(--cds-text-helper);
	}

	.frame-latest {
		color: var(--cds-link-primary);
		font-weight: 500;
	}

	.frames-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 8rem;
		gap: 0.5rem;
		color: var(--cds-text-helper);
	}

	.frames-empty-sub {
		font-size: 0.625rem;
		opacity: 0.7;
	}
</style>
